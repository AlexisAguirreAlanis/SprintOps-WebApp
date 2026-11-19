package com.pistache.sprintops_backend.service.chatbot;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import com.pistache.sprintops_backend.service.chatbot.AiToolCatalog.AiTool;
import com.pistache.sprintops_backend.service.chatbot.AiToolCatalog.Param;

import java.util.Locale;

/**
 * Esquemas de herramientas para Groq. Salen del catálogo, no de una lista paralela.
 */
public final class ChatbotGroqToolDefinitions {

    private ChatbotGroqToolDefinitions() {
    }

    /** Menos herramientas en consultas de solo lectura → menos errores tool_use_failed en Groq. */
    public static ArrayNode forUserMessage(ObjectMapper om, String userMessage) {
        ArrayNode all = all(om);
        if (looksLikeMutation(userMessage)) {
            return all;
        }
        ArrayNode filtered = om.createArrayNode();
        for (var tool : all) {
            String name = tool.path("function").path("name").asText("");
            if (AiToolCatalog.isRead(name)) {
                filtered.add(tool);
            }
        }
        return filtered.isEmpty() ? all : filtered;
    }

    private static boolean looksLikeMutation(String userMessage) {
        if (userMessage == null || userMessage.isBlank()) {
            return false;
        }
        String low = userMessage.toLowerCase(Locale.ROOT);
        return low.contains("crea ")
                || low.contains("crear ")
                || low.contains("asigna")
                || low.contains("mueve")
                || low.contains("mover ")
                || low.contains("elimina")
                || low.contains("borra")
                || low.contains("restaura")
                || low.contains("cambia ")
                || low.contains("cambiar ")
                || low.contains("actualiza")
                || low.contains("guarda ")
                || low.contains("únete")
                || low.contains("unete")
                || low.contains("invitación")
                || low.contains("invitacion")
                || low.contains("permiso")
                || low.contains("papelera")
                || low.contains("definitiv")
                || low.contains("reescrib")
                || low.contains("tabla")
                || low.contains("prioridad")
                || low.contains("organiza")
                || low.contains("retrospect")
                || low.contains("documenta")
                || low.contains("genera ")
                || low.contains("aplica ");
    }

    public static ArrayNode readsOnly(ObjectMapper om) {
        ArrayNode filtered = om.createArrayNode();
        for (var tool : all(om)) {
            String name = tool.path("function").path("name").asText("");
            if (AiToolCatalog.isRead(name)) filtered.add(tool);
        }
        return filtered;
    }

    public static ArrayNode all(ObjectMapper om) {
        ArrayNode tools = om.createArrayNode();
        for (AiTool tool : AiToolCatalog.exposed()) {
            tools.add(function(om, tool));
        }
        return tools;
    }

    private static ObjectNode function(ObjectMapper om, AiTool tool) {
        ObjectNode node = om.createObjectNode();
        node.put("type", "function");
        ObjectNode fn = node.putObject("function");
        fn.put("name", tool.name());
        fn.put("description", tool.description());
        fn.set("parameters", parameters(om, tool));
        return node;
    }

    private static ObjectNode parameters(ObjectMapper om, AiTool tool) {
        ObjectNode root = om.createObjectNode();
        root.put("type", "object");
        ObjectNode props = om.createObjectNode();
        ArrayNode required = om.createArrayNode();
        for (Param param : tool.parameters()) {
            props.set(param.name(), jsonType(param.type()).toNode(om));
            if (param.required()) required.add(param.name());
        }
        root.set("properties", props);
        if (!required.isEmpty()) root.set("required", required);
        return root;
    }

    private enum JsonType {
        STRING, INTEGER, ARRAY;

        ObjectNode toNode(ObjectMapper om) {
            ObjectNode node = om.createObjectNode();
            switch (this) {
                case INTEGER -> {
                    ArrayNode types = om.createArrayNode();
                    types.add("integer");
                    types.add("string");
                    node.set("type", types);
                    node.put("description", "ID numérico (entero o texto con dígitos)");
                }
                case ARRAY -> {
                    node.put("type", "array");
                    node.putObject("items").put("type", "string");
                }
                default -> node.put("type", "string");
            }
            return node;
        }
    }

    private static JsonType jsonType(String type) {
        return switch (type) {
            case "int", "integer" -> JsonType.INTEGER;
            case "array" -> JsonType.ARRAY;
            default -> JsonType.STRING;
        };
    }
}
