package com.pistache.sprintops_backend.controller;

import com.pistache.sprintops_backend.dto.chatbot.ChatbotMessageRequest;
import com.pistache.sprintops_backend.service.AiCreditService;
import com.pistache.sprintops_backend.service.AiPreferenceService;
import com.pistache.sprintops_backend.service.AiWorkspaceService;
import com.pistache.sprintops_backend.service.UsuarioService;
import com.pistache.sprintops_backend.service.AiWorkspaceService.Turn;
import com.pistache.sprintops_backend.service.chatbot.AiAuthorizationService;
import com.pistache.sprintops_backend.service.chatbot.AiStreamCancelled;
import com.pistache.sprintops_backend.service.chatbot.AiStreamListener;
import com.pistache.sprintops_backend.service.chatbot.ChatbotOrchestrationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@RestController
@RequestMapping("/api/ai/projects/{projectId}")
@CrossOrigin(origins = "*")
public class AiController {

    private final ExecutorService streamPool = Executors.newCachedThreadPool();

    @Autowired
    private AiWorkspaceService workspaceService;
    @Autowired
    private AiCreditService creditService;
    @Autowired
    private AiPreferenceService preferenceService;
    @Autowired
    private AiAuthorizationService authorizationService;
    @Autowired
    private ChatbotOrchestrationService chatbotOrchestrationService;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private UsuarioService usuarioService;

    @GetMapping
    public Map<String, Object> workspace(@PathVariable Integer projectId, @RequestParam Integer userId) {
        requireMember(userId, projectId);
        Map<String, Object> body = workspaceService.workspace(projectId, userId);
        body.put("credits", creditService.snapshot(projectId));
        body.put("balance", creditService.balance(projectId, userId));
        body.put("preferences", preferenceService.preferences(userId));
        body.put("authorization", authorizationService.policy(projectId, userId));
        body.put("proposals", authorizationService.proposals(projectId, userId));
        body.put("operations", authorizationService.operations(projectId, userId));
        return body;
    }

    @PostMapping("/conversations")
    public Map<String, Object> createConversation(@PathVariable Integer projectId, @RequestBody JsonNode body) {
        Integer userId = userId(body);
        requireMember(userId, projectId);
        return workspaceService.createConversation(projectId, userId);
    }

    @PatchMapping("/conversations/{conversationId}")
    public Map<String, Object> updateConversation(@PathVariable Integer projectId,
                                                  @PathVariable Integer conversationId,
                                                  @RequestBody JsonNode body) {
        Integer userId = userId(body);
        requireMember(userId, projectId);
        boolean moveFolder = body.has("folderId");
        Integer folderId = body.path("folderId").isNull() || !body.has("folderId") ? null : body.path("folderId").asInt();
        return workspaceService.updateConversation(
                projectId,
                userId,
                conversationId,
                body.hasNonNull("title") ? body.get("title").asText() : null,
                folderId,
                body.has("archived") ? body.get("archived").asBoolean() : null,
                moveFolder
        );
    }

