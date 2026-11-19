package com.pistache.sprintops_backend.service.chatbot;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import com.pistache.sprintops_backend.dto.chatbot.ChatbotHistoryTurn;
import com.pistache.sprintops_backend.dto.chatbot.ChatbotMessageRequest;
import com.pistache.sprintops_backend.model.AiPropuesta;
import com.pistache.sprintops_backend.model.InfoUsuarioEquipo.InfoUsuarioEquipoId;
import com.pistache.sprintops_backend.model.Proyecto;
import com.pistache.sprintops_backend.model.Sprint;
import com.pistache.sprintops_backend.model.Usuario;
import com.pistache.sprintops_backend.repository.InfoUsuarioEquipoRepository;
import com.pistache.sprintops_backend.repository.SprintRepository;
import com.pistache.sprintops_backend.service.AiCreditService;
import com.pistache.sprintops_backend.service.AiObserveService;
import com.pistache.sprintops_backend.service.AiPreferenceService;
import com.pistache.sprintops_backend.service.ProyectoService;
import com.pistache.sprintops_backend.service.UsuarioService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ChatbotOrchestrationService {

    private static final int MAX_TOOL_ROUNDS = 8;

    /** Evita que una herramienta devuelva texto enorme y dispare el TPM de Groq en la siguiente ronda. */
    private static final int MAX_TOOL_MESSAGE_CHARS = 12_000;

    /** Solo los últimos turnos entran al modelo (cada turno suma tokens en cada ronda de herramientas). */
    private static final int MAX_HISTORY_TURNS = 20;

    /**
     * Si el modelo ya pidió solo mutaciones concretas y la respuesta de herramienta es clara,
     * devolvemos eso al usuario sin una segunda llamada a Groq (ahorra TPM y evita 429 tras éxito en BD).
     */
    private static final Set<String> MUTATION_TOOLS_OK_WITHOUT_LLM_FOLLOW_UP = Set.of(
            "set_issue_status",
            "set_issue_status_by_title",
            "set_issue_assignees",
            "assign_issue_by_title",
            "move_issue_to_next_sprint",
            "create_issue",
            "update_issue_fields",
            "save_my_daily_standup",
            "create_project_note",
            "create_project_document",
            "append_document_section",
            "replace_document_section",
            "add_document_table",
            "save_retro_item"
    );

    private static final String HELP = """
            Comandos rápidos (también puedes escribir en lenguaje natural):
            /start /inicio — mensaje de bienvenida
            /help /ayuda — esta ayuda
            
            Consultas (el asistente usa herramientas según tu rol):
            • Issues asignados a ti, por sprint, detalle, historial, tu progreso
            • Métricas por sprint (si tienes canViewMetrics)
            • Daily: el tuyo o del equipo por fecha; retrospectivas guardadas en servidor
            
            Acciones: crear/editar issues, asignar por título o por id de issue, cambiar estado (in_progress/done), mover entre sprints, daily de hoy, papelera, sprints, proyecto, roles, unirse por código, crear proyecto.
            La reflexión + health check del sprint siguen en la pantalla Reflexión de la app (almacenamiento local).
            
            Todas las operaciones respetan el proyecto abierto y tus permisos en ese proyecto.
            """;

    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private GroqChatClient groqChatClient;
    @Autowired
    private ChatbotToolExecutor toolExecutor;
    @Autowired
    private ProyectoService proyectoService;
    @Autowired
    private UsuarioService usuarioService;
    @Autowired
    private InfoUsuarioEquipoRepository infoUsuarioEquipoRepository;
    @Autowired
    private SprintRepository sprintRepository;
    @Autowired
    private ProjectContextRetriever contextRetriever;
    @Autowired
    private AiCreditService creditService;
    @Autowired
    private AiCreditTariff creditTariff;
    @Autowired
    private AiObserveService observeService;
    @Autowired
    private AiPreferenceService preferenceService;
    @Autowired
    private AiAuthorizationService authorizationService;

    public boolean isProjectMember(Integer userId, Integer projectId) {
        if (userId == null || projectId == null) {
            return false;
        }
        Optional<Proyecto> opt = proyectoService.findById(projectId);
        if (opt.isEmpty() || opt.get().getEquipo() == null) {
            return false;
        }
        int equipoId = opt.get().getEquipo().getIdEquipo();
        return infoUsuarioEquipoRepository.findById(new InfoUsuarioEquipoId(equipoId, userId)).isPresent();
    }

    public String handle(ChatbotMessageRequest req) throws Exception {
        long started = System.nanoTime();
        if (!groqChatClient.isConfigured()) {
            return "El asistente no está configurado: define la variable de entorno GROQ_API_KEY en el servidor "
                    + "(o groq.api.key en application.properties) y reinicia el backend.";
        }

        Integer projectId = req.getProjectId();
        Integer userId = req.getUserId();
        String userMessage = req.getMessage() != null ? req.getMessage().trim() : "";
        if (userMessage.isEmpty()) {
            return "Escribe un mensaje o un comando (por ejemplo /ayuda).";
        }

        String lower = userMessage.toLowerCase();
        if (lower.equals("/help") || lower.equals("/ayuda")) {
            return HELP;
        }
        if (lower.equals("/start") || lower.equals("/inicio")) {
            return "¡Hola! Soy Dash (Oracle SprintOps). Estoy conectado al proyecto actual: puedes preguntar por issues, "
                    + "daily meetings, métricas (si tienes permiso) o pedir acciones como crear un issue. Escribe /ayuda para la lista de temas.";
        }

        Optional<Proyecto> optP = proyectoService.findById(projectId);
        if (optP.isEmpty()) {
            return "Proyecto no encontrado.";
        }
        Proyecto proyecto = optP.get();
        String userLabel = usuarioService.findById(userId)
                .map(Usuario::getNombreUsuario)
                .orElse("usuario " + userId);

        preferenceService.ensure(userId);
        String blocked = blockIfNeeded(projectId, userId, userMessage, null);
        if (blocked != null) {
            return blocked;
        }

        List<Sprint> sprints = sprintRepository.findByProyectoIdProyecto(projectId);

        String fastAssigned = tryFastPathAssignedIssuesInSprint(userMessage, projectId, userId, sprints);
        if (fastAssigned != null && !planning(req)) {
            settle(req, userMessage, List.of("list_my_assigned_issues_in_sprint"), 0, 0, null, started);
            return fastAssigned;
        }

        String retrieved = contextRetriever.focus(projectId, userId, userMessage);
        if (retrieved == null) retrieved = contextRetriever.retrieve(projectId, userId, userMessage);
        String system = """
                Eres Dash, asistente de Oracle SprintOps.
                %s
                %s
                %s
                Solo puedes usar herramientas que operan sobre este proyecto (salvo crear_new_project o join_project_by_invite_code).
                Si el usuario no tiene permiso, explica qué permiso hace falta (nombres exactos: canViewMetrics, canCreateIssue, canEditIssue, canCreateSprint, canManageMembers, canEditProjectDates, canViewAllIssues, canViewOnlyOwnIssues).
                Para fechas en daily usa yyyy-MM-dd. Estados de issue (inglés en herramientas): todo, in_progress, done, blocked.
                Si preguntan qué tienen asignado en un sprint concreto, usa list_my_assigned_issues_in_sprint con sprint_id (list_project_sprints para ids).
                Nunca inventes issue_id ni uses marcadores como <issue_id>: el id es un número devuelto por find_issues o list_sprint_issues.
                Asignar por título (ej. «Prueba de issue-sprint» en sprint 1 a axel): prefer assign_issue_by_title con title_contains, sprint_id si lo sabes y assignee_usernames ["axel"]. Alternativa: find_issues y luego set_issue_assignees con ese issue_id entero.
                Cambiar estado por título (una frase): set_issue_status_by_title con title_contains, status (todo/in_progress/done/blocked) y sprint_id opcional. Con issue_id numérico: set_issue_status. Alternativa: find_issues y set_issue_status.
                Mover issue a otro sprint: move_issue_to_next_sprint (issue_id, from_sprint_id, to_sprint_id); usa list_project_sprints para ids de sprint.
                Si preguntan por "qué dijo X en el daily", usa team_daily_standup con date_iso y username_contains.
                Para una búsqueda acotada usa search_project_context. Documentos: list_project_documents. Notas: list_project_notes. Equipo: list_project_team. Reuniones: list_project_meetings.
                Si piden una propuesta, un plan o una recomendación, consulta y responde sin escribir.
                Si piden aplicar el cambio, usa solo una herramienta de esta lista. Tareas: create_issue, update_issue_fields (descripción, prioridad, story points, due_date yyyy-MM-dd, estimated_hours), set_issue_status, set_issue_assignees, move_issue_to_next_sprint. Sprints: create_sprint, update_sprint_fields. Retrospectiva: save_retro_item. Documentos: create_project_document, append_document_section, replace_document_section, add_document_table; para resumir usa summarize_project_document. Notas: create_project_note. Proyectos: create_new_project y update_project_fields. Bloqueos y tendencias: analyze_sprint_health. No escribas SQL ni un JSON de documento. Si una herramienta dice que el cambio está pendiente de autorización, no digas que ya se aplicó.
                No escribas tu razonamiento interno. Cuando cites un elemento real, enlázalo con un id devuelto por las herramientas:
                tarea [título](sprintops://issue/{sprintId}/{issueId}), sprint [nombre](sprintops://sprint/{sprintId}), documento [nombre](sprintops://documento/{documentoId}).
                """.formatted(preferenceService.style(userId), AiToolGuard.DATA_RULE.strip(), scopeBlock(proyecto, projectId, userId, userLabel, retrieved))
                + modeNote(req);

        ArrayNode messages = objectMapper.createArrayNode();
        messages.add(objectMapper.createObjectNode()
                .put("role", "system")
                .put("content", system));
        appendConversation(messages, req);

        messages.add(objectMapper.createObjectNode()
                .put("role", "user")
                .put("content", userMessage));

        ArrayNode tools = toolsFor(req, userMessage);
        List<String> usedTools = new ArrayList<>();
        Set<String> executed = new HashSet<>();
        int[] usage = new int[2];
        String[] problem = new String[1];
        try {
        for (int round = 0; round < MAX_TOOL_ROUNDS; round++) {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("model", groqChatClient.getModel());
            body.put("temperature", 0.2);
            body.set("messages", messages);
            body.set("tools", tools);
            body.put("tool_choice", "auto");
            body.put("parallel_tool_calls", false);

            JsonNode resp = groqChatClient.chat(body);
            addUsage(resp, usage);
            JsonNode choice = resp.path("choices").path(0).path("message");
            JsonNode toolCalls = choice.get("tool_calls");
            String assistantContent = choice.path("content").isMissingNode() || choice.get("content").isNull()
                    ? ""
                    : choice.get("content").asText("");

            ObjectNode assistantMsg = objectMapper.createObjectNode();
            assistantMsg.put("role", "assistant");
            if (!assistantContent.isEmpty()) {
                assistantMsg.put("content", assistantContent);
            } else {
                assistantMsg.putNull("content");
            }
            if (toolCalls != null && toolCalls.isArray() && !toolCalls.isEmpty()) {
                assistantMsg.set("tool_calls", toolCalls);
            }
            messages.add(assistantMsg);

            if (toolCalls == null || !toolCalls.isArray() || toolCalls.isEmpty()) {
                return assistantContent.isEmpty()
                        ? "Listo."
                        : assistantContent;
            }

            List<String> batchToolNames = new ArrayList<>();
            List<String> batchToolResults = new ArrayList<>();
            runTools(messages, toolCalls, projectId, userId, req, null, batchToolNames, batchToolResults, executed, projectLabel(proyecto));
            usedTools.addAll(batchToolNames);
            String shortcut = maybeUserVisibleReplyWithoutGroq(batchToolNames, batchToolResults);
            if (shortcut != null) {
                return shortcut;
            }
        }

        return "La conversación requirió demasiadas herramientas seguidas; simplifica la petición o hazla por pasos.";
        } catch (Exception ex) {
            problem[0] = ex instanceof AiStreamCancelled ? "interrumpido" : ex.getMessage();
            throw ex;
        } finally {
            settle(req, userMessage, usedTools, usage[0], usage[1], problem[0], started);
        }
    }

    public void streamReply(ChatbotMessageRequest req, AiStreamListener listener) throws Exception {
        long started = System.nanoTime();
        if (listener.isCancelled()) {
            throw new AiStreamCancelled();
        }
        if (!groqChatClient.isConfigured()) {
            listener.delta("El asistente no está configurado: define la variable de entorno GROQ_API_KEY en el servidor "
                    + "(o groq.api.key en application.properties) y reinicia el backend.");
            return;
        }
        Integer projectId = req.getProjectId();
        Integer userId = req.getUserId();
        String userMessage = req.getMessage() != null ? req.getMessage().trim() : "";
        if (userMessage.isEmpty()) {
            listener.delta("Escribe un mensaje.");
            return;
        }
        String lower = userMessage.toLowerCase();
        if (lower.equals("/help") || lower.equals("/ayuda")) {
            listener.delta(HELP);
            return;
        }
        if (lower.equals("/start") || lower.equals("/inicio")) {
            listener.delta("¡Hola! Soy SprintOps AI. Puedo consultar este proyecto y responder con lo que tienes permiso de ver.");
            return;
        }
        Optional<Proyecto> optP = proyectoService.findById(projectId);
        if (optP.isEmpty()) {
            listener.delta("Proyecto no encontrado.");
            return;
        }
        Proyecto proyecto = optP.get();
        String userLabel = usuarioService.findById(userId)
                .map(Usuario::getNombreUsuario)
                .orElse("usuario " + userId);
        preferenceService.ensure(userId);
        String blocked = blockIfNeeded(projectId, userId, userMessage, listener);
        if (blocked != null) {
            listener.delta(blocked);
            return;
        }
        List<Sprint> sprints = sprintRepository.findByProyectoIdProyecto(projectId);
        String fastAssigned = tryFastPathAssignedIssuesInSprint(userMessage, projectId, userId, sprints);
        if (fastAssigned != null && !planning(req)) {
            settle(req, userMessage, List.of("list_my_assigned_issues_in_sprint"), 0, 0, null, started);
            listener.status("Consultando tareas…");
            listener.delta(fastAssigned);
            List<Map<String, Object>> sources = AiSources.choose(fastAssigned, List.of(fastAssigned), "");
            if (!sources.isEmpty()) listener.sources(sources);
            return;
        }

        String retrieved = contextRetriever.focus(projectId, userId, userMessage);
        if (retrieved == null) retrieved = contextRetriever.retrieve(projectId, userId, userMessage);
        List<String> observed = new ArrayList<>();
        StringBuilder answer = new StringBuilder();
        String system = """
                Eres SprintOps AI, asistente del proyecto.
                %s
                %s
                %s
                Solo puedes usar herramientas que operan sobre este proyecto (salvo crear_new_project o join_project_by_invite_code).
                Si el usuario no tiene permiso, explica qué permiso hace falta (nombres exactos: canViewMetrics, canCreateIssue, canEditIssue, canCreateSprint, canManageMembers, canEditProjectDates, canViewAllIssues, canViewOnlyOwnIssues).
                Para fechas en daily usa yyyy-MM-dd. Estados de issue (inglés en herramientas): todo, in_progress, done, blocked.
                Si preguntan qué tienen asignado en un sprint concreto, usa list_my_assigned_issues_in_sprint con sprint_id (list_project_sprints para ids).
                Nunca inventes issue_id ni uses marcadores como <issue_id>: el id es un número devuelto por find_issues o list_sprint_issues.
                Para una búsqueda acotada usa search_project_context. Documentos: list_project_documents. Notas: list_project_notes. Equipo: list_project_team. Reuniones: list_project_meetings.
                Si piden una propuesta, un plan o una recomendación, consulta y responde sin escribir.
                Si piden aplicar el cambio, usa solo una herramienta de esta lista. Tareas: create_issue, update_issue_fields (descripción, prioridad, story points, due_date yyyy-MM-dd, estimated_hours), set_issue_status, set_issue_assignees, move_issue_to_next_sprint. Sprints: create_sprint, update_sprint_fields. Retrospectiva: save_retro_item. Documentos: create_project_document, append_document_section, replace_document_section, add_document_table; para resumir usa summarize_project_document. Notas: create_project_note. Proyectos: create_new_project y update_project_fields. Bloqueos y tendencias: analyze_sprint_health. No escribas SQL ni un JSON de documento. Si una herramienta dice que el cambio está pendiente de autorización, no digas que ya se aplicó.
                No escribas tu razonamiento interno. Cuando cites un elemento real, enlázalo con un id devuelto por las herramientas:
                tarea [título](sprintops://issue/{sprintId}/{issueId}), sprint [nombre](sprintops://sprint/{sprintId}), documento [nombre](sprintops://documento/{documentoId}).
                """.formatted(preferenceService.style(userId), AiToolGuard.DATA_RULE.strip(), scopeBlock(proyecto, projectId, userId, userLabel, retrieved))
                + modeNote(req);

        ArrayNode messages = objectMapper.createArrayNode();
        messages.add(objectMapper.createObjectNode().put("role", "system").put("content", system));
        appendConversation(messages, req);
        messages.add(objectMapper.createObjectNode().put("role", "user").put("content", userMessage));
        ArrayNode tools = toolsFor(req, userMessage);
        List<String> usedTools = new ArrayList<>();
        Set<String> executed = new HashSet<>();
        int[] usage = new int[2];
        String[] problem = new String[1];
        try {
        for (int round = 0; round < MAX_TOOL_ROUNDS; round++) {
            if (listener.isCancelled()) {
                throw new AiStreamCancelled();
            }
            listener.status("Pensando…");
            ObjectNode body = objectMapper.createObjectNode();
            body.put("model", groqChatClient.getModel());
            body.put("temperature", 0.2);
            body.set("messages", messages);
            body.set("tools", tools);
            body.put("tool_choice", "auto");
            body.put("parallel_tool_calls", false);
            StringBuilder roundText = new StringBuilder();
            int[] roundUsage = new int[2];
            ObjectNode assistantMsg = groqChatClient.streamRound(body, new GroqChatClient.GroqDeltaHandler() {
                @Override
                public void onContent(String text) {
                    roundText.append(text);
                    listener.delta(text);
                }

                @Override
                public void onToolName(String name) {
                    listener.status(statusForTool(name, false));
                }

                @Override
                public boolean isCancelled() {
                    return listener.isCancelled();
                }
            }, roundUsage);
            usage[0] += roundUsage[0];
            usage[1] += roundUsage[1];
            messages.add(assistantMsg);
            answer.append(roundText);
            JsonNode toolCalls = assistantMsg.get("tool_calls");
            if (toolCalls == null || !toolCalls.isArray() || toolCalls.isEmpty()) {
                if (roundText.isEmpty()) {
                    listener.delta("Listo.");
                    answer.append("Listo.");
                }
                return;
            }
            List<String> batchToolNames = new ArrayList<>();
            List<String> batchToolResults = new ArrayList<>();
            runTools(messages, toolCalls, projectId, userId, req, listener, batchToolNames, batchToolResults, executed, projectLabel(proyecto));
            usedTools.addAll(batchToolNames);
            observed.addAll(batchToolResults);
            String shortcut = maybeUserVisibleReplyWithoutGroq(batchToolNames, batchToolResults);
            if (shortcut != null && roundText.isEmpty()) {
                listener.delta(shortcut);
                answer.append(shortcut);
                return;
            }
            if (shortcut != null) {
                return;
            }
        }
        listener.delta("La conversación requirió demasiadas herramientas seguidas; simplifica la petición o hazla por pasos.");
        } catch (Exception ex) {
            problem[0] = ex instanceof AiStreamCancelled ? "interrumpido" : ex.getMessage();
            throw ex;
        } finally {
            settle(req, userMessage, usedTools, usage[0], usage[1], problem[0], started);
            if (planning(req) && problem[0] == null) {
                try {
                    Map<String, Object> plan = AiPlan.card(answer.toString());
                    if (plan != null) listener.action(plan);
                } catch (RuntimeException ignored) {
                    // el plan no debe impedir el cierre del turno
                }
            }
            try {
                List<Map<String, Object>> sources = AiSources.choose(answer.toString(), observed, retrieved);
                if (!sources.isEmpty()) listener.sources(sources);
            } catch (RuntimeException ignored) {
                // la conexión ya se cerró; el cobro de este turno queda hecho
            }
        }
    }

    private String blockIfNeeded(Integer projectId, Integer userId, String message, AiStreamListener listener) {
        String limited = observeService.limitMessage(userId, projectId);
        if (limited != null) {
            observeService.record(userId, projectId, null, 0, 0, 0, 0, List.of(), limited);
            return limited;
        }
        int estimate = creditTariff.estimate(message);
        if (creditService.available(projectId, userId) < estimate) {
            observeService.record(userId, projectId, null, 0, 0, 0, 0, List.of(), "sin créditos");
            if (listener != null) listener.notice(creditService.notice(userId));
            return AiCreditService.EXHAUSTED;
        }
        if (listener != null && creditTariff.costly(estimate)) listener.estimate(estimate);
        return null;
    }

    private void settle(ChatbotMessageRequest req, String message, List<String> tools, int promptTokens, int completionTokens, String error, long started) {
        String action = creditTariff.action(message, tools);
        int price = creditTariff.price(message, tools, promptTokens + completionTokens);
        String key = chargeKey(req);
        int charged = creditService.consume(req.getProjectId(), req.getUserId(), price, action, promptTokens, completionTokens, key);
        long duration = Math.max(0, (System.nanoTime() - started) / 1_000_000);
        observeService.record(req.getUserId(), req.getProjectId(), key, charged, promptTokens, completionTokens, duration, tools, error);
    }

    private static String chargeKey(ChatbotMessageRequest req) {
        String requestId = req.getRequestId() == null ? "" : req.getRequestId().trim();
        if (requestId.matches("[A-Za-z0-9._:-]{8,80}")) {
            return "solicitud:" + req.getUserId() + ":" + requestId;
        }
        if (req.getAssistantMessageId() != null) return "turno:" + req.getAssistantMessageId();
        return null;
    }

    private static void addUsage(JsonNode response, int[] usage) {
        JsonNode node = response.path("usage");
        if (node.isMissingNode() || node.isNull()) return;
        usage[0] += node.path("prompt_tokens").asInt(0);
        usage[1] += node.path("completion_tokens").asInt(0);
    }

    private void appendConversation(ArrayNode messages, ChatbotMessageRequest req) {
        if (req.getMemory() != null && !req.getMemory().isBlank()) {
            messages.add(objectMapper.createObjectNode()
                    .put("role", "system")
                    .put("content", "Memoria de esta conversación. Resume mensajes anteriores y no describe el estado actual del proyecto. "
                            + "Confirma los datos con las herramientas.\n" + req.getMemory().trim()));
        }
        if (req.getHistory() == null || req.getHistory().isEmpty()) return;
        List<ChatbotHistoryTurn> hist = req.getHistory();
        int from = Math.max(0, hist.size() - MAX_HISTORY_TURNS);
        for (int idx = from; idx < hist.size(); idx++) {
            ChatbotHistoryTurn turn = hist.get(idx);
            if (turn == null || turn.getRole() == null || turn.getContent() == null) continue;
            String role = turn.getRole().trim().toLowerCase();
            String content = turn.getContent().trim();
            if ((!role.equals("user") && !role.equals("assistant")) || content.isEmpty()) continue;
            if (content.length() > 700) content = content.substring(0, 700);
            messages.add(objectMapper.createObjectNode().put("role", role).put("content", content));
        }
    }

    private ArrayNode toolsFor(ChatbotMessageRequest req, String userMessage) {
        if (planning(req)) return ChatbotGroqToolDefinitions.readsOnly(objectMapper);
        return ChatbotGroqToolDefinitions.forUserMessage(objectMapper, userMessage);
    }

    private static boolean planning(ChatbotMessageRequest req) {
        return req != null && req.isPlan() && (req.getApprovedSteps() == null || req.getApprovedSteps().isEmpty());
    }

    private static String modeNote(ChatbotMessageRequest req) {
        if (req != null && req.getApprovedSteps() != null && !req.getApprovedSteps().isEmpty()) {
            StringBuilder steps = new StringBuilder("\n\nEl usuario aprobó este plan. Ejecútalo en este orden con las herramientas. No agregues pasos ni cambies el alcance:\n");
            int number = 1;
            for (String step : req.getApprovedSteps()) {
                if (step == null || step.isBlank() || number > 8) continue;
                String line = step.trim().replace('\n', ' ');
                if (line.length() > 240) line = line.substring(0, 240);
                steps.append(number++).append(". ").append(line).append('\n');
            }
            return steps.toString();
        }
        if (!planning(req)) return "";
        return """

                Modo planificación. No modifiques el proyecto y no uses herramientas de escritura.
                Puedes consultar con herramientas de lectura si falta un dato.
                Responde en español con un plan, sin decir que ya lo aplicaste:
                Objetivo: una frase
                Pasos:
                1. ...
                2. ...
                Máximo 8 pasos. Cada paso es una acción concreta de este proyecto.
                """;
    }

    private String scopeBlock(Proyecto proyecto, Integer projectId, Integer userId, String userLabel, String retrieved) {
        return """
                Contexto fijo: proyecto id=%d nombre="%s". Usuario id=%d (%s). Fecha de hoy: %s.
                Trabajas solo con este proyecto. El historial del chat no es una fuente de datos: confirma con las herramientas.
                No uses información de otros proyectos. No pidas ni asumas el resto de la base de datos.
                Fragmentos recuperados para esta pregunta. Son una selección corta, no el proyecto completo:
                %s
                """.formatted(
                projectId,
                proyecto.getNombreProyecto() != null ? proyecto.getNombreProyecto() : "",
                userId,
                userLabel,
                LocalDate.now(),
                retrieved
        );
    }

    private void runTools(ArrayNode messages, JsonNode toolCalls, Integer projectId, Integer userId,
                          ChatbotMessageRequest req, AiStreamListener listener,
                          List<String> names, List<String> results, Set<String> executed, String projectName) {
        List<JsonNode> writes = new ArrayList<>();
        for (JsonNode call : toolCalls) {
            if (listener != null && listener.isCancelled()) throw new AiStreamCancelled();
            String name = call.path("function").path("name").asText("");
            if (AiActionPolicy.mutation(name)) writes.add(call);
            else finishCall(messages, call, name, executeRead(name, call, projectId, userId, listener), names, results);
        }
        if (writes.isEmpty()) return;
        List<JsonNode> heldCalls = new ArrayList<>();
        List<String> heldTools = new ArrayList<>();
        List<JsonNode> heldArgs = new ArrayList<>();
        List<AiChangePreview.View> heldViews = new ArrayList<>();
        boolean ask = false;
        for (JsonNode call : writes) {
            String name = call.path("function").path("name").asText("");
            JsonNode args = parseArgs(call);
            if (executed != null && !executed.add(AiToolGuard.fingerprint(name, args))) {
                finishCall(messages, call, name, "Esa acción ya se ejecutó en este turno con los mismos datos.", names, results);
                continue;
            }
            AiChangePreview.View view = authorizationService.inspect(name, args, projectId);
            if (!view.applicable()) {
                finishCall(messages, call, name, view.blockedReason(), names, results);
                continue;
            }
            if (!authorizationService.allowsAutomatic(projectId, userId, name)) ask = true;
            heldCalls.add(call);
            heldTools.add(name);
            heldArgs.add(args);
            heldViews.add(view);
        }
        if (heldTools.isEmpty()) return;
        if (!ask) {
            for (int index = 0; index < heldTools.size(); index++) {
                if (listener != null && listener.isCancelled()) throw new AiStreamCancelled();
                String callId = heldCalls.get(index).path("id").asText("accion-" + index);
                if (listener != null) {
                    listener.status(statusForTool(heldTools.get(index), true));
                    listener.action(AiRunCard.running(callId, heldTools.get(index), heldArgs.get(index), projectName));
                }
                String raw = toolExecutor.execute(heldTools.get(index), heldArgs.get(index), projectId, userId);
                String result = AiUndo.strip(raw);
                String summary = heldViews.get(index).body().get("target") + " " + firstSummary(heldViews.get(index));
                Integer retryId = null;
                if (AiRunCard.canRetry(heldTools.get(index), result)) {
                    retryId = authorizationService.rememberFailure(
                            projectId, userId, req.getConversationId(), req.getAssistantMessageId(),
                            heldTools.get(index), heldArgs.get(index), result, callId);
                } else if (AiRunCard.succeeded(result)) {
                    authorizationService.record(projectId, userId, null, heldTools.get(index), summary, "automatica");
                }
                if (listener != null) {
                    listener.action(AiRunCard.present(callId, heldTools.get(index), heldArgs.get(index), projectName, raw, retryId));
                }
                finishCall(messages, heldCalls.get(index), heldTools.get(index), result, names, results);
            }
            return;
        }
        AiChangePreview.View merged = authorizationService.combine(heldViews);
        AiPropuesta proposal = authorizationService.hold(
                projectId,
                userId,
                req.getConversationId(),
                req.getAssistantMessageId(),
                heldTools,
                heldArgs,
                merged);
        if (listener != null) {
            listener.status("Esperando autorización…");
            listener.proposal(authorizationService.toClient(proposal));
        }
        for (int index = 0; index < heldTools.size(); index++) {
            finishCall(messages, heldCalls.get(index), heldTools.get(index),
                    "Pendiente de autorización: " + firstSummary(heldViews.get(index)), names, results);
        }
    }

    private String executeRead(String name, JsonNode call, Integer projectId, Integer userId, AiStreamListener listener) {
        if (listener != null) listener.status(statusForTool(name, true));
        return AiToolGuard.fence(toolExecutor.execute(name, parseArgs(call), projectId, userId));
    }

    private void finishCall(ArrayNode messages, JsonNode call, String name, String result,
                            List<String> names, List<String> results) {
        String text = clampToolContent(result);
        names.add(name);
        results.add(text);
        ObjectNode toolMessage = objectMapper.createObjectNode();
        toolMessage.put("role", "tool");
        toolMessage.put("tool_call_id", call.path("id").asText(""));
        toolMessage.put("name", name);
        toolMessage.put("content", text);
        messages.add(toolMessage);
    }

    private JsonNode parseArgs(JsonNode call) {
        String raw = call.path("function").path("arguments").asText("{}");
        try {
            return objectMapper.readTree(raw.isBlank() ? "{}" : raw);
        } catch (RuntimeException ex) {
            return objectMapper.createObjectNode();
        }
    }

    private static String firstSummary(AiChangePreview.View view) {
        Object summary = view.body().get("summary");
        if (summary instanceof List<?> lines && !lines.isEmpty()) return String.valueOf(lines.get(0));
        return "Confirmar el cambio.";
    }

    private static String projectLabel(Proyecto proyecto) {
        if (proyecto == null || proyecto.getNombreProyecto() == null || proyecto.getNombreProyecto().isBlank()) {
            return "Este proyecto";
        }
        return proyecto.getNombreProyecto();
    }

    private static String statusForTool(String name, boolean executing) {
        if (name == null || name.isBlank()) {
            return "Pensando…";
        }
        boolean mutation = name.startsWith("create_")
                || name.startsWith("update_")
                || name.startsWith("set_")
                || name.startsWith("delete_")
                || name.startsWith("restore_")
                || name.startsWith("assign_")
                || name.startsWith("move_")
                || name.startsWith("save_")
                || name.startsWith("append_")
                || name.startsWith("replace_")
                || name.startsWith("add_")
                || name.equals("join_project_by_invite_code");
        if (mutation) {
            return executing ? "Aplicando cambios…" : "Preparando cambios…";
        }
        if ("list_project_documents".equals(name) || "summarize_project_document".equals(name)) {
            return "Buscando documentos…";
        }
        if (name.contains("issue") || name.contains("trash") || name.contains("assign")) {
            return "Consultando tareas…";
        }
        if (name.contains("sprint") || name.contains("metric") || name.contains("daily")
                || name.contains("retro") || name.contains("reflection") || name.contains("meeting")) {
            return "Analizando el sprint…";
        }
        return "Pensando…";
    }

    /**
     * Respuesta directa sin LLM para «qué tengo asignado en el sprint X» (evita tool_use_failed de Groq).
     */
    private String tryFastPathAssignedIssuesInSprint(
            String userMessage, Integer projectId, Integer userId, List<Sprint> sprints) {
        if (sprints == null || sprints.isEmpty()) {
            return null;
        }
        String low = userMessage.toLowerCase(Locale.ROOT);
        boolean asksAssigned = low.contains("asignad")
                || low.contains("mis tarea")
                || low.contains("mis actividad")
                || low.contains("tengo en el sprint")
                || low.contains("tengo en sprint");
        if (!asksAssigned) {
            return null;
        }
        Optional<Sprint> sprint = matchSprintFromMessage(userMessage, sprints);
        if (sprint.isEmpty()) {
            return null;
        }
        ObjectNode args = objectMapper.createObjectNode().put("sprint_id", sprint.get().getIdSprint());
        return toolExecutor.execute("list_my_assigned_issues_in_sprint", args, projectId, userId);
    }

    private static Optional<Sprint> matchSprintFromMessage(String message, List<Sprint> sprints) {
        Matcher quoted = Pattern.compile("['\"]([^'\"]{2,80})['\"]").matcher(message);
        while (quoted.find()) {
            Optional<Sprint> hit = matchSprintByNameFragment(quoted.group(1), sprints);
            if (hit.isPresent()) {
                return hit;
            }
        }
        String low = message.toLowerCase(Locale.ROOT);
        Sprint best = null;
        int bestLen = 0;
        for (Sprint s : sprints) {
            String name = s.getNombreSprint();
            if (name == null || name.isBlank()) {
                continue;
            }
            String nameLow = name.toLowerCase(Locale.ROOT);
            if (low.contains(nameLow) && nameLow.length() > bestLen) {
                best = s;
                bestLen = nameLow.length();
            }
        }
        return Optional.ofNullable(best);
    }

    private static Optional<Sprint> matchSprintByNameFragment(String fragment, List<Sprint> sprints) {
        if (fragment == null || fragment.isBlank()) {
            return Optional.empty();
        }
        String f = fragment.trim().toLowerCase(Locale.ROOT);
        Sprint exact = null;
        Sprint partial = null;
        int partialLen = 0;
        for (Sprint s : sprints) {
            String name = s.getNombreSprint();
            if (name == null) {
                continue;
            }
            String n = name.toLowerCase(Locale.ROOT);
            if (n.equals(f)) {
                exact = s;
            } else if ((n.contains(f) || f.contains(n)) && n.length() > partialLen) {
                partial = s;
                partialLen = n.length();
            }
        }
        if (exact != null) {
            return Optional.of(exact);
        }
        return Optional.ofNullable(partial);
    }

    private static String clampToolContent(String raw) {
        if (raw == null) {
            return "";
        }
        if (raw.length() <= MAX_TOOL_MESSAGE_CHARS) {
            return raw;
        }
        return raw.substring(0, MAX_TOOL_MESSAGE_CHARS)
                + "\n… (respuesta truncada para no sobrecargar la IA; acota la consulta o usa la app).";
    }

    private static String maybeUserVisibleReplyWithoutGroq(List<String> toolNames, List<String> toolResults) {
        if (toolNames.size() != toolResults.size() || toolNames.isEmpty()) {
            return null;
        }
        for (String name : toolNames) {
            if (!MUTATION_TOOLS_OK_WITHOUT_LLM_FOLLOW_UP.contains(name)) {
                return null;
            }
        }
        List<String> lines = new ArrayList<>();
        for (String r : toolResults) {
            if (!looksLikeSuccessfulMutationToolText(r)) {
                return null;
            }
            lines.add(r.trim());
        }
        return String.join("\n\n", lines);
    }

    private static boolean looksLikeSuccessfulMutationToolText(String r) {
        if (r == null || r.isBlank()) {
            return false;
        }
        if (r.length() > 900) {
            return false;
        }
        String low = r.trim().toLowerCase(Locale.ROOT);
        if (low.startsWith("no ")) {
            return false;
        }
        if (low.startsWith("varios issues")) {
            return false;
        }
        if (low.startsWith("indica ")) {
            return false;
        }
        if (low.contains("inválido") || low.contains("invalido")) {
            return false;
        }
        if (low.contains("error:")) {
            return false;
        }
        if (low.contains("necesitas ")) {
            return false;
        }
        if (low.contains("no es miembro")) {
            return false;
        }
        if (low.contains("no hay ningún")) {
            return false;
        }
        if (low.contains("sin permiso")) {
            return false;
        }
        return true;
    }
}
