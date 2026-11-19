package com.pistache.sprintops_backend.dto.chatbot;

import lombok.Data;
import java.util.ArrayList;
import java.util.List;

@Data
public class ChatbotMessageRequest {
    private Integer projectId;
    private Integer userId;
    private Integer conversationId;
    private Integer assistantMessageId;
    /** Misma clave en un reintento: el consumo de créditos no se aplica dos veces. */
    private String requestId;
    private String message;
    private List<ChatbotHistoryTurn> history = new ArrayList<>();
    /** Resumen y fragmentos de mensajes anteriores. No es el estado del proyecto. */
    private String memory;
    /** Pide un plan y no ejecuta cambios. */
    private boolean plan;
    /** Pasos ya aprobados. Si hay alguno, el turno los ejecuta. */
    private List<String> approvedSteps = new ArrayList<>();
}
