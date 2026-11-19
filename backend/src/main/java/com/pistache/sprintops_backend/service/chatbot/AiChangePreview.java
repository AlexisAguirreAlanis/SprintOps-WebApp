package com.pistache.sprintops_backend.service.chatbot;

import tools.jackson.databind.JsonNode;
import com.pistache.sprintops_backend.model.AsignacionIssues;
import com.pistache.sprintops_backend.model.DescIssue;
import com.pistache.sprintops_backend.model.Hoja;
import com.pistache.sprintops_backend.model.Issues;
import com.pistache.sprintops_backend.model.Proyecto;
import com.pistache.sprintops_backend.model.Sprint;
import com.pistache.sprintops_backend.repository.AsignacionIssuesRepository;
import com.pistache.sprintops_backend.repository.DescIssueRepository;
import com.pistache.sprintops_backend.repository.HojaRepository;
import com.pistache.sprintops_backend.repository.IssuesRepository;
import com.pistache.sprintops_backend.repository.SprintRepository;
import com.pistache.sprintops_backend.service.ProyectoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Arma la vista previa. No escribe. */
@Service
public class AiChangePreview {

    private static final Pattern HEADING = Pattern.compile("(?is)<h([1-3])\\b[^>]*>(.*?)</h\\1>");

    @Autowired
    private IssuesRepository issuesRepository;
    @Autowired
    private SprintRepository sprintRepository;
    @Autowired
    private HojaRepository hojaRepository;
    @Autowired
    private DescIssueRepository descIssueRepository;
    @Autowired
    private AsignacionIssuesRepository asignacionIssuesRepository;
    @Autowired
    private ProyectoService proyectoService;

    public View inspect(String tool, JsonNode args, Integer projectId) {
        View view = new View();
        view.highRisk = AiActionPolicy.highRisk(tool);
        view.scope = AiActionPolicy.scope(tool);
        try {
            switch (tool) {
                case "update_issue_fields" -> issueFields(view, args, projectId);
                case "set_issue_status", "set_issue_status_by_title" -> issueStatus(view, tool, args, projectId);
                case "set_issue_assignees", "assign_issue_by_title" -> issueAssignees(view, tool, args, projectId);
                case "move_issue_to_next_sprint" -> moveIssue(view, args, projectId);
                case "create_issue" -> createIssue(view, args);
                case "create_sprint" -> createSprint(view, args);
                case "update_sprint_fields" -> updateSprint(view, args, projectId);
                case "create_project_document" -> createDocument(view, args);
                case "append_document_section" -> appendDocument(view, args, projectId);
                case "replace_document_section" -> replaceDocument(view, args, projectId);
                case "add_document_table" -> tableDocument(view, args, projectId);
                case "create_project_note" -> createNote(view, args);
                case "save_retro_item" -> retro(view, args, projectId);
                case "update_project_fields" -> updateProject(view, args, projectId);
                case "delete_trash_permanently" -> risky(view, "Papelera", "Eliminar definitivamente un elemento de la papelera.");
                case "create_new_project" -> risky(view, "Proyecto nuevo", "Crear el proyecto \"" + text(args, "name") + "\".");
                case "join_project_by_invite_code" -> risky(view, "Otro proyecto", "Unirse a un proyecto con un código de invitación.");
                case "set_team_member_role", "create_project_role", "rename_role", "set_role_permissions_by_name" ->
                        risky(view, "Administración del equipo", "Cambiar roles o permisos del equipo.");
                default -> fallback(view, tool);
            }
        } catch (RuntimeException ex) {
            view.applicable = false;
            view.blockedReason = "No pude preparar la vista previa de ese cambio.";
        }
        if (view.applicable && view.summary.isEmpty() && "update_issue_fields".equals(tool)) {
            view.applicable = false;
            view.blockedReason = "No hay cambios que aplicar.";
        }
        if (view.highRisk) {
            view.warning = "Esta acción pide confirmación aunque Permitir todo esté activo.";
        }
        return view;
    }

