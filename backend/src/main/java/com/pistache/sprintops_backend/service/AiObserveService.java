package com.pistache.sprintops_backend.service;

import com.pistache.sprintops_backend.model.AiObservacion;
import com.pistache.sprintops_backend.repository.AiObservacionRepository;
import com.pistache.sprintops_backend.service.chatbot.GroqChatClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Uso interno del asistente. El chat y los ajustes no leen este registro. */
@Service
public class AiObserveService {

    static final String USER_LIMIT = "Este mes llegaste al límite de uso del asistente.";
    static final String PROJECT_LIMIT = "Este proyecto llegó a su límite de uso del asistente este mes.";

    @Value("${sprintops.ai.cost.input-cents-per-million:0}")
    private int inputCentsPerMillion;
    @Value("${sprintops.ai.cost.output-cents-per-million:0}")
    private int outputCentsPerMillion;
    @Value("${sprintops.ai.limit.user-credits:0}")
    private int userCredits;
    @Value("${sprintops.ai.limit.project-credits:0}")
    private int projectCredits;
    @Value("${sprintops.ai.limit.user-tokens:0}")
    private long userTokens;
    @Value("${sprintops.ai.limit.project-tokens:0}")
    private long projectTokens;
    @Value("${sprintops.ai.observe-key:}")
    private String observeKey;

    @Autowired
    private AiObservacionRepository repository;
    @Autowired
    private GroqChatClient groqChatClient;

    public String limitMessage(Integer userId, Integer projectId) {
        if (userId == null) return null;
        String period = YearMonth.now().toString();
        if (over(userCredits, repository.sumCreditsByUsuario(userId, period))
                || over(userTokens, repository.sumTokensByUsuario(userId, period))) {
            return USER_LIMIT;
        }
        if (projectId != null && (over(projectCredits, repository.sumCreditsByProyecto(projectId, period))
                || over(projectTokens, repository.sumTokensByProyecto(projectId, period)))) {
            return PROJECT_LIMIT;
        }
        return null;
    }

    @Transactional
    public void record(Integer userId, Integer projectId, String clave, int credits, int inputTokens, int outputTokens,
                       long durationMs, List<String> tools, String error) {
        if (userId == null) return;
        try {
            String key = clave == null || clave.isBlank() ? null : clave;
            if (key != null && repository.findByClave(key).isPresent()) return;
            AiObservacion row = new AiObservacion();
            row.setClave(key);
            row.setUsuarioId(userId);
            row.setProyectoId(projectId);
            row.setModelo(clip(groqChatClient.getModel(), 80));
            row.setTokensEntrada(Math.max(0, inputTokens));
            row.setTokensSalida(Math.max(0, outputTokens));
            row.setCosto(cost(inputTokens, outputTokens));
            row.setCreditos(Math.max(0, credits));
            row.setDuracionMs(Math.max(0, durationMs));
            row.setHerramientas(clip(joinTools(tools), 400));
            row.setError(clip(error, 400));
            row.setPeriodo(YearMonth.now().toString());
            row.setCreadoEn(Instant.now());
            repository.save(row);
        } catch (RuntimeException ignored) {
            // un fallo del registro no debe cortar la respuesta
        }
    }

