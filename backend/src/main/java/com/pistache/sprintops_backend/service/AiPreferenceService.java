package com.pistache.sprintops_backend.service;

import tools.jackson.databind.JsonNode;
import com.pistache.sprintops_backend.model.AiPreferencia;
import com.pistache.sprintops_backend.repository.AiAutorizacionRepository;
import com.pistache.sprintops_backend.repository.AiPreferenciaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@Service
public class AiPreferenceService {

    private static final Set<String> MODES = Set.of("preguntar", "seguras", "todo");
    private static final Set<String> LANGUAGES = Set.of("es", "en");
    private static final Set<String> DETAILS = Set.of("breve", "detallada");
    private static final Set<String> POOLS = Set.of("personal", "shared");

    @Autowired
    private AiPreferenciaRepository repository;
    @Autowired
    private AiAutorizacionRepository autorizacionRepository;
    @Autowired
    private AiCreditService creditService;

    @Transactional
    public void ensure(Integer userId) {
        load(userId);
    }

    @Transactional
    public String mode(Integer userId) {
        String mode = load(userId).getModo();
        return MODES.contains(mode) ? mode : "preguntar";
    }

    @Transactional
    public String style(Integer userId) {
        AiPreferencia row = load(userId);
        boolean english = "en".equals(row.getIdioma());
        String language = english
                ? "The user's response language is English. Write the answer in English even though these instructions are in Spanish."
                : "Responde en español.";
        String detail = "breve".equals(row.getDetalle())
                ? (english ? "Keep the answer short, in a few sentences." : "Responde breve, en pocas frases, sin secciones de más.")
                : (english ? "Give the useful detail. Use lists when they organize the answer." : "Responde con el detalle necesario. Usa listas cuando organicen la información.");
        return language + " " + detail;
    }

    @Transactional
    public Map<String, Object> preferences(Integer userId) {
        return preferenceJson(load(userId));
    }

    @Transactional
    public Map<String, Object> settings(Integer userId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("preferences", preferenceJson(load(userId)));
        body.put("credits", creditService.account(userId));
        return body;
    }

    @Transactional
    public Map<String, Object> update(Integer userId, JsonNode body) {
        AiPreferencia row = load(userId);
        if (body.has("mode")) row.setModo(oneOf(body.get("mode").asText(""), MODES, "modo"));
        if (body.has("language")) row.setIdioma(oneOf(body.get("language").asText(""), LANGUAGES, "idioma"));
        if (body.has("detail")) row.setDetalle(oneOf(body.get("detail").asText(""), DETAILS, "detalle"));
        if (body.has("indicators")) row.setIndicadores(body.get("indicators").asBoolean());
        if (body.has("animations")) row.setAnimaciones(body.get("animations").asBoolean());
        if (body.has("creditPool")) {
            String pool = oneOf(body.get("creditPool").asText(""), POOLS, "bolsa de créditos");
            if ("shared".equals(pool) && !canUseShared(userId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No puedes consumir los créditos compartidos.");
            }
            row.setCreditosPrimero(pool);
        }
        repository.save(row);
        return settings(userId);
    }

    private boolean canUseShared(Integer userId) {
        Object credits = creditService.account(userId).get("canUseShared");
        return Boolean.TRUE.equals(credits);
    }

    private AiPreferencia load(Integer userId) {
        return repository.findByUsuarioId(userId).orElseGet(() -> {
            AiPreferencia created = new AiPreferencia();
            created.setUsuarioId(userId);
            created.setModo(autorizacionRepository.existsByUsuarioIdAndPermitirTodoTrue(userId) ? "todo" : "preguntar");
            created.setIdioma("es");
            created.setDetalle("detallada");
            created.setIndicadores(true);
            created.setAnimaciones(true);
            created.setCreditosPrimero("personal");
            return repository.save(created);
        });
    }

    private static Map<String, Object> preferenceJson(AiPreferencia row) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("mode", row.getModo());
        body.put("language", row.getIdioma());
        body.put("detail", row.getDetalle());
        body.put("indicators", row.isIndicadores());
        body.put("animations", row.isAnimaciones());
        body.put("creditPool", row.getCreditosPrimero());
        return body;
    }

    private static String oneOf(String value, Set<String> allowed, String label) {
        if (!allowed.contains(value)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valor no válido para " + label);
        }
        return value;
    }
}
