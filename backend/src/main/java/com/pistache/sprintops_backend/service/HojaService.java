package com.pistache.sprintops_backend.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.pistache.sprintops_backend.dto.HojaDTO;
import com.pistache.sprintops_backend.model.Hoja;
import com.pistache.sprintops_backend.model.InfoUsuarioEquipo;
import com.pistache.sprintops_backend.model.Proyecto;
import com.pistache.sprintops_backend.model.Usuario;
import com.pistache.sprintops_backend.repository.HojaRepository;
import com.pistache.sprintops_backend.repository.InfoUsuarioEquipoRepository;
import com.pistache.sprintops_backend.repository.ProyectoRepository;
import com.pistache.sprintops_backend.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class HojaService {

    public static final int SCHEMA_VERSION = 1;
    public static final String EMPTY_DOCUMENT = "{\"schemaVersion\":1,\"elements\":[]}";
    private static final int MAX_DOCUMENT_CHARS = 1_500_000;

    private final HojaRepository hojaRepository;
    private final UsuarioRepository usuarioRepository;
    private final ProyectoRepository proyectoRepository;
    private final InfoUsuarioEquipoRepository membershipRepository;
    private final ObjectMapper objectMapper;

    public HojaService(
            HojaRepository hojaRepository,
            UsuarioRepository usuarioRepository,
            ProyectoRepository proyectoRepository,
            InfoUsuarioEquipoRepository membershipRepository,
            ObjectMapper objectMapper) {
        this.hojaRepository = hojaRepository;
        this.usuarioRepository = usuarioRepository;
        this.proyectoRepository = proyectoRepository;
        this.membershipRepository = membershipRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<HojaDTO> list(Integer userId) {
        Usuario user = requireUser(userId);
        Map<Integer, Hoja> found = new LinkedHashMap<>();
        for (Hoja hoja : hojaRepository.findByPropietario_IdUsuario(user.getIdUsuario())) {
            found.put(hoja.getIdHoja(), hoja);
        }
        List<Integer> teams = teamIds(user.getIdUsuario());
        if (!teams.isEmpty()) {
            for (Hoja hoja : hojaRepository.findByProyecto_Equipo_IdEquipoIn(teams)) {
                found.putIfAbsent(hoja.getIdHoja(), hoja);
            }
        }
        List<HojaDTO> result = new ArrayList<>();
        for (Hoja hoja : found.values()) {
            if (canView(hoja, user.getIdUsuario())) {
                result.add(toDto(hoja, user.getIdUsuario(), false));
            }
        }
        return result;
    }

    @Transactional(readOnly = true)
    public HojaDTO get(Integer id, Integer userId) {
        Usuario user = requireUser(userId);
        Hoja hoja = requireView(id, user.getIdUsuario());
        return toDto(hoja, user.getIdUsuario(), true);
    }

    @Transactional
    public HojaDTO create(Integer userId, String name, Integer projectId, String document) {
        Usuario user = requireUser(userId);
        Hoja hoja = new Hoja();
        hoja.setNombre(cleanName(name));
        hoja.setPropietario(user);
        hoja.setProyecto(projectFor(user, projectId));
        hoja.setFavorita(false);
        hoja.setArchivada(false);
        hoja.setEliminada(false);
        hoja.setSchemaVersion(SCHEMA_VERSION);
        hoja.setRevision(1);
        hoja.setDocumento(validateDocument(document == null || document.isBlank() ? EMPTY_DOCUMENT : document));
        Instant now = Instant.now();
        hoja.setFechaCreacion(now);
        hoja.setFechaActualizacion(now);
        return toDto(hojaRepository.save(hoja), user.getIdUsuario(), false);
    }

    @Transactional
    public HojaDTO update(Integer id, Integer userId, String name, Boolean favorite, Boolean archived, Boolean deleted, Integer projectId, boolean projectPresent) {
        Usuario user = requireUser(userId);
        Hoja hoja = requireView(id, user.getIdUsuario());
        boolean owner = isOwner(hoja, user.getIdUsuario());
        if (name != null) {
            if (!owner) throw forbidden();
            hoja.setNombre(cleanName(name));
        }
        if (favorite != null) {
            if (!canEdit(hoja, user.getIdUsuario())) throw forbidden();
            hoja.setFavorita(favorite);
        }
        if (archived != null) {
            if (!owner) throw forbidden();
            hoja.setArchivada(archived);
            if (archived) hoja.setEliminada(false);
        }
        if (deleted != null) {
            if (!owner) throw forbidden();
            hoja.setEliminada(deleted);
        }
        if (projectPresent) {
            if (!owner) throw forbidden();
            hoja.setProyecto(projectFor(user, projectId));
        }
        hoja.setFechaActualizacion(Instant.now());
        return toDto(hojaRepository.save(hoja), user.getIdUsuario(), false);
    }

    @Transactional
    public HojaDTO saveDocument(Integer id, Integer userId, String document, long revision) {
        Usuario user = requireUser(userId);
        Hoja hoja = requireView(id, user.getIdUsuario());
        if (!canEdit(hoja, user.getIdUsuario())) throw forbidden();
        if (hoja.isEliminada()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La hoja está en la papelera.");
        }
        if (hoja.getRevision() != revision) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La hoja cambió en el servidor.");
        }
        hoja.setDocumento(validateDocument(document));
        hoja.setSchemaVersion(SCHEMA_VERSION);
        hoja.setRevision(revision + 1);
        hoja.setFechaActualizacion(Instant.now());
        return toDto(hojaRepository.save(hoja), user.getIdUsuario(), false);
    }

    @Transactional
    public HojaDTO duplicate(Integer id, Integer userId) {
        Usuario user = requireUser(userId);
        Hoja source = requireView(id, user.getIdUsuario());
        if (!canView(source, user.getIdUsuario())) throw forbidden();
        Hoja copy = new Hoja();
        String name = "Copia de " + source.getNombre();
        copy.setNombre(name.length() > 250 ? name.substring(0, 250) : name);
        copy.setPropietario(user);
        copy.setProyecto(canEdit(source, user.getIdUsuario()) ? source.getProyecto() : null);
        copy.setFavorita(false);
        copy.setArchivada(false);
        copy.setEliminada(false);
        copy.setSchemaVersion(source.getSchemaVersion());
        copy.setRevision(1);
        copy.setDocumento(source.getDocumento() == null ? EMPTY_DOCUMENT : source.getDocumento());
        Instant now = Instant.now();
        copy.setFechaCreacion(now);
        copy.setFechaActualizacion(now);
        return toDto(hojaRepository.save(copy), user.getIdUsuario(), false);
    }

    private Hoja requireView(Integer id, Integer userId) {
        Hoja hoja = hojaRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Hoja no encontrada."));
        if (!canView(hoja, userId)) throw forbidden();
        return hoja;
    }

    private boolean canView(Hoja hoja, Integer userId) {
        return isOwner(hoja, userId) || isProjectMember(hoja, userId);
    }

    private boolean canEdit(Hoja hoja, Integer userId) {
        return canView(hoja, userId);
    }

    private boolean isOwner(Hoja hoja, Integer userId) {
        return hoja.getPropietario() != null && userId.equals(hoja.getPropietario().getIdUsuario());
    }

    private boolean isProjectMember(Hoja hoja, Integer userId) {
        if (hoja.getProyecto() == null || hoja.getProyecto().getEquipo() == null) return false;
        Integer equipoId = hoja.getProyecto().getEquipo().getIdEquipo();
        return teamIds(userId).contains(equipoId);
    }

    private List<Integer> teamIds(Integer userId) {
        List<Integer> ids = new ArrayList<>();
        for (InfoUsuarioEquipo membership : membershipRepository.findByUsuarioIdUsuario(userId)) {
            if (membership.getEquipo() != null) ids.add(membership.getEquipo().getIdEquipo());
        }
        return ids;
    }

    private Proyecto projectFor(Usuario user, Integer projectId) {
        if (projectId == null) return null;
        Proyecto proyecto = proyectoRepository.findById(projectId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "El proyecto no existe."));
        if (proyecto.getCreador() != null && user.getIdUsuario().equals(proyecto.getCreador().getIdUsuario())) {
            return proyecto;
        }
        if (proyecto.getEquipo() != null && teamIds(user.getIdUsuario()).contains(proyecto.getEquipo().getIdEquipo())) {
            return proyecto;
        }
        throw forbidden();
    }

    private Usuario requireUser(Integer userId) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Falta el usuario.");
        }
        return usuarioRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado."));
    }

    private String cleanName(String name) {
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isEmpty()) trimmed = "Sin título";
        return trimmed.length() > 250 ? trimmed.substring(0, 250) : trimmed;
    }

    private String validateDocument(String document) {
        if (document == null || document.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El documento está vacío.");
        }
        if (document.length() > MAX_DOCUMENT_CHARS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El documento es demasiado grande.");
        }
        try {
            JsonNode root = objectMapper.readTree(document);
            if (!root.isObject() || !root.path("elements").isArray()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El documento no tiene elementos.");
            }
            int version = root.path("schemaVersion").asInt(0);
            if (version != SCHEMA_VERSION) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Versión de documento no soportada.");
            }
            return document;
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El documento no es JSON válido.");
        }
    }

    private HojaDTO toDto(Hoja hoja, Integer userId, boolean includeDocument) {
        HojaDTO dto = new HojaDTO();
        dto.id = hoja.getIdHoja();
        dto.name = hoja.getNombre();
        dto.favorite = hoja.isFavorita();
        dto.archived = hoja.isArchivada();
        dto.deleted = hoja.isEliminada();
        dto.updatedAt = hoja.getFechaActualizacion() == null ? null : hoja.getFechaActualizacion().toString();
        dto.createdAt = hoja.getFechaCreacion() == null ? null : hoja.getFechaCreacion().toString();
        dto.ownerId = hoja.getPropietario() == null ? null : hoja.getPropietario().getIdUsuario();
        dto.ownerName = hoja.getPropietario() == null ? "" : hoja.getPropietario().getNombreUsuario();
        dto.projectId = hoja.getProyecto() == null ? null : hoja.getProyecto().getIdProyecto();
        dto.projectName = hoja.getProyecto() == null ? null : hoja.getProyecto().getNombreProyecto();
        dto.shared = dto.ownerId != null && !dto.ownerId.equals(userId);
        dto.team = dto.projectId != null;
        dto.canManage = dto.ownerId != null && dto.ownerId.equals(userId);
        dto.canEdit = canEdit(hoja, userId);
        dto.revision = hoja.getRevision();
        dto.schemaVersion = hoja.getSchemaVersion();
        dto.preview = preview(hoja.getDocumento());
        dto.elementCount = dto.preview == null ? 0 : countElements(hoja.getDocumento());
        if (includeDocument) dto.document = hoja.getDocumento();
        return dto;
    }

    private int countElements(String document) {
        try {
            JsonNode elements = objectMapper.readTree(document).path("elements");
            return elements.isArray() ? elements.size() : 0;
        } catch (Exception ex) {
            return 0;
        }
    }

    private List<Map<String, Object>> preview(String document) {
        List<Map<String, Object>> items = new ArrayList<>();
        if (document == null || document.isBlank()) return items;
        try {
            JsonNode elements = objectMapper.readTree(document).path("elements");
            if (!elements.isArray()) return items;
            int kept = 0;
            for (JsonNode el : elements) {
                if (kept >= 24) break;
                if (!el.path("visible").asBoolean(true)) continue;
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("type", el.path("type").asText("rect"));
                item.put("x", el.path("x").asDouble(0));
                item.put("y", el.path("y").asDouble(0));
                item.put("width", el.path("width").asDouble(40));
                item.put("height", el.path("height").asDouble(40));
                item.put("rotation", el.path("rotation").asDouble(0));
                item.put("fill", el.path("fill").asText("#ffffff"));
                item.put("stroke", el.path("stroke").asText(""));
                item.put("strokeWidth", el.path("strokeWidth").asDouble(0));
                item.put("radius", el.path("radius").asDouble(0));
                String text = el.path("text").asText("");
                if (!text.isEmpty()) item.put("text", text.length() > 48 ? text.substring(0, 48) : text);
                if (el.path("points").isArray()) {
                    List<Double> points = new ArrayList<>();
                    for (JsonNode point : el.path("points")) points.add(point.asDouble());
                    item.put("points", points);
                }
                items.add(item);
                kept++;
            }
        } catch (Exception ignored) {
            return items;
        }
        return items;
    }

    private ResponseStatusException forbidden() {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes permiso sobre esta hoja.");
    }
}
