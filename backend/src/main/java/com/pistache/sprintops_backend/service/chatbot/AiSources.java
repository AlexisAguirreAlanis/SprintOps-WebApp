package com.pistache.sprintops_backend.service.chatbot;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Fuentes que el usuario puede abrir. Salen de la consulta de este turno, no de una invención. */
public final class AiSources {

    private static final Pattern ISSUE_ID = Pattern.compile("issue_id=(\\d+)");
    private static final Pattern TITLE = Pattern.compile("t[ií]tulo=\"([^\"]*)\"", Pattern.CASE_INSENSITIVE);
    private static final Pattern SPRINT_FIELD = Pattern.compile("sprint_id=(\\d+)");
    private static final Pattern SPRINTS_FIELD = Pattern.compile("sprint\\(s\\)=(\\d+)");
    private static final Pattern STATUS_FIELD = Pattern.compile("estado=([A-Za-z_]+)");
    private static final Pattern SPRINT_HEAD = Pattern.compile("Sprint id=(\\d+)(?: nombre=\"([^\"]*)\")?");
    private static final Pattern SPRINT_LIST = Pattern.compile("Issues del sprint (\\d+)");
    private static final Pattern DASH_ISSUE = Pattern.compile("^- #(\\d+) (.+)$");
    private static final Pattern ISSUE_CREATED = Pattern.compile("Issue creado con id (\\d+)");
    private static final Pattern SPRINT_LINKED = Pattern.compile("vinculado al sprint (\\d+)");
    private static final Pattern SPRINT_DETAIL = Pattern.compile("Sprint vinculado \\(si aplica\\): (\\d+)");
    private static final Pattern SPRINT_CREATED = Pattern.compile("Sprint creado con id (\\d+)");
    private static final Pattern DOC_CREATED = Pattern.compile("Documento creado con id (\\d+)(?: y nombre \"([^\"]*)\")?");
    private static final Pattern DOC_ID = Pattern.compile("documento_id=(\\d+)(?: nombre=\"([^\"]*)\")?");
    private static final Pattern ISSUE_LINE = Pattern.compile("^Issue #(\\d+)");

    private AiSources() {
    }

    public static List<Map<String, Object>> choose(String answer, List<String> toolResults, String retrieved) {
        List<Hit> fromTools = new ArrayList<>();
        if (toolResults != null) {
            for (String result : toolResults) fromTools.addAll(parse(result));
        }
        if (!fromTools.isEmpty()) return publish(fromTools);
        if (refusal(answer)) return List.of();
        List<Hit> context = parse(retrieved);
        List<Hit> used = new ArrayList<>();
        for (Hit hit : context) {
            if ("tarea".equals(hit.kind) && mentioned(answer, hit)) used.add(hit);
            if ("documento".equals(hit.kind) && mentioned(answer, hit)) used.add(hit);
        }
        if (used.isEmpty()) return List.of();
        for (Hit hit : used) {
            if (hit.sprintId == null) continue;
            boolean present = context.stream().anyMatch(item -> "sprint".equals(item.kind) && hit.sprintId.equals(item.id));
            if (!present) context.add(sprint(hit.sprintId, ""));
        }
        List<Hit> selected = new ArrayList<>();
        for (Hit hit : context) {
            if (!"sprint".equals(hit.kind)) continue;
            boolean parent = used.stream().anyMatch(item -> hit.id.equals(item.sprintId));
            if (parent || mentioned(answer, hit)) selected.add(hit);
        }
        selected.addAll(used);
        return publish(selected);
    }

    private static List<Hit> parse(String text) {
        List<Hit> hits = new ArrayList<>();
        if (text == null || text.isBlank() || failed(text)) return hits;
        String sprintContext = "";
        Hit lastTask = null;
        for (String raw : text.split("\n")) {
            String line = raw.trim();
            if (line.isEmpty()) continue;
            Matcher list = SPRINT_LIST.matcher(line);
            if (list.find()) sprintContext = list.group(1);
            Matcher sprint = SPRINT_HEAD.matcher(line);
            if (sprint.find()) hits.add(sprint(sprint.group(1), sprint.group(2)));
            Matcher createdSprint = SPRINT_CREATED.matcher(line);
            if (createdSprint.find()) hits.add(sprint(createdSprint.group(1), ""));
            Matcher document = DOC_ID.matcher(line);
            if (document.find()) hits.add(document(document.group(1), document.group(2)));
            Matcher createdDocument = DOC_CREATED.matcher(line);
            if (createdDocument.find()) hits.add(document(createdDocument.group(1), createdDocument.group(2)));
            Matcher issue = ISSUE_ID.matcher(line);
            if (issue.find()) {
                String sprintId = first(SPRINT_FIELD, line);
                if (sprintId.isEmpty()) sprintId = first(SPRINTS_FIELD, line);
                hits.add(task(issue.group(1), sprintId, group(TITLE, line), group(STATUS_FIELD, line)));
                continue;
            }
            Matcher dash = DASH_ISSUE.matcher(line);
            if (dash.find()) {
                String rest = dash.group(2);
                String title = rest;
                String status = "";
                int pipe = rest.indexOf('|');
                if (pipe >= 0) {
                    title = rest.substring(0, pipe).trim();
                    String after = rest.substring(pipe + 1).trim();
                    Matcher estado = STATUS_FIELD.matcher(after);
                    status = estado.find() ? estado.group(1) : after.split("\\|")[0].trim();
                }
                hits.add(task(dash.group(1), sprintContext, title, status));
            }
            Matcher numbered = ISSUE_LINE.matcher(line);
            if (numbered.find()) {
                lastTask = task(numbered.group(1), "", "", "");
                hits.add(lastTask);
            }
            Matcher detail = SPRINT_DETAIL.matcher(line);
            if (detail.find() && lastTask != null) {
                lastTask.sprintId = detail.group(1);
                lastTask.href = "/sprint/" + lastTask.sprintId + "/planning/task/" + lastTask.id;
            }
        }
        Matcher created = ISSUE_CREATED.matcher(text);
        if (created.find()) {
            String sprintId = first(SPRINT_LINKED, text);
            hits.add(task(created.group(1), sprintId, "", ""));
        }
        List<Hit> withSprints = new ArrayList<>();
        for (Hit hit : hits) {
            if (hit.sprintId != null) withSprints.add(sprint(hit.sprintId, ""));
            withSprints.add(hit);
        }
        return withSprints;
    }