    public View combine(List<View> views) {
        View merged = new View();
        if (views == null || views.isEmpty()) {
            merged.applicable = false;
            merged.blockedReason = "No hay cambios que aplicar.";
            return merged;
        }
        for (View view : views) {
            if (!view.applicable) return view;
        }
        String target = views.get(0).target;
        boolean sameTarget = views.stream().allMatch(view -> target.equals(view.target));
        merged.target = sameTarget ? target : "Cambios en este proyecto";
        merged.highRisk = views.stream().anyMatch(view -> view.highRisk);
        merged.scope = views.get(0).scope;
        if (merged.highRisk) merged.warning = "Esta acción pide confirmación aunque Permitir todo esté activo.";
        for (View view : views) {
            merged.summary.addAll(view.summary);
            merged.fields.addAll(view.fields);
            merged.diff.addAll(view.diff);
        }
        if (merged.summary.size() > 8) merged.summary = new ArrayList<>(merged.summary.subList(0, 8));
        return merged;
    }

    private void issueFields(View view, JsonNode args, Integer projectId) {
        Issues issue = requireIssue(view, args, projectId);
        if (issue == null) return;
        view.target = "Tarea: " + safe(issue.getTituloIssue());
        change(view, "Título", issue.getTituloIssue(), text(args, "title"));
        change(view, "Prioridad", label(issue.getPrioridadIssue()), label(text(args, "priority")));
        change(view, "Puntos", string(issue.getStoryPointsIssue()), text(args, "story_points"));
        change(view, "Fecha límite", string(issue.getFechaFinIssue()), text(args, "due_date"));
        change(view, "Horas estimadas", string(issue.getHorasEstimadas()), text(args, "estimated_hours"));
        String description = text(args, "description");
        if (description != null && !description.equals(safe(issue.getDescripcionIssue()))) {
            view.summary.add("Editar la descripción.");
            view.diff.addAll(diffWords(safe(issue.getDescripcionIssue()), description));
        }
        String purpose = text(args, "purpose");
        if (purpose != null && !purpose.equals(safe(issue.getPropositoIssue()))) {
            view.summary.add("Editar el propósito.");
        }
    }

    private void issueStatus(View view, String tool, JsonNode args, Integer projectId) {
        if ("set_issue_status_by_title".equals(tool)) {
            view.target = "Tarea: " + safe(text(args, "title_contains"));
            view.summary.add("Modificar el estado.");
            change(view, "Estado", "Actual", label(text(args, "status")));
            return;
        }
        Issues issue = requireIssue(view, args, projectId);
        if (issue == null) return;
        view.target = "Tarea: " + safe(issue.getTituloIssue());
        change(view, "Estado", label(issue.getEstadoIssue()), label(text(args, "status")));
        if (view.summary.isEmpty()) view.summary.add("Modificar el estado.");
    }

    private void issueAssignees(View view, String tool, JsonNode args, Integer projectId) {
        String after = joinNames(args);
        if ("assign_issue_by_title".equals(tool)) {
            view.target = "Tarea: " + safe(text(args, "title_contains"));
            view.summary.add("Asignar responsables.");
            change(view, "Responsables", "Actuales", after);
            return;
        }
        Issues issue = requireIssue(view, args, projectId);
        if (issue == null) return;
        view.target = "Tarea: " + safe(issue.getTituloIssue());
        List<String> names = new ArrayList<>();
        for (AsignacionIssues row : asignacionIssuesRepository.findByIssueIdIssue(issue.getIdIssue())) {
            if (row.getUsuario() != null) names.add(safe(row.getUsuario().getNombreUsuario()));
        }
        change(view, "Responsables", names.isEmpty() ? "Sin asignar" : String.join(", ", names), after);
        if (view.summary.isEmpty()) view.summary.add("Asignar responsables.");
    }

    private void moveIssue(View view, JsonNode args, Integer projectId) {
        Issues issue = requireIssue(view, args, projectId);
        if (issue == null) return;
        Sprint from = requireSprint(view, intValue(args, "from_sprint_id"), projectId);
        Sprint to = requireSprint(view, intValue(args, "to_sprint_id"), projectId);
        if (!view.applicable || from == null || to == null) return;
        view.target = "Tarea: " + safe(issue.getTituloIssue());
        change(view, "Sprint", safe(from.getNombreSprint()), safe(to.getNombreSprint()));
        if (view.summary.isEmpty()) view.summary.add("Mover la tarea de sprint.");
    }

    private void createIssue(View view, JsonNode args) {
        view.target = "Tarea nueva";
        view.summary.add("Crear la tarea \"" + safe(text(args, "title")) + "\".");
        change(view, "Prioridad", "Sin definir", label(text(args, "priority")));
        change(view, "Estado", "Sin definir", label(text(args, "status")));
        change(view, "Fecha límite", "Sin definir", text(args, "due_date"));
    }