    @DeleteMapping("/conversations/{conversationId}")
    public ResponseEntity<Void> deleteConversation(@PathVariable Integer projectId,
                                                   @PathVariable Integer conversationId,
                                                   @RequestParam Integer userId) {
        requireMember(userId, projectId);
        workspaceService.deleteConversation(projectId, userId, conversationId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/conversations/{conversationId}/import")
    public ResponseEntity<Void> importMessages(@PathVariable Integer projectId,
                                               @PathVariable Integer conversationId,
                                               @RequestBody JsonNode body) {
        Integer userId = userId(body);
        requireMember(userId, projectId);
        workspaceService.importMessages(projectId, userId, conversationId, body.path("messages"));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/folders")
    public Map<String, Object> createFolder(@PathVariable Integer projectId, @RequestBody JsonNode body) {
        Integer userId = userId(body);
        requireMember(userId, projectId);
        return workspaceService.createFolder(projectId, userId, body.path("name").asText(""));
    }

    @PatchMapping("/folders/{folderId}")
    public Map<String, Object> updateFolder(@PathVariable Integer projectId,
                                            @PathVariable Integer folderId,
                                            @RequestBody JsonNode body) {
        Integer userId = userId(body);
        requireMember(userId, projectId);
        return workspaceService.updateFolder(
                projectId,
                userId,
                folderId,
                body.hasNonNull("name") ? body.get("name").asText() : null,
                body.has("expanded") ? body.get("expanded").asBoolean() : null
        );
    }

    @DeleteMapping("/folders/{folderId}")
    public ResponseEntity<Void> deleteFolder(@PathVariable Integer projectId,
                                             @PathVariable Integer folderId,
                                             @RequestParam Integer userId) {
        requireMember(userId, projectId);
        workspaceService.deleteFolder(projectId, userId, folderId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/credits")
    public Map<String, Object> updateCredits(@PathVariable Integer projectId, @RequestBody JsonNode body) {
        Integer userId = userId(body);
        requireMember(userId, projectId);
        return creditService.updateShared(projectId, userId, body);
    }

    @PatchMapping("/authorization")
    public Map<String, Object> updateAuthorization(@PathVariable Integer projectId, @RequestBody JsonNode body) {
        Integer userId = userId(body);
        requireMember(userId, projectId);
        return authorizationService.updatePolicy(projectId, userId, body);
    }

    @PostMapping("/proposals/{proposalId}/allow")
    public Map<String, Object> allowProposal(@PathVariable Integer projectId,
                                             @PathVariable Integer proposalId,
                                             @RequestBody JsonNode body) {
        Integer userId = userId(body);
        requireMember(userId, projectId);
        rejectSubstitutedChanges(body);
        return authorizationService.allow(projectId, userId, proposalId);
    }

    @PostMapping("/messages/{messageId}/undo")
    public Map<String, Object> undoAction(@PathVariable Integer projectId,
                                          @PathVariable Integer messageId,
                                          @RequestBody JsonNode body) {
        Integer userId = userId(body);
        requireMember(userId, projectId);
        return workspaceService.undo(projectId, userId, messageId, body.path("actionId").asText(""));
    }

    @PostMapping("/actions/{actionId}/retry")
    public Map<String, Object> retryAction(@PathVariable Integer projectId,
                                           @PathVariable Integer actionId,
                                           @RequestBody JsonNode body) {
        Integer userId = userId(body);
        requireMember(userId, projectId);
        rejectSubstitutedChanges(body);
        return authorizationService.retry(projectId, userId, actionId);
    }

    @PostMapping("/proposals/{proposalId}/reject")
    public Map<String, Object> rejectProposal(@PathVariable Integer projectId,
                                              @PathVariable Integer proposalId,
                                              @RequestBody JsonNode body) {
        Integer userId = userId(body);
        requireMember(userId, projectId);
        rejectSubstitutedChanges(body);
        return authorizationService.reject(projectId, userId, proposalId);
    }

    @PostMapping(value = "/conversations/{conversationId}/messages", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamMessage(@PathVariable Integer projectId,
                                    @PathVariable Integer conversationId,
                                    @RequestBody JsonNode body) {
        Integer userId = userId(body);
        requireMember(userId, projectId);
        String mode = body.path("mode").asText("send");
        Integer messageId = body.hasNonNull("messageId") ? body.get("messageId").asInt() : null;
        String message = body.path("message").asText("");
        String requestId = body.path("requestId").asText("");
        Turn turn = workspaceService.beginTurn(projectId, userId, conversationId, mode, messageId, message, requestId);

        SseEmitter emitter = new SseEmitter(300_000L);
        AtomicBoolean cancelled = new AtomicBoolean(false);
        emitter.onCompletion(() -> cancelled.set(true));
        emitter.onTimeout(() -> cancelled.set(true));
        emitter.onError(error -> cancelled.set(true));

        streamPool.execute(() -> {
            StringBuilder visible = new StringBuilder();
            Map<String, Map<String, Object>> actions = new LinkedHashMap<>();
            java.util.List<Map<String, Object>> sources = new java.util.ArrayList<>();
            try {
                send(emitter, "ready", Map.of(
                        "assistantMessageId", turn.assistantMessageId(),
                        "userMessageId", turn.userMessageId(),
                        "title", turn.title()
                ));
                ChatbotMessageRequest request = new ChatbotMessageRequest();
                request.setProjectId(projectId);
                request.setUserId(userId);
                request.setConversationId(turn.conversationId());
                request.setAssistantMessageId(turn.assistantMessageId());
                request.setRequestId(body.path("requestId").asText(""));
                request.setMessage(turn.message());
                request.setHistory(turn.history());
                request.setMemory(turn.memory());
                java.util.List<String> approved = new java.util.ArrayList<>();
                if (body.has("approvedSteps") && body.get("approvedSteps").isArray()) {
                    for (JsonNode step : body.get("approvedSteps")) {
                        String line = step.asText("").trim();
                        if (!line.isEmpty() && approved.size() < 8) {
                            approved.add(line.length() > 240 ? line.substring(0, 240) : line);
                        }
                    }
                }
                request.setApprovedSteps(approved);
                request.setPlan(approved.isEmpty() && body.path("plan").asBoolean(false));
                if (turn.replay()) {
                    String stored = turn.storedText() == null ? "" : turn.storedText();
                    if (!stored.isEmpty()) send(emitter, "delta", Map.of("text", stored));
                    send(emitter, "done", donePayload(turn, projectId, userId, stored, turn.status()));
                    emitter.complete();
                    return;
                }
                chatbotOrchestrationService.streamReply(request, new AiStreamListener() {
                    @Override
                    public void status(String label) {
                        send(emitter, "status", Map.of("label", label));
                    }

                    @Override
                    public void delta(String text) {
                        visible.append(text);
                        send(emitter, "delta", Map.of("text", text));
                    }

                    @Override
                    public void proposal(Map<String, Object> proposal) {
                        send(emitter, "proposal", proposal);
                    }

                    @Override
                    public void action(Map<String, Object> action) {
                        if (action.get("id") != null) actions.put(String.valueOf(action.get("id")), action);
                        send(emitter, "action", action);
                    }

                    @Override
                    public void sources(java.util.List<Map<String, Object>> next) {
                        sources.clear();
                        if (next != null) sources.addAll(next);
                        send(emitter, "sources", Map.of("sources", sources));
                    }

                    @Override
                    public void estimate(int credits) {
                        send(emitter, "estimate", Map.of("credits", credits));
                    }

                    @Override
                    public void notice(Map<String, Object> notice) {
                        send(emitter, "notice", notice);
                    }

                    @Override
                    public boolean isCancelled() {
                        return cancelled.get();
                    }
                });
                java.util.List<Map<String, Object>> savedActions = new java.util.ArrayList<>(actions.values());
                java.util.List<Map<String, Object>> savedSources = new java.util.ArrayList<>(sources);
                workspaceService.finishTurn(turn.conversationId(), turn.assistantMessageId(), visible.toString(), "completo", savedActions, savedSources);
                if (body.hasNonNull("planMessageId")) {
                    workspaceService.markPlan(turn.conversationId(), body.get("planMessageId").asInt());
                }
                Map<String, Object> done = donePayload(turn, projectId, userId, visible.toString(), "completo");
                done.put("actions", savedActions);
                done.put("sources", savedSources);
                send(emitter, "done", done);
                emitter.complete();
            } catch (AiStreamCancelled cancelledEx) {
                workspaceService.finishTurn(turn.conversationId(), turn.assistantMessageId(), visible.toString(), "interrumpido", new java.util.ArrayList<>(actions.values()), new java.util.ArrayList<>(sources));
                try {
                    emitter.complete();
                } catch (Exception ignored) {
                    // el cliente ya cerró la conexión
                }
            } catch (Exception error) {
                String text = visible.isEmpty()
                        ? (error.getMessage() == null ? "No pude contactar al asistente." : error.getMessage())
                        : visible.toString();
                workspaceService.finishTurn(turn.conversationId(), turn.assistantMessageId(), text, "error", new java.util.ArrayList<>(actions.values()), new java.util.ArrayList<>(sources));
                try {
                    send(emitter, "error", Map.of("message", text));
                    emitter.complete();
                } catch (Exception ignored) {
                    // el cliente ya cerró la conexión
                }
            }
        });
        return emitter;
    }

    private static void rejectSubstitutedChanges(JsonNode body) {
        if (body != null && (body.has("arguments") || body.has("changes") || body.has("proposedChanges") || body.has("tool"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La autorización solo aplica a los cambios ya propuestos");
        }
    }

    private void requireMember(Integer userId, Integer projectId) {
        if (userId == null || projectId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "projectId y userId son obligatorios");
        }
        if (usuarioService.findById(userId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado");
        }
        if (!chatbotOrchestrationService.isProjectMember(userId, projectId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No eres miembro de este proyecto");
        }
    }

    private Map<String, Object> donePayload(Turn turn, Integer projectId, Integer userId, String text, String status) {
        Map<String, Object> done = new LinkedHashMap<>();
        done.put("assistantMessageId", turn.assistantMessageId());
        done.put("userMessageId", turn.userMessageId());
        done.put("title", turn.title());
        done.put("text", text == null ? "" : text);
        done.put("status", status == null ? "completo" : status);
        done.put("credits", creditService.snapshot(projectId));
        done.put("balance", creditService.balance(projectId, userId));
        return done;
    }

    private static Integer userId(JsonNode body) {
        if (body == null || !body.hasNonNull("userId")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId es obligatorio");
        }
        return body.get("userId").asInt();
    }

    private void send(SseEmitter emitter, String event, Map<String, ?> data) {
        try {
            emitter.send(SseEmitter.event()
                    .name(event)
                    .data(objectMapper.writeValueAsString(data)));
        } catch (Exception error) {
            throw new AiStreamCancelled();
        }
    }
}
