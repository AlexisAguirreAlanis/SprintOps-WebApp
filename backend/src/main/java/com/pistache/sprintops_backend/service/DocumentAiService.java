package com.pistache.sprintops_backend.service;

import com.pistache.sprintops_backend.service.chatbot.GroqChatClient;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.util.Map;

/** Acciones de IA del editor de documentos. Las respuestas son HTML simple o JSON, según la acción. */
@Service
public class DocumentAiService {

    private static final int MAX_INPUT_CHARS = 24_000;

    private static final String HTML_RULES = """
            Responde solo con HTML simple y válido para insertar en un documento: usa p, h2, h3, ul, ol, li, strong, em, table, tr, th, td, blockquote, pre, code.
            No uses markdown, no envuelvas en ```, no incluyas html/head/body ni estilos.""";

    private static final String JSON_ITEMS = """
            Responde solo con JSON válido, sin texto adicional ni markdown, con la forma {"items":[{"title":"...","detail":"...","owner":"...","due":"..."}]}.
            Usa cadenas vacías si un dato no aparece en el texto.""";

    private static final Map<String, String> PROMPTS = Map.ofEntries(
            Map.entry("generate", "Redacta un documento profesional completo sobre lo que pide la persona. " + HTML_RULES),
            Map.entry("summarize", "Resume el texto en pocos párrafos claros, conservando datos y decisiones. " + HTML_RULES),
            Map.entry("expand", "Desarrolla el texto con más detalle y ejemplos, conservando el sentido y el idioma. " + HTML_RULES),
            Map.entry("shorten", "Acorta el texto a la mitad aproximadamente sin perder información clave. " + HTML_RULES),
            Map.entry("fix", "Corrige ortografía, gramática y puntuación sin cambiar el contenido ni el tono. " + HTML_RULES),
            Map.entry("clarity", "Reescribe el texto para que sea más claro y directo, con frases cortas. " + HTML_RULES),
            Map.entry("tone", "Reescribe el texto con el tono que indica la instrucción. " + HTML_RULES),
            Map.entry("translate", "Traduce el texto al idioma que indica la instrucción, conservando el formato. " + HTML_RULES),
            Map.entry("explain", "Explica el contenido del texto de forma sencilla para alguien nuevo en el tema. " + HTML_RULES),
            Map.entry("table", "Convierte la información en una tabla HTML con encabezados (th) adecuados. " + HTML_RULES),
            Map.entry("list", "Convierte la información en una lista HTML ordenada y concisa. " + HTML_RULES),
            Map.entry("executive", "Crea un resumen ejecutivo: contexto, puntos clave, riesgos y siguiente paso. " + HTML_RULES),
            Map.entry("minutes", "Genera un acta de reunión: asistentes, temas, acuerdos, decisiones y pendientes con responsable y fecha. " + HTML_RULES),
            Map.entry("techdoc", "Genera documentación técnica estructurada: propósito, arquitectura, componentes, uso, configuración y errores comunes. " + HTML_RULES),
            Map.entry("mermaid", "Genera un diagrama Mermaid que represente el texto. Responde solo con el código Mermaid, sin ``` ni explicaciones."),
            Map.entry("tasks", "Extrae las tareas accionables del texto. " + JSON_ITEMS),
            Map.entry("commitments", "Detecta los compromisos (quién se comprometió a qué y para cuándo). " + JSON_ITEMS),
            Map.entry("decisions", "Identifica las decisiones tomadas en el texto. " + JSON_ITEMS),
            Map.entry("issues", "Propón issues de software a partir del texto, con título corto y descripción. " + JSON_ITEMS),
            Map.entry("contradictions", "Identifica contradicciones o inconsistencias dentro del texto; si no hay, dilo. " + HTML_RULES),
            Map.entry("grammar", """
                    Revisa ortografía y gramática. Responde solo con JSON válido, sin markdown, con la forma
                    {"items":[{"wrong":"fragmento exacto con error","right":"corrección","reason":"explicación breve"}]}. Máximo 40 elementos."""),
            Map.entry("synonyms", "Da hasta 8 sinónimos de la palabra, en el mismo idioma. Responde solo con JSON {\"items\":[\"...\"]}."),
            Map.entry("link-issues", """
                    Compara el texto con la lista de issues del contexto y sugiere qué issues están relacionados.
                    Responde solo con JSON {"items":[{"id":123,"title":"...","reason":"..."}]}."""),
            Map.entry("chat", "Responde la pregunta usando solo el documento del contexto; si no está, dilo. " + HTML_RULES),
            Map.entry("search", "Responde la pregunta usando los documentos del contexto e indica el nombre del documento de cada dato. " + HTML_RULES),
            Map.entry("detect-language", "Indica el código ISO 639-1 del idioma del texto. Responde solo con JSON {\"language\":\"es\"}."),
            Map.entry("ink-to-text", "Transcribe el texto escrito a mano en la imagen. Responde solo con el texto transcrito, sin comentarios.")
    );

    private final GroqChatClient groq;
    private final ObjectMapper objectMapper;

    public DocumentAiService(GroqChatClient groq, ObjectMapper objectMapper) {
        this.groq = groq;
        this.objectMapper = objectMapper;
    }

    public String run(String action, String text, String instruction, String context, String image) {
        String system = PROMPTS.get(action);
        if (system == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Acción de IA desconocida.");
        if (!groq.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "La IA no está configurada (falta GROQ_API_KEY).");
        }
        StringBuilder user = new StringBuilder();
        if (instruction != null && !instruction.isBlank()) user.append("Instrucción: ").append(instruction.trim()).append("\n\n");
        if (context != null && !context.isBlank()) user.append("Contexto:\n").append(clip(context)).append("\n\n");
        if (text != null && !text.isBlank()) user.append("Texto:\n").append(clip(text));
        boolean hasImage = image != null && image.startsWith("data:image/");
        if (user.isEmpty() && !hasImage) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No hay texto para la IA.");

        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", groq.getModel());
        body.put("temperature", 0.3);
        ArrayNode messages = body.putArray("messages");
        messages.addObject().put("role", "system").put("content", "Eres el asistente de documentos de Pistache SprintOps. Responde en el idioma del texto salvo que se pida otro. " + system);
        if (hasImage) {
            ArrayNode content = messages.addObject().put("role", "user").putArray("content");
            content.addObject().put("type", "text").put("text", user.isEmpty() ? "Transcribe la imagen." : user.toString());
            content.addObject().put("type", "image_url").putObject("image_url").put("url", image);
        } else {
            messages.addObject().put("role", "user").put("content", user.toString());
        }
        try {
            JsonNode reply = groq.chat(body);
            String content = reply.path("choices").path(0).path("message").path("content").asText("");
            return content.replaceAll("^\\s*```[a-zA-Z]*\\s*", "").replaceAll("\\s*```\\s*$", "").trim();
        } catch (IllegalStateException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, ex.getMessage());
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "La IA no respondió. Inténtalo de nuevo.");
        }
    }

    private String clip(String value) {
        return value.length() > MAX_INPUT_CHARS ? value.substring(0, MAX_INPUT_CHARS) : value;
    }
}