    private void createSprint(View view, JsonNode args) {
        view.target = "Sprint nuevo";
        view.summary.add("Crear el sprint \"" + safe(text(args, "name")) + "\".");
        change(view, "Inicio", "Sin definir", text(args, "start_date"));
        change(view, "Fin", "Sin definir", text(args, "end_date"));
    }

    private void updateSprint(View view, JsonNode args, Integer projectId) {
        Sprint sprint = requireSprint(view, intValue(args, "sprint_id"), projectId);
        if (sprint == null) return;
        view.target = "Sprint: " + safe(sprint.getNombreSprint());
        change(view, "Nombre", sprint.getNombreSprint(), text(args, "name"));
        change(view, "Objetivo", sprint.getObjetivoSprint(), text(args, "goal"));
        change(view, "Estado", sprint.getEstadoDelSprint(), text(args, "status"));
        change(view, "Inicio", string(sprint.getFechaInicioSprint()), text(args, "start_date"));
        change(view, "Fin", string(sprint.getFechaFinSprint()), text(args, "end_date"));
        if (view.summary.isEmpty()) view.summary.add("Actualizar el sprint.");
    }

    private void createDocument(View view, JsonNode args) {
        String name = safe(text(args, "name"));
        view.target = "Documento: " + name;
        view.summary.add("Crear el documento \"" + name + "\".");
        StringBuilder added = new StringBuilder();
        if (args.path("blocks").isArray()) {
            for (JsonNode block : args.path("blocks")) {
                String line = block.asText("").trim();
                if (line.isEmpty()) continue;
                String heading = line.split("\\n", 2)[0].trim();
                view.summary.add("Agregar sección de " + heading + ".");
                added.append(line).append('\n');
            }
        }
        view.diff.addAll(diffWords("", added.toString()));
    }

    private void appendDocument(View view, JsonNode args, Integer projectId) {
        Hoja hoja = requireDocument(view, intValue(args, "document_id"), projectId);
        if (hoja == null) return;
        String heading = safe(text(args, "heading"));
        view.target = "Documento: " + safe(hoja.getNombre());
        view.summary.add("Agregar sección de " + heading + ".");
        view.diff.addAll(diffWords("", heading + "\n" + safe(text(args, "body"))));
    }

    private void replaceDocument(View view, JsonNode args, Integer projectId) {
        Hoja hoja = requireDocument(view, intValue(args, "document_id"), projectId);
        if (hoja == null) return;
        String heading = safe(text(args, "heading"));
        view.target = "Documento: " + safe(hoja.getNombre());
        view.summary.add("Modificar " + heading + ".");
        view.diff.addAll(diffWords(sectionText(hoja.getDocumento(), heading), heading + "\n" + safe(text(args, "body"))));
    }

    private void tableDocument(View view, JsonNode args, Integer projectId) {
        Hoja hoja = requireDocument(view, intValue(args, "document_id"), projectId);
        if (hoja == null) return;
        String caption = safe(text(args, "caption"));
        view.target = "Documento: " + safe(hoja.getNombre());
        view.summary.add(caption.isEmpty() ? "Agregar una tabla." : "Agregar tabla de " + caption + ".");
        StringBuilder added = new StringBuilder(caption);
        if (args.path("rows").isArray()) {
            for (JsonNode row : args.path("rows")) added.append('\n').append(row.asText(""));
        }
        view.diff.addAll(diffWords("", added.toString()));
    }

    private void createNote(View view, JsonNode args) {
        view.target = "Nota nueva";
        view.summary.add("Crear una nota.");
        view.diff.addAll(diffWords("", safe(text(args, "text"))));
    }

    private void retro(View view, JsonNode args, Integer projectId) {
        Sprint sprint = requireSprint(view, intValue(args, "sprint_id"), projectId);
        if (sprint == null) return;
        view.target = "Sprint: " + safe(sprint.getNombreSprint());
        view.summary.add("Preparar un punto de retrospectiva.");
        change(view, "Lo bueno", "Sin definir", text(args, "good"));
        change(view, "Lo malo", "Sin definir", text(args, "bad"));
        change(view, "A mejorar", "Sin definir", text(args, "improve"));
    }

