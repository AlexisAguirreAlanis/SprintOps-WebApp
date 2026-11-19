package com.pistache.sprintops_backend.service.chatbot;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Plan propuesto en el chat. Los pasos salen del texto, no de una herramienta de escritura. */
public final class AiPlan {

    private static final Pattern STEP = Pattern.compile("^\\d+[.)]\\s+(.+)$");

    private AiPlan() {
    }

    public static Map<String, Object> card(String answer) {
        if (answer == null || answer.isBlank()) return null;
        String goal = "";
        List<String> steps = new ArrayList<>();
        for (String raw : answer.split("\\n")) {
            String line = raw.trim();
            if (line.toLowerCase(Locale.ROOT).startsWith("objetivo:")) {
                goal = clip(line.substring("objetivo:".length()).trim(), 180);
                continue;
            }
            Matcher matcher = STEP.matcher(line);
            if (matcher.find() && steps.size() < 8) {
                String step = clip(matcher.group(1).trim(), 240);
                if (!step.isEmpty()) steps.add(step);
            }
        }
        if (steps.isEmpty()) return null;
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", "plan");
        body.put("phase", "plan");
        body.put("kind", "plan");
        body.put("headline", "Plan listo para revisar");
        body.put("goal", goal);
        body.put("steps", steps);
        body.put("status", "Pendiente de aprobación");
        return body;
    }

    private static String clip(String value, int max) {
        if (value == null) return "";
        return value.length() <= max ? value : value.substring(0, max);
    }
}
