package com.pistache.sprintops_backend.service;

import tools.jackson.databind.ObjectMapper;
import com.pistache.sprintops_backend.dto.chatbot.ChatbotHistoryTurn;
import com.pistache.sprintops_backend.model.AiCarpeta;
import com.pistache.sprintops_backend.model.AiConversacion;
import com.pistache.sprintops_backend.model.AiMensaje;
import com.pistache.sprintops_backend.repository.AiCarpetaRepository;
import com.pistache.sprintops_backend.repository.AiConversacionRepository;
import com.pistache.sprintops_backend.repository.AiMensajeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AiWorkspaceService {

    public static final String NEW_TITLE = "Nueva conversación";

    @Autowired
    private AiCarpetaRepository carpetaRepository;
    @Autowired
    private AiConversacionRepository conversacionRepository;
    @Autowired
    private AiMensajeRepository mensajeRepository;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private HojaService hojaService;

    @Transactional(readOnly = true)
    public Map<String, Object> workspace(Integer projectId, Integer userId) {
        List<Map<String, Object>> folders = carpetaRepository
                .findByProyectoIdAndUsuarioIdOrderByCreadoEnAsc(projectId, userId)
                .stream()
                .map(this::folderJson)
                .toList();
        List<AiConversacion> conversations = conversacionRepository
                .findByProyectoIdAndUsuarioIdOrderByActualizadoEnDesc(projectId, userId);
        List<Map<String, Object>> conversationJson = new ArrayList<>();
        for (AiConversacion conversation : conversations) {
            conversationJson.add(conversationJson(conversation, true));
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("folders", folders);
        body.put("conversations", conversationJson);
        return body;
    }

    @Transactional
    public Map<String, Object> createConversation(Integer projectId, Integer userId) {
        Instant now = Instant.now();
        AiConversacion conversation = new AiConversacion();
        conversation.setProyectoId(projectId);
        conversation.setUsuarioId(userId);
        conversation.setTitulo(NEW_TITLE);
        conversation.setArchivada(false);
        conversation.setCreadoEn(now);
        conversation.setActualizadoEn(now);
        conversacionRepository.save(conversation);
        return conversationJson(conversation, true);
    }

    @Transactional
    public Map<String, Object> updateConversation(Integer projectId, Integer userId, Integer conversationId,
                                                  String title, Integer folderId, Boolean archived, boolean moveFolder) {
        AiConversacion conversation = requireConversation(projectId, userId, conversationId);
        if (title != null) {
            String next = title.trim();
            if (next.isEmpty() || next.length() > 80) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El nombre debe tener entre 1 y 80 caracteres");
            }
            conversation.setTitulo(next);
        }
        if (moveFolder) {
            if (folderId != null) {
                requireFolder(projectId, userId, folderId);
            }
            conversation.setCarpetaId(folderId);
        }
        if (archived != null) {
            conversation.setArchivada(archived);
        }
        conversation.setActualizadoEn(Instant.now());
        conversacionRepository.save(conversation);
        return conversationJson(conversation, false);
    }

    @Transactional
    public void deleteConversation(Integer projectId, Integer userId, Integer conversationId) {
        AiConversacion conversation = requireConversation(projectId, userId, conversationId);
        List<AiMensaje> messages = mensajeRepository.findByConversacionIdOrderByIdMensajeAsc(conversation.getIdConversacion());
        mensajeRepository.deleteAll(messages);
        conversacionRepository.delete(conversation);
    }

    @Transactional
    public Map<String, Object> createFolder(Integer projectId, Integer userId, String name) {
        String title = cleanFolderName(name);
        AiCarpeta folder = new AiCarpeta();
        folder.setProyectoId(projectId);
        folder.setUsuarioId(userId);
        folder.setNombre(title);
        folder.setExpandida(true);
        folder.setCreadoEn(Instant.now());
        carpetaRepository.save(folder);
        return folderJson(folder);
    }

    @Transactional
    public Map<String, Object> updateFolder(Integer projectId, Integer userId, Integer folderId,
                                             String name, Boolean expanded) {
        AiCarpeta folder = requireFolder(projectId, userId, folderId);
        if (name != null) {
            folder.setNombre(cleanFolderName(name));
        }
        if (expanded != null) {
            folder.setExpandida(expanded);
        }
        carpetaRepository.save(folder);
        return folderJson(folder);
    }

    @Transactional
    public void deleteFolder(Integer projectId, Integer userId, Integer folderId) {
        AiCarpeta folder = requireFolder(projectId, userId, folderId);
        for (AiConversacion conversation : conversacionRepository.findByProyectoIdAndUsuarioIdOrderByActualizadoEnDesc(projectId, userId)) {
            if (folderId.equals(conversation.getCarpetaId())) {
                conversation.setCarpetaId(null);
                conversacionRepository.save(conversation);
            }
        }
        carpetaRepository.delete(folder);
    }

    @Transactional
    public void importMessages(Integer projectId, Integer userId, Integer conversationId, tools.jackson.databind.JsonNode messages) {
        AiConversacion conversation = requireConversation(projectId, userId, conversationId);
        if (!mensajeRepository.findByConversacionIdOrderByIdMensajeAsc(conversation.getIdConversacion()).isEmpty()) {
            return;
        }
        if (messages == null || !messages.isArray()) {
            return;
        }
        for (tools.jackson.databind.JsonNode item : messages) {
            String role = item.path("role").asText("");
            String text = item.path("text").asText("");
            if ((!"user".equals(role) && !"assistant".equals(role)) || text.isBlank()) {
                continue;
            }
            mensajeRepository.save(message(conversation.getIdConversacion(), role, text));
        }
        conversation.setActualizadoEn(Instant.now());
        conversacionRepository.save(conversation);
    }

    @Transactional
    public Turn beginTurn(Integer projectId, Integer userId, Integer conversationId,
                          String mode, Integer messageId, String message, String requestId) {
        AiConversacion conversation = requireConversation(projectId, userId, conversationId);
        conversacionRepository.lockById(conversation.getIdConversacion());
        List<AiMensaje> messages = new ArrayList<>(
                mensajeRepository.findByConversacionIdOrderByIdMensajeAsc(conversation.getIdConversacion()));
        closeStale(messages);
        String key = requestKey(userId, requestId);
        if (key != null) {
            AiMensaje prior = mensajeRepository.findBySolicitud(key).orElse(null);
            if (prior != null) {
                if (!conversation.getIdConversacion().equals(prior.getConversacionId())) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Esa solicitud pertenece a otra conversación");
                }
                if ("generando".equals(prior.getEstado())) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Esa solicitud ya se está generando");
                }
                return replay(conversation, messages, prior);
            }
        }
        if (messages.stream().anyMatch(item -> "generando".equals(item.getEstado()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya hay una respuesta en curso en esta conversación");
        }
        String kind = mode == null ? "send" : mode;
        if ("edit".equals(kind)) {
            AiMensaje target = messages.stream()
                    .filter(item -> item.getIdMensaje().equals(messageId) && "user".equals(item.getRol()))
                    .findFirst()
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mensaje no encontrado"));
            String text = requireText(message);
            target.setTexto(text);
            mensajeRepository.save(target);
            mensajeRepository.deleteAfter(conversation.getIdConversacion(), target.getIdMensaje());
            messages.removeIf(item -> item.getIdMensaje() > target.getIdMensaje());
        } else if ("regenerate".equals(kind)) {
            if (!messages.isEmpty() && "assistant".equals(messages.get(messages.size() - 1).getRol())) {
                AiMensaje last = messages.remove(messages.size() - 1);
                mensajeRepository.delete(last);
            }
            if (messages.isEmpty() || !"user".equals(messages.get(messages.size() - 1).getRol())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No hay un mensaje para regenerar");
            }
        } else {
            String text = requireText(message);
            AiMensaje user = message(conversation.getIdConversacion(), "user", text);
            mensajeRepository.save(user);
            messages.add(user);
            if (NEW_TITLE.equals(conversation.getTitulo())) {
                String title = text.replaceAll("\\s+", " ").trim();
                conversation.setTitulo(title.length() > 80 ? title.substring(0, 80) : title);
            }
        }

        AiMensaje currentUser = messages.get(messages.size() - 1);
        if (!"user".equals(currentUser.getRol())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La conversación no termina en un mensaje tuyo");
        }
        messages.remove(messages.size() - 1);

        AiMensaje assistant = message(conversation.getIdConversacion(), "assistant", "");
        assistant.setEstado("generando");
        assistant.setSolicitud(key);
        mensajeRepository.save(assistant);
        conversation.setActualizadoEn(Instant.now());
        conversacionRepository.save(conversation);

        String memory = fold(conversation, messages, currentUser.getTexto());
        List<ChatbotHistoryTurn> history = recent(messages);
        return new Turn(
                assistant.getIdMensaje(),
                currentUser.getIdMensaje(),
                conversation.getIdConversacion(),
                conversation.getTitulo(),
                currentUser.getTexto(),
                history,
                false,
                "",
                "generando",
                memory
        );
    }

    @Transactional
    public void finishTurn(Integer conversationId, Integer assistantId, String text, String status) {
        finishTurn(conversationId, assistantId, text, status, null);
    }

    @Transactional
    public void finishTurn(Integer conversationId, Integer assistantId, String text, String status, java.util.List<Map<String, Object>> actions) {
        finishTurn(conversationId, assistantId, text, status, actions, null);
    }

    @Transactional
    public void finishTurn(Integer conversationId, Integer assistantId, String text, String status,
                           java.util.List<Map<String, Object>> actions, java.util.List<Map<String, Object>> sources) {
        AiMensaje assistant = mensajeRepository.findById(assistantId).orElse(null);
        if (assistant == null || !conversationId.equals(assistant.getConversacionId())) {
            return;
        }
        if ("completo".equals(assistant.getEstado()) || "interrumpido".equals(assistant.getEstado()) || "error".equals(assistant.getEstado())) {
            return;
        }
        String kind = "interrumpido".equals(status) || "error".equals(status) ? status : "completo";
        String body = text == null ? "" : text;
        if (body.isBlank()) {
            body = "interrumpido".equals(kind) ? "La respuesta se interrumpió." : "error".equals(kind) ? "No pude completar la respuesta." : "Listo.";
        }
        assistant.setTexto(body);
        assistant.setEstado(kind);
        if (actions != null && !actions.isEmpty()) assistant.setAcciones(objectMapper.writeValueAsString(actions));
        if (sources != null && !sources.isEmpty()) assistant.setFuentes(objectMapper.writeValueAsString(sources));
        mensajeRepository.save(assistant);
        conversacionRepository.findById(conversationId).ifPresent(conversation -> {
            conversation.setActualizadoEn(Instant.now());
            conversacionRepository.save(conversation);
        });
    }

    public AiConversacion requireConversation(Integer projectId, Integer userId, Integer conversationId) {
        AiConversacion conversation = conversacionRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversación no encontrada"));
        if (!projectId.equals(conversation.getProyectoId()) || !userId.equals(conversation.getUsuarioId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversación no encontrada");
        }
        return conversation;
    }

    private AiCarpeta requireFolder(Integer projectId, Integer userId, Integer folderId) {
        AiCarpeta folder = carpetaRepository.findById(folderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Carpeta no encontrada"));
        if (!projectId.equals(folder.getProyectoId()) || !userId.equals(folder.getUsuarioId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Carpeta no encontrada");
        }
        return folder;
    }

    private static String requireText(String message) {
        String text = message == null ? "" : message.trim();
        if (text.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escribe un mensaje");
        }
        return text;
    }

    private static String cleanFolderName(String name) {
        String title = name == null ? "" : name.trim();
        if (title.isEmpty() || title.length() > 60) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El nombre de la carpeta debe tener entre 1 y 60 caracteres");
        }
        return title;
    }

    private static AiMensaje message(Integer conversationId, String role, String text) {
        AiMensaje message = new AiMensaje();
        message.setConversacionId(conversationId);
        message.setRol(role);
        message.setTexto(text);
        message.setEstado("completo");
        message.setCreadoEn(Instant.now());
        return message;
    }

    private void closeStale(List<AiMensaje> messages) {
        Instant limit = Instant.now().minus(Duration.ofMinutes(6));
        for (AiMensaje message : messages) {
            if (!"generando".equals(message.getEstado())) continue;
            if (message.getCreadoEn() != null && message.getCreadoEn().isAfter(limit)) continue;
            message.setEstado("interrumpido");
            if (message.getTexto() == null || message.getTexto().isBlank()) {
                message.setTexto("La respuesta se interrumpió.");
            }
            mensajeRepository.save(message);
        }
    }

    private Turn replay(AiConversacion conversation, List<AiMensaje> messages, AiMensaje assistant) {
        AiMensaje user = null;
        for (AiMensaje item : messages) {
            if (item.getIdMensaje().equals(assistant.getIdMensaje())) break;
            if ("user".equals(item.getRol())) user = item;
        }
        return new Turn(
                assistant.getIdMensaje(),
                user == null ? null : user.getIdMensaje(),
                conversation.getIdConversacion(),
                conversation.getTitulo(),
                user == null ? "" : user.getTexto(),
                List.of(),
                true,
                assistant.getTexto() == null ? "" : assistant.getTexto(),
                assistant.getEstado() == null ? "completo" : assistant.getEstado(),
                ""
        );
    }

    @Transactional
    public void markPlan(Integer conversationId, Integer messageId) {
        AiMensaje message = mensajeRepository.findById(messageId).orElse(null);
        if (message == null || !conversationId.equals(message.getConversacionId())) return;
        List<Map<String, Object>> actions = copyActions(message.getAcciones());
        boolean changed = false;
        for (Map<String, Object> action : actions) {
            if (!"plan".equals(action.get("kind")) && !"plan".equals(action.get("id"))) continue;
            action.put("phase", "done");
            action.put("headline", "Plan ejecutado");
            action.put("status", "Ejecutado");
            changed = true;
        }
        if (!changed) return;
        message.setAcciones(objectMapper.writeValueAsString(actions));
        mensajeRepository.save(message);
    }

    @Transactional
    public Map<String, Object> undo(Integer projectId, Integer userId, Integer messageId, String actionId) {
        if (actionId == null || actionId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Falta la acción.");
        }
        AiMensaje message = mensajeRepository.findById(messageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mensaje no encontrado"));
        requireConversation(projectId, userId, message.getConversacionId());
        Map<String, Object> action = null;
        for (Map<String, Object> item : copyActions(message.getAcciones())) {
            if (actionId.equals(String.valueOf(item.get("id")))) action = item;
        }
        if (action == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No encontré ese cambio.");
        }
        if ("undone".equals(action.get("phase"))) return action;
        if (!(action.get("undo") instanceof Map<?, ?> undo) || !"documento".equals(String.valueOf(undo.get("kind")))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este cambio no se puede deshacer.");
        }
        hojaService.restoreVersion(intValue(undo.get("documentId")), intValue(undo.get("versionId")), userId);
        action.remove("undo");
        action.put("phase", "undone");
        action.put("headline", "Se recuperó la versión anterior");
        action.put("status", "Deshecho");
        replaceAction(messageId, action);
        return action;
    }

    private List<Map<String, Object>> copyActions(String raw) {
        List<Map<String, Object>> actions = new ArrayList<>();
        for (Object item : readActions(raw)) {
            if (!(item instanceof Map<?, ?> map)) continue;
            Map<String, Object> copy = new LinkedHashMap<>();
            map.forEach((key, value) -> copy.put(String.valueOf(key), value));
            actions.add(copy);
        }
        return actions;
    }

    private static int intValue(Object raw) {
        if (raw instanceof Number number) return number.intValue();
        try {
            return Integer.parseInt(String.valueOf(raw));
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este cambio no se puede deshacer.");
        }
    }

    @Transactional
    public void replaceAction(Integer messageId, Map<String, Object> action) {
        if (messageId == null || action == null || action.get("id") == null) return;
        AiMensaje message = mensajeRepository.findById(messageId).orElse(null);
        if (message == null) return;
        java.util.List<Map<String, Object>> actions = new java.util.ArrayList<>();
        for (Object item : readActions(message.getAcciones())) {
            if (item instanceof Map<?, ?> map && !action.get("id").equals(map.get("id"))) {
                Map<String, Object> copy = new java.util.LinkedHashMap<>();
                map.forEach((key, value) -> copy.put(String.valueOf(key), value));
                actions.add(copy);
            }
        }
        actions.add(action);
        message.setAcciones(objectMapper.writeValueAsString(actions));
        mensajeRepository.save(message);
    }

    private java.util.List<?> readActions(String raw) {
        if (raw == null || raw.isBlank()) return java.util.List.of();
        try {
            Object parsed = objectMapper.readValue(raw, java.util.List.class);
            return parsed instanceof java.util.List<?> list ? list : java.util.List.of();
        } catch (RuntimeException ex) {
            return java.util.List.of();
        }
    }

    private static String requestKey(Integer userId, String requestId) {
        String clean = requestId == null ? "" : requestId.trim();
        if (!clean.matches("[A-Za-z0-9._:-]{8,80}")) return null;
        return "solicitud:" + userId + ":" + clean;
    }

    private Map<String, Object> folderJson(AiCarpeta folder) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", folder.getIdCarpeta());
        json.put("name", folder.getNombre());
        json.put("expanded", folder.isExpandida());
        json.put("createdAt", folder.getCreadoEn().toString());
        return json;
    }

    private Map<String, Object> conversationJson(AiConversacion conversation, boolean withMessages) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", conversation.getIdConversacion());
        json.put("title", conversation.getTitulo());
        json.put("folderId", conversation.getCarpetaId());
        json.put("archived", conversation.isArchivada());
        json.put("createdAt", conversation.getCreadoEn().toString());
        json.put("updatedAt", conversation.getActualizadoEn().toString());
        if (withMessages) {
            List<Map<String, Object>> messages = new ArrayList<>();
            for (AiMensaje message : mensajeRepository.findByConversacionIdOrderByIdMensajeAsc(conversation.getIdConversacion())) {
                String status = message.getEstado() == null || message.getEstado().isBlank() ? "completo" : message.getEstado();
                String text = message.getTexto() == null ? "" : message.getTexto();
                if (text.isBlank() && !"generando".equals(status)) continue;
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", message.getIdMensaje());
                item.put("role", message.getRol());
                item.put("text", text.isBlank() ? "Generando respuesta…" : text);
                item.put("status", status);
                item.put("actions", readActions(message.getAcciones()));
                item.put("sources", readActions(message.getFuentes()));
                messages.add(item);
            }
            json.put("messages", messages);
        }
        return json;
    }

    public record Turn(
            Integer assistantMessageId,
            Integer userMessageId,
            Integer conversationId,
            String title,
            String message,
            List<ChatbotHistoryTurn> history,
            boolean replay,
            String storedText,
            String status,
            String memory
    ) {
    }

    private static final int RECENT_MESSAGES = 12;

    private String fold(AiConversacion conversation, List<AiMensaje> prior, String question) {
        if (prior.size() <= RECENT_MESSAGES) return "";
        List<AiMensaje> older = prior.subList(0, prior.size() - RECENT_MESSAGES);
        Integer lastId = older.get(older.size() - 1).getIdMensaje();
        String summary = conversation.getResumen();
        if (summary == null || summary.isBlank() || !lastId.equals(conversation.getResumenHasta())) {
            summary = summarize(older);
            conversation.setResumen(summary);
            conversation.setResumenHasta(lastId);
            conversacionRepository.save(conversation);
        }
        String recalled = recall(older, question);
        if (recalled.isBlank()) return summary;
        return summary + "\nFragmentos de mensajes anteriores relacionados con esta pregunta:\n" + recalled;
    }

    private List<ChatbotHistoryTurn> recent(List<AiMensaje> prior) {
        List<ChatbotHistoryTurn> history = new ArrayList<>();
        int from = Math.max(0, prior.size() - RECENT_MESSAGES);
        for (int index = from; index < prior.size(); index++) {
            AiMensaje item = prior.get(index);
            if (item.getTexto() == null || item.getTexto().isBlank()) continue;
            String content = item.getTexto();
            if ("interrumpido".equals(item.getEstado()) && !content.contains("se interrumpió")) {
                content = content + "\nLa respuesta se interrumpió.";
            }
            ChatbotHistoryTurn turn = new ChatbotHistoryTurn();
            turn.setRole(item.getRol());
            turn.setContent(clipMemory(content, 600));
            history.add(turn);
        }
        return history;
    }

    private static String summarize(List<AiMensaje> older) {
        StringBuilder body = new StringBuilder("Resumen de mensajes anteriores de esta conversación:\n");
        AiMensaje first = null;
        for (AiMensaje item : older) {
            if ("user".equals(item.getRol()) && item.getTexto() != null && !item.getTexto().isBlank()) {
                first = item;
                break;
            }
        }
        if (first != null) body.append(memoryLine(first)).append('\n');
        int start = Math.max(0, older.size() - 8);
        for (int index = start; index < older.size(); index++) {
            AiMensaje item = older.get(index);
            if (item == first || item.getTexto() == null || item.getTexto().isBlank()) continue;
            body.append(memoryLine(item)).append('\n');
            if (body.length() > 1400) break;
        }
        return clipMemory(body.toString(), 1500);
    }

    private static String recall(List<AiMensaje> older, String question) {
        List<String> tokens = memoryTokens(question);
        if (tokens.isEmpty()) return "";
        StringBuilder body = new StringBuilder();
        int shown = 0;
        for (int index = older.size() - 1; index >= 0 && shown < 3; index--) {
            AiMensaje item = older.get(index);
            String text = item.getTexto() == null ? "" : item.getTexto();
            String normalized = normMemory(text);
            int hits = 0;
            for (String token : tokens) {
                if (normalized.contains(token)) hits++;
            }
            if (hits == 0) continue;
            body.append("- ").append(clipMemory(text.replace('\n', ' '), 180)).append('\n');
            shown++;
        }
        return body.toString().trim();
    }

    private static String memoryLine(AiMensaje item) {
        String who = "user".equals(item.getRol()) ? "Tú" : "Asistente";
        return "- " + who + ": " + clipMemory(item.getTexto().replace('\n', ' '), 140);
    }

    private static List<String> memoryTokens(String value) {
        List<String> tokens = new ArrayList<>();
        for (String part : normMemory(value).split("[^a-z0-9]+")) {
            if (part.length() < 4) continue;
            if ("para".equals(part) || "como".equals(part) || "este".equals(part) || "esta".equals(part)
                    || "sobre".equals(part) || "quiero".equals(part) || "puedes".equals(part)) {
                continue;
            }
            tokens.add(part);
        }
        return tokens;
    }

    private static String clipMemory(String value, int max) {
        String text = value == null ? "" : value.trim();
        return text.length() <= max ? text : text.substring(0, max);
    }

    private static String normMemory(String value) {
        String text = value == null ? "" : value;
        return java.text.Normalizer.normalize(text, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(java.util.Locale.ROOT);
    }
}