    private void updateProject(View view, JsonNode args, Integer projectId) {
        Proyecto proyecto = proyectoService.findById(projectId).orElse(null);
        if (proyecto == null) {
            block(view, "Ese proyecto no existe.");
            return;
        }
        view.target = "Proyecto: " + safe(proyecto.getNombreProyecto());
        change(view, "Nombre", proyecto.getNombreProyecto(), text(args, "name"));
        change(view, "Descripción", proyecto.getDescripcionProyecto(), text(args, "description"));
        change(view, "Inicio", string(proyecto.getFechaInicioProyecto()), text(args, "start"));
        change(view, "Fin", string(proyecto.getFechaFinProyecto()), text(args, "end"));
        if (view.summary.isEmpty()) view.summary.add("Modificar la información del proyecto.");
    }

    private void risky(View view, String target, String line) {
        view.target = target;
        view.summary.add(line);
    }

    private void fallback(View view, String tool) {
        view.target = "Cambio en este proyecto";
        view.summary.add("Confirmar la acción " + tool + ".");
    }

    private Issues requireIssue(View view, JsonNode args, Integer projectId) {
        Integer id = intValue(args, "issue_id");
        Issues issue = id == null ? null : issuesRepository.findById(id).orElse(null);
        if (issue == null || !issueInProject(issue, projectId)) {
            block(view, "Esa tarea no pertenece a este proyecto.");
            return null;
        }
        return issue;
    }

    private Sprint requireSprint(View view, Integer id, Integer projectId) {
        Sprint sprint = id == null ? null : sprintRepository.findById(id).orElse(null);
        if (sprint == null || sprint.getProyecto() == null || !projectId.equals(sprint.getProyecto().getIdProyecto())) {
            block(view, "Ese sprint no pertenece a este proyecto.");
            return null;
        }
        return sprint;
    }

    private Hoja requireDocument(View view, Integer id, Integer projectId) {
        Hoja hoja = id == null ? null : hojaRepository.findById(id).orElse(null);
        if (hoja == null || hoja.getProyecto() == null || !projectId.equals(hoja.getProyecto().getIdProyecto())) {
            block(view, "Ese documento no pertenece a este proyecto.");
            return null;
        }
        if (hoja.isEliminada() || hoja.isArchivada()) {
            block(view, "El documento no está disponible para editar.");
            return null;
        }
        return hoja;
    }

    private boolean issueInProject(Issues issue, Integer projectId) {
        if (issue.getProyecto() != null) return projectId.equals(issue.getProyecto().getIdProyecto());
        for (DescIssue link : descIssueRepository.findByIssueIdIssue(issue.getIdIssue())) {
            if (link.getSprint() != null && link.getSprint().getProyecto() != null
                    && projectId.equals(link.getSprint().getProyecto().getIdProyecto())) {
                return true;
            }
        }
        return false;
    }

    private static void change(View view, String label, String before, String after) {
        if (after == null) return;
        String left = before == null || before.isBlank() ? "Sin definir" : before.trim();
        String right = after.isBlank() ? "Sin definir" : after.trim();
        if (left.equals(right)) return;
        Map<String, String> field = new LinkedHashMap<>();
        field.put("label", label);
        field.put("before", clip(left, 180));
        field.put("after", clip(right, 180));
        view.fields.add(field);
        view.summary.add("Cambiar " + label.toLowerCase(Locale.ROOT) + ".");
    }

    private static String sectionText(String document, String heading) {
        if (document == null || heading == null) return "";
        Matcher matcher = HEADING.matcher(document);
        while (matcher.find()) {
            String found = plain(matcher.group(2));
            if (!found.equalsIgnoreCase(heading)) continue;
            int from = matcher.end();
            Matcher next = HEADING.matcher(document);
            int to = document.length();
            if (next.find(matcher.end())) to = next.start();
            return found + "\n" + plain(document.substring(from, to));
        }
        return "";
    }

