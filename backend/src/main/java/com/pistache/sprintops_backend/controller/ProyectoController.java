package com.pistache.sprintops_backend.controller;

import com.pistache.sprintops_backend.dto.CreateProyectoRequest;
import com.pistache.sprintops_backend.dto.ProyectoDTO;
import com.pistache.sprintops_backend.dto.MiembroEquipoDTO;
import com.pistache.sprintops_backend.model.*;
import com.pistache.sprintops_backend.service.JoinCodeRateLimiter;
import com.pistache.sprintops_backend.service.ProyectoService;
import com.pistache.sprintops_backend.service.ProyectoIssuesDocxExportService;
import com.pistache.sprintops_backend.service.ProyectoCardCoverService;
import com.pistache.sprintops_backend.util.ImageUploadSupport;
import com.pistache.sprintops_backend.service.EquipoService;
import com.pistache.sprintops_backend.util.ScheduleDates;
import com.pistache.sprintops_backend.service.UsuarioService;
import com.pistache.sprintops_backend.repository.*;
import com.pistache.sprintops_backend.model.InfoUsuarioEquipo.InfoUsuarioEquipoId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/proyectos")
@CrossOrigin(origins = "*")
public class ProyectoController {

    @Autowired
    private ProyectoService proyectoService;
    @Autowired
    private EquipoService equipoService;
    @Autowired
    private UsuarioService usuarioService;
    @Autowired
    private InfoUsuarioEquipoRepository infoUsuarioEquipoRepository;
    @Autowired
    private RolesDeUsuariosRepository rolesDeUsuariosRepository;
    @Autowired
    private RolRepository rolRepository;
    @Autowired
    private ProyectoIssuesDocxExportService proyectoIssuesDocxExportService;
    @Autowired
    private ProyectoCardCoverService proyectoCardCoverService;
    @Autowired
    private SprintRepository sprintRepository;
    @Autowired
    private JoinCodeRateLimiter joinCodeRateLimiter;
    @Autowired
    private IssuesRepository issuesRepository;

