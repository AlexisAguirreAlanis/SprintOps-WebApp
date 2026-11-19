package com.pistache.sprintops_backend.service.chatbot;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Marca interna para recuperar la versión previa de un documento. No se muestra en el chat. */
public final class AiUndo {

    private static final Pattern MARK = Pattern.compile("(?m)^undo:documento:(\\d+):(\\d+)\\s*$");

    private AiUndo() {
    }

    public static String strip(String result) {
        if (result == null || result.isBlank()) return result == null ? "" : result;
        return MARK.matcher(result).replaceAll("").trim();
    }

    public static Map<String, Object> from(String result) {
        if (result == null) return null;
        Matcher matcher = MARK.matcher(result);
        if (!matcher.find()) return null;
        Map<String, Object> undo = new LinkedHashMap<>();
        undo.put("kind", "documento");
        undo.put("documentId", Integer.parseInt(matcher.group(1)));
        undo.put("versionId", Integer.parseInt(matcher.group(2)));
        return undo;
    }
}