    static List<Map<String, String>> diffWords(String before, String after) {
        String[] left = words(before);
        String[] right = words(after);
        List<Map<String, String>> parts = new ArrayList<>();
        if (left.length > 160 || right.length > 160) {
            if (left.length > 0) parts.add(part("removed", String.join(" ", left).substring(0, Math.min(500, String.join(" ", left).length()))));
            if (right.length > 0) parts.add(part("added", String.join(" ", right).substring(0, Math.min(500, String.join(" ", right).length()))));
            return parts;
        }
        int n = left.length;
        int m = right.length;
        int[][] score = new int[n + 1][m + 1];
        for (int i = n - 1; i >= 0; i--) {
            for (int j = m - 1; j >= 0; j--) {
                score[i][j] = left[i].equals(right[j]) ? score[i + 1][j + 1] + 1 : Math.max(score[i + 1][j], score[i][j + 1]);
            }
        }
        int i = 0;
        int j = 0;
        String type = "";
        StringBuilder chunk = new StringBuilder();
        while (i < n && j < m) {
            String nextType;
            String word;
            if (left[i].equals(right[j])) {
                nextType = "same";
                word = left[i];
                i++;
                j++;
            } else if (score[i + 1][j] >= score[i][j + 1]) {
                nextType = "removed";
                word = left[i++];
            } else {
                nextType = "added";
                word = right[j++];
            }
            if (!nextType.equals(type) && chunk.length() > 0) {
                parts.add(part(type, chunk.toString().trim()));
                chunk.setLength(0);
            }
            type = nextType;
            chunk.append(word).append(' ');
        }
        while (i < n) {
            if (!"removed".equals(type) && chunk.length() > 0) {
                parts.add(part(type, chunk.toString().trim()));
                chunk.setLength(0);
            }
            type = "removed";
            chunk.append(left[i++]).append(' ');
        }
        while (j < m) {
            if (!"added".equals(type) && chunk.length() > 0) {
                parts.add(part(type, chunk.toString().trim()));
                chunk.setLength(0);
            }
            type = "added";
            chunk.append(right[j++]).append(' ');
        }
        if (chunk.length() > 0 && !type.isEmpty()) parts.add(part(type, chunk.toString().trim()));
        if (parts.size() > 80) return new ArrayList<>(parts.subList(0, 80));
        return parts;
    }

    private static Map<String, String> part(String type, String text) {
        Map<String, String> item = new LinkedHashMap<>();
        item.put("type", type);
        item.put("text", text);
        return item;
    }

    private static String[] words(String value) {
        String text = value == null ? "" : value.trim();
        if (text.isEmpty()) return new String[0];
        return text.split("\\s+");
    }

    private static String plain(String html) {
        if (html == null) return "";
        return html.replaceAll("<[^>]+>", " ")
                .replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"")
                .replaceAll("\\s+", " ").trim();
    }

    private static void block(View view, String reason) {
        view.applicable = false;
        view.blockedReason = reason;
    }

    private static String joinNames(JsonNode args) {
        List<String> names = new ArrayList<>();
        if (args.path("assignee_usernames").isArray()) {
            for (JsonNode node : args.path("assignee_usernames")) names.add(node.asText(""));
        }
        if (args.path("assignee_user_ids").isArray()) {
            for (JsonNode node : args.path("assignee_user_ids")) names.add("usuario " + node.asText(""));
        }
        return names.isEmpty() ? "Sin asignar" : String.join(", ", names);
    }

    private static String label(String value) {
        if (value == null || value.isBlank()) return null;
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "low", "baja" -> "Baja";
            case "medium", "media" -> "Media";
            case "high", "alta" -> "Alta";
            case "todo" -> "Por hacer";
            case "in_progress" -> "En progreso";
            case "done" -> "Finalizado";
            case "blocked" -> "Bloqueado";
            default -> value.trim();
        };
    }

    private static String text(JsonNode args, String field) {
        if (args == null || !args.has(field) || args.get(field).isNull()) return null;
        String value = args.get(field).asText();
        return value == null ? null : value.trim();
    }

    private static Integer intValue(JsonNode args, String field) {
        if (args == null || !args.has(field) || args.get(field).isNull()) return null;
        JsonNode value = args.get(field);
        if (value.isNumber()) return value.asInt();
        try {
            return Integer.valueOf(value.asText().trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String string(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private static String clip(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    public static final class View {
        private boolean applicable = true;
        private String blockedReason = "";
        private boolean highRisk;
        private String scope;
        private String target = "Cambio en este proyecto";
        private String warning;
        private List<String> summary = new ArrayList<>();
        private final List<Map<String, String>> fields = new ArrayList<>();
        private List<Map<String, String>> diff = new ArrayList<>();

        public boolean applicable() {
            return applicable;
        }

        public String blockedReason() {
            return blockedReason;
        }

        public boolean highRisk() {
            return highRisk;
        }

        public Map<String, Object> body() {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("title", "Cambios propuestos");
            body.put("target", target);
            body.put("summary", summary);
            body.put("fields", fields);
            body.put("diff", diff);
            body.put("highRisk", highRisk);
            body.put("scope", scope);
            body.put("warning", warning);
            return body;
        }
    }
}
