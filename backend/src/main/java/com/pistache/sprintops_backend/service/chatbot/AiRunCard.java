package com.pistache.sprintops_backend.service.chatbot;

import tools.jackson.databind.JsonNode;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Tarjeta que ve el usuario cuando una herramienta escribe. Sin argumentos crudos. */
public final class AiRunCard {

    private static final Pattern ISSUE_CREATED = Pattern.compile("Issue creado con id (\\d+)");
    private static final Pattern SPRINT_MENTION = Pattern.compile("sprint (\\d+)");
    private static final Pattern DOCUMENT_CREATED = Pattern.compile("Documento creado con id (\\d+)");
    private static final Pattern SPRINT_CREATED = Pattern.compile("Sprint creado con id (\\d+)");

    private AiRunCard() {
    }

    public static Map<String, Object> running(String id, String tool, JsonNode args, String project) {
        return card(id, tool, args, project, "running", null, null);
    }

    public static Map<String, Object> present(String id, String tool, JsonNode args, String project, String result, Integer retryId) {
        Map<String, Object> card = finished(id, tool, args, project, AiUndo.strip(result), retryId);
        if ("done".equals(card.get("phase"))) {
            Map<String, Object> undo = AiUndo.from(result);
            if (undo != null) card.put("undo", undo);
        }
        return card;
    }

    public static Map<String, Object> finished(String id, String tool, JsonNode args, String project, String result, Integer retryId) {
        boolean ok = !failed(result);
        return card(id, tool, args, project, ok ? "done" : "failed", result, ok ? null : retryId);
    }

    public static boolean succeeded(String result) {
        return !failed(result);
    }

    public static boolean canRetry(String tool, String result) {
        if (!failed(result) || AiActionPolicy.highRisk(tool)) return false;
        String low = result.trim().toLowerCase(Locale.ROOT);
        if (low.startsWith("esa acción ya") || low.startsWith("error ejecutando") || low.startsWith("pendiente de autorización")) {
            return false;
        }
        return true;
    }

    private static boolean failed(String result) {
        if (result == null || result.isBlank()) return true;
        String low = result.trim().toLowerCase(Locale.ROOT);
        return low.startsWith("no ")
                || low.startsWith("necesitas ")
                || low.startsWith("indica ")
                || low.startsWith("falta ")
                || low.startsWith("faltan ")
                || low.startsWith("error")
                || low.startsWith("esa ")
                || low.startsWith("ese ")
                || low.startsWith("sin permiso")
                || low.startsWith("herramienta ")
                || low.startsWith("pendiente de autorización")
                || low.startsWith("issue inválido")
                || low.startsWith("issue no ")
                || low.startsWith("estado no ")
                || low.startsWith("due_date")
                || low.startsWith("estimated_hours")
                || low.startsWith("el ")
                || low.startsWith("ya eres")
                || low.startsWith("usuario no ")
                || low.startsWith("rol no ")
                || low.startsWith("proyecto sin ")
                || low.startsWith("sprint_id inválido")
                || low.startsWith("los sprints")
                || low.startsWith("el código");
    }

    private static Map<String, Object> card(String id, String tool, JsonNode args, String project, String phase, String result, Integer retryId) {
        String operation = AiToolCatalog.operation(tool);
        String kind = kind(operation);
        String verb = verb(operation);
        boolean ok = !"failed".equals(phase);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", id);
        body.put("phase", phase);
        body.put("kind", kind);
        body.put("verb", verb);
        body.put("headline", headline(operation, phase));
        body.put("project", project == null || project.isBlank() ? "Este proyecto" : project);
        body.put("subjectLabel", subjectLabel(kind));
        body.put("subject", subject(args));
        body.put("status", "running".equals(phase) ? "En proceso…" : ok ? "Listo" : "No se completó");
        if (!ok && result != null && !result.isBlank()) body.put("error", plain(result));
        String href = ok ? href(operation, args, result) : null;
        if (href != null) {
            body.put("href", href);
            body.put("linkLabel", linkLabel(kind));
        }
        if (retryId != null) body.put("retryId", retryId);
        return body;
    }

    private static String kind(String operation) {
        if (operation.contains("document")) return "documento";
        if (operation.contains("sprint") || operation.contains("retro") || operation.contains("daily")) return "sprint";
        if (operation.contains("note")) return "nota";
        return "tarea";
    }