    private static List<Map<String, Object>> publish(List<Hit> hits) {
        Map<String, Map<String, Object>> ordered = new LinkedHashMap<>();
        int sprints = 0;
        int tasks = 0;
        int documents = 0;
        for (Hit hit : hits) {
            if (hit.id == null || hit.id.isBlank()) continue;
            String key = hit.kind + ":" + hit.id;
            if (ordered.containsKey(key)) continue;
            if ("sprint".equals(hit.kind) && sprints >= 2) continue;
            if ("tarea".equals(hit.kind) && tasks >= 6) continue;
            if ("documento".equals(hit.kind) && documents >= 2) continue;
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("id", key);
            body.put("kind", hit.kind);
            body.put("label", hit.label);
            if (hit.href != null) body.put("href", hit.href);
            ordered.put(key, body);
            if ("sprint".equals(hit.kind)) sprints++;
            else if ("documento".equals(hit.kind)) documents++;
            else tasks++;
            if (ordered.size() >= 8) break;
        }
        List<Map<String, Object>> sprintsFirst = new ArrayList<>();
        List<Map<String, Object>> rest = new ArrayList<>();
        for (Map<String, Object> body : ordered.values()) {
            if ("sprint".equals(body.get("kind"))) sprintsFirst.add(body);
            else rest.add(body);
        }
        sprintsFirst.addAll(rest);
        return sprintsFirst;
    }

    private static boolean mentioned(String answer, Hit hit) {
        if (answer == null || answer.isBlank() || hit.id == null) return false;
        String low = norm(answer);
        if (low.matches("(?s).*\\b" + hit.id + "\\b.*")) return true;
        if (hit.title != null) {
            for (String word : norm(hit.title).split("[^a-z0-9]+")) {
                if (word.length() >= 5 && low.contains(word)) return true;
            }
        }
        String status = hit.status == null ? "" : hit.status.toLowerCase(Locale.ROOT);
        if ("blocked".equals(status) && (low.contains("bloquead") || low.contains("blocked"))) return true;
        if ("done".equals(status) && (low.contains("termin") || low.contains("hecha") || low.contains("complet"))) return true;
        if ("in_progress".equals(status) && (low.contains("en curso") || low.contains("progreso"))) return true;
        return "sprint".equals(hit.kind) && hit.label != null && low.contains(norm(hit.label));
    }

    private static boolean refusal(String answer) {
        if (answer == null || answer.isBlank()) return true;
        String low = norm(answer).trim();
        return low.startsWith("no encontr") || low.startsWith("no hay") || low.startsWith("no tengo") || low.startsWith("ningun");
    }

    private static boolean failed(String text) {
        String low = text.trim().toLowerCase(Locale.ROOT);
        return low.startsWith("no ")
                || low.startsWith("indica ")
                || low.startsWith("error")
                || low.startsWith("sin permiso")
                || low.startsWith("faltan ")
                || low.startsWith("falta ");
    }

    private static Hit task(String id, String sprintId, String title, String status) {
        Hit hit = new Hit();
        hit.kind = "tarea";
        hit.id = id;
        hit.sprintId = sprintId == null || !sprintId.matches("\\d+") ? null : sprintId;
        hit.title = title == null ? "" : title.trim();
        hit.status = status == null ? "" : status.trim();
        hit.label = "Tarea #" + id;
        if (hit.sprintId != null) hit.href = "/sprint/" + hit.sprintId + "/planning/task/" + id;
        return hit;
    }

    private static Hit sprint(String id, String name) {
        Hit hit = new Hit();
        hit.kind = "sprint";
        hit.id = id;
        hit.title = name == null ? "" : name.trim();
        hit.label = "Sprint " + id;
        hit.href = "/sprint/" + id;
        return hit;
    }

    private static Hit document(String id, String name) {
        Hit hit = new Hit();
        hit.kind = "documento";
        hit.id = id;
        hit.title = name == null ? "" : name.trim();
        hit.label = hit.title.isBlank() ? "Documento #" + id : hit.title;
        hit.href = "/portafolio/" + id;
        return hit;
    }

    private static String first(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        return matcher.find() ? matcher.group(1) : "";
    }

    private static String group(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        return matcher.find() && matcher.groupCount() >= 1 && matcher.group(1) != null ? matcher.group(1) : "";
    }

    private static String norm(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
    }

    private static final class Hit {
        private String kind;
        private String id;
        private String sprintId;
        private String title;
        private String status;
        private String label;
        private String href;
    }
}
