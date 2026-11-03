package com.pistache.sprintops_backend.controller;

import com.pistache.sprintops_backend.dto.HojaDTO;
import com.pistache.sprintops_backend.service.HojaService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/hojas")
@CrossOrigin(origins = "*")
public class HojaController {

    private final HojaService hojaService;

    public HojaController(HojaService hojaService) {
        this.hojaService = hojaService;
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
