package com.pistache.sprintops_backend.controller;

import com.pistache.sprintops_backend.dto.HojaDTO;
import com.pistache.sprintops_backend.service.DocumentAiService;
import com.pistache.sprintops_backend.service.HojaService;
import com.pistache.sprintops_backend.service.LegacyDocImportService;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/hojas")
@CrossOrigin(origins = "*")
public class HojaController {

    private final HojaService hojaService;
    private final DocumentAiService documentAiService;
    private final LegacyDocImportService legacyDocImportService;

    public HojaController(HojaService hojaService, DocumentAiService documentAiService, LegacyDocImportService legacyDocImportService) {
        this.hojaService = hojaService;
        this.documentAiService = documentAiService;
        this.legacyDocImportService = legacyDocImportService;
    }

    @GetMapping
    public List<HojaDTO> list(@RequestParam Integer userId) {
        return hojaService.list(userId);
    }

    @GetMapping("/{id}")
    public HojaDTO get(@PathVariable Integer id, @RequestParam Integer userId) {
        return hojaService.get(id, userId);
    }

    @PostMapping
    public HojaDTO create(@RequestBody Map<String, Object> body) {
        return hojaService.create(
                intValue(body.get("userId")),
                stringValue(body.get("name")),
                intValue(body.get("projectId")),
                stringValue(body.get("document")));
    }

    @PutMapping("/{id}")
    public HojaDTO update(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        return hojaService.update(
                id,
                intValue(body.get("userId")),
                body.containsKey("name") ? stringValue(body.get("name")) : null,
                boolValue(body.get("favorite")),
                boolValue(body.get("archived")),
                boolValue(body.get("deleted")),
                intValue(body.get("projectId")),
                body.containsKey("projectId"));
    }

    @PutMapping("/{id}/documento")
    public HojaDTO saveDocument(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        Number revision = body.get("revision") instanceof Number number ? number : 0;
        return hojaService.saveDocument(
                id,
                intValue(body.get("userId")),
                stringValue(body.get("document")),
                revision.longValue());
    }

    @PostMapping("/{id}/duplicar")
    public HojaDTO duplicate(@PathVariable Integer id, @RequestParam Integer userId) {
        return hojaService.duplicate(id, userId);
    }

    @GetMapping("/{id}/acceso")
    public Map<String, Object> access(@PathVariable Integer id, @RequestParam Integer userId) {
        return hojaService.access(id, userId);
    }

    @PutMapping("/{id}/acceso")
    public Map<String, Object> updateAccess(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        return hojaService.updateAccess(
                id,
                intValue(body.get("userId")),
                body.containsKey("visibility") ? stringValue(body.get("visibility")) : null,
                boolValue(body.get("filterTeam")),
                body.containsKey("teamUserIds") ? intList(body.get("teamUserIds")) : null,
                body.containsKey("addEmail") ? stringValue(body.get("addEmail")) : null,
                stringValue(body.get("addRole")),
                intValue(body.get("removeUserId")),
                intValue(body.get("roleUserId")),
                stringValue(body.get("role")));
    }

    @PostMapping("/{id}/presencia")
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> pulse(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        Map<String, Object> cursor = body.get("cursor") instanceof Map<?, ?> map ? (Map<String, Object>) map : null;
        return hojaService.pulse(id, intValue(body.get("userId")), cursor);
    }

    @GetMapping("/{id}/revision")
    public Map<String, Object> revision(@PathVariable Integer id, @RequestParam Integer userId) {
        return hojaService.revision(id, userId);
    }

    @GetMapping("/{id}/versiones")
    public List<Map<String, Object>> versions(@PathVariable Integer id, @RequestParam Integer userId) {
        return hojaService.versions(id, userId);
    }

    @GetMapping("/{id}/versiones/{versionId}")
    public Map<String, Object> version(@PathVariable Integer id, @PathVariable Integer versionId, @RequestParam Integer userId) {
        return hojaService.version(id, versionId, userId);
    }

    @PostMapping("/{id}/versiones")
    public Map<String, Object> createVersion(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        return hojaService.createVersion(id, intValue(body.get("userId")), stringValue(body.get("label")));
    }

    @PostMapping("/{id}/versiones/{versionId}/restaurar")
    public HojaDTO restoreVersion(@PathVariable Integer id, @PathVariable Integer versionId, @RequestBody Map<String, Object> body) {
        return hojaService.restoreVersion(id, versionId, intValue(body.get("userId")));
    }

    @PostMapping("/{id}/menciones")
    public Map<String, Object> mentions(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        return hojaService.notifyMentions(id, intValue(body.get("userId")), intList(body.get("mentionedIds")), stringValue(body.get("text")));
    }

    @PostMapping("/{id}/ia")
    public Map<String, Object> ai(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        hojaService.plainTextFor(id, intValue(body.get("userId")));
        String result = documentAiService.run(
                stringValue(body.get("action")),
                stringValue(body.get("text")),
                stringValue(body.get("instruction")),
                stringValue(body.get("context")),
                stringValue(body.get("image")));
        return Map.of("result", result);
    }

    @GetMapping("/buscar")
    public List<Map<String, Object>> search(@RequestParam Integer userId, @RequestParam String q) {
        return hojaService.search(userId, q);
    }

    @PostMapping(value = "/importar-doc", consumes = "multipart/form-data")
    public Map<String, Object> importLegacyDoc(@RequestParam("file") MultipartFile file) throws java.io.IOException {
        return Map.of("html", legacyDocImportService.toHtml(file.getInputStream()));
    }

    private static List<Integer> intList(Object value) {
        List<Integer> ids = new ArrayList<>();
        if (value instanceof List<?> list) {
            for (Object item : list) {
                Integer id = intValue(item);
                if (id != null) ids.add(id);
            }
        }
        return ids;
    }

    private static Integer intValue(Object value) {
        if (value == null || value instanceof String text && text.isBlank()) return null;
        if (value instanceof Number number) return number.intValue();
        return Integer.valueOf(String.valueOf(value));
    }

    private static String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static Boolean boolValue(Object value) {
        if (value == null) return null;
        if (value instanceof Boolean bool) return bool;
        return Boolean.valueOf(String.valueOf(value));
    }
}
