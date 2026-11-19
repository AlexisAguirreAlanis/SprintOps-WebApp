package com.pistache.sprintops_backend.service.chatbot;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class GroqChatClient {

    private static final Logger log = LoggerFactory.getLogger(GroqChatClient.class);

    private static final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

    private static final int GROQ_MAX_RETRIES = 3;

    private static final Pattern GROQ_RETRY_AFTER_SEC = Pattern.compile("try again in ([0-9.]+)s", Pattern.CASE_INSENSITIVE);

    /** Mensaje corto para el usuario (Telegram / API); nunca incluir el JSON completo de Groq. */
    static final String RATE_LIMIT_USER_MESSAGE = """
            Límite temporal del servicio de IA (tokens por minuto en Groq). Espera 30–60 s y vuelve a intentarlo.
            Si usas Telegram, /ayuda, /estado, /misproyectos y /proyecto ID no pasan por esta IA y suelen responder al instante.""".trim();

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(20))
            .build();

    @Value("${groq.api.key:}")
    private String apiKey;

    @Value("${groq.model:meta-llama/llama-4-scout-17b-16e-instruct}")
    private String model;

    public GroqChatClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void normalizeApiKey() {
        if (apiKey == null) {
            return;
        }
        apiKey = apiKey.trim();
        while (apiKey.length() >= 2
                && ((apiKey.startsWith("\"") && apiKey.endsWith("\""))
                || (apiKey.startsWith("'") && apiKey.endsWith("'")))) {
            apiKey = apiKey.substring(1, apiKey.length() - 1).trim();
        }
        if (!apiKey.isBlank() && !apiKey.startsWith("gsk_")) {
            log.warn("GROQ_API_KEY no parece una clave Groq válida (debe empezar con gsk_)");
        }
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    /**
     * @param bodyJson JSON object: model, messages, tools (optional), tool_choice (optional)
     */
    public JsonNode chat(JsonNode bodyJson) throws Exception {
        if (!isConfigured()) {
            throw new IllegalStateException("GROQ_API_KEY no configurada");
        }

        String body = objectMapper.writeValueAsString(bodyJson);
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(GROQ_URL))
                .timeout(Duration.ofSeconds(120))
                .header("Authorization", "Bearer " + apiKey.trim())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();

        Exception lastFailure = null;
        for (int attempt = 1; attempt <= GROQ_MAX_RETRIES; attempt++) {
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            int code = resp.statusCode();
            if (code >= 200 && code < 300) {
                return objectMapper.readTree(resp.body());
            }
            String errBody = resp.body();
            log.warn("Groq HTTP {} (intento {}/{}): {}", code, attempt, GROQ_MAX_RETRIES,
                    errBody != null && errBody.length() > 2000 ? errBody.substring(0, 2000) + "…" : errBody);
            boolean rateLimited = code == 429 || code == 503;
            if (rateLimited && attempt < GROQ_MAX_RETRIES) {
                long waitMs = parseRetryAfterMs(errBody, 16_000);
                log.info("Reintentando Groq en {} ms (TPM/cuota)", waitMs);
                Thread.sleep(waitMs);
                continue;
            }
            if (code == 400 && isToolUseFailed(errBody) && attempt < GROQ_MAX_RETRIES) {
                log.info("Reintentando Groq tras tool_use_failed (intento {})", attempt + 1);
                Thread.sleep(600L * attempt);
                continue;
            }
            lastFailure = new IllegalStateException(userFacingErrorMessage(code, errBody));
            break;
        }
        throw lastFailure != null ? lastFailure : new IllegalStateException("Groq: sin respuesta");
    }

    private boolean isToolUseFailed(String errorBody) {
        if (errorBody == null || errorBody.isBlank()) {
            return false;
        }
        try {
            JsonNode err = objectMapper.readTree(errorBody).path("error");
            return "tool_use_failed".equals(err.path("code").asText(""));
        } catch (Exception e) {
            return errorBody.contains("tool_use_failed")
                    || errorBody.contains("Failed to call a function");
        }
    }

    /** Groq suele incluir "try again in 19.5s" en el JSON de error 429. */
    static long parseRetryAfterMs(String errorBody, long defaultMs) {
        if (errorBody == null) {
            return defaultMs;
        }
        Matcher m = GROQ_RETRY_AFTER_SEC.matcher(errorBody);
        if (!m.find()) {
            return defaultMs;
        }
        try {
            double sec = Double.parseDouble(m.group(1));
            long ms = (long) (sec * 1000.0) + 400L;
            return Math.min(22_000L, Math.max(800L, ms));
        } catch (NumberFormatException e) {
            return defaultMs;
        }
    }

    private String userFacingErrorMessage(int httpStatus, String responseBody) {
        if (httpStatus == 429) {
            return RATE_LIMIT_USER_MESSAGE;
        }
        if (responseBody == null || responseBody.isBlank()) {
            return "El servicio de IA respondió con error HTTP " + httpStatus + ". Inténtalo de nuevo en un momento.";
        }
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode err = root.path("error");
            String code = err.path("code").asText("");
            String msg = err.path("message").asText("");
            if ("rate_limit_exceeded".equals(code) || "tokens".equals(err.path("type").asText(""))) {
                return RATE_LIMIT_USER_MESSAGE;
            }
            if (!msg.isEmpty()) {
                String shortMsg = msg.length() > 280 ? msg.substring(0, 277) + "…" : msg;
                return "No pude completar la petición a la IA (" + httpStatus + "): " + shortMsg;
            }
        } catch (Exception ignored) {
            // usar mensaje genérico
        }
        return "El servicio de IA no está disponible ahora (HTTP " + httpStatus + "). Reintenta en unos segundos.";
    }

    public String getModel() {
        return model;
    }

    /**
     * Lee el stream real de Groq. El contenido visible se entrega en {@code onContent}
     * conforme llega; los argumentos de herramientas no se reenvían.
     */
    public ObjectNode streamRound(JsonNode bodyJson, GroqDeltaHandler handler, int[] usage) throws Exception {
        if (!isConfigured()) {
            throw new IllegalStateException("GROQ_API_KEY no configurada");
        }
        ObjectNode body = objectMapper.readValue(objectMapper.writeValueAsString(bodyJson), ObjectNode.class);
        body.put("stream", true);
        body.putObject("stream_options").put("include_usage", true);
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(GROQ_URL))
                .timeout(Duration.ofSeconds(120))
                .header("Authorization", "Bearer " + apiKey.trim())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body), StandardCharsets.UTF_8))
                .build();
        HttpResponse<java.io.InputStream> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofInputStream());
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            String errBody = new String(resp.body().readAllBytes(), StandardCharsets.UTF_8);
            throw new IllegalStateException(userFacingErrorMessage(resp.statusCode(), errBody));
        }
        StringBuilder content = new StringBuilder();
        TreeMap<Integer, ToolAcc> tools = new TreeMap<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(resp.body(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (handler.isCancelled()) {
                    throw new AiStreamCancelled();
                }
                if (!line.startsWith("data:")) {
                    continue;
                }
                String data = line.substring(5).trim();
                if (data.isEmpty()) {
                    continue;
                }
                if ("[DONE]".equals(data)) {
                    break;
                }
                JsonNode chunk = objectMapper.readTree(data);
                JsonNode usageNode = chunk.get("usage");
                if (usage != null && usageNode != null && !usageNode.isNull()) {
                    usage[0] = usageNode.path("prompt_tokens").asInt(0);
                    usage[1] = usageNode.path("completion_tokens").asInt(0);
                }
                JsonNode delta = chunk.path("choices").path(0).path("delta");
                if (delta.hasNonNull("content")) {
                    String text = delta.get("content").asText("");
                    if (!text.isEmpty()) {
                        content.append(text);
                        handler.onContent(text);
                    }
                }
                JsonNode toolCalls = delta.get("tool_calls");
                if (toolCalls != null && toolCalls.isArray()) {
                    for (JsonNode call : toolCalls) {
                        int index = call.path("index").asInt(0);
                        ToolAcc acc = tools.computeIfAbsent(index, key -> new ToolAcc());
                        if (call.hasNonNull("id")) {
                            acc.id = call.get("id").asText(acc.id);
                        }
                        JsonNode fn = call.path("function");
                        if (fn.hasNonNull("name") && !fn.get("name").asText("").isEmpty()) {
                            boolean first = acc.name.isEmpty();
                            acc.name = acc.name + fn.get("name").asText("");
                            if (first) {
                                handler.onToolName(acc.name);
                            }
                        }
                        if (fn.has("arguments") && !fn.get("arguments").isNull()) {
                            acc.args.append(fn.get("arguments").asText(""));
                        }
                    }
                }
            }
        }
        ObjectNode message = objectMapper.createObjectNode();
        message.put("role", "assistant");
        if (content.isEmpty()) {
            message.putNull("content");
        } else {
            message.put("content", content.toString());
        }
        if (!tools.isEmpty()) {
            ArrayNode calls = objectMapper.createArrayNode();
            for (ToolAcc acc : tools.values()) {
                ObjectNode call = objectMapper.createObjectNode();
                call.put("id", acc.id == null ? "" : acc.id);
                call.put("type", "function");
                ObjectNode fn = objectMapper.createObjectNode();
                fn.put("name", acc.name == null ? "" : acc.name);
                fn.put("arguments", acc.args.toString());
                call.set("function", fn);
                calls.add(call);
            }
            message.set("tool_calls", calls);
        }
        return message;
    }

    public interface GroqDeltaHandler {
        void onContent(String text);

        void onToolName(String name);

        boolean isCancelled();
    }

    private static final class ToolAcc {
        private String id = "";
        private String name = "";
        private final StringBuilder args = new StringBuilder();
    }
}
