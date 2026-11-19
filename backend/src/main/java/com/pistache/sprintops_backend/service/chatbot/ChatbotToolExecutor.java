package com.pistache.sprintops_backend.service.chatbot;

import tools.jackson.databind.JsonNode;
import com.pistache.sprintops_backend.model.*;
import com.pistache.sprintops_backend.model.AsignacionIssues.AsignacionIssuesId;
import com.pistache.sprintops_backend.model.InfoUsuarioEquipo.InfoUsuarioEquipoId;
import com.pistache.sprintops_backend.model.RolesDeUsuarios.RolesDeUsuariosId;
import com.pistache.sprintops_backend.model.TablaPermisos.TablaPermisosId;
import com.pistache.sprintops_backend.repository.*;
import com.pistache.sprintops_backend.service.*;
import com.pistache.sprintops_backend.util.ScheduleDates;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ChatbotToolExecutor {

    private static final String DAILY_TYPE = "Daily";

    @Autowired
    @Lazy
    private ChatbotToolExecutor self;

    @Autowired
    private ProyectoPermissionCheckService permissionCheckService;
    @Autowired
    private ProyectoService proyectoService;
    @Autowired
    private JoinCodeRateLimiter joinCodeRateLimiter;
    @Autowired
    private SprintService sprintService;
    @Autowired
    private SprintRepository sprintRepository;
    @Autowired
    private ProjectContextRetriever contextRetriever;
    @Autowired
    private AiActionService actionService;
    @Autowired
    private IssuesService issuesService;
    @Autowired
    private IssuesRepository issuesRepository;
    @Autowired
    private DescIssueRepository descIssueRepository;
    @Autowired
    private AsignacionIssuesRepository asignacionIssuesRepository;
    @Autowired
    private LogsIssuesRepository logsIssuesRepository;
    @Autowired
    private LogsIssuesService logsIssuesService;
    @Autowired
    private UsuarioService usuarioService;
    @Autowired
    private UsuarioRepository usuarioRepository;
    @Autowired
    private ReunionRepository reunionRepository;
    @Autowired
    private RegistroReunionRepository registroReunionRepository;
    @Autowired
    private ReunionService reunionService;
    @Autowired
    private PapeleraIssueRepository papeleraIssueRepository;
    @Autowired
    private RetroSprintRepository retroSprintRepository;
    @Autowired
    private RetroItemRepository retroItemRepository;
    @Autowired
    private RolService rolService;
    @Autowired
    private RolRepository rolRepository;
    @Autowired
    private TablaPermisosRepository tablaPermisosRepository;
    @Autowired
    private PermisoRepository permisoRepository;
    @Autowired
    private InfoUsuarioEquipoRepository infoUsuarioEquipoRepository;
    @Autowired
    private RolesDeUsuariosRepository rolesDeUsuariosRepository;
    @Autowired
    private EquipoService equipoService;

    public String execute(String toolName, JsonNode args, Integer projectId, Integer userId) {
        if (toolName == null || toolName.isBlank()) {
            return "Error: herramienta sin nombre.";
        }
        JsonNode a = args != null ? args : tools.jackson.databind.node.MissingNode.getInstance();
        String foreign = foreignScope(a, projectId);
        if (foreign != null) {
            return foreign;
        }
        AiToolGuard.Gate gate = AiToolGuard.open(toolName, a, userId, (uid, permission) -> perm(uid, projectId, permission));
        if (!gate.ok()) {
            return gate.error();
        }
        try {
            return switch (gate.operation()) {
                case "list_my_assigned_issues" -> listMyAssignedIssues(projectId, userId);
                case "list_my_assigned_issues_in_sprint" -> listMyAssignedIssuesInSprint(projectId, userId, a);
                case "list_sprint_issues" -> listSprintIssues(projectId, userId, a);
                case "list_project_sprints" -> listProjectSprints(projectId, userId);
                case "list_project_documents" -> contextRetriever.documents(projectId, userId);
                case "search_project_context" -> contextRetriever.retrieve(projectId, userId, a.path("query").asText(""));
                case "list_project_notes" -> contextRetriever.notes(projectId, userId);
                case "list_project_team" -> contextRetriever.team(projectId, userId);
                case "list_project_meetings" -> contextRetriever.meetings(projectId, userId);
                case "create_project_note" -> actionService.createNote(projectId, userId, strArg(a, "text"));
                case "create_project_document" -> actionService.createDocument(projectId, userId, strArg(a, "name"), stringArrayArg(a, "blocks"));
                case "append_document_section" -> actionService.appendSection(projectId, userId, intArg(a, "document_id"), strArg(a, "heading"), strArg(a, "body"));
                case "replace_document_section" -> actionService.replaceSection(projectId, userId, intArg(a, "document_id"), strArg(a, "heading"), strArg(a, "body"));
                case "add_document_table" -> actionService.addTable(projectId, userId, intArg(a, "document_id"), strArg(a, "caption"), stringArrayArg(a, "columns"), stringArrayArg(a, "rows"));
                case "summarize_project_document" -> actionService.summarizeDocument(projectId, userId, intArg(a, "document_id"));
                case "save_retro_item" -> actionService.saveRetro(projectId, userId, intArg(a, "sprint_id"), strArg(a, "good"), strArg(a, "bad"), strArg(a, "improve"));
                case "analyze_sprint_health" -> actionService.analyze(projectId, userId, intArg(a, "sprint_id"));
                case "find_issues" -> findIssues(projectId, userId, a);
                case "get_issue_detail" -> getIssueDetail(projectId, userId, a);
                case "get_issue_change_history" -> getIssueHistory(projectId, userId, a);
                case "summarize_my_issue_progress" -> summarizeMyProgress(projectId, userId);
                case "project_metrics_snapshot" -> projectMetrics(projectId, userId);
                case "team_daily_standup" -> teamDaily(projectId, userId, a);
                case "my_daily_standup" -> myDaily(projectId, userId, a);
                case "list_retro_reflections" -> listRetro(projectId, userId, a);
                case "create_issue" -> self.createIssue(projectId, userId, a);
                case "update_issue_fields" -> self.updateIssueFields(projectId, userId, a);
                case "set_issue_assignees" -> self.setIssueAssignees(projectId, userId, a);
                case "assign_issue_by_title" -> self.assignIssueByTitle(projectId, userId, a);
                case "set_issue_status" -> self.setIssueStatus(projectId, userId, a);
                case "set_issue_status_by_title" -> self.setIssueStatusByTitle(projectId, userId, a);
                case "save_my_daily_standup" -> self.saveMyDaily(projectId, userId, a);
                case "move_issue_to_next_sprint" -> self.moveIssueNextSprint(projectId, userId, a);
                case "join_project_by_invite_code" -> self.joinByCode(userId, a);
                case "get_project_invite_code" -> getInviteCode(projectId, userId);
                case "create_sprint" -> self.createSprint(projectId, userId, a);
                case "update_sprint_fields" -> self.updateSprint(projectId, userId, a);
                case "update_project_fields" -> self.updateProject(projectId, userId, a);
                case "set_team_member_role" -> self.setMemberRole(projectId, userId, a);
                case "create_project_role" -> self.createProjectRole(projectId, userId, a);
                case "rename_role" -> self.renameRole(projectId, userId, a);
                case "set_role_permissions_by_name" -> self.setRolePerms(projectId, userId, a);
                case "list_sprint_trash" -> listTrash(projectId, userId, a);
                case "restore_trash_item" -> self.restoreTrash(projectId, userId, a);
                case "delete_trash_permanently" -> self.deleteTrash(projectId, userId, a);
                case "create_new_project" -> self.createNewProject(userId, a);
                case "reflection_health_check_hint" -> reflectionHint();
                default -> "Herramienta no reconocida: " + toolName;
            };
        } catch (Exception e) {
            return "Error ejecutando " + toolName + ": " + e.getMessage();
        }
    }

    /** Rechaza ids que el modelo intente colar de otro proyecto. El projectId de la petición no se sustituye. */
    private String foreignScope(JsonNode args, Integer projectId) {
        Integer claimed = intField(args, "project_id");
        if (claimed == null) claimed = intField(args, "proyecto_id");
        if (claimed == null) claimed = intField(args, "projectId");
        if (claimed != null && !claimed.equals(projectId)) {
            return "Esa operación no pertenece a este proyecto.";
        }
        for (String key : List.of("sprint_id", "from_sprint_id", "to_sprint_id")) {
            Integer sprintId = intField(args, key);
            if (sprintId != null && !sprintInProject(sprintId, projectId)) {
                return "Ese sprint no pertenece a este proyecto.";
            }
        }
        Integer issueId = intField(args, "issue_id");
        if (issueId != null && !issueInProject(issueId, projectId)) {
            return "Esa tarea no pertenece a este proyecto.";
        }
        return null;
    }

    private static Integer intField(JsonNode node, String key) {
        if (node == null || !node.has(key) || node.get(key).isNull()) return null;
        JsonNode value = node.get(key);
        if (value.isNumber()) return value.asInt();
        if (value.isTextual()) {
            try {
                return Integer.valueOf(value.asText().trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private boolean perm(Integer uid, Integer pid, String p) {
        return permissionCheckService.memberHasPermission(uid, pid, p);
    }

    private boolean issueInProject(Integer issueId, Integer projectId) {
        return issuesRepository.findAllBelongingToProject(projectId).stream()
                .anyMatch(i -> i.getIdIssue().equals(issueId));
    }

    private boolean sprintInProject(Integer sprintId, Integer projectId) {
        return sprintService.findById(sprintId)
                .map(s -> s.getProyecto() != null && s.getProyecto().getIdProyecto().equals(projectId))
                .orElse(false);
    }

    private boolean assignedTo(Integer userId, Integer issueId) {
        return asignacionIssuesRepository.findByIssueIdIssue(issueId).stream()
                .anyMatch(x -> x.getUsuario().getIdUsuario().equals(userId));
    }

    private boolean canSeeIssue(Integer userId, Integer projectId, Integer issueId) {
        if (!issueInProject(issueId, projectId)) {
            return false;
        }
        if (perm(userId, projectId, "canViewAllIssues")) {
            return true;
        }
        return perm(userId, projectId, "canViewOnlyOwnIssues") && assignedTo(userId, issueId);
    }

    private boolean canMutateIssue(Integer userId, Integer projectId) {
        return perm(userId, projectId, "canEditIssue");
    }

    private static Integer intArg(JsonNode n, String field) {
        if (n == null || !n.has(field) || n.get(field).isNull()) {
            return null;
        }
        JsonNode v = n.get(field);
        if (v.isInt() || v.isLong()) {
            return v.asInt();
        }
        if (v.isTextual()) {
            try {
                return Integer.parseInt(v.asText().trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private static String strArg(JsonNode n, String field) {
        if (n == null || !n.has(field) || n.get(field).isNull()) {
            return null;
        }
        String t = n.get(field).asText();
        return t == null ? null : t.trim();
    }

    private static List<Integer> intArrayArg(JsonNode n, String field) {
        if (n == null || !n.has(field) || !n.get(field).isArray()) {
            return List.of();
        }
        List<Integer> out = new ArrayList<>();
        for (JsonNode el : n.get(field)) {
            if (el.isInt() || el.isLong()) {
                out.add(el.asInt());
            } else if (el.isTextual()) {
                try {
                    out.add(Integer.parseInt(el.asText().trim()));
                } catch (NumberFormatException ignored) {
                    // omitir elemento inválido
                }
            }
        }
        return out;
    }

    private static List<String> stringArrayArg(JsonNode n, String field) {
        if (n == null || !n.has(field) || !n.get(field).isArray()) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (JsonNode el : n.get(field)) {
            if (el.isTextual()) {
                String s = el.asText().trim();
                if (!s.isEmpty()) {
                    out.add(s);
                }
            } else if (el.isNumber()) {
                out.add(String.valueOf(el.asInt()));
            }
        }
        return out;
    }

    private static LocalDate dateArg(JsonNode n, String field, LocalDate defaultDate) {
        String s = strArg(n, field);
        if (s == null || s.isEmpty()) {
            return defaultDate;
        }
        return LocalDate.parse(s);
    }

    private String listMyAssignedIssues(Integer projectId, Integer userId) {
        if (!perm(userId, projectId, "canViewOnlyOwnIssues") && !perm(userId, projectId, "canViewAllIssues")) {
            return "No tienes permiso para ver issues en este proyecto.";
        }
        Set<Integer> mine = asignacionIssuesRepository.findByUsuarioIdUsuario(userId).stream()
                .map(a -> a.getIssue().getIdIssue())
                .collect(Collectors.toSet());
        List<Issues> list = issuesRepository.findAllBelongingToProject(projectId).stream()
                .filter(i -> mine.contains(i.getIdIssue()))
                .sorted(Comparator.comparing(Issues::getIdIssue))
                .toList();
        if (list.isEmpty()) {
            return "No tienes issues asignados en este proyecto.";
        }
        final int cap = 50;
        StringBuilder sb = new StringBuilder("Tus issues en el proyecto:\n");
        int n = Math.min(cap, list.size());
        for (int idx = 0; idx < n; idx++) {
            Issues i = list.get(idx);
            sb.append("- #").append(i.getIdIssue()).append(" ").append(safe(i.getTituloIssue()))
                    .append(" | estado=").append(safe(i.getEstadoIssue()))
                    .append(" | SP=").append(i.getStoryPointsIssue() != null ? i.getStoryPointsIssue() : 0)
                    .append("\n");
        }
        if (list.size() > cap) {
            sb.append("(mostrando ").append(cap).append(" de ").append(list.size()).append(")\n");
        }
        return sb.toString();
    }

    private String listMyAssignedIssuesInSprint(Integer projectId, Integer userId, JsonNode a) {
        Integer sprintId = intArg(a, "sprint_id");
        if (sprintId == null) {
            return "Indica sprint_id (número).";
        }
        if (!sprintInProject(sprintId, projectId)) {
            return "Ese sprint no pertenece al proyecto actual.";
        }
        if (!perm(userId, projectId, "canViewOnlyOwnIssues") && !perm(userId, projectId, "canViewAllIssues")) {
            return "No tienes permiso para ver issues en este proyecto.";
        }
        Set<Integer> mine = asignacionIssuesRepository.findByUsuarioIdUsuario(userId).stream()
                .map(x -> x.getIssue().getIdIssue())
                .collect(Collectors.toSet());
        List<DescIssue> descs = descIssueRepository.findBySprintIdSprint(sprintId);
        List<Issues> assigned = new ArrayList<>();
        for (DescIssue d : descs) {
            Issues i = d.getIssue();
            if (i == null || !issueInProject(i.getIdIssue(), projectId)) {
                continue;
            }
            if (mine.contains(i.getIdIssue())) {
                assigned.add(i);
            }
        }
        assigned.sort(Comparator.comparing(Issues::getIdIssue));
        if (assigned.isEmpty()) {
            return "No tienes issues asignados en ese sprint.";
        }
        String sprintLabel = sprintService.findById(sprintId)
                .map(s -> s.getNombreSprint() != null ? s.getNombreSprint() : ("sprint " + sprintId))
                .orElse("sprint " + sprintId);
        StringBuilder sb = new StringBuilder("Tus issues asignados en «").append(sprintLabel).append("»:\n");
        for (Issues i : assigned) {
            sb.append("- #").append(i.getIdIssue()).append(" ").append(safe(i.getTituloIssue()))
                    .append(" | estado=").append(safe(i.getEstadoIssue()))
                    .append(" | SP=").append(i.getStoryPointsIssue() != null ? i.getStoryPointsIssue() : 0)
                    .append("\n");
        }
        return sb.toString();
    }

    private String listSprintIssues(Integer projectId, Integer userId, JsonNode a) {
        Integer sprintId = intArg(a, "sprint_id");
        if (sprintId == null) {
            return "Indica sprint_id (número).";
        }
        if (!sprintInProject(sprintId, projectId)) {
            return "Ese sprint no pertenece al proyecto actual.";
        }
        boolean all = perm(userId, projectId, "canViewAllIssues");
        boolean own = perm(userId, projectId, "canViewOnlyOwnIssues");
        if (!all && !own) {
            return "No tienes permiso para ver issues del sprint.";
        }
        Set<Integer> mine = asignacionIssuesRepository.findByUsuarioIdUsuario(userId).stream()
                .map(x -> x.getIssue().getIdIssue())
                .collect(Collectors.toSet());
        List<DescIssue> descs = descIssueRepository.findBySprintIdSprint(sprintId);
        List<Issues> visible = new ArrayList<>();
        for (DescIssue d : descs) {
            Issues i = d.getIssue();
            if (!issueInProject(i.getIdIssue(), projectId)) {
                continue;
            }
            if (!all && !mine.contains(i.getIdIssue())) {
                continue;
            }
            visible.add(i);
        }
        visible.sort(Comparator.comparing(Issues::getIdIssue));
        if (visible.isEmpty()) {
            return "No hay issues visibles para ti en ese sprint (o el sprint está vacío).";
        }
        final int cap = 50;
        StringBuilder sb = new StringBuilder("Issues del sprint ").append(sprintId).append(":\n");
        int n = Math.min(cap, visible.size());
        for (int idx = 0; idx < n; idx++) {
            Issues i = visible.get(idx);
            sb.append("- #").append(i.getIdIssue()).append(" ").append(safe(i.getTituloIssue()))
                    .append(" | ").append(safe(i.getEstadoIssue()))
                    .append(" | SP=").append(i.getStoryPointsIssue() != null ? i.getStoryPointsIssue() : 0)
                    .append("\n");
        }
        if (visible.size() > cap) {
            sb.append("(mostrando ").append(cap).append(" de ").append(visible.size()).append(")\n");
        }
        return sb.toString();
    }

    private String listProjectSprints(Integer projectId, Integer userId) {
        if (!perm(userId, projectId, "canViewAllIssues") && !perm(userId, projectId, "canViewOnlyOwnIssues")
                && !perm(userId, projectId, "canCreateIssue") && !perm(userId, projectId, "canEditIssue")
                && !perm(userId, projectId, "canCreateSprint") && !perm(userId, projectId, "canManageMembers")) {
            return "No tienes permiso para listar sprints en este proyecto.";
        }
        List<Sprint> sprints = sprintRepository.findByProyectoIdProyecto(projectId);
        sprints.sort(Comparator.comparing(Sprint::getFechaInicioSprint, Comparator.nullsLast(Comparator.naturalOrder())));
        StringBuilder sb = new StringBuilder("Sprints del proyecto:\n");
        for (Sprint s : sprints) {
            sb.append("- id=").append(s.getIdSprint())
                    .append(" nombre=\"").append(safe(s.getNombreSprint()))
                    .append("\" ").append(s.getFechaInicioSprint() != null ? s.getFechaInicioSprint() : "?")
                    .append(" → ").append(s.getFechaFinSprint() != null ? s.getFechaFinSprint() : "?")
                    .append("\n");
        }
        if (sprints.isEmpty()) {
            return "No hay sprints registrados en este proyecto.";
        }
        return sb.toString();
    }

    private List<Issues> collectMatchingIssues(Integer projectId, Integer userId, String titleQ, Integer sprintF, String statusNorm) {
        List<Issues> all = issuesRepository.findAllBelongingToProject(projectId);
        List<Issues> matches = new ArrayList<>();
        for (Issues i : all) {
            if (!canSeeIssue(userId, projectId, i.getIdIssue())) {
                continue;
            }
            if (titleQ != null && !titleQ.isEmpty()) {
                String t = safe(i.getTituloIssue()).toLowerCase(Locale.ROOT);
                if (!t.contains(titleQ.toLowerCase(Locale.ROOT))) {
                    continue;
                }
            }
            if (statusNorm != null && !statusNorm.isEmpty()) {
                String st = safe(i.getEstadoIssue()).toLowerCase(Locale.ROOT);
                if (!st.equals(statusNorm)) {
                    continue;
                }
            }
            if (sprintF != null) {
                if (!sprintInProject(sprintF, projectId)
                        || descIssueRepository.findByIdSprintIdAndIdIssueId(sprintF, i.getIdIssue()).isEmpty()) {
                    continue;
                }
            }
            matches.add(i);
        }
        return matches;
    }

    private String findIssues(Integer projectId, Integer userId, JsonNode a) {
        if (!perm(userId, projectId, "canViewAllIssues") && !perm(userId, projectId, "canViewOnlyOwnIssues")) {
            return "No tienes permiso para buscar issues.";
        }
        String titleQ = strArg(a, "title_contains");
        Integer sprintF = intArg(a, "sprint_id");
        String statusF = strArg(a, "status");
        String statusNorm = statusF != null ? statusF.trim().toLowerCase(Locale.ROOT) : null;
        List<Issues> allMatches = collectMatchingIssues(projectId, userId, titleQ, sprintF, statusNorm);
        allMatches.sort(Comparator.comparing(Issues::getIdIssue));
        int fullCount = allMatches.size();
        int limit = 30;
        List<Issues> matches = allMatches;
        if (matches.size() > limit) {
            matches = allMatches.subList(0, limit);
        }
        if (allMatches.isEmpty()) {
            return "No hay issues que coincidan con los filtros (revisa título, sprint_id o status: todo, in_progress, done, blocked).";
        }
        StringBuilder sb = new StringBuilder("Issues encontrados:\n");
        for (Issues i : matches) {
            String sprintIds = descIssueRepository.findByIssueIdIssue(i.getIdIssue()).stream()
                    .map(d -> String.valueOf(d.getSprint().getIdSprint()))
                    .collect(Collectors.joining(","));
            sb.append("- issue_id=").append(i.getIdIssue())
                    .append(" título=\"").append(safe(i.getTituloIssue())).append("\"")
                    .append(" estado=").append(safe(i.getEstadoIssue()))
                    .append(" sprint(s)=").append(sprintIds.isEmpty() ? "-" : sprintIds)
                    .append("\n");
        }
        if (fullCount > limit) {
            sb.append("(mostrando los primeros ").append(limit).append(")\n");
        }
        return sb.toString();
    }

    private String getIssueDetail(Integer projectId, Integer userId, JsonNode a) {
        Integer id = intArg(a, "issue_id");
        if (id == null) {
            return "Indica issue_id.";
        }
        if (!canSeeIssue(userId, projectId, id)) {
            return "No encontré el issue o no tienes permiso para verlo.";
        }
        return issuesService.findById(id).map(this::formatIssueDetail).orElse("Issue no encontrado.");
    }

    private String formatIssueDetail(Issues i) {
        List<Integer> assignees = asignacionIssuesRepository.findByIssueIdIssue(i.getIdIssue()).stream()
                .map(a -> a.getUsuario().getIdUsuario())
                .toList();
        String sprint = descIssueRepository.findByIssueIdIssue(i.getIdIssue()).stream()
                .findFirst()
                .map(d -> String.valueOf(d.getSprint().getIdSprint()))
                .orElse("-");
        return """
                Issue #%d
                Título: %s
                Descripción: %s
                Propósito: %s
                Estado: %s | Prioridad: %s | SP: %s
                Sprint vinculado (si aplica): %s
                Asignados (user ids): %s
                """.formatted(
                i.getIdIssue(),
                safe(i.getTituloIssue()),
                safe(i.getDescripcionIssue()),
                safe(i.getPropositoIssue()),
                safe(i.getEstadoIssue()),
                safe(i.getPrioridadIssue()),
                i.getStoryPointsIssue() != null ? i.getStoryPointsIssue() : 0,
                sprint,
                assignees.isEmpty() ? "(ninguno)" : assignees.toString()
        );
    }

    private String getIssueHistory(Integer projectId, Integer userId, JsonNode a) {
        Integer id = intArg(a, "issue_id");
        if (id == null) {
            return "Indica issue_id.";
        }
        if (!canSeeIssue(userId, projectId, id)) {
            return "No encontré el issue o no tienes permiso.";
        }
        List<LogsIssues> logs = logsIssuesRepository.findByIssueIdIssue(id);
        if (logs.isEmpty()) {
            return "No hay historial registrado para este issue.";
        }
        logs.sort(Comparator.comparing(l -> l.getFechaCreacionLogIssue() != null ? l.getFechaCreacionLogIssue() : ""));
        final int cap = 60;
        int start = Math.max(0, logs.size() - cap);
        StringBuilder sb = new StringBuilder("Historial del issue #").append(id).append(":\n");
        if (start > 0) {
            sb.append("(últimas ").append(cap).append(" entradas de ").append(logs.size()).append(")\n");
        }
        for (int i = start; i < logs.size(); i++) {
            LogsIssues l = logs.get(i);
            sb.append("- ").append(safe(l.getFechaCreacionLogIssue()))
                    .append(" | ").append(safe(l.getTipoAccion()))
                    .append(" | ").append(safe(l.getActorLogIssue()))
                    .append(" → ").append(safe(l.getDescripcionLogIssue()))
                    .append("\n");
        }
        return sb.toString();
    }

    private String summarizeMyProgress(Integer projectId, Integer userId) {
        if (!perm(userId, projectId, "canViewOnlyOwnIssues") && !perm(userId, projectId, "canViewAllIssues")) {
            return "Sin permiso para consultar issues.";
        }
        Set<Integer> mine = asignacionIssuesRepository.findByUsuarioIdUsuario(userId).stream()
                .map(a -> a.getIssue().getIdIssue())
                .collect(Collectors.toSet());
        Map<String, Long> byState = issuesRepository.findAllBelongingToProject(projectId).stream()
                .filter(i -> mine.contains(i.getIdIssue()))
                .collect(Collectors.groupingBy(i -> Optional.ofNullable(i.getEstadoIssue()).orElse("?"), Collectors.counting()));
        if (byState.isEmpty()) {
            return "No tienes issues asignados en este proyecto.";
        }
        int spTodo = issuesRepository.findAllBelongingToProject(projectId).stream()
                .filter(i -> mine.contains(i.getIdIssue()))
                .filter(i -> !"done".equalsIgnoreCase(Optional.ofNullable(i.getEstadoIssue()).orElse("")))
                .mapToInt(i -> i.getStoryPointsIssue() != null ? i.getStoryPointsIssue() : 0)
                .sum();
        return "Resumen de tus issues en el proyecto:\n"
                + "Por estado: " + byState + "\n"
                + "Story points aún no terminados (aprox.): " + spTodo;
    }

    private String projectMetrics(Integer projectId, Integer userId) {
        if (!perm(userId, projectId, "canViewMetrics")) {
            return "Solo usuarios con permiso canViewMetrics pueden ver este resumen.";
        }
        List<Sprint> sprints = sprintRepository.findByProyectoIdProyecto(projectId);
        if (sprints.isEmpty()) {
            return "No hay sprints en el proyecto.";
        }
        StringBuilder sb = new StringBuilder("Métricas del proyecto (resumen por sprint):\n");
        for (Sprint sp : sprints) {
            int sid = sp.getIdSprint();
            List<DescIssue> descs = descIssueRepository.findBySprintIdSprint(sid);
            int total = descs.size();
            int done = 0;
            int wip = 0;
            int pts = 0;
            int ptsDone = 0;
            for (DescIssue d : descs) {
                Issues i = d.getIssue();
                int p = i.getStoryPointsIssue() != null ? i.getStoryPointsIssue() : 0;
                pts += p;
                String st = Optional.ofNullable(i.getEstadoIssue()).orElse("").toLowerCase(Locale.ROOT);
                if ("done".equals(st)) {
                    done++;
                    ptsDone += p;
                }
                if ("in_progress".equals(st)) {
                    wip++;
                }
            }
            int cap = sp.getCapacidadStoryPoints() != null ? sp.getCapacidadStoryPoints() : 0;
            int sent = sp.getIssuesEnviadosSiguiente() != null ? sp.getIssuesEnviadosSiguiente() : 0;
            int sentPts = sp.getStoryPointsEnviadosSiguiente() != null ? sp.getStoryPointsEnviadosSiguiente() : 0;
            sb.append(String.format(Locale.ROOT,
                    "- Sprint %d \"%s\" (%s → %s): capacidad_SP=%d | issues=%d | hechos=%d | en_progreso=%d | SP_tot=%d | SP_hechos=%d | enviados_siguiente_sprint=%d (SP enviados=%d)\n",
                    sid, safe(sp.getNombreSprint()),
                    sp.getFechaInicioSprint(), sp.getFechaFinSprint(),
                    cap, total, done, wip, pts, ptsDone, sent, sentPts));
        }
        sb.append("Nota: \"deuda estimada\" en Kanban suele relacionarse con trabajo no terminado y puntos enviados al siguiente sprint; revisa los números anteriores.\n");
        sb.append("\"Tareas a revisar\" no tiene entidad de code review en el sistema; se listan tareas en progreso arriba.\n");
        return sb.toString();
    }

    private String teamDaily(Integer projectId, Integer userId, JsonNode a) {
        if (!perm(userId, projectId, "canViewMetrics")) {
            return "Necesitas canViewMetrics para ver los daily de todo el equipo.";
        }
        LocalDate day = dateArg(a, "date_iso", LocalDate.now());
        String userPart = Optional.ofNullable(strArg(a, "username_contains")).orElse("").toLowerCase(Locale.ROOT);
        List<Sprint> sprints = sprintRepository.findByProyectoIdProyecto(projectId);
        StringBuilder sb = new StringBuilder("Daily tipo \"").append(DAILY_TYPE).append("\" del ")
                .append(day).append(":\n");
        int found = 0;
        for (Sprint sp : sprints) {
            Optional<Reunion> opt = reunionRepository
                    .findBySprintIdSprintAndFechaDeReunionAndTipoReunion(sp.getIdSprint(), day, DAILY_TYPE);
            if (opt.isEmpty()) {
                continue;
            }
            Reunion r = opt.get();
            for (RegistroReunion reg : registroReunionRepository.findByReunion(r)) {
                Usuario u = reg.getUsuario();
                String name = u != null && u.getNombreUsuario() != null ? u.getNombreUsuario() : "?";
                if (!userPart.isEmpty() && !name.toLowerCase(Locale.ROOT).contains(userPart)) {
                    continue;
                }
                found++;
                sb.append(String.format(Locale.ROOT,
                        "- [%s] sprint %d | %s: ayer/qué hice=%s | hoy/qué haré=%s | bloqueos=%s\n",
                        day, sp.getIdSprint(), name,
                        safe(reg.getQueHice()), safe(reg.getQueHare()), safe(reg.getImpedimentos())));
            }
        }
        if (found == 0) {
            return "No hay registros de daily para esa fecha" + (userPart.isEmpty() ? "" : " y filtro de nombre") + ".";
        }
        return sb.toString();
    }

    private String myDaily(Integer projectId, Integer userId, JsonNode a) {
        LocalDate day = dateArg(a, "date_iso", LocalDate.now());
        List<Sprint> sprints = sprintRepository.findByProyectoIdProyecto(projectId);
        StringBuilder sb = new StringBuilder("Tu daily del ").append(day).append(":\n");
        int found = 0;
        for (Sprint sp : sprints) {
            Optional<Reunion> opt = reunionRepository
                    .findBySprintIdSprintAndFechaDeReunionAndTipoReunion(sp.getIdSprint(), day, DAILY_TYPE);
            if (opt.isEmpty()) {
                continue;
            }
            Optional<RegistroReunion> regOpt = registroReunionRepository
                    .findByReunionIdReunionAndUsuarioIdUsuario(opt.get().getIdReunion(), userId);
            if (regOpt.isEmpty()) {
                continue;
            }
            RegistroReunion reg = regOpt.get();
            found++;
            sb.append(String.format(Locale.ROOT,
                    "- sprint %d: qué hice=%s | qué haré=%s | bloqueos=%s\n",
                    sp.getIdSprint(),
                    safe(reg.getQueHice()), safe(reg.getQueHare()), safe(reg.getImpedimentos())));
        }
        if (found == 0) {
            return "No encontré tu registro de daily para esa fecha en los sprints de este proyecto.";
        }
        return sb.toString();
    }

    private String listRetro(Integer projectId, Integer userId, JsonNode a) {
        if (!perm(userId, projectId, "canViewMetrics")) {
            return "Necesitas canViewMetrics para ver reflexiones de retrospectiva del equipo.";
        }
        Integer onlySprint = intArg(a, "sprint_id");
        List<Sprint> sprints = sprintRepository.findByProyectoIdProyecto(projectId);
        StringBuilder sb = new StringBuilder("Reflexiones (ítems de retro) del proyecto:\n");
        int n = 0;
        for (Sprint sp : sprints) {
            if (onlySprint != null && !onlySprint.equals(sp.getIdSprint())) {
                continue;
            }
            Optional<RetroSprint> rs = retroSprintRepository.findBySprint(sp);
            if (rs.isEmpty()) {
                continue;
            }
            List<RetroItem> items = retroItemRepository.findByRetroSprint(rs.get());
            for (RetroItem it : items) {
                n++;
                sb.append(String.format(Locale.ROOT,
                        "- Sprint %d | bueno=%s | malo=%s | mejorar=%s\n",
                        sp.getIdSprint(),
                        safe(it.getLoBuenoRetro()), safe(it.getLoMaloRetro()), safe(it.getAMejorarRetro())));
            }
        }
        if (n == 0) {
            return "No hay ítems de retrospectiva registrados para los sprints de este proyecto.";
        }
        return sb.toString();
    }

    @Transactional
    public String createIssue(Integer projectId, Integer userId, JsonNode a) {
        if (!perm(userId, projectId, "canCreateIssue")) {
            return "No tienes permiso para crear issues (canCreateIssue).";
        }
        String title = strArg(a, "title");
        if (title == null || title.isEmpty()) {
            return "Falta el título del issue.";
        }
        Integer sprintId = intArg(a, "sprint_id");
        Issues issue = new Issues();
        issue.setTituloIssue(title);
        issue.setDescripcionIssue(Optional.ofNullable(strArg(a, "description")).orElse(""));
        issue.setPropositoIssue(Optional.ofNullable(strArg(a, "purpose")).orElse(""));
        issue.setEstadoIssue(Optional.ofNullable(strArg(a, "status")).orElse("todo"));
        issue.setPrioridadIssue(Optional.ofNullable(strArg(a, "priority")).orElse("Medium"));
        issue.setStoryPointsIssue(intArg(a, "story_points") != null ? intArg(a, "story_points") : 0);
        issue.setFechaCreacionIssue(LocalDate.now());
        if (strArg(a, "due_date") != null) {
            LocalDate due = dateArg(a, "due_date", null);
            if (due == null) return "due_date debe usar el formato yyyy-MM-dd.";
            issue.setFechaFinIssue(due);
        }
        proyectoService.findById(projectId).ifPresent(issue::setProyecto);

        Sprint linked = null;
        if (sprintId != null && sprintInProject(sprintId, projectId)) {
            linked = sprintService.findById(sprintId).orElse(null);
            if (linked != null && issue.getProyecto() == null && linked.getProyecto() != null) {
                issue.setProyecto(linked.getProyecto());
            }
        }

        issue = issuesService.save(issue);
        if (linked != null) {
            DescIssue desc = new DescIssue();
            desc.setId(new DescIssue.DescIssueId(linked.getIdSprint(), issue.getIdIssue()));
            desc.setSprint(linked);
            desc.setIssue(issue);
            desc.setFechaEntrada(LocalDate.now());
            descIssueRepository.save(desc);
        }
        return "Issue creado con id " + issue.getIdIssue()
                + (linked != null ? " vinculado al sprint " + linked.getIdSprint() : " (sin sprint; puedes asignarlo después desde la UI).");
    }

    @Transactional
    public String updateIssueFields(Integer projectId, Integer userId, JsonNode a) {
        if (!canMutateIssue(userId, projectId)) {
            return "No tienes permiso para editar issues.";
        }
        Integer id = intArg(a, "issue_id");
        if (id == null || !issueInProject(id, projectId)) {
            return "Issue inválido para este proyecto.";
        }
        var opt = issuesService.findById(id);
        if (opt.isEmpty()) {
            return "Issue no encontrado.";
        }
        Issues issue = opt.get();
        if (strArg(a, "title") != null) {
            issue.setTituloIssue(strArg(a, "title"));
        }
        if (strArg(a, "description") != null) {
            issue.setDescripcionIssue(strArg(a, "description"));
        }
        if (strArg(a, "purpose") != null) {
            issue.setPropositoIssue(strArg(a, "purpose"));
        }
        if (strArg(a, "priority") != null) {
            issue.setPrioridadIssue(strArg(a, "priority"));
        }
        if (a.has("story_points") && !a.get("story_points").isNull()) {
            issue.setStoryPointsIssue(intArg(a, "story_points"));
        }
        if (strArg(a, "due_date") != null) {
            LocalDate due = dateArg(a, "due_date", null);
            if (due == null) return "due_date debe usar el formato yyyy-MM-dd.";
            issue.setFechaFinIssue(due);
        }
        if (a.has("estimated_hours") && !a.get("estimated_hours").isNull()) {
            double hours = a.get("estimated_hours").asDouble();
            if (hours < 0 || hours > 999) return "estimated_hours debe estar entre 0 y 999.";
            issue.setHorasEstimadas(java.math.BigDecimal.valueOf(hours));
        }
        issuesService.save(issue);
        return "Issue #" + id + " actualizado.";
    }

    @Transactional
    public String setIssueAssignees(Integer projectId, Integer userId, JsonNode a) {
        if (!canMutateIssue(userId, projectId)) {
            return "No tienes permiso para editar issues (canEditIssue).";
        }
        Integer issueId = intArg(a, "issue_id");
        if (issueId == null || !issueInProject(issueId, projectId)) {
            return "Issue inválido para este proyecto.";
        }
        if (!canSeeIssue(userId, projectId, issueId)) {
            return "No tienes permiso para ver este issue.";
        }
        List<Integer> fromIds = intArrayArg(a, "assignee_user_ids");
        List<String> fromNames = stringArrayArg(a, "assignee_usernames");
        if (fromIds.isEmpty() && fromNames.isEmpty()) {
            return "Indica assignee_user_ids y/o assignee_usernames (al menos un asignado).";
        }
        return doReplaceIssueAssignees(projectId, userId, issueId, fromIds, fromNames);
    }

    private String doReplaceIssueAssignees(Integer projectId, Integer userId, int issueId, List<Integer> fromIds, List<String> fromNames) {
        Proyecto pro = proyectoService.findById(projectId).orElse(null);
        if (pro == null || pro.getEquipo() == null) {
            return "Proyecto sin equipo.";
        }
        int equipoId = pro.getEquipo().getIdEquipo();
        Set<Integer> teamIds = infoUsuarioEquipoRepository.findByEquipoIdEquipo(equipoId).stream()
                .map(x -> x.getUsuario().getIdUsuario())
                .collect(Collectors.toSet());
        LinkedHashSet<Integer> target = new LinkedHashSet<>();
        for (Integer aid : fromIds) {
            if (!teamIds.contains(aid)) {
                return "El usuario id " + aid + " no es miembro del equipo del proyecto.";
            }
            target.add(aid);
        }
        for (String name : fromNames) {
            Optional<Integer> uid = resolveUsernameInTeam(name, teamIds);
            if (uid.isEmpty()) {
                return "No hay miembro del equipo con nombre de usuario «" + name
                        + "». Usa el mismo nombre que en SprintOps (list_sprint_issues / miembros del proyecto).";
            }
            target.add(uid.get());
        }
        Issues issue = issuesService.findById(issueId).orElseThrow();
        asignacionIssuesRepository.findByIssueIdIssue(issueId).forEach(asignacionIssuesRepository::delete);
        for (Integer aid : target) {
            Usuario u = usuarioService.findById(aid).orElseThrow();
            AsignacionIssues row = new AsignacionIssues();
            row.setId(new AsignacionIssuesId(aid, issueId));
            row.setUsuario(u);
            row.setIssue(issue);
            asignacionIssuesRepository.save(row);
        }
        return "Issue #" + issueId + " asignado a usuario(s): " + target.stream().map(String::valueOf).collect(Collectors.joining(", "));
    }

    @Transactional
    public String assignIssueByTitle(Integer projectId, Integer userId, JsonNode a) {
        if (!canMutateIssue(userId, projectId)) {
            return "No tienes permiso para editar issues (canEditIssue).";
        }
        if (!perm(userId, projectId, "canViewAllIssues") && !perm(userId, projectId, "canViewOnlyOwnIssues")) {
            return "No tienes permiso para buscar issues.";
        }
        String titleQ = strArg(a, "title_contains");
        if (titleQ == null || titleQ.isEmpty()) {
            return "Indica title_contains (fragmento del título del issue).";
        }
        Integer sprintF = intArg(a, "sprint_id");
        String statusF = strArg(a, "status");
        String statusNorm = statusF != null ? statusF.trim().toLowerCase(Locale.ROOT) : null;
        List<Issues> matches = collectMatchingIssues(projectId, userId, titleQ, sprintF, statusNorm);
        matches.sort(Comparator.comparing(Issues::getIdIssue));
        if (matches.isEmpty()) {
            return "No hay ningún issue visible que coincida con ese título"
                    + (sprintF != null ? " en el sprint " + sprintF : "")
                    + ". Revisa el nombre o usa list_project_sprints para ver sprint_id.";
        }
        if (matches.size() > 1) {
            StringBuilder sb = new StringBuilder("Varios issues coinciden (").append(matches.size())
                    .append("). Acota title_contains o pasa sprint_id. Ejemplos:\n");
            int show = Math.min(8, matches.size());
            for (int i = 0; i < show; i++) {
                Issues iss = matches.get(i);
                String sprintIds = descIssueRepository.findByIssueIdIssue(iss.getIdIssue()).stream()
                        .map(d -> String.valueOf(d.getSprint().getIdSprint()))
                        .collect(Collectors.joining(","));
                sb.append("- issue_id=").append(iss.getIdIssue()).append(" \"").append(safe(iss.getTituloIssue()))
                        .append("\" sprint(s)=").append(sprintIds.isEmpty() ? "-" : sprintIds).append("\n");
            }
            if (matches.size() > show) {
                sb.append("…\n");
            }
            return sb.toString();
        }
        int issueId = matches.get(0).getIdIssue();
        if (!issueInProject(issueId, projectId) || !canSeeIssue(userId, projectId, issueId)) {
            return "Issue inválido o sin permiso.";
        }
        List<Integer> fromIds = intArrayArg(a, "assignee_user_ids");
        List<String> fromNames = stringArrayArg(a, "assignee_usernames");
        if (fromIds.isEmpty() && fromNames.isEmpty()) {
            return "Indica assignee_user_ids y/o assignee_usernames (al menos un asignado).";
        }
        return doReplaceIssueAssignees(projectId, userId, issueId, fromIds, fromNames);
    }

    private Optional<Integer> resolveUsernameInTeam(String rawName, Set<Integer> teamIds) {
        String n = rawName.trim();
        if (n.isEmpty()) {
            return Optional.empty();
        }
        for (Integer tid : teamIds) {
            Optional<Usuario> u = usuarioService.findById(tid);
            if (u.isEmpty()) {
                continue;
            }
            String nu = u.get().getNombreUsuario();
            if (nu != null && nu.equalsIgnoreCase(n)) {
                return Optional.of(tid);
            }
        }
        return Optional.empty();
    }

    private String doSetIssueStatus(Integer projectId, int id, String s) {
        if (!issueInProject(id, projectId)) {
            return "Issue no pertenece al proyecto.";
        }
        var opt = issuesService.findById(id);
        if (opt.isEmpty()) {
            return "Issue no encontrado.";
        }
        Issues issue = opt.get();
        issue.setEstadoIssue(s);
        if ("done".equals(s)) {
            issue.setFechaFinIssue(LocalDate.now());
        }
        issuesService.save(issue);
        return "Estado del issue #" + id + " → " + s;
    }

    @Transactional
    public String setIssueStatus(Integer projectId, Integer userId, JsonNode a) {
        if (!canMutateIssue(userId, projectId)) {
            return "No tienes permiso para editar issues.";
        }
        Integer id = intArg(a, "issue_id");
        String status = strArg(a, "status");
        if (id == null || status == null) {
            return "Indica issue_id y status (todo, in_progress, done o blocked).";
        }
        String s = status.trim().toLowerCase(Locale.ROOT);
        if (!Set.of("todo", "in_progress", "done", "blocked").contains(s)) {
            return "Estado no válido. Usa todo, in_progress, done o blocked.";
        }
        return doSetIssueStatus(projectId, id, s);
    }

    @Transactional
    public String setIssueStatusByTitle(Integer projectId, Integer userId, JsonNode a) {
        if (!canMutateIssue(userId, projectId)) {
            return "No tienes permiso para editar issues.";
        }
        if (!perm(userId, projectId, "canViewAllIssues") && !perm(userId, projectId, "canViewOnlyOwnIssues")) {
            return "No tienes permiso para buscar issues.";
        }
        String titleQ = strArg(a, "title_contains");
        if (titleQ == null || titleQ.isEmpty()) {
            return "Indica title_contains (fragmento del título del issue).";
        }
        String status = strArg(a, "status");
        if (status == null || status.isEmpty()) {
            return "Indica status: todo, in_progress, done o blocked.";
        }
        String s = status.trim().toLowerCase(Locale.ROOT);
        if (!Set.of("todo", "in_progress", "done", "blocked").contains(s)) {
            return "Estado no válido. Usa todo, in_progress, done o blocked.";
        }
        Integer sprintF = intArg(a, "sprint_id");
        List<Issues> matches = collectMatchingIssues(projectId, userId, titleQ, sprintF, null);
        matches.sort(Comparator.comparing(Issues::getIdIssue));
        if (matches.isEmpty()) {
            return "No hay ningún issue visible que coincida con ese título"
                    + (sprintF != null ? " en el sprint " + sprintF : "")
                    + ". Revisa el nombre o usa list_project_sprints para ver sprint_id.";
        }
        if (matches.size() > 1) {
            StringBuilder sb = new StringBuilder("Varios issues coinciden (").append(matches.size())
                    .append("). Acota title_contains o pasa sprint_id. Ejemplos:\n");
            int show = Math.min(8, matches.size());
            for (int i = 0; i < show; i++) {
                Issues iss = matches.get(i);
                String sprintIds = descIssueRepository.findByIssueIdIssue(iss.getIdIssue()).stream()
                        .map(d -> String.valueOf(d.getSprint().getIdSprint()))
                        .collect(Collectors.joining(","));
                sb.append("- issue_id=").append(iss.getIdIssue()).append(" \"").append(safe(iss.getTituloIssue()))
                        .append("\" sprint(s)=").append(sprintIds.isEmpty() ? "-" : sprintIds).append("\n");
            }
            if (matches.size() > show) {
                sb.append("…\n");
            }
            return sb.toString();
        }
        int issueId = matches.get(0).getIdIssue();
        if (!issueInProject(issueId, projectId) || !canSeeIssue(userId, projectId, issueId)) {
            return "Issue inválido o sin permiso.";
        }
        return doSetIssueStatus(projectId, issueId, s);
    }

    @Transactional
    public String saveMyDaily(Integer projectId, Integer userId, JsonNode a) {
        Integer sprintId = intArg(a, "sprint_id");
        if (sprintId == null || !sprintInProject(sprintId, projectId)) {
            return "sprint_id inválido para este proyecto.";
        }
        LocalDate day = LocalDate.now();
        Reunion reunion = reunionRepository
                .findBySprintIdSprintAndFechaDeReunionAndTipoReunion(sprintId, day, DAILY_TYPE)
                .orElseGet(() -> {
                    var sp = sprintService.findById(sprintId).orElseThrow();
                    Reunion r = new Reunion();
                    r.setTipoReunion(DAILY_TYPE);
                    r.setFechaDeReunion(day);
                    r.setSprint(sp);
                    if (sp.getProyecto() != null) {
                        r.setProyecto(sp.getProyecto());
                    }
                    return reunionService.save(r);
                });
        var user = usuarioService.findById(userId).orElseThrow();
        RegistroReunion reg = registroReunionRepository
                .findByReunionIdReunionAndUsuarioIdUsuario(reunion.getIdReunion(), userId)
                .orElse(new RegistroReunion());
        reg.setQueHice(Optional.ofNullable(strArg(a, "done")).orElse(""));
        reg.setQueHare(Optional.ofNullable(strArg(a, "doing")).orElse(""));
        reg.setImpedimentos(Optional.ofNullable(strArg(a, "blockers")).orElse(""));
        reg.setReunion(reunion);
        reg.setUsuario(user);
        reg.setFechaHoraRegistro(LocalDateTime.now());
        registroReunionRepository.save(reg);
        return "Daily guardado para " + day + " (reunionId=" + reunion.getIdReunion() + ").";
    }

    @Transactional
    public String moveIssueNextSprint(Integer projectId, Integer userId, JsonNode a) {
        if (!canMutateIssue(userId, projectId)) {
            return "No tienes permiso para mover issues.";
        }
        Integer issueId = intArg(a, "issue_id");
        int fromSprintId = Optional.ofNullable(intArg(a, "from_sprint_id")).orElse(-1);
        int toSprintId = Optional.ofNullable(intArg(a, "to_sprint_id")).orElse(-1);
        if (issueId == null || fromSprintId < 0 || toSprintId < 0) {
            return "Indica issue_id, from_sprint_id y to_sprint_id.";
        }
        if (fromSprintId == toSprintId) {
            return "El sprint origen y destino deben ser distintos.";
        }
        if (!sprintInProject(fromSprintId, projectId) || !sprintInProject(toSprintId, projectId)) {
            return "Los sprints deben pertenecer al proyecto actual.";
        }
        if (!issueInProject(issueId, projectId)) {
            return "El issue no pertenece al proyecto.";
        }
        Issues issue = issuesService.findById(issueId).orElseThrow();
        Sprint fromSprint = sprintService.findById(fromSprintId).orElseThrow();
        Sprint toSprint = sprintService.findById(toSprintId).orElseThrow();
        Optional<DescIssue> linkOpt = descIssueRepository.findByIdSprintIdAndIdIssueId(fromSprintId, issueId);
        if (linkOpt.isEmpty()) {
            return "El issue no está vinculado al sprint origen.";
        }
        int movedPts = intArg(a, "story_points") != null
                ? Math.max(0, intArg(a, "story_points"))
                : Optional.ofNullable(issue.getStoryPointsIssue()).orElse(0);
        if ((issue.getStoryPointsIssue() == null || issue.getStoryPointsIssue() == 0) && movedPts > 0) {
            issue.setStoryPointsIssue(movedPts);
        }
        descIssueRepository.delete(linkOpt.get());
        descIssueRepository.findByIdSprintIdAndIdIssueId(toSprintId, issueId).ifPresent(descIssueRepository::delete);
        DescIssue newLink = new DescIssue();
        newLink.setId(new DescIssue.DescIssueId(toSprintId, issueId));
        newLink.setSprint(toSprint);
        newLink.setIssue(issue);
        newLink.setFechaEntrada(LocalDate.now());
        descIssueRepository.save(newLink);
        issue.setEstadoIssue("todo");
        issue.setFechaFinIssue(null);
        issuesService.save(issue);
        int prev = fromSprint.getIssuesEnviadosSiguiente() != null ? fromSprint.getIssuesEnviadosSiguiente() : 0;
        fromSprint.setIssuesEnviadosSiguiente(prev + 1);
        int prevPts = fromSprint.getStoryPointsEnviadosSiguiente() != null ? fromSprint.getStoryPointsEnviadosSiguiente() : 0;
        fromSprint.setStoryPointsEnviadosSiguiente(prevPts + movedPts);
        sprintService.save(fromSprint);
        LogsIssues log = new LogsIssues();
        log.setIssue(issue);
        log.setTipoAccion("Traslado a siguiente sprint");
        log.setActorLogIssue(String.valueOf(userId));
        String destName = toSprint.getNombreSprint() != null ? toSprint.getNombreSprint() : ("#" + toSprintId);
        log.setDescripcionLogIssue("Enviado al sprint \"" + destName + "\" vía asistente");
        log.setFechaCreacionLogIssue(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss")));
        logsIssuesService.save(log);
        return "Issue #" + issueId + " movido del sprint " + fromSprintId + " al " + toSprintId + ".";
    }

    @Transactional
    public String joinByCode(Integer userId, JsonNode a) {
        String key = JoinCodeRateLimiter.attemptKey(userId);
        var locked = joinCodeRateLimiter.lockRemaining(key);
        if (locked.isPresent()) {
            return JoinCodeRateLimiter.lockMessage(locked.get());
        }
        String code = strArg(a, "code");
        if (code == null || !code.matches("[A-Za-z0-9]{5,6}")) {
            joinCodeRateLimiter.recordFailure(key);
            return "El código debe tener 5 o 6 caracteres, con letras y números. Respeta mayúsculas y minúsculas.";
        }
        var optP = proyectoService.findByCodigoProyecto(code);
        if (optP.isEmpty()) {
            joinCodeRateLimiter.recordFailure(key);
            var nowLocked = joinCodeRateLimiter.lockRemaining(key);
            if (nowLocked.isPresent()) {
                return JoinCodeRateLimiter.lockMessage(nowLocked.get());
            }
            return JoinCodeRateLimiter.UNKNOWN_CODE;
        }
        joinCodeRateLimiter.reset(key);
        Proyecto p = optP.get();
        if (p.getEquipo() == null) {
            return "Proyecto sin equipo configurado.";
        }
        int equipoId = p.getEquipo().getIdEquipo();
        var existing = infoUsuarioEquipoRepository.findById(new InfoUsuarioEquipoId(equipoId, userId));
        if (existing.isPresent()) {
            return "Ya eres miembro del proyecto \"" + safe(p.getNombreProyecto()) + "\" (id " + p.getIdProyecto() + ").";
        }
        var usuario = usuarioService.findById(userId).orElseThrow();
        InfoUsuarioEquipo info = new InfoUsuarioEquipo();
        info.setId(new InfoUsuarioEquipoId(equipoId, userId));
        info.setEquipo(p.getEquipo());
        info.setUsuario(usuario);
        info.setFechaUnionEquipo(LocalDate.now());
        infoUsuarioEquipoRepository.save(info);
        return "Te uniste al proyecto \"" + safe(p.getNombreProyecto()) + "\" (id " + p.getIdProyecto() + "). "
                + "Si no ves permisos, pide a un SM/PO que te asigne rol en el equipo.";
    }

    private String getInviteCode(Integer projectId, Integer userId) {
        return proyectoService.findById(projectId)
                .map(p -> "Código de invitación del proyecto: " + safe(p.getCodigoProyecto()))
                .orElse("Proyecto no encontrado.");
    }

    @Transactional
    public String createSprint(Integer projectId, Integer userId, JsonNode a) {
        if (!perm(userId, projectId, "canCreateSprint")) {
            return "No tienes permiso para crear sprints (canCreateSprint).";
        }
        String name = strArg(a, "name");
        if (name == null || name.isEmpty()) {
            return "Indica name, start_date, end_date (ISO).";
        }
        LocalDate start = dateArg(a, "start_date", null);
        LocalDate end = dateArg(a, "end_date", null);
        if (start == null || end == null) {
            return "Faltan start_date o end_date (formato yyyy-MM-dd).";
        }
        Proyecto p = proyectoService.findById(projectId).orElseThrow();
        String sprintDateError = ScheduleDates.sprintRangeError(
                start, end, p.getFechaInicioProyecto(), p.getFechaFinProyecto(),
                sprintRepository.findByProyectoIdProyecto(projectId));
        if (sprintDateError != null) {
            return sprintDateError;
        }
        Sprint sp = new Sprint();
        sp.setNombreSprint(name);
        sp.setObjetivoSprint(Optional.ofNullable(strArg(a, "goal")).orElse(""));
        sp.setEstadoDelSprint(Optional.ofNullable(strArg(a, "status")).orElse("P"));
        sp.setFechaInicioSprint(start);
        sp.setFechaFinSprint(end);
        sp.setCapacidadStoryPoints(intArg(a, "capacity"));
        sp.setProyecto(p);
        sp = sprintService.save(sp);
        return "Sprint creado con id " + sp.getIdSprint() + ".";
    }

    @Transactional
    public String updateSprint(Integer projectId, Integer userId, JsonNode a) {
        if (!perm(userId, projectId, "canCreateSprint")) {
            return "Necesitas canCreateSprint para editar sprints.";
        }
        Integer sid = intArg(a, "sprint_id");
        if (sid == null || !sprintInProject(sid, projectId)) {
            return "sprint_id inválido.";
        }
        Sprint sp = sprintService.findById(sid).orElseThrow();
        if (strArg(a, "name") != null) {
            sp.setNombreSprint(strArg(a, "name"));
        }
        if (strArg(a, "goal") != null) {
            sp.setObjetivoSprint(strArg(a, "goal"));
        }
        if (strArg(a, "status") != null) {
            sp.setEstadoDelSprint(strArg(a, "status"));
        }
        if (strArg(a, "start_date") != null) {
            sp.setFechaInicioSprint(LocalDate.parse(strArg(a, "start_date")));
        }
        if (strArg(a, "end_date") != null) {
            sp.setFechaFinSprint(LocalDate.parse(strArg(a, "end_date")));
        }
        if (a.has("capacity") && !a.get("capacity").isNull()) {
            sp.setCapacidadStoryPoints(intArg(a, "capacity"));
        }
        sprintService.save(sp);
        return "Sprint " + sid + " actualizado.";
    }

    @Transactional
    public String updateProject(Integer projectId, Integer userId, JsonNode a) {
        if (!perm(userId, projectId, "canEditProjectDates")) {
            return "Necesitas canEditProjectDates para editar datos del proyecto.";
        }
        Proyecto p = proyectoService.findById(projectId).orElseThrow();
        if (strArg(a, "name") != null) {
            p.setNombreProyecto(strArg(a, "name"));
        }
        if (strArg(a, "description") != null) {
            p.setDescripcionProyecto(strArg(a, "description"));
        }
        if (strArg(a, "start") != null) {
            p.setFechaInicioProyecto(LocalDate.parse(strArg(a, "start")));
        }
        if (strArg(a, "end") != null) {
            p.setFechaFinProyecto(LocalDate.parse(strArg(a, "end")));
        }
        if (strArg(a, "status") != null) {
            p.setEstadoDelProyecto(strArg(a, "status"));
        }
        proyectoService.save(p);
        return "Proyecto actualizado.";
    }

    @Transactional
    public String setMemberRole(Integer projectId, Integer userId, JsonNode a) {
        if (!perm(userId, projectId, "canManageMembers")) {
            return "Necesitas canManageMembers para cambiar roles.";
        }
        Integer targetId = intArg(a, "target_user_id");
        if (targetId == null) {
            String uname = strArg(a, "target_username");
            if (uname != null) {
                targetId = usuarioRepository.findByNombreUsuario(uname).map(Usuario::getIdUsuario).orElse(null);
            }
        }
        String roleName = strArg(a, "role_name");
        if (targetId == null || roleName == null) {
            return "Indica target_user_id o target_username y role_name (Developer, Scrum Master, Product Owner).";
        }
        Proyecto proyecto = proyectoService.findById(projectId).orElseThrow();
        if (proyecto.getEquipo() == null) {
            return "Proyecto sin equipo.";
        }
        int equipoId = proyecto.getEquipo().getIdEquipo();
        var usuario = usuarioService.findById(targetId);
        if (usuario.isEmpty()) {
            return "Usuario no encontrado.";
        }
        var newRol = rolRepository.findByNombreRol(roleName);
        if (newRol.isEmpty()) {
            return "Rol no encontrado: " + roleName;
        }
        rolesDeUsuariosRepository.findByEquipo_IdEquipoAndUsuario_IdUsuario(equipoId, targetId)
                .ifPresent(rolesDeUsuariosRepository::delete);
        RolesDeUsuarios entry = new RolesDeUsuarios();
        entry.setId(new RolesDeUsuariosId(newRol.get().getIdRol(), equipoId, targetId));
        entry.setRol(newRol.get());
        entry.setEquipo(proyecto.getEquipo());
        entry.setUsuario(usuario.get());
        rolesDeUsuariosRepository.save(entry);
        return "Rol de usuario " + targetId + " actualizado a " + roleName + ".";
    }

    @Transactional
    public String createProjectRole(Integer projectId, Integer userId, JsonNode a) {
        if (!perm(userId, projectId, "canManageMembers")) {
            return "Necesitas canManageMembers para crear roles de proyecto.";
        }
        String name = strArg(a, "role_name");
        if (name == null || name.isEmpty()) {
            return "Indica role_name.";
        }
        Proyecto p = proyectoService.findById(projectId).orElseThrow();
        Rol r = new Rol();
        r.setNombreRol(name);
        r.setSistema(false);
        r.setProyecto(p);
        r = rolService.save(r);
        return "Rol de proyecto creado con id " + r.getIdRol() + ". Asigna permisos con set_role_permissions_by_name.";
    }

    @Transactional
    public String renameRole(Integer projectId, Integer userId, JsonNode a) {
        if (!perm(userId, projectId, "canManageMembers")) {
            return "Necesitas canManageMembers.";
        }
        Integer rid = intArg(a, "role_id");
        String newName = strArg(a, "new_name");
        if (rid == null || newName == null) {
            return "Indica role_id y new_name.";
        }
        Rol r = rolService.findById(rid).orElseThrow();
        if (Boolean.TRUE.equals(r.getSistema())) {
            return "No se renombran roles del sistema (sistema=true).";
        }
        if (r.getProyecto() == null || !r.getProyecto().getIdProyecto().equals(projectId)) {
            return "Ese rol no pertenece a este proyecto.";
        }
        r.setNombreRol(newName);
        rolService.save(r);
        return "Rol renombrado.";
    }

    @Transactional
    public String setRolePerms(Integer projectId, Integer userId, JsonNode a) {
        if (!perm(userId, projectId, "canManageMembers")) {
            return "Necesitas canManageMembers.";
        }
        Integer rid = intArg(a, "role_id");
        if (rid == null || !a.has("permission_names") || !a.get("permission_names").isArray()) {
            return "Indica role_id y permission_names (array de strings).";
        }
        Rol r = rolService.findById(rid).orElseThrow();
        if (Boolean.TRUE.equals(r.getSistema())) {
            return "No modificar permisos de roles globales del sistema desde aquí (afectaría a todos los proyectos). Crea un rol de proyecto.";
        }
        if (r.getProyecto() == null || !r.getProyecto().getIdProyecto().equals(projectId)) {
            return "El rol no pertenece a este proyecto.";
        }
        List<TablaPermisos> existing = tablaPermisosRepository.findByRolIdRol(rid);
        tablaPermisosRepository.deleteAll(existing);
        for (JsonNode n : a.get("permission_names")) {
            if (!n.isTextual()) {
                continue;
            }
            String pname = n.asText().trim();
            var pOpt = permisoRepository.findByNombrePermiso(pname);
            if (pOpt.isEmpty()) {
                continue;
            }
            TablaPermisos tp = new TablaPermisos();
            tp.setId(new TablaPermisosId(rid, pOpt.get().getIdPermiso()));
            tp.setRol(r);
            tp.setPermiso(pOpt.get());
            tablaPermisosRepository.save(tp);
        }
        return "Permisos del rol " + rid + " actualizados.";
    }

    private String listTrash(Integer projectId, Integer userId, JsonNode a) {
        if (!perm(userId, projectId, "canEditIssue") && !perm(userId, projectId, "canCreateSprint")) {
            return "Sin permiso para ver la papelera.";
        }
        Integer sprintId = intArg(a, "sprint_id");
        if (sprintId == null || !sprintInProject(sprintId, projectId)) {
            return "Indica sprint_id del proyecto.";
        }
        List<PapeleraIssue> list = papeleraIssueRepository.findBySprintIdOrderByFechaBorradoDesc(sprintId);
        if (list.isEmpty()) {
            return "Papelera vacía para ese sprint.";
        }
        StringBuilder sb = new StringBuilder("Papelera sprint ").append(sprintId).append(":\n");
        for (PapeleraIssue p : list) {
            sb.append("- id_papelera=").append(p.getId())
                    .append(" | ex_issue=").append(p.getOriginalIssueId())
                    .append(" | ").append(safe(p.getTitulo()))
                    .append(" | borrado=").append(p.getFechaBorrado())
                    .append("\n");
        }
        return sb.toString();
    }

    @Transactional
    public String restoreTrash(Integer projectId, Integer userId, JsonNode a) {
        if (!perm(userId, projectId, "canEditIssue")) {
            return "Necesitas permiso para restaurar issues.";
        }
        Integer trashId = intArg(a, "papelera_id");
        if (trashId == null) {
            return "Indica papelera_id.";
        }
        var optTrash = papeleraIssueRepository.findById(trashId);
        if (optTrash.isEmpty()) {
            return "Entrada de papelera no encontrada.";
        }
        PapeleraIssue trashed = optTrash.get();
        if (trashed.getProyectoId() != null && !trashed.getProyectoId().equals(projectId)) {
            return "Esa entrada no pertenece al proyecto actual.";
        }
        if (trashed.getSprintId() != null && !sprintInProject(trashed.getSprintId(), projectId)) {
            return "El sprint de la papelera no coincide con el proyecto.";
        }
        Issues issue = new Issues();
        issue.setTituloIssue(trashed.getTitulo());
        issue.setDescripcionIssue(trashed.getDescripcion());
        issue.setPropositoIssue(trashed.getProposito());
        issue.setEstadoIssue(trashed.getEstado());
        issue.setPrioridadIssue(trashed.getPrioridad());
        issue.setStoryPointsIssue(trashed.getStoryPoints());
        issue.setParentIssueId(trashed.getParentIssueId());
        issue.setFechaCreacionIssue(trashed.getFechaCreacionIssue() != null ? trashed.getFechaCreacionIssue() : LocalDate.now());
        proyectoService.findById(projectId).ifPresent(issue::setProyecto);
        Sprint linkedSprint = null;
        if (trashed.getSprintId() != null) {
            linkedSprint = sprintService.findById(trashed.getSprintId()).orElse(null);
            if (linkedSprint != null && issue.getProyecto() == null && linkedSprint.getProyecto() != null) {
                issue.setProyecto(linkedSprint.getProyecto());
            }
        }
        issue = issuesService.save(issue);
        if (linkedSprint != null) {
            DescIssue desc = new DescIssue();
            desc.setId(new DescIssue.DescIssueId(linkedSprint.getIdSprint(), issue.getIdIssue()));
            desc.setSprint(linkedSprint);
            desc.setIssue(issue);
            desc.setFechaEntrada(LocalDate.now());
            descIssueRepository.save(desc);
        }
        LogsIssues logRestore = new LogsIssues();
        logRestore.setTipoAccion("Restaurado desde papelera");
        logRestore.setDescripcionLogIssue("Issue restaurado vía asistente");
        logRestore.setActorLogIssue(String.valueOf(userId));
        logRestore.setFechaCreacionLogIssue(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss")));
        logRestore.setIssue(issue);
        logsIssuesService.save(logRestore);
        papeleraIssueRepository.deleteById(trashId);
        return "Issue restaurado. Nuevo id de issue: " + issue.getIdIssue();
    }

    @Transactional
    public String deleteTrash(Integer projectId, Integer userId, JsonNode a) {
        if (!perm(userId, projectId, "canEditIssue")) {
            return "Sin permiso.";
        }
        Integer trashId = intArg(a, "papelera_id");
        if (trashId == null) {
            return "Indica papelera_id.";
        }
        var optTrash = papeleraIssueRepository.findById(trashId);
        if (optTrash.isEmpty()) {
            return "No encontrado.";
        }
        PapeleraIssue trashed = optTrash.get();
        if (trashed.getProyectoId() != null && !trashed.getProyectoId().equals(projectId)) {
            return "No pertenece a este proyecto.";
        }
        papeleraIssueRepository.deleteById(trashId);
        return "Entrada eliminada permanentemente de la papelera.";
    }

    @Transactional
    public String createNewProject(Integer userId, JsonNode a) {
        String name = strArg(a, "name");
        if (name == null || name.isEmpty()) {
            return "Indica name, description, start, end (ISO).";
        }
        LocalDate start = dateArg(a, "start", null);
        LocalDate end = dateArg(a, "end", null);
        if (start == null || end == null) {
            return "Faltan fechas start y end.";
        }
        String projectDateError = ScheduleDates.projectRangeError(start, end);
        if (projectDateError != null) {
            return projectDateError;
        }
        Equipo nuevoEquipo = new Equipo();
        nuevoEquipo.setNombreEquipo("Equipo " + name);
        nuevoEquipo.setDescripcion("Equipo del proyecto " + name);
        nuevoEquipo.setFechaCreacionEquipo(LocalDate.now());
        Equipo equipoGuardado = equipoService.save(nuevoEquipo);

        String codigo = proyectoService.nextUniqueCodigoProyecto();
        Proyecto proyecto = new Proyecto();
        proyecto.setNombreProyecto(name);
        proyecto.setDescripcionProyecto(Optional.ofNullable(strArg(a, "description")).orElse(""));
        proyecto.setCodigoProyecto(codigo);
        proyecto.setFechaInicioProyecto(start);
        proyecto.setFechaFinProyecto(end);
        proyecto.setEstadoDelProyecto("A");
        proyecto.setModoProyecto("agil");
        proyecto.setCotizacionHabilitada(false);
        proyecto.setEquipo(equipoGuardado);
        usuarioService.findById(userId).ifPresent(proyecto::setCreador);
        Proyecto proyectoGuardado = proyectoService.save(proyecto);

        Usuario ownerUser = usuarioService.findById(userId).orElse(null);
        if (ownerUser != null) {
            InfoUsuarioEquipo info = new InfoUsuarioEquipo();
            info.setId(new InfoUsuarioEquipoId(equipoGuardado.getIdEquipo(), userId));
            info.setEquipo(equipoGuardado);
            info.setUsuario(ownerUser);
            info.setFechaUnionEquipo(LocalDate.now());
            infoUsuarioEquipoRepository.save(info);
            rolRepository.findByNombreRol("Product Owner").ifPresent(poRol -> {
                RolesDeUsuarios roleEntry = new RolesDeUsuarios();
                roleEntry.setId(new RolesDeUsuariosId(poRol.getIdRol(), equipoGuardado.getIdEquipo(), userId));
                roleEntry.setRol(poRol);
                roleEntry.setEquipo(equipoGuardado);
                roleEntry.setUsuario(ownerUser);
                rolesDeUsuariosRepository.save(roleEntry);
            });
        }
        return "Proyecto creado con id " + proyectoGuardado.getIdProyecto() + " y código " + codigo
                + ". Ábrelo desde Inicio; el chatbot sigue asociado al proyecto donde estabas navegando.";
    }

    private static String reflectionHint() {
        return """
                La reflexión del sprint y el health check se guardan hoy en el cliente (página Reflexión), no en el servidor.
                Abre la vista de reflexión del sprint en la app para completarlos; cuando exista API en backend podremos automatizarlo desde aquí.
                """;
    }

    private static String safe(String s) {
        return s != null ? s : "";
    }
}
