package com.pistache.sprintops_backend.service.chatbot;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Tarifas y planes. Los números salen de application.properties. */
@Component
public class AiCreditTariff {

    @Value("${sprintops.ai.plans.free:50}")
    private int free;
    @Value("${sprintops.ai.plans.pro:1000}")
    private int pro;
    @Value("${sprintops.ai.plans.business:3000}")
    private int business;
    @Value("${sprintops.ai.costs.simple:1}")
    private int simple;
    @Value("${sprintops.ai.costs.search:2}")
    private int search;
    @Value("${sprintops.ai.costs.summary:3}")
    private int summary;
    @Value("${sprintops.ai.costs.task:5}")
    private int task;
    @Value("${sprintops.ai.costs.retro:10}")
    private int retro;
    @Value("${sprintops.ai.costs.sprint:15}")
    private int sprint;
    @Value("${sprintops.ai.costs.planning:20}")
    private int planning;
    @Value("${sprintops.ai.costs.full:30}")
    private int full;
    @Value("${sprintops.ai.estimate-threshold:5}")
    private int threshold;
    @Value("${sprintops.ai.tokens-per-credit:0}")
    private int tokensPerCredit;
    @Value("${sprintops.ai.packs:250:39,750:99,2000:229,5000:499}")
    private String packs;

    public int included(String plan) {
        return switch (planId(plan)) {
            case "pro" -> Math.max(0, pro);
            case "business" -> Math.max(0, business);
            default -> Math.max(0, free);
        };
    }

    public String planId(String plan) {
        if (plan == null) return "free";
        String value = plan.trim().toLowerCase(Locale.ROOT);
        if (value.equals("pro") || value.equals("business") || value.equals("free")) return value;
        return "free";
    }

    public String planLabel(String plan) {
        return switch (planId(plan)) {
            case "pro" -> "Pro";
            case "business" -> "Business";
            default -> "Free";
        };
    }

    public boolean costly(int credits) {
        return credits >= Math.max(1, threshold);
    }

    /** Cada paquete es créditos, precio en pesos y moneda. El formato de la propiedad es créditos:precio. */
    public List<Map<String, Object>> packs() {
        List<Map<String, Object>> values = new ArrayList<>();
        if (packs == null) return values;
        for (String part : packs.split(",")) {
            String[] bits = part.trim().split(":");
            if (bits.length != 2) continue;
            try {
                int credits = Integer.parseInt(bits[0].trim());
                int price = Integer.parseInt(bits[1].trim());
                if (credits <= 0 || credits > 100_000 || price < 0 || price > 1_000_000) continue;
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("credits", credits);
                row.put("price", price);
                row.put("currency", "MXN");
                values.add(row);
            } catch (NumberFormatException ignored) {
                // un valor mal escrito no tumba el resto de paquetes
            }
        }
        return values;
    }

    public Integer packPrice(int credits) {
        for (Map<String, Object> pack : packs()) {
            if (((Number) pack.get("credits")).intValue() == credits) {
                return ((Number) pack.get("price")).intValue();
            }
        }
        return null;
    }

    public boolean packAllowed(int credits) {
        return packPrice(credits) != null;
    }

    public List<Map<String, Object>> plans() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(plan("free", "Free", free));
        rows.add(plan("pro", "Pro", pro));
        rows.add(plan("business", "Business", business));
        return rows;
    }

    /** Costo que verá el usuario. Los tokens solo pueden subir la tarifa si tokens-per-credit es mayor que 0. */
    public int price(String message, List<String> tools, int tokens) {
        String kind = action(message, tools);
        int credits = cost(kind);
        if (tokensPerCredit > 0 && tokens > 0) {
            int fromTokens = (tokens + tokensPerCredit - 1) / tokensPerCredit;
            credits = Math.max(credits, fromTokens);
        }
        return Math.max(1, credits);
    }

    public int estimate(String message) {
        return cost(kindForMessage(message));
    }

    public String action(String message, List<String> tools) {
        String best = kindForMessage(message);
        if (tools != null) {
            for (String tool : tools) {
                String kind = kindForTool(tool);
                if (cost(kind) > cost(best)) best = kind;
            }
        }
        return best;
    }

    public String label(String kind) {
        return switch (kind == null ? "" : kind) {
            case "search" -> "Búsqueda contextual";
            case "summary" -> "Resumen de documento";
            case "task" -> "Generación de tarea";
            case "retro" -> "Retrospectiva";
            case "sprint" -> "Análisis de sprint";
            case "planning" -> "Planificación de sprint";
            case "full" -> "Análisis completo";
            default -> "Consulta sencilla";
        };
    }

    private int cost(String kind) {
        return switch (kind == null ? "" : kind) {
            case "search" -> positive(search, 2);
            case "summary" -> positive(summary, 3);
            case "task" -> positive(task, 5);
            case "retro" -> positive(retro, 10);
            case "sprint" -> positive(sprint, 15);
            case "planning" -> positive(planning, 20);
            case "full" -> positive(full, 30);
            default -> positive(simple, 1);
        };
    }

    private String kindForMessage(String message) {
        String text = message == null ? "" : message.toLowerCase(Locale.ROOT);
        if (contains(text, "análisis completo", "analisis completo", "analiza todo", "diagnóstico completo", "diagnostico completo")) return "full";
        if (contains(text, "planificar", "planificación", "planificacion", "plan del sprint", "plan de sprint")) return "planning";
        if (contains(text, "analizar el sprint", "analiza el sprint", "análisis del sprint", "analisis del sprint", "salud del sprint", "analizar el progreso")) return "sprint";
        if (contains(text, "retrospectiva", "retro")) return "retro";
        if (contains(text, "genera una tarea", "generar tarea", "crea una tarea", "crear tarea", "nueva tarea", "crear issue")) return "task";
        if (contains(text, "resume", "resumen", "resumir")) return "summary";
        if (contains(text, "busca", "buscar", "encuentra", "búsqueda", "busqueda")) return "search";
        return "simple";
    }

    private static String kindForTool(String name) {
        if (name == null || name.isBlank()) return "simple";
        if (name.equals("analyze_sprint_health")) return "sprint";
        if (name.equals("create_sprint") || name.equals("update_sprint_fields")) return "planning";
        if (name.equals("save_retro_item") || name.contains("retro")) return "retro";
        if (name.equals("summarize_project_document")) return "summary";
        if (name.equals("create_issue")) return "task";
        if (AiActionPolicy.mutation(name)) return "task";
        return "search";
    }

    private static boolean contains(String text, String... needles) {
        for (String needle : needles) {
            if (text.contains(needle)) return true;
        }
        return false;
    }

    private static int positive(int value, int fallback) {
        return value > 0 ? value : fallback;
    }

    private static Map<String, Object> plan(String id, String label, int credits) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", id);
        row.put("label", label);
        row.put("credits", Math.max(0, credits));
        return row;
    }
}