    private static String verb(String operation) {
        if (operation.startsWith("create") || operation.startsWith("save") || operation.startsWith("restore")) return "crear";
        return "actualizar";
    }

    private static String headline(String operation, String phase) {
        boolean running = "running".equals(phase);
        boolean failed = "failed".equals(phase);
        return switch (operation) {
            case "create_issue" -> running ? "Creando tarea…" : failed ? "No se pudo crear la tarea" : "Tarea creada correctamente";
            case "update_issue_fields", "set_issue_status", "set_issue_status_by_title", "set_issue_assignees", "assign_issue_by_title" ->
                    running ? "Actualizando tarea…" : failed ? "No se pudo actualizar la tarea" : "Tarea actualizada correctamente";
            case "move_issue_to_next_sprint" -> running ? "Moviendo la tarea…" : failed ? "No se pudo mover la tarea" : "Tarea movida correctamente";
            case "create_project_document" -> running ? "Creando documento…" : failed ? "No se pudo crear el documento" : "Documento creado correctamente";
            case "append_document_section", "replace_document_section", "add_document_table" ->
                    running ? "Actualizando documento…" : failed ? "No se pudo actualizar el documento" : "Documento actualizado correctamente";
            case "create_project_note" -> running ? "Creando nota…" : failed ? "No se pudo crear la nota" : "Nota creada correctamente";
            case "create_sprint" -> running ? "Creando el sprint…" : failed ? "No se pudo crear el sprint" : "Sprint creado correctamente";
            case "update_sprint_fields", "save_retro_item", "save_my_daily_standup" ->
                    running ? "Actualizando la planificación…" : failed ? "No se pudo actualizar la planificación" : "Planificación del sprint actualizada";
            case "delete_trash_permanently" -> running ? "Eliminando…" : failed ? "No se pudo eliminar" : "Elemento eliminado";
            case "restore_trash_item" -> running ? "Restaurando…" : failed ? "No se pudo restaurar" : "Elemento restaurado";
            default -> running ? "Aplicando cambios…" : failed ? "No se pudo completar el cambio" : "Cambio aplicado";
        };
    }

    private static String subjectLabel(String kind) {
        return switch (kind) {
            case "documento", "sprint" -> "Nombre";
            case "nota" -> "Nota";
            default -> "Título";
        };
    }

    private static String linkLabel(String kind) {
        return switch (kind) {
            case "documento" -> "Abrir documento";
            case "sprint" -> "Abrir sprint";
            default -> "Abrir tarea";
        };
    }

    private static String subject(JsonNode args) {
        if (args == null) return "";
        for (String key : new String[] {"title", "name", "title_contains", "heading", "text"}) {
            String value = args.path(key).asText("").trim();
            if (!value.isEmpty()) return value.length() > 80 ? value.substring(0, 80) : value;
        }
        return "";
    }

    private static String href(String operation, JsonNode args, String result) {
        if (result == null) result = "";
        Matcher issue = ISSUE_CREATED.matcher(result);
        if (issue.find()) {
            String sprint = args == null ? "" : args.path("sprint_id").asText("");
            Matcher mentioned = SPRINT_MENTION.matcher(result);
            if (mentioned.find()) sprint = mentioned.group(1);
            if (sprint.matches("\\d+")) return "/sprint/" + sprint + "/planning/task/" + issue.group(1);
        }
        Matcher document = DOCUMENT_CREATED.matcher(result);
        if (document.find()) return "/portafolio/" + document.group(1);
        if (operation.contains("document")) {
            String id = args == null ? "" : args.path("document_id").asText("");
            if (id.matches("\\d+")) return "/portafolio/" + id;
        }
        Matcher sprint = SPRINT_CREATED.matcher(result);
        if (sprint.find()) return "/sprint/" + sprint.group(1);
        if (operation.contains("sprint") || operation.contains("retro") || operation.contains("daily")) {
            String id = args == null ? "" : args.path("sprint_id").asText("");
            if (id.matches("\\d+")) return "/sprint/" + id;
        }
        return null;
    }

    private static String plain(String result) {
        String text = result.trim();
        int line = text.indexOf('\n');
        if (line > 0) text = text.substring(0, line);
        return text.length() > 180 ? text.substring(0, 180) : text;
    }
}
