package com.pistache.sprintops_backend.service.chatbot;

import com.pistache.sprintops_backend.service.chatbot.AiToolCatalog.AiTool;
import com.pistache.sprintops_backend.service.chatbot.AiToolCatalog.Risk;

import java.util.Locale;

/** El riesgo y el alcance salen del catálogo. Una herramienta desconocida no se ejecuta sola. */
public final class AiActionPolicy {

    private AiActionPolicy() {
    }

    public static boolean mutation(String name) {
        AiTool tool = AiToolCatalog.definition(name);
        if (tool != null) return tool.risk() != Risk.READ;
        if (name == null || name.isBlank()) return false;
        return name.startsWith("create_")
                || name.startsWith("update_")
                || name.startsWith("set_")
                || name.startsWith("delete_")
                || name.startsWith("restore_")
                || name.startsWith("assign_")
                || name.startsWith("move_")
                || name.startsWith("save_")
                || name.startsWith("append_")
                || name.startsWith("replace_")
                || name.startsWith("add_")
                || name.equals("join_project_by_invite_code");
    }

    public static boolean safe(String name) {
        AiTool tool = AiToolCatalog.definition(name);
        return tool != null && tool.risk() == Risk.SAFE;
    }

    public static boolean highRisk(String name) {
        if (name == null || name.isBlank()) return true;
        String low = name.toLowerCase(Locale.ROOT);
        if (low.contains("pago") || low.contains("compra") || low.contains("cargo")
                || low.contains("purchase") || low.contains("charge") || low.contains("billing")
                || low.contains("stripe")) {
            return true;
        }
        AiTool tool = AiToolCatalog.definition(name);
        if (tool == null) return true;
        return tool.risk() == Risk.DESTRUCTIVE;
    }

    /** tasks, sprints, documents, notes, o null si no puede entrar en Permitir todo. */
    public static String scope(String name) {
        AiTool tool = AiToolCatalog.definition(name);
        if (tool == null || tool.risk() == Risk.READ || tool.risk() == Risk.DESTRUCTIVE) return null;
        return tool.scope();
    }
}
