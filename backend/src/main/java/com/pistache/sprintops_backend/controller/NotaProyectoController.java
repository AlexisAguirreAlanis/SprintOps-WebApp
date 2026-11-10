package com.pistache.sprintops_backend.controller;

import com.pistache.sprintops_backend.model.NotaProyecto;
import com.pistache.sprintops_backend.model.Proyecto;
import com.pistache.sprintops_backend.model.Usuario;
import com.pistache.sprintops_backend.repository.NotaProyectoRepository;
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

    @Autowired
    private NotaProyectoRepository notaRepository;
    @Autowired
    private ProyectoService proyectoService;
    @Autowired
    private UsuarioService usuarioService;

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
