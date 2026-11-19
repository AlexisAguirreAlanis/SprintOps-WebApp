package com.pistache.sprintops_backend.service.chatbot;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import com.pistache.sprintops_backend.model.AiAutorizacion;
import com.pistache.sprintops_backend.model.AiOperacion;
import com.pistache.sprintops_backend.model.AiPropuesta;
import com.pistache.sprintops_backend.model.Proyecto;
import com.pistache.sprintops_backend.repository.AiAutorizacionRepository;
import com.pistache.sprintops_backend.repository.AiOperacionRepository;
import com.pistache.sprintops_backend.repository.AiPropuestaRepository;
import com.pistache.sprintops_backend.service.AiPreferenceService;
import com.pistache.sprintops_backend.service.AiWorkspaceService;
import com.pistache.sprintops_backend.service.ProyectoService;
import com.pistache.sprintops_backend.service.chatbot.AiChangePreview.View;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AiAuthorizationService {

    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private AiAutorizacionRepository autorizacionRepository;
    @Autowired
    private AiPropuestaRepository propuestaRepository;
    @Autowired
    private AiOperacionRepository operacionRepository;
    @Autowired
    private AiChangePreview preview;
    @Autowired
    private ChatbotToolExecutor toolExecutor;
    @Autowired
    private AiPreferenceService preferenceService;
    @Autowired
    private ProyectoService proyectoService;
    @Autowired
    private AiWorkspaceService workspaceService;

    @Transactional
    public Map<String, Object> policy(Integer projectId, Integer userId) {
        return policyJson(load(projectId, userId));
    }

    @Transactional
    public Map<String, Object> updatePolicy(Integer projectId, Integer userId, JsonNode body) {
        AiAutorizacion row = load(projectId, userId);
        if (body.has("allowAll")) row.setPermitirTodo(body.get("allowAll").asBoolean());
        if (body.has("tasks")) row.setTareas(body.get("tasks").asBoolean());
        if (body.has("sprints")) row.setSprints(body.get("sprints").asBoolean());
        if (body.has("documents")) row.setDocumentos(body.get("documents").asBoolean());
        if (body.has("notes")) row.setNotas(body.get("notes").asBoolean());
        autorizacionRepository.save(row);
        return policyJson(row);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> proposals(Integer projectId, Integer userId) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (AiPropuesta proposal : propuestaRepository.findTop20ByProyectoIdAndUsuarioIdOrderByIdPropuestaDesc(projectId, userId)) {
            rows.add(toClient(proposal));
        }
        return rows;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> operations(Integer projectId, Integer userId) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (AiOperacion operation : operacionRepository.findTop12ByProyectoIdAndUsuarioIdOrderByIdOperacionDesc(projectId, userId)) {
            rows.add(operationJson(operation));
        }
        return rows;
    }

    @Transactional
    public boolean allowsAutomatic(Integer projectId, Integer userId, String tool) {
        if (AiActionPolicy.highRisk(tool)) return false;
        String scope = AiActionPolicy.scope(tool);
        if (scope == null) return false;
        String mode = preferenceService.mode(userId);
        if ("seguras".equals(mode)) {
            if (!AiActionPolicy.safe(tool)) return false;
        } else if (!"todo".equals(mode)) {
            return false;
        }
        AiAutorizacion row = load(projectId, userId);
        return switch (scope) {
            case "tasks" -> row.isTareas();
            case "sprints" -> row.isSprints();
            case "documents" -> row.isDocumentos();
            case "notes" -> row.isNotas();
            default -> false;
        };
    }

    public View inspect(String tool, JsonNode args, Integer projectId) {
        return preview.inspect(tool, args, projectId);
    }

    public View combine(List<View> views) {
        return preview.combine(views);
    }

    @Transactional
    public AiPropuesta hold(Integer projectId, Integer userId, Integer conversationId, Integer messageId,
                            List<String> tools, List<JsonNode> args, View view) {
        ArrayNode steps = objectMapper.createArrayNode();
        for (int index = 0; index < tools.size(); index++) {
            ObjectNode step = objectMapper.createObjectNode();
            step.put("tool", tools.get(index));
            step.set("arguments", args.get(index));
            steps.add(step);
        }
        AiPropuesta proposal = new AiPropuesta();
        proposal.setProyectoId(projectId);
        proposal.setUsuarioId(userId);
        proposal.setConversacionId(conversationId);
        proposal.setMensajeId(messageId);
        proposal.setHerramienta(tools.size() == 1 ? tools.get(0) : "varios");
        String arguments = objectMapper.writeValueAsString(steps);
        proposal.setArgumentos(arguments);
        proposal.setHuella(AiToolGuard.fingerprint(arguments));
        proposal.setVista(objectMapper.writeValueAsString(view.body()));
        proposal.setEstado("pendiente");
        proposal.setCreadoEn(Instant.now());
        return propuestaRepository.save(proposal);
    }

    public Map<String, Object> toClient(AiPropuesta proposal) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", proposal.getIdPropuesta());
        body.put("conversationId", proposal.getConversacionId());
        body.put("messageId", proposal.getMensajeId());
        body.put("status", proposal.getEstado());
        body.put("tool", proposal.getHerramienta());
        body.put("result", proposal.getResultado());
        try {
            body.put("preview", objectMapper.readValue(proposal.getVista(), Map.class));
        } catch (RuntimeException ex) {
            body.put("preview", Map.of("title", "Cambios propuestos", "target", "", "summary", List.of(), "fields", List.of(), "diff", List.of()));
        }
        return body;
    }

    @Transactional
    public Map<String, Object> allow(Integer projectId, Integer userId, Integer proposalId) {
        int claimed = propuestaRepository.claim(proposalId, projectId, userId);
        if (claimed == 0) {
            AiPropuesta current = owned(projectId, userId, proposalId);
            return Map.of("proposal", toClient(current), "result", "Esta propuesta ya se resolvió.");
        }
        AiPropuesta proposal = owned(projectId, userId, proposalId);
        if (proposal.getHuella() != null && !proposal.getHuella().equals(AiToolGuard.fingerprint(proposal.getArgumentos()))) {
            return Map.of("proposal", toClient(proposal), "result", "Los cambios aprobados no coinciden con esta acción.");
        }
        JsonNode steps = objectMapper.readTree(proposal.getArgumentos());
        String project = projectName(projectId);
        StringBuilder result = new StringBuilder();
        List<Map<String, Object>> actions = new ArrayList<>();
        boolean wrote = false;
        boolean refused = false;
        if (steps.isArray()) {
            int index = 0;
            for (JsonNode step : steps) {
                String tool = step.path("tool").asText("");
                JsonNode arguments = step.path("arguments");
                String raw = toolExecutor.execute(tool, arguments, projectId, userId);
                String line = AiUndo.strip(raw);
                if (result.length() > 0) result.append('\n');
                result.append(line);
                boolean stepFailed = !AiRunCard.succeeded(line);
                Integer retryId = stepFailed && !wrote && AiRunCard.canRetry(tool, line) ? proposal.getIdPropuesta() : null;
                actions.add(AiRunCard.present("propuesta-" + proposal.getIdPropuesta() + "-" + index, tool, arguments, project, raw, retryId));
                index++;
                if (stepFailed) {
                    refused = true;
                    break;
                }
                wrote = true;
            }
        }
        boolean applied = wrote || !refused;
        proposal.setResultado(clip(result.toString(), 400));
        proposal.setEstado(applied && !refused ? "permitida" : (wrote ? "permitida" : "pendiente"));
        proposal.setResueltoEn(applied ? Instant.now() : null);
        propuestaRepository.save(proposal);
        Map<String, Object> operation = null;
        if (applied) operation = record(projectId, userId, proposal.getIdPropuesta(), proposal.getHerramienta(), summary(proposal), "permitida");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("proposal", toClient(proposal));
        body.put("result", result.toString());
        body.put("operation", operation);
        body.put("actions", actions);
        return body;
    }

    @Transactional
    public Integer rememberFailure(Integer projectId, Integer userId, Integer conversationId, Integer messageId,
                                   String tool, JsonNode args, String result, String cardId) {
        if (!AiRunCard.canRetry(tool, result)) return null;
        ArrayNode steps = objectMapper.createArrayNode();
        ObjectNode step = objectMapper.createObjectNode();
        step.put("tool", tool);
        step.set("arguments", args == null ? objectMapper.createObjectNode() : args);
        steps.add(step);
        String arguments = objectMapper.writeValueAsString(steps);
        AiPropuesta proposal = new AiPropuesta();
        proposal.setProyectoId(projectId);
        proposal.setUsuarioId(userId);
        proposal.setConversacionId(conversationId);
        proposal.setMensajeId(messageId);
        proposal.setHerramienta(tool);
        proposal.setArgumentos(arguments);
        proposal.setHuella(AiToolGuard.fingerprint(arguments));
        ObjectNode view = objectMapper.createObjectNode();
        view.put("title", "Reintento");
        if (cardId != null && !cardId.isBlank()) view.put("cardId", cardId);
        proposal.setVista(objectMapper.writeValueAsString(view));
        proposal.setEstado("fallida");
        proposal.setResultado(clip(result, 400));
        proposal.setCreadoEn(Instant.now());
        return propuestaRepository.save(proposal).getIdPropuesta();
    }

    @Transactional
    public Map<String, Object> retry(Integer projectId, Integer userId, Integer proposalId) {
        AiPropuesta current = owned(projectId, userId, proposalId);
        if ("pendiente".equals(current.getEstado())) return allow(projectId, userId, proposalId);
        int claimed = propuestaRepository.claimRetry(proposalId, projectId, userId);
        if (claimed == 0) {
            return Map.of("action", Map.of("id", "propuesta-" + proposalId + "-0", "phase", "failed", "headline", "Este cambio ya se resolvió", "error", "No hace falta reintentarlo."), "actions", List.of());
        }
        AiPropuesta proposal = owned(projectId, userId, proposalId);
        if (AiActionPolicy.highRisk(proposal.getHerramienta())
                || (proposal.getHuella() != null && !proposal.getHuella().equals(AiToolGuard.fingerprint(proposal.getArgumentos())))) {
            proposal.setEstado("fallida");
            propuestaRepository.save(proposal);
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "Ese cambio no se puede reintentar");
        }
        JsonNode steps = objectMapper.readTree(proposal.getArgumentos());
        JsonNode step = steps.isArray() && !steps.isEmpty() ? steps.get(0) : objectMapper.createObjectNode();
        String tool = step.path("tool").asText(proposal.getHerramienta());
        JsonNode arguments = step.path("arguments");
        String raw = toolExecutor.execute(tool, arguments, projectId, userId);
        String line = AiUndo.strip(raw);
        boolean ok = AiRunCard.succeeded(line);
        proposal.setResultado(clip(line, 400));
        proposal.setEstado(ok ? "permitida" : "fallida");
        proposal.setResueltoEn(ok ? Instant.now() : null);
        propuestaRepository.save(proposal);
        Integer retryId = ok ? null : proposal.getIdPropuesta();
        String cardId = "propuesta-" + proposal.getIdPropuesta() + "-0";
        try {
            String stored = objectMapper.readTree(proposal.getVista()).path("cardId").asText("");
            if (!stored.isBlank()) cardId = stored;
        } catch (RuntimeException ignored) {
            cardId = "propuesta-" + proposal.getIdPropuesta() + "-0";
        }
        Map<String, Object> action = AiRunCard.present(cardId, tool, arguments, projectName(projectId), raw, retryId);
        if (reqMessage(proposal)) workspaceService.replaceAction(proposal.getMensajeId(), action);
        if (ok) record(projectId, userId, proposal.getIdPropuesta(), tool, summary(proposal), "permitida");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("action", action);
        body.put("actions", List.of(action));
        body.put("proposal", toClient(proposal));
        return body;
    }

    private boolean reqMessage(AiPropuesta proposal) {
        return proposal.getMensajeId() != null;
    }

    private String projectName(Integer projectId) {
        return proyectoService.findById(projectId)
                .map(Proyecto::getNombreProyecto)
                .filter(name -> name != null && !name.isBlank())
                .orElse("Este proyecto");
    }

    @Transactional
    public Map<String, Object> reject(Integer projectId, Integer userId, Integer proposalId) {
        int claimed = propuestaRepository.rejectPending(proposalId, projectId, userId, Instant.now());
        AiPropuesta proposal = owned(projectId, userId, proposalId);
        if (claimed == 0) {
            return Map.of("proposal", toClient(proposal), "result", "Esta propuesta ya se resolvió.");
        }
        Map<String, Object> operation = record(projectId, userId, proposal.getIdPropuesta(), proposal.getHerramienta(), summary(proposal), "rechazada");
        return Map.of("proposal", toClient(proposal), "result", "Cambio rechazado.", "operation", operation);
    }

    @Transactional
    public Map<String, Object> record(Integer projectId, Integer userId, Integer proposalId, String tool, String summary, String mode) {
        AiOperacion operation = new AiOperacion();
        operation.setProyectoId(projectId);
        operation.setUsuarioId(userId);
        operation.setPropuestaId(proposalId);
        operation.setHerramienta(tool == null ? "accion" : clip(tool, 60));
        operation.setResumen(clip(summary, 240));
        operation.setModo(mode);
        operation.setCreadoEn(Instant.now());
        return operationJson(operacionRepository.save(operation));
    }

    private AiPropuesta owned(Integer projectId, Integer userId, Integer proposalId) {
        AiPropuesta proposal = propuestaRepository.findById(proposalId)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "Propuesta no encontrada"));
        if (!projectId.equals(proposal.getProyectoId()) || !userId.equals(proposal.getUsuarioId())) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.NOT_FOUND, "Propuesta no encontrada");
        }
        return proposal;
    }

    private AiAutorizacion load(Integer projectId, Integer userId) {
        return autorizacionRepository.findByProyectoIdAndUsuarioId(projectId, userId).orElseGet(() -> {
            AiAutorizacion created = new AiAutorizacion();
            created.setProyectoId(projectId);
            created.setUsuarioId(userId);
            created.setPermitirTodo(false);
            created.setTareas(true);
            created.setSprints(true);
            created.setDocumentos(true);
            created.setNotas(true);
            return autorizacionRepository.save(created);
        });
    }

    private String summary(AiPropuesta proposal) {
        try {
            JsonNode view = objectMapper.readTree(proposal.getVista());
            String target = view.path("target").asText("");
            String first = view.path("summary").isArray() && !view.path("summary").isEmpty()
                    ? view.path("summary").get(0).asText("") : "";
            String text = (target + " " + first).trim();
            return text.isEmpty() ? proposal.getHerramienta() : text;
        } catch (RuntimeException ex) {
            return proposal.getHerramienta();
        }
    }

    private static boolean accepted(String line) {
        if (line == null || line.isBlank()) return false;
        String low = line.trim().toLowerCase(Locale.ROOT);
        return !low.startsWith("no ")
                && !low.startsWith("necesitas ")
                && !low.startsWith("ese ")
                && !low.startsWith("esa ")
                && !low.startsWith("indica ")
                && !low.startsWith("error");
    }

    private static Map<String, Object> policyJson(AiAutorizacion row) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("allowAll", row.isPermitirTodo());
        body.put("tasks", row.isTareas());
        body.put("sprints", row.isSprints());
        body.put("documents", row.isDocumentos());
        body.put("notes", row.isNotas());
        return body;
    }

    private static Map<String, Object> operationJson(AiOperacion operation) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", operation.getIdOperacion());
        body.put("tool", operation.getHerramienta());
        body.put("summary", operation.getResumen());
        body.put("mode", operation.getModo());
        body.put("createdAt", operation.getCreadoEn() == null ? null : operation.getCreadoEn().toString());
        return body;
    }

    private static String clip(String value, int max) {
        String text = value == null ? "" : value.trim();
        return text.length() <= max ? text : text.substring(0, max);
    }
}
