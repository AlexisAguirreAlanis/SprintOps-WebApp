package com.pistache.sprintops_backend.controller;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.pistache.sprintops_backend.model.NotaProyecto;
import com.pistache.sprintops_backend.model.Proyecto;
import com.pistache.sprintops_backend.model.ProyectoNotaPagina;
import com.pistache.sprintops_backend.model.Usuario;
import com.pistache.sprintops_backend.repository.NotaProyectoRepository;
import com.pistache.sprintops_backend.repository.ProyectoNotaPaginaRepository;
import com.pistache.sprintops_backend.service.ProyectoService;
import com.pistache.sprintops_backend.service.UsuarioService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/proyectos/{projectId}/notas")
@CrossOrigin(origins = "*")
public class NotaProyectoController {

    private static final int MAX_TEXT = 2000;
    private static final int MAX_PAGE = 500_000;

    @Autowired
    private NotaProyectoRepository notaRepository;
    @Autowired
    private ProyectoNotaPaginaRepository paginaRepository;
    @Autowired
    private ProyectoService proyectoService;
    @Autowired
    private UsuarioService usuarioService;
    @Autowired
    private ObjectMapper objectMapper;

    @GetMapping
    public ResponseEntity<?> list(@PathVariable Integer projectId) {
        if (proyectoService.findById(projectId).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        List<Map<String, Object>> notes = notaRepository
                .findByProyectoIdProyectoOrderByCreadoEnDesc(projectId)
                .stream()
                .map(this::toMap)
                .toList();
        return ResponseEntity.ok(notes);
    }

    @GetMapping("/pagina")
    public ResponseEntity<?> page(@PathVariable Integer projectId) {
        if (proyectoService.findById(projectId).isEmpty()) return ResponseEntity.notFound().build();
        ProyectoNotaPagina page = paginaRepository.findByProyectoIdProyecto(projectId).orElse(null);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("content", page == null ? null : readJson(page.getContenido()));
        return ResponseEntity.ok(body);
    }

    @PutMapping("/pagina")
    public ResponseEntity<?> savePage(@PathVariable Integer projectId, @RequestBody Map<String, Object> body) {
        Proyecto project = proyectoService.findById(projectId).orElse(null);
        if (project == null) return ResponseEntity.notFound().build();
        Integer userId = intValue(body == null ? null : body.get("userId"));
        if (userId == null || usuarioService.findById(userId).isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Falta un usuario válido."));
        }
        Object raw = body == null ? null : body.get("content");
        if (!(raw instanceof Map<?, ?> content) || !"doc".equals(String.valueOf(content.get("type")))) {
            return ResponseEntity.badRequest().body(Map.of("error", "La página de notas no tiene un documento válido."));
        }
        String json;
        try {
            json = objectMapper.writeValueAsString(content);
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Map.of("error", "No se pudo leer la página de notas."));
        }
        if (json.length() > MAX_PAGE) {
            return ResponseEntity.badRequest().body(Map.of("error", "La página de notas es demasiado larga."));
        }
        ProyectoNotaPagina page = paginaRepository.findByProyectoIdProyecto(projectId).orElseGet(ProyectoNotaPagina::new);
        page.setProyecto(project);
        page.setContenido(json);
        page.setActualizadoEn(Instant.now());
        paginaRepository.save(page);
        return ResponseEntity.ok(Map.of("content", content));
    }

    @PostMapping
    public ResponseEntity<?> create(@PathVariable Integer projectId, @RequestBody Map<String, Object> body) {
        Proyecto project = proyectoService.findById(projectId).orElse(null);
        if (project == null) return ResponseEntity.notFound().build();

        Integer userId = intValue(body == null ? null : body.get("userId"));
        Usuario author = userId == null ? null : usuarioService.findById(userId).orElse(null);
        if (author == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Falta un usuario válido."));
        }

        String text = body == null || body.get("text") == null ? "" : String.valueOf(body.get("text")).trim();
        if (text.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "La nota no puede estar vacía."));
        }
        if (text.length() > MAX_TEXT) {
            return ResponseEntity.badRequest().body(Map.of("error", "La nota es demasiado larga."));
        }

        NotaProyecto note = new NotaProyecto();
        note.setProyecto(project);
        note.setAutor(author);
        note.setTexto(text);
        note.setCreadoEn(Instant.now());
        return ResponseEntity.ok(toMap(notaRepository.save(note)));
    }

    @DeleteMapping("/{noteId}")
    public ResponseEntity<?> delete(
            @PathVariable Integer projectId,
            @PathVariable Integer noteId,
            @RequestParam Integer userId
    ) {
        NotaProyecto note = notaRepository.findById(noteId).orElse(null);
        if (note == null || note.getProyecto() == null || !projectId.equals(note.getProyecto().getIdProyecto())) {
            return ResponseEntity.notFound().build();
        }
        if (note.getAutor() == null || !userId.equals(note.getAutor().getIdUsuario())) {
            return ResponseEntity.status(403).body(Map.of("error", "Solo quien escribió la nota puede eliminarla."));
        }
        notaRepository.delete(note);
        return ResponseEntity.noContent().build();
    }

    private Map<String, Object> toMap(NotaProyecto note) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", note.getIdNota());
        row.put("text", note.getTexto());
        row.put("authorId", note.getAutor() == null ? null : note.getAutor().getIdUsuario());
        row.put("authorName", note.getAutor() == null ? "Sin autor" : note.getAutor().getNombreUsuario());
        row.put("createdAt", note.getCreadoEn() == null ? null : note.getCreadoEn().toString());
        return row;
    }

    private Object readJson(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            JsonNode node = objectMapper.readTree(raw);
            return objectMapper.convertValue(node, Object.class);
        } catch (Exception ex) {
            return null;
        }
    }

    private Integer intValue(Object raw) {
        if (raw instanceof Number number) return number.intValue();
        if (raw == null) return null;
        try {
            return Integer.valueOf(String.valueOf(raw));
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