    public Map<String, Object> report(String period, String presentedKey) {
        if (observeKey == null || observeKey.isBlank() || !sameKey(observeKey, presentedKey)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No encontrado");
        }
        String month = period == null || !period.matches("\\d{4}-\\d{2}") ? YearMonth.now().toString() : period;
        List<AiObservacion> rows = repository.findTop2000ByPeriodoOrderByIdObservacionDesc(month);
        long credits = 0;
        long input = 0;
        long output = 0;
        long cost = 0;
        long duration = 0;
        int errors = 0;
        Map<String, long[]> models = new LinkedHashMap<>();
        Map<String, long[]> toolUse = new LinkedHashMap<>();
        Map<String, long[]> users = new LinkedHashMap<>();
        Map<String, long[]> projects = new LinkedHashMap<>();
        for (AiObservacion row : rows) {
            credits += row.getCreditos();
            input += row.getTokensEntrada();
            output += row.getTokensSalida();
            cost += row.getCosto();
            duration += row.getDuracionMs();
            if (row.getError() != null && !row.getError().isBlank()) errors++;
            add(models, row.getModelo() == null || row.getModelo().isBlank() ? "sin modelo" : row.getModelo(), row);
            add(users, String.valueOf(row.getUsuarioId()), row);
            if (row.getProyectoId() != null) add(projects, String.valueOf(row.getProyectoId()), row);
            if (row.getHerramientas() != null) {
                for (String tool : row.getHerramientas().split(",")) {
                    if (!tool.isBlank()) add(toolUse, tool.trim(), row);
                }
            }
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("period", month);
        body.put("requests", rows.size());
        body.put("truncated", rows.size() == 2000);
        body.put("errors", errors);
        body.put("credits", credits);
        body.put("inputTokens", input);
        body.put("outputTokens", output);
        body.put("estimatedCents", cost / 1_000_000);
        body.put("averageMs", rows.isEmpty() ? 0 : duration / rows.size());
        body.put("models", ranked(models, "model"));
        body.put("tools", ranked(toolUse, "tool"));
        body.put("users", ranked(users, "userId"));
        body.put("projects", ranked(projects, "projectId"));
        Map<String, Object> limits = new LinkedHashMap<>();
        limits.put("userCredits", Math.max(0, userCredits));
        limits.put("projectCredits", Math.max(0, projectCredits));
        limits.put("userTokens", Math.max(0, userTokens));
        limits.put("projectTokens", Math.max(0, projectTokens));
        body.put("limits", limits);
        return body;
    }

    private long cost(int inputTokens, int outputTokens) {
        long in = Math.max(0, inputTokens) * (long) Math.max(0, inputCentsPerMillion);
        long out = Math.max(0, outputTokens) * (long) Math.max(0, outputCentsPerMillion);
        return in + out;
    }

    private static boolean over(long limit, long used) {
        return limit > 0 && used >= limit;
    }

    private static void add(Map<String, long[]> groups, String key, AiObservacion row) {
        long[] totals = groups.computeIfAbsent(key, ignored -> new long[4]);
        totals[0]++;
        totals[1] += row.getCreditos();
        totals[2] += row.getTokensEntrada();
        totals[3] += row.getTokensSalida();
    }

    private static List<Map<String, Object>> ranked(Map<String, long[]> groups, String name) {
        List<Map.Entry<String, long[]>> entries = new ArrayList<>(groups.entrySet());
        entries.sort(Comparator.comparingLong((Map.Entry<String, long[]> entry) -> entry.getValue()[1]).reversed());
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map.Entry<String, long[]> entry : entries) {
            if (rows.size() >= 12) break;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put(name, entry.getKey());
            row.put("requests", entry.getValue()[0]);
            row.put("credits", entry.getValue()[1]);
            row.put("inputTokens", entry.getValue()[2]);
            row.put("outputTokens", entry.getValue()[3]);
            rows.add(row);
        }
        return rows;
    }

    private static String joinTools(List<String> tools) {
        if (tools == null || tools.isEmpty()) return "";
        List<String> names = new ArrayList<>();
        for (String tool : tools) {
            if (tool == null || tool.isBlank() || names.contains(tool)) continue;
            names.add(tool.trim());
        }
        return String.join(",", names);
    }

    private static String clip(String value, int max) {
        if (value == null) return null;
        String text = value.replace('\n', ' ').trim();
        if (text.isEmpty()) return null;
        return text.length() <= max ? text : text.substring(0, max);
    }

    private static boolean sameKey(String expected, String presented) {
        byte[] left = expected.getBytes(StandardCharsets.UTF_8);
        byte[] right = (presented == null ? "" : presented).getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(left, right);
    }
}
