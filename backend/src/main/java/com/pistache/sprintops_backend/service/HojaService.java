package com.pistache.sprintops_backend.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.pistache.sprintops_backend.dto.HojaDTO;
import com.pistache.sprintops_backend.model.Hoja;
import com.pistache.sprintops_backend.model.HojaInvitado;
import com.pistache.sprintops_backend.model.HojaVersion;
import com.pistache.sprintops_backend.model.InfoUsuarioEquipo;
import com.pistache.sprintops_backend.model.Proyecto;
import com.pistache.sprintops_backend.model.Usuario;
import com.pistache.sprintops_backend.repository.HojaInvitadoRepository;
import com.pistache.sprintops_backend.repository.HojaRepository;
import com.pistache.sprintops_backend.repository.HojaVersionRepository;
import com.pistache.sprintops_backend.repository.InfoUsuarioEquipoRepository;
import com.pistache.sprintops_backend.repository.ProyectoRepository;
import com.pistache.sprintops_backend.repository.UsuarioRepository;
import com.pistache.sprintops_backend.service.telegram.TelegramApiClient;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class HojaService {

    public static final int SCHEMA_VERSION = 1;
    public static final String EMPTY_DOCUMENT = "{\"schemaVersion\":1,\"elements\":[]}";
    private static final int MAX_DOCUMENT_CHARS = 12_000_000;

    private static final long PRESENCE_TTL_MS = 20_000;
    private static final long AUTO_VERSION_MS = 10 * 60_000;
    private static final Set<String> ROLES = Set.of("editor", "comentador", "lector");

    private final HojaRepository hojaRepository;
    private final HojaInvitadoRepository invitadoRepository;
    private final HojaVersionRepository versionRepository;
    private final UsuarioRepository usuarioRepository;
    private final ProyectoRepository proyectoRepository;
    private final InfoUsuarioEquipoRepository membershipRepository;
    private final TelegramApiClient telegram;
    private final ObjectMapper objectMapper;
    private final Map<Integer, Map<Integer, Long>> presence = new ConcurrentHashMap<>();
    private final Map<Integer, Map<Integer, Map<String, Object>>> cursors = new ConcurrentHashMap<>();

    public HojaService(
            HojaRepository hojaRepository,
            HojaInvitadoRepository invitadoRepository,
            HojaVersionRepository versionRepository,
            UsuarioRepository usuarioRepository,
            ProyectoRepository proyectoRepository,
            InfoUsuarioEquipoRepository membershipRepository,
            TelegramApiClient telegram,
            ObjectMapper objectMapper) {
        this.hojaRepository = hojaRepository;
        this.invitadoRepository = invitadoRepository;
        this.versionRepository = versionRepository;
        this.usuarioRepository = usuarioRepository;
        this.proyectoRepository = proyectoRepository;
        this.membershipRepository = membershipRepository;
        this.telegram = telegram;
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
        for (HojaInvitado invite : invitadoRepository.findByUsuario_IdUsuarioAndOrigen(user.getIdUsuario(), "invitado")) {
            if (invite.getHoja() != null) found.putIfAbsent(invite.getHoja().getIdHoja(), invite.getHoja());
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
        boolean editor = canEdit(hoja, user.getIdUsuario());
        if (!editor && !canComment(hoja, user.getIdUsuario())) throw forbidden();
        if (hoja.isEliminada()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La hoja está en la papelera.");
        }
        if (hoja.getRevision() != revision) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La hoja cambió en el servidor.");
        }
        String next = validateDocument(document);
        hoja.setDocumento(editor ? next : mergeComments(hoja.getDocumento(), next));
        hoja.setSchemaVersion(SCHEMA_VERSION);
        hoja.setRevision(revision + 1);
        hoja.setFechaActualizacion(Instant.now());
        Hoja saved = hojaRepository.save(hoja);
        HojaVersion last = versionRepository.findFirstByHoja_IdHojaOrderByFechaDesc(saved.getIdHoja()).orElse(null);
        if (last == null || Instant.now().toEpochMilli() - last.getFecha().toEpochMilli() > AUTO_VERSION_MS) {
            snapshot(saved, user, null);
        }
        return toDto(saved, user.getIdUsuario(), false);
    }

    /** Quien solo comenta puede cambiar únicamente doc.comments; el resto del documento se conserva. */
    private String mergeComments(String stored, String incoming) {
        try {
            JsonNode base = objectMapper.readTree(stored);
            JsonNode comments = objectMapper.readTree(incoming).path("doc").path("comments");
            if (base.path("doc") instanceof tools.jackson.databind.node.ObjectNode doc && comments.isArray()) {
                doc.set("comments", comments);
                return objectMapper.writeValueAsString(base);
            }
        } catch (Exception ignored) {
            // el documento guardado no es un documento de texto
        }
        throw forbidden();
    }

    private HojaVersion snapshot(Hoja hoja, Usuario author, String label) {
        HojaVersion version = new HojaVersion();
        version.setHoja(hoja);
        version.setAutor(author);
        version.setEtiqueta(label == null || label.isBlank() ? null : label.trim().substring(0, Math.min(120, label.trim().length())));
        version.setRevision(hoja.getRevision());
        version.setDocumento(hoja.getDocumento());
        version.setFecha(Instant.now());
        return versionRepository.save(version);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> versions(Integer id, Integer userId) {
        Usuario user = requireUser(userId);
        Hoja hoja = requireView(id, user.getIdUsuario());
        List<Map<String, Object>> items = new ArrayList<>();
        for (HojaVersion version : versionRepository.findTop60ByHoja_IdHojaOrderByFechaDesc(hoja.getIdHoja())) {
            items.add(versionItem(version, false));
        }
        return items;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> version(Integer id, Integer versionId, Integer userId) {
        Usuario user = requireUser(userId);
        Hoja hoja = requireView(id, user.getIdUsuario());
        return versionItem(requireVersion(hoja, versionId), true);
    }

    @Transactional
    public Map<String, Object> createVersion(Integer id, Integer userId, String label) {
        Usuario user = requireUser(userId);
        Hoja hoja = requireView(id, user.getIdUsuario());
        if (!canEdit(hoja, user.getIdUsuario())) throw forbidden();
        return versionItem(snapshot(hoja, user, label), false);
    }

    @Transactional
    public HojaDTO restoreVersion(Integer id, Integer versionId, Integer userId) {
        Usuario user = requireUser(userId);
        Hoja hoja = requireView(id, user.getIdUsuario());
        if (!canEdit(hoja, user.getIdUsuario())) throw forbidden();
        HojaVersion version = requireVersion(hoja, versionId);
        snapshot(hoja, user, "Antes de restaurar");
        hoja.setDocumento(validateDocument(version.getDocumento()));
        hoja.setRevision(hoja.getRevision() + 1);
        hoja.setFechaActualizacion(Instant.now());
        Hoja saved = hojaRepository.save(hoja);
        snapshot(saved, user, "Restaurada desde " + version.getFecha());
        return toDto(saved, user.getIdUsuario(), true);
    }

    private HojaVersion requireVersion(Hoja hoja, Integer versionId) {
        HojaVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Versión no encontrada."));
        if (!version.getHoja().getIdHoja().equals(hoja.getIdHoja())) throw forbidden();
        return version;
    }

    private Map<String, Object> versionItem(HojaVersion version, boolean includeDocument) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", version.getIdVersion());
        item.put("label", version.getEtiqueta());
        item.put("revision", version.getRevision());
        item.put("createdAt", version.getFecha().toString());
        item.put("authorId", version.getAutor() == null ? null : version.getAutor().getIdUsuario());
        item.put("authorName", version.getAutor() == null ? "" : version.getAutor().getNombreUsuario());
        item.put("size", version.getDocumento() == null ? 0 : version.getDocumento().length());
        if (includeDocument) item.put("document", version.getDocumento());
        return item;
    }

    /** Búsqueda de texto plano dentro de los documentos que la persona puede ver. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> search(Integer userId, String query) {
        String needle = query == null ? "" : query.trim().toLowerCase();
        List<Map<String, Object>> results = new ArrayList<>();
        if (needle.length() < 2) return results;
        for (HojaDTO dto : list(userId)) {
            if (dto.deleted || results.size() >= 30) continue;
            Hoja hoja = hojaRepository.findById(dto.id).orElse(null);
            if (hoja == null) continue;
            String text = plainText(hoja.getDocumento());
            int at = text.toLowerCase().indexOf(needle);
            boolean nameHit = dto.name != null && dto.name.toLowerCase().contains(needle);
            if (at < 0 && !nameHit) continue;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", dto.id);
            item.put("name", dto.name);
            item.put("updatedAt", dto.updatedAt);
            int from = Math.max(0, at - 80);
            item.put("snippet", at < 0 ? text.substring(0, Math.min(160, text.length())) : text.substring(from, Math.min(text.length(), at + needle.length() + 120)));
            item.put("text", text.substring(0, Math.min(6000, text.length())));
            results.add(item);
        }
        return results;
    }

    @Transactional(readOnly = true)
    public String plainTextFor(Integer id, Integer userId) {
        Usuario user = requireUser(userId);
        return plainText(requireView(id, user.getIdUsuario()).getDocumento());
    }

    private String plainText(String document) {
        if (document == null || document.isBlank()) return "";
        try {
            JsonNode root = objectMapper.readTree(document);
            StringBuilder builder = new StringBuilder();
            JsonNode pages = root.path("doc").path("pages");
            if (pages.isArray()) {
                for (JsonNode page : pages) builder.append(' ').append(page.path("html").asText(""));
            } else {
                for (JsonNode el : root.path("elements")) builder.append(' ').append(el.path("text").asText(""));
            }
            return builder.toString()
                    .replaceAll("(?i)</(p|h[1-6]|li|tr|div|blockquote)>", "\n")
                    .replaceAll("<[^>]+>", " ")
                    .replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
                    .replaceAll("[ \\t]+", " ").replaceAll("\\n\\s*", "\n").trim();
        } catch (Exception ex) {
            return "";
        }
    }

    /** Notifica por Telegram a quien fue mencionado con @ en un comentario. */
    @Transactional(readOnly = true)
    public Map<String, Object> notifyMentions(Integer id, Integer userId, List<Integer> mentionedIds, String text) {
        Usuario user = requireUser(userId);
        Hoja hoja = requireView(id, user.getIdUsuario());
        if (!canComment(hoja, user.getIdUsuario())) throw forbidden();
        int sent = 0;
        for (Integer mentionedId : mentionedIds) {
            Usuario mentioned = usuarioRepository.findById(mentionedId).orElse(null);
            if (mentioned == null || role(hoja, mentionedId) == null || mentioned.getTelegramUserId() == null || !telegram.isConfigured()) continue;
            String snippet = text == null ? "" : text.substring(0, Math.min(400, text.length()));
            telegram.sendMessage(mentioned.getTelegramUserId(),
                    user.getNombreUsuario() + " te mencionó en «" + hoja.getNombre() + "»:\n" + snippet);
            sent++;
        }
        return Map.of("sent", sent);
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

    /** propietario, editor, comentador o lector; null si no puede entrar. */
    private String role(Hoja hoja, Integer userId) {
        if (isOwner(hoja, userId)) return "propietario";
        HojaInvitado invite = invitadoRepository
                .findByHoja_IdHojaAndUsuario_IdUsuarioAndOrigen(hoja.getIdHoja(), userId, "invitado")
                .orElse(null);
        if (invite != null) return invite.getPermiso() == null ? "editor" : invite.getPermiso();
        if (teamCanEnter(hoja, userId)) return "editor";
        return "enlace".equals(visibility(hoja)) ? "lector" : null;
    }

    private boolean canView(Hoja hoja, Integer userId) {
        return role(hoja, userId) != null;
    }

    private boolean canEdit(Hoja hoja, Integer userId) {
        String role = role(hoja, userId);
        return "propietario".equals(role) || "editor".equals(role);
    }

    private boolean canComment(Hoja hoja, Integer userId) {
        return canEdit(hoja, userId) || "comentador".equals(role(hoja, userId));
    }

    private boolean teamCanEnter(Hoja hoja, Integer userId) {
        if (!isProjectMember(hoja, userId)) return false;
        if (!Boolean.TRUE.equals(hoja.getFiltrarEquipo())) return true;
        return invitadoRepository
                .findByHoja_IdHojaAndUsuario_IdUsuarioAndOrigen(hoja.getIdHoja(), userId, "equipo")
                .isPresent();
    }

    private String visibility(Hoja hoja) {
        return "enlace".equals(hoja.getVisibilidad()) ? "enlace" : "privada";
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
        dto.role = role(hoja, userId);
        dto.canEdit = "propietario".equals(dto.role) || "editor".equals(dto.role);
        dto.canComment = dto.canEdit || "comentador".equals(dto.role);
        dto.visibility = visibility(hoja);
        dto.filterTeam = Boolean.TRUE.equals(hoja.getFiltrarEquipo());
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
            JsonNode root = objectMapper.readTree(document);
            String kind = root.path("kind").asText("");
            if ("document".equals(kind)) return documentPreview(root.path("doc"));
            JsonNode elements = root.path("elements");
            if ("slides".equals(kind)) {
                JsonNode slides = root.path("slides");
                if (slides.isArray() && slides.size() > 0) {
                    JsonNode first = slides.get(0);
                    items.add(previewBox(0, 0, 1280, 720, first.path("background").asText("#ffffff"), ""));
                    elements = first.path("elements");
                }
            }
            if (!elements.isArray()) return items;
            int kept = items.size();
            for (JsonNode el : elements) {
                if (kept >= 24) break;
                if (!el.path("visible").asBoolean(true)) continue;
                Map<String, Object> item = previewShape(el);
                items.add(item);
                kept++;
            }
        } catch (Exception ignored) {
            return items;
        }
        return items;
    }

    private List<Map<String, Object>> documentPreview(JsonNode doc) {
        String raw = "";
        JsonNode pages = doc.path("pages");
        if (pages.isArray()) {
            StringBuilder builder = new StringBuilder();
            for (JsonNode page : pages) builder.append(' ').append(page.path("html").asText(""));
            raw = builder.toString().replaceAll("<[^>]+>", " ").replace("&nbsp;", " ").replaceAll("\\s+", " ").trim();
        }
        String title = raw.isEmpty() ? "Documento" : raw.substring(0, Math.min(28, raw.length()));
        List<Map<String, Object>> items = new ArrayList<>();
        Map<String, Object> page = previewBox(12, 8, 216, 284, "#ffffff", "");
        page.put("stroke", "#e5e7eb");
        page.put("strokeWidth", 1);
        page.put("radius", 8);
        items.add(page);
        Map<String, Object> heading = previewBox(28, 28, 176, 40, "transparent", title);
        heading.put("type", "text");
        heading.put("textFill", "#1e293b");
        heading.put("fontSize", 15);
        heading.put("fontWeight", 800);
        heading.put("align", "left");
        items.add(heading);
        items.add(previewBox(28, 76, 52, 4, "#67bfa1", ""));
        for (int index = 0; index < 6; index++) {
            items.add(previewBox(28, 96 + index * 22, index == 5 ? 110 : 168, 6, "#e6eef2", ""));
        }
        return items;
    }

    private Map<String, Object> previewShape(JsonNode el) {
        Map<String, Object> item = previewBox(
                el.path("x").asDouble(0),
                el.path("y").asDouble(0),
                el.path("width").asDouble(40),
                el.path("height").asDouble(40),
                el.path("fill").asText("#ffffff"),
                "");
        item.put("type", el.path("type").asText("rect"));
        item.put("rotation", el.path("rotation").asDouble(0));
        item.put("stroke", el.path("stroke").asText(""));
        item.put("strokeWidth", el.path("strokeWidth").asDouble(0));
        item.put("radius", el.path("radius").asDouble(0));
        if (el.has("fontSize")) item.put("fontSize", el.path("fontSize").asDouble(16));
        if (el.has("fontWeight")) item.put("fontWeight", el.path("fontWeight").asInt(600));
        if (el.has("textFill") && !el.path("textFill").asText("").isEmpty()) item.put("textFill", el.path("textFill").asText(""));
        if (el.has("align")) item.put("align", el.path("align").asText("left"));
        if (el.path("closed").asBoolean(false)) item.put("closed", true);
        String text = el.path("text").asText("");
        if (!text.isEmpty()) item.put("text", text.length() > 42 ? text.substring(0, 42) : text);
        if (el.path("points").isArray()) {
            List<Double> points = new ArrayList<>();
            for (JsonNode point : el.path("points")) points.add(point.asDouble());
            item.put("points", points);
        }
        return item;
    }

    private Map<String, Object> previewBox(double x, double y, double width, double height, String fill, String text) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("type", "rect");
        item.put("x", x);
        item.put("y", y);
        item.put("width", width);
        item.put("height", height);
        item.put("fill", fill);
        if (!text.isEmpty()) item.put("text", text);
        return item;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> access(Integer id, Integer userId) {
        Usuario user = requireUser(userId);
        Hoja hoja = requireView(id, user.getIdUsuario());
        if (!isOwner(hoja, user.getIdUsuario())) throw forbidden();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("visibility", visibility(hoja));
        body.put("filterTeam", Boolean.TRUE.equals(hoja.getFiltrarEquipo()));
        body.put("projectId", hoja.getProyecto() == null ? null : hoja.getProyecto().getIdProyecto());
        body.put("projectName", hoja.getProyecto() == null ? null : hoja.getProyecto().getNombreProyecto());
        List<Map<String, Object>> invites = new ArrayList<>();
        List<HojaInvitado> rows = invitadoRepository.findByHoja_IdHoja(hoja.getIdHoja());
        Set<Integer> teamGrants = new HashSet<>();
        for (HojaInvitado row : rows) {
            if (row.getUsuario() == null) continue;
            if ("equipo".equals(row.getOrigen())) teamGrants.add(row.getUsuario().getIdUsuario());
            if ("invitado".equals(row.getOrigen())) {
                Map<String, Object> item = person(row.getUsuario());
                item.put("role", row.getPermiso() == null ? "editor" : row.getPermiso());
                invites.add(item);
            }
        }
        body.put("invites", invites);
        body.put("projectMembers", projectPeople(hoja, teamGrants));
        return body;
    }

    @Transactional
    public Map<String, Object> updateAccess(
            Integer id,
            Integer userId,
            String visibility,
            Boolean filterTeam,
            List<Integer> teamUserIds,
            String addEmail,
            String addRole,
            Integer removeUserId,
            Integer roleUserId,
            String role) {
        Usuario user = requireUser(userId);
        Hoja hoja = requireView(id, user.getIdUsuario());
        if (!isOwner(hoja, user.getIdUsuario())) throw forbidden();
        if (visibility != null) {
            hoja.setVisibilidad("enlace".equals(visibility) ? "enlace" : "privada");
        }
        if (filterTeam != null) {
            hoja.setFiltrarEquipo(filterTeam);
            if (!filterTeam) invitadoRepository.deleteByHoja_IdHojaAndOrigen(hoja.getIdHoja(), "equipo");
        }
        if (teamUserIds != null) {
            hoja.setFiltrarEquipo(true);
            invitadoRepository.deleteByHoja_IdHojaAndOrigen(hoja.getIdHoja(), "equipo");
            Set<Integer> allowed = new HashSet<>();
            if (hoja.getProyecto() != null && hoja.getProyecto().getEquipo() != null) {
                for (InfoUsuarioEquipo membership : membershipRepository.findByEquipoIdEquipo(hoja.getProyecto().getEquipo().getIdEquipo())) {
                    if (membership.getUsuario() != null) allowed.add(membership.getUsuario().getIdUsuario());
                }
            }
            for (Integer memberId : teamUserIds) {
                if (memberId == null || !allowed.contains(memberId) || memberId.equals(user.getIdUsuario())) continue;
                if (invitadoRepository.findByHoja_IdHojaAndUsuario_IdUsuarioAndOrigen(hoja.getIdHoja(), memberId, "equipo").isPresent()) {
                    continue;
                }
                Usuario member = usuarioRepository.findById(memberId).orElse(null);
                if (member == null) continue;
                HojaInvitado row = new HojaInvitado();
                row.setHoja(hoja);
                row.setUsuario(member);
                row.setOrigen("equipo");
                invitadoRepository.save(row);
            }
        }
        if (removeUserId != null) {
            invitadoRepository.deleteByHoja_IdHojaAndUsuario_IdUsuario(hoja.getIdHoja(), removeUserId);
        }
        if (addEmail != null && !addEmail.isBlank()) {
            Usuario invited = usuarioRepository.findByEmailUsuario(addEmail.trim())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No hay una cuenta con ese correo."));
            if (!invited.getIdUsuario().equals(user.getIdUsuario())
                    && invitadoRepository.findByHoja_IdHojaAndUsuario_IdUsuarioAndOrigen(hoja.getIdHoja(), invited.getIdUsuario(), "invitado").isEmpty()) {
                HojaInvitado row = new HojaInvitado();
                row.setHoja(hoja);
                row.setUsuario(invited);
                row.setOrigen("invitado");
                row.setPermiso(ROLES.contains(addRole) ? addRole : "editor");
                invitadoRepository.save(row);
            }
        }
        if (roleUserId != null && ROLES.contains(role)) {
            invitadoRepository.findByHoja_IdHojaAndUsuario_IdUsuarioAndOrigen(hoja.getIdHoja(), roleUserId, "invitado")
                    .ifPresent(row -> {
                        row.setPermiso(role);
                        invitadoRepository.save(row);
                    });
        }
        hoja.setFechaActualizacion(Instant.now());
        hojaRepository.save(hoja);
        invitadoRepository.flush();
        return access(id, userId);
    }

    public List<Map<String, Object>> pulse(Integer id, Integer userId, Map<String, Object> cursor) {
        Usuario user = requireUser(userId);
        requireView(id, user.getIdUsuario());
        long now = System.currentTimeMillis();
        Map<Integer, Long> room = presence.computeIfAbsent(id, key -> new ConcurrentHashMap<>());
        Map<Integer, Map<String, Object>> roomCursors = cursors.computeIfAbsent(id, key -> new ConcurrentHashMap<>());
        room.put(user.getIdUsuario(), now);
        if (cursor != null) roomCursors.put(user.getIdUsuario(), cursor);
        room.entrySet().removeIf(entry -> now - entry.getValue() > PRESENCE_TTL_MS);
        roomCursors.keySet().removeIf(key -> !room.containsKey(key));
        List<Map<String, Object>> people = new ArrayList<>();
        for (Integer presentId : room.keySet()) {
            usuarioRepository.findById(presentId).ifPresent(present -> {
                Map<String, Object> item = person(present);
                if (roomCursors.containsKey(presentId)) item.put("cursor", roomCursors.get(presentId));
                people.add(item);
            });
        }
        return people;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> revision(Integer id, Integer userId) {
        Usuario user = requireUser(userId);
        Hoja hoja = requireView(id, user.getIdUsuario());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("revision", hoja.getRevision());
        body.put("updatedAt", hoja.getFechaActualizacion() == null ? null : hoja.getFechaActualizacion().toString());
        return body;
    }

    private List<Map<String, Object>> projectPeople(Hoja hoja, Set<Integer> teamGrants) {
        List<Map<String, Object>> people = new ArrayList<>();
        if (hoja.getProyecto() == null || hoja.getProyecto().getEquipo() == null) return people;
        boolean filtered = Boolean.TRUE.equals(hoja.getFiltrarEquipo());
        Integer ownerId = hoja.getPropietario() == null ? null : hoja.getPropietario().getIdUsuario();
        for (InfoUsuarioEquipo membership : membershipRepository.findByEquipoIdEquipo(hoja.getProyecto().getEquipo().getIdEquipo())) {
            Usuario member = membership.getUsuario();
            if (member == null || member.getIdUsuario().equals(ownerId)) continue;
            Map<String, Object> item = person(member);
            item.put("included", !filtered || teamGrants.contains(member.getIdUsuario()));
            people.add(item);
        }
        return people;
    }

    private Map<String, Object> person(Usuario user) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", user.getIdUsuario());
        item.put("name", user.getNombreUsuario() == null ? "" : user.getNombreUsuario());
        item.put("email", user.getEmailUsuario() == null ? "" : user.getEmailUsuario());
        item.put("avatarUrl", user.getAvatarUrl());
        return item;
    }

    private ResponseStatusException forbidden() {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes permiso sobre esta hoja.");
    }
}
