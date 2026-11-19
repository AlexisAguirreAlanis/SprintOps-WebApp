package com.pistache.sprintops_backend.controller;

import com.pistache.sprintops_backend.service.AiCreditService;
import com.pistache.sprintops_backend.service.AiPreferenceService;
import com.pistache.sprintops_backend.service.UsuarioService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

import java.util.Map;

@RestController
@RequestMapping("/api/ai/settings")
@CrossOrigin(origins = "*")
public class AiSettingsController {

    @Autowired
    private AiPreferenceService preferenceService;
    @Autowired
    private AiCreditService creditService;
    @Autowired
    private UsuarioService usuarioService;

    @GetMapping
    public Map<String, Object> settings(@RequestParam Integer userId) {
        requireUser(userId);
        return preferenceService.settings(userId);
    }

    @PostMapping("/purchase")
    public Map<String, Object> purchase(@RequestBody JsonNode body) {
        if (body == null || !body.path("confirm").asBoolean(false)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Confirma la compra para continuar. No se hace ningún cargo automático.");
        }
        if (!body.has("userId") || !body.get("userId").isNumber() || !body.has("credits") || !body.get("credits").isNumber()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica el paquete de créditos");
        }
        Integer userId = body.get("userId").asInt();
        requireUser(userId);
        Map<String, Object> transaction = creditService.preparePurchase(
                userId, body.get("credits").asInt(), body.path("requestId").asText(""));
        Map<String, Object> result = preferenceService.settings(userId);
        result.put("transaction", transaction);
        if (body.has("projectId") && body.get("projectId").isNumber()) {
            result.put("balance", creditService.balance(body.get("projectId").asInt(), userId));
        }
        return result;
    }

    @PatchMapping
    public Map<String, Object> update(@RequestBody JsonNode body) {
        if (body == null || !body.has("userId") || !body.get("userId").isNumber()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica el usuario");
        }
        Integer userId = body.get("userId").asInt();
        requireUser(userId);
        return preferenceService.update(userId, body);
    }

    private void requireUser(Integer userId) {
        if (userId == null || usuarioService.findById(userId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado");
        }
    }
}
