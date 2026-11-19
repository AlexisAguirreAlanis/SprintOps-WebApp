package com.pistache.sprintops_backend.service.chatbot;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Menciones @Tarea, @Sprint, @Documento y @Nota. El número es el id real del proyecto. */
public final class AiMentions {

    public record Hit(String kind, int id) {
    }

    private static final Pattern PATTERN = Pattern.compile("(?i)@(tarea|sprint|documento|nota)\\s+#?(\\d+)");

    private AiMentions() {
    }

    public static List<Hit> parse(String message) {
        List<Hit> hits = new ArrayList<>();
        if (message == null || message.isBlank()) return hits;
        Matcher matcher = PATTERN.matcher(message);
        Set<String> seen = new HashSet<>();
        while (matcher.find() && hits.size() < 4) {
            String kind = matcher.group(1).toLowerCase(Locale.ROOT);
            int id = Integer.parseInt(matcher.group(2));
            if (seen.add(kind + ":" + id)) hits.add(new Hit(kind, id));
        }
        return hits;
    }
}
