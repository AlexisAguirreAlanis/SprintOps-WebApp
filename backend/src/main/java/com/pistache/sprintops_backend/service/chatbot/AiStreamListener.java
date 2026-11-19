package com.pistache.sprintops_backend.service.chatbot;

import java.util.Map;

public interface AiStreamListener {
    void status(String label);

    void delta(String text);

    void proposal(Map<String, Object> proposal);

    void action(Map<String, Object> action);

    void sources(java.util.List<Map<String, Object>> sources);

    void estimate(int credits);

    void notice(Map<String, Object> notice);

    boolean isCancelled();
}