    @GetMapping
    public List<ProyectoDTO> getAll() {
        return proyectoService.findAll().stream()
                .map(p -> toDashboardDto(p, null))
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProyectoDTO> getById(@PathVariable Integer id) {
        return proyectoService.findById(id)
                .map(p -> ResponseEntity.ok(ProyectoDTO.fromEntity(p)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/export/issues-docx")
    public ResponseEntity<byte[]> exportIssuesDocx(@PathVariable Integer id) {
        try {
            var opt = proyectoService.findById(id);
            if (opt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            byte[] bytes = proyectoIssuesDocxExportService.export(opt.get());
            String base = opt.get().getNombreProyecto() != null ? opt.get().getNombreProyecto() : "proyecto";
            String safe = base.replaceAll("[^a-zA-Z0-9._\\- ]", "_").replaceAll("\\s+", " ").trim();
            if (safe.isEmpty()) {
                safe = "proyecto";
            }
            String filename = safe + "-Issues.docx";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.parseMediaType(
                            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
                    .body(bytes);
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/codigo/{codigo}")
    public ResponseEntity<?> getByCodigo(
            @PathVariable String codigo,
            @RequestParam(required = false) Integer userId) {
        String key = JoinCodeRateLimiter.attemptKey(userId);
        var locked = joinCodeRateLimiter.lockRemaining(key);
        if (locked.isPresent()) {
            return lockedResponse(locked.get());
        }
        var found = proyectoService.findByCodigoProyecto(codigo);
        if (found.isEmpty()) {
            joinCodeRateLimiter.recordFailure(key);
            var nowLocked = joinCodeRateLimiter.lockRemaining(key);
            if (nowLocked.isPresent()) {
                return lockedResponse(nowLocked.get());
            }
            return ResponseEntity.status(404).body(Map.of("error", JoinCodeRateLimiter.UNKNOWN_CODE));
        }
        joinCodeRateLimiter.reset(key);
        return ResponseEntity.ok(ProyectoDTO.fromEntity(found.get()));
    }

    private ResponseEntity<Map<String, Object>> lockedResponse(Duration remaining) {
        long seconds = Math.max(1, remaining.getSeconds());
        return ResponseEntity.status(429).body(Map.of(
                "error", JoinCodeRateLimiter.lockMessage(remaining),
                "retryAfterSeconds", seconds));
    }

    @GetMapping("/usuario/{userId}")
    public List<ProyectoDTO> getByUserId(@PathVariable Integer userId) {
        // Find all equipos where user is a member
        List<InfoUsuarioEquipo> memberships = infoUsuarioEquipoRepository.findByUsuarioIdUsuario(userId);
        Set<Integer> equipoIds = memberships.stream()
                .map(m -> m.getEquipo().getIdEquipo())
                .collect(Collectors.toSet());

        // Get all projects from those equipos
        return proyectoService.findAll().stream()
                .filter(p -> p.getEquipo() != null && equipoIds.contains(p.getEquipo().getIdEquipo()))
                .map(p -> toDashboardDto(p, userId))
                .collect(Collectors.toList());
    }

    /**
     * Datos de la card: equipo, rol de quien consulta y avance por issues.
     * Si no hay issues, progress queda null.
     */
    private ProyectoDTO toDashboardDto(Proyecto proyecto, Integer viewerId) {
        ProyectoDTO dto = ProyectoDTO.fromEntity(proyecto);
        dto.setMembersPreview(List.of());
        dto.setMemberCount(0);
        dto.setIssuesTotal(0);
        dto.setIssuesDone(0);
        try {
            if (proyecto.getEquipo() != null) {
                Integer equipoId = proyecto.getEquipo().getIdEquipo();
                List<InfoUsuarioEquipo> memberships = infoUsuarioEquipoRepository.findByEquipoIdEquipo(equipoId);
                Map<Integer, String> roleMap = new HashMap<>();
                for (RolesDeUsuarios entry : rolesDeUsuariosRepository.findByEquipoIdEquipo(equipoId)) {
                    if (entry.getUsuario() != null && entry.getRol() != null) {
                        roleMap.put(entry.getUsuario().getIdUsuario(), entry.getRol().getNombreRol());
                    }
                }
                List<MiembroEquipoDTO> preview = new ArrayList<>();
                for (InfoUsuarioEquipo membership : memberships) {
                    Usuario person = membership.getUsuario();
                    if (person == null) continue;
                    if (preview.size() < 4) {
                        MiembroEquipoDTO member = new MiembroEquipoDTO();
                        member.setUserId(person.getIdUsuario());
                        member.setName(person.getNombreUsuario());
                        member.setAvatarUrl(person.getAvatarUrl());
                        member.setRole(roleMap.get(person.getIdUsuario()));
                        preview.add(member);
                    }
                    if (viewerId != null && viewerId.equals(person.getIdUsuario())) {
                        dto.setMyRole(roleMap.getOrDefault(viewerId, "Miembro"));
                    }
                }
                dto.setMembersPreview(preview);
                dto.setMemberCount(memberships.size());
            }

            List<Issues> issues = issuesRepository.findAllBelongingToProject(proyecto.getIdProyecto());
            int done = 0;
            LocalDate last = null;
            for (Issues issue : issues) {
                if ("done".equalsIgnoreCase(issue.getEstadoIssue())) done++;
                LocalDate mark = issue.getFechaFinIssue() != null
                        ? issue.getFechaFinIssue()
                        : issue.getFechaCreacionIssue();
                if (mark != null && (last == null || mark.isAfter(last))) last = mark;
            }
            dto.setIssuesTotal(issues.size());
            dto.setIssuesDone(done);
            dto.setProgress(issues.isEmpty() ? null : (int) Math.round(done * 100.0 / issues.size()));
            dto.setLastActivity(last);
        } catch (RuntimeException ignored) {
            dto.setProgress(null);
        }
        return dto;
    }

    @GetMapping("/{id}/miembros")
    public List<MiembroEquipoDTO> getMembers(@PathVariable Integer id) {
        var proyecto = proyectoService.findById(id);
        if (proyecto.isEmpty() || proyecto.get().getEquipo() == null) {
            return List.of();
        }
        Integer equipoId = proyecto.get().getEquipo().getIdEquipo();
        List<InfoUsuarioEquipo> members = infoUsuarioEquipoRepository.findByEquipoIdEquipo(equipoId);
        List<RolesDeUsuarios> roles = rolesDeUsuariosRepository.findByEquipoIdEquipo(equipoId);

        Map<Integer, String> roleMap = new HashMap<>();
        for (RolesDeUsuarios r : roles) {
            roleMap.put(r.getUsuario().getIdUsuario(), r.getRol().getNombreRol());
        }

        return members.stream().map(m -> {
            MiembroEquipoDTO dto = new MiembroEquipoDTO();
            dto.setUserId(m.getUsuario().getIdUsuario());
            dto.setName(m.getUsuario().getNombreUsuario());
            dto.setEmail(m.getUsuario().getEmailUsuario());
            dto.setRole(roleMap.getOrDefault(m.getUsuario().getIdUsuario(), "Developer"));
            dto.setAvatarUrl(m.getUsuario().getAvatarUrl());
            return dto;
        }).collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody CreateProyectoRequest request) {
        String dateError = ScheduleDates.projectRangeError(request.getStart(), request.getEnd());
        if (dateError != null) {
            return ResponseEntity.badRequest().body(Map.of("error", dateError));
        }
        // Create equipo for project
        Equipo equipo = new Equipo();
        equipo.setNombreEquipo("Equipo " + request.getName());
        equipo.setDescripcion("Equipo del proyecto " + request.getName());
        equipo.setFechaCreacionEquipo(LocalDate.now());
        final Equipo savedEquipo = equipoService.save(equipo);

        String codigo = proyectoService.nextUniqueCodigoProyecto();

        Proyecto proyecto = new Proyecto();
        proyecto.setNombreProyecto(request.getName());
        proyecto.setDescripcionProyecto(request.getDescription());
        proyecto.setCodigoProyecto(codigo);
        proyecto.setFechaInicioProyecto(request.getStart());
        proyecto.setFechaFinProyecto(request.getEnd());
        proyecto.setEstadoDelProyecto("A");
        proyecto.setEquipo(savedEquipo);
        boolean modoTiempo = "tiempo".equalsIgnoreCase(request.getModo());
        proyecto.setModoProyecto(modoTiempo ? "tiempo" : "agil");
        proyecto.setCotizacionHabilitada(modoTiempo && Boolean.TRUE.equals(request.getCotizacionHabilitada()));

        // Set creator
        if (request.getOwnerId() != null) {
            usuarioService.findById(request.getOwnerId()).ifPresent(proyecto::setCreador);
        }

        proyecto = proyectoService.save(proyecto);

        // Add owner to equipo
        if (request.getOwnerId() != null) {
            var owner = usuarioService.findById(request.getOwnerId());
            if (owner.isPresent()) {
                InfoUsuarioEquipo info = new InfoUsuarioEquipo();
                info.setId(new InfoUsuarioEquipo.InfoUsuarioEquipoId(savedEquipo.getIdEquipo(), owner.get().getIdUsuario()));
                info.setEquipo(savedEquipo);
                info.setUsuario(owner.get());
                info.setFechaUnionEquipo(LocalDate.now());
                infoUsuarioEquipoRepository.save(info);

                // Assign Product Owner role to the creator
                rolRepository.findByNombreRol("Product Owner").ifPresent(poRol -> {
                    RolesDeUsuarios roleEntry = new RolesDeUsuarios();
                    roleEntry.setId(new RolesDeUsuarios.RolesDeUsuariosId(
                        poRol.getIdRol(), savedEquipo.getIdEquipo(), owner.get().getIdUsuario()));
                    roleEntry.setRol(poRol);
                    roleEntry.setEquipo(savedEquipo);
                    roleEntry.setUsuario(owner.get());
                    rolesDeUsuariosRepository.save(roleEntry);
                });
            }
        }

        return ResponseEntity.ok(ProyectoDTO.fromEntity(proyecto));
    }

    @PostMapping("/{id}/unirse")
    public ResponseEntity<?> joinProject(@PathVariable Integer id, @RequestBody Map<String, Integer> body) {
        Integer userId = body.get("userId");
        var proyecto = proyectoService.findById(id);
        var usuario = usuarioService.findById(userId);

        if (proyecto.isEmpty() || usuario.isEmpty() || proyecto.get().getEquipo() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Proyecto o usuario no encontrado"));
        }

        Equipo equipo = proyecto.get().getEquipo();

        // Check if already a member
        var existing = infoUsuarioEquipoRepository.findById(
                new InfoUsuarioEquipo.InfoUsuarioEquipoId(equipo.getIdEquipo(), userId));
        if (existing.isPresent()) {
            return ResponseEntity.ok(Map.of("message", "Ya eres miembro de este proyecto"));
        }

        InfoUsuarioEquipo info = new InfoUsuarioEquipo();
        info.setId(new InfoUsuarioEquipo.InfoUsuarioEquipoId(equipo.getIdEquipo(), userId));
        info.setEquipo(equipo);
        info.setUsuario(usuario.get());
        info.setFechaUnionEquipo(LocalDate.now());
        infoUsuarioEquipoRepository.save(info);

        return ResponseEntity.ok(Map.of("message", "Te has unido al proyecto exitosamente"));
    }

    @PutMapping("/{id}/miembros/{userId}/rol")
    public ResponseEntity<?> updateMemberRole(
            @PathVariable Integer id,
            @PathVariable Integer userId,
            @RequestBody Map<String, String> body) {
        String roleName = body.get("role");
        if (roleName == null || roleName.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Role name is required"));
        }

        var proyecto = proyectoService.findById(id);
        if (proyecto.isEmpty() || proyecto.get().getEquipo() == null) {
            return ResponseEntity.notFound().build();
        }
        Integer equipoId = proyecto.get().getEquipo().getIdEquipo();

        var usuario = usuarioService.findById(userId);
        if (usuario.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        var newRol = rolRepository.findByNombreRol(roleName);
        if (newRol.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Rol no encontrado: " + roleName));
        }

        // Delete old role entry for this user in this team
        List<RolesDeUsuarios> existing = rolesDeUsuariosRepository.findByEquipoIdEquipo(equipoId);
        existing.stream()
                .filter(r -> r.getUsuario().getIdUsuario().equals(userId))
                .forEach(rolesDeUsuariosRepository::delete);

        // Insert new role entry
        RolesDeUsuarios entry = new RolesDeUsuarios();
        entry.setId(new RolesDeUsuarios.RolesDeUsuariosId(
                newRol.get().getIdRol(), equipoId, userId));
        entry.setRol(newRol.get());
        entry.setEquipo(proyecto.get().getEquipo());
        entry.setUsuario(usuario.get());
        rolesDeUsuariosRepository.save(entry);

        return ResponseEntity.ok(Map.of("message", "Rol actualizado exitosamente"));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Integer id, @RequestBody Map<String, Object> updates) {
        var optProyecto = proyectoService.findById(id);
        if (optProyecto.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Proyecto proyecto = optProyecto.get();

        if (updates.containsKey("name")) proyecto.setNombreProyecto((String) updates.get("name"));
        if (updates.containsKey("description")) proyecto.setDescripcionProyecto((String) updates.get("description"));
        if (updates.containsKey("status")) proyecto.setEstadoDelProyecto((String) updates.get("status"));
        if (updates.containsKey("end")) {
            LocalDate end = LocalDate.parse((String) updates.get("end"));
            LocalDate latestSprintEnd = null;
            for (var sprint : sprintRepository.findByProyectoIdProyecto(id)) {
                LocalDate marker = sprint.getFechaFinSprint() != null
                        ? sprint.getFechaFinSprint()
                        : sprint.getFechaInicioSprint();
                if (marker != null && (latestSprintEnd == null || marker.isAfter(latestSprintEnd))) {
                    latestSprintEnd = marker;
                }
            }
            LocalDate start = updates.containsKey("start")
                    ? LocalDate.parse((String) updates.get("start"))
                    : proyecto.getFechaInicioProyecto();
            String dateError = ScheduleDates.projectEndUpdateError(start, end, latestSprintEnd);
            if (dateError != null) {
                return ResponseEntity.badRequest().body(Map.of("error", dateError));
            }
            proyecto.setFechaFinProyecto(end);
        }
        if (updates.containsKey("start")) proyecto.setFechaInicioProyecto(LocalDate.parse((String) updates.get("start")));

        return ResponseEntity.ok(ProyectoDTO.fromEntity(proyectoService.save(proyecto)));
    }

    @GetMapping("/{id}/card-cover")
    public ResponseEntity<byte[]> getCardCover(@PathVariable Integer id) {
        var opt = proyectoService.findById(id);
        if (opt.isEmpty() || !Boolean.TRUE.equals(opt.get().getCardCoverCustom())) {
            return ResponseEntity.notFound().build();
        }
        try {
            Optional<byte[]> bytes = proyectoCardCoverService.load(id);
            if (bytes.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            String ct = opt.get().getCardCoverContentType() != null
                    ? opt.get().getCardCoverContentType()
                    : "image/jpeg";
            MediaType mediaType = MediaType.parseMediaType(ct);
            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .body(bytes.get());
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @Transactional
    @PostMapping(value = "/{id}/card-cover", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadCardCover(
            @PathVariable Integer id,
            @RequestParam("userId") Integer userId,
            @RequestParam("file") MultipartFile file) {
        if (!isUserMemberOfProject(userId, id)) {
            return ResponseEntity.status(403).body(Map.of("error", "No eres miembro de este proyecto"));
        }
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Archivo vacío"));
        }
        if (!ImageUploadSupport.isAllowed(file)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Solo imágenes JPEG, PNG, WebP, GIF o HEIC"));
        }
        var opt = proyectoService.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Proyecto proyecto = opt.get();
        String contentType = ImageUploadSupport.resolveContentType(file);
        try {
            proyectoCardCoverService.save(id, file.getInputStream(), 6_000_000L, contentType);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "No se pudo guardar la imagen"));
        }
        String ct = contentType;
        proyecto.setCardCoverContentType(ct);
        proyecto.setCardCoverCustom(true);
        long v = proyecto.getCardCoverVersion() != null ? proyecto.getCardCoverVersion() : 0L;
        proyecto.setCardCoverVersion(v + 1);
        proyecto = proyectoService.save(proyecto);
        return ResponseEntity.ok(ProyectoDTO.fromEntity(proyecto));
    }

    @Transactional
    @DeleteMapping("/{id}/card-cover")
    public ResponseEntity<?> deleteCardCover(
            @PathVariable Integer id,
            @RequestParam("userId") Integer userId) {
        if (!isUserMemberOfProject(userId, id)) {
            return ResponseEntity.status(403).body(Map.of("error", "No eres miembro de este proyecto"));
        }
        var opt = proyectoService.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        try {
            proyectoCardCoverService.delete(id);
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "No se pudo eliminar el archivo"));
        }
        Proyecto proyecto = opt.get();
        proyecto.setCardCoverCustom(false);
        proyecto.setCardCoverContentType(null);
        proyecto = proyectoService.save(proyecto);
        return ResponseEntity.ok(ProyectoDTO.fromEntity(proyecto));
    }

    private boolean isUserMemberOfProject(Integer userId, Integer projectId) {
        if (userId == null || projectId == null) {
            return false;
        }
        var opt = proyectoService.findById(projectId);
        if (opt.isEmpty() || opt.get().getEquipo() == null) {
            return false;
        }
        int equipoId = opt.get().getEquipo().getIdEquipo();
        return infoUsuarioEquipoRepository.findById(new InfoUsuarioEquipoId(equipoId, userId)).isPresent();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        if (!proyectoService.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        proyectoService.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private String mapRoleName(String dbRole) {
        if (dbRole == null) return "developer";
        return switch (dbRole.toLowerCase()) {
            case "product owner", "productowner" -> "productOwner";
            case "scrum master", "scrummaster" -> "scrumMaster";
            default -> "developer";
        };
    }
}
