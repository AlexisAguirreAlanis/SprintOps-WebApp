package com.pistache.sprintops_backend.service.chatbot;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import com.pistache.sprintops_backend.dto.HojaDTO;
import com.pistache.sprintops_backend.model.DescIssue;
import com.pistache.sprintops_backend.model.Hoja;
import com.pistache.sprintops_backend.model.InfoUsuarioEquipo;
import com.pistache.sprintops_backend.model.Issues;
import com.pistache.sprintops_backend.model.NotaProyecto;
import com.pistache.sprintops_backend.model.Proyecto;
import com.pistache.sprintops_backend.model.RetroItem;
import com.pistache.sprintops_backend.model.RetroSprint;
import com.pistache.sprintops_backend.model.Sprint;
import com.pistache.sprintops_backend.model.Usuario;
import com.pistache.sprintops_backend.repository.DescIssueRepository;
import com.pistache.sprintops_backend.repository.HojaRepository;
import com.pistache.sprintops_backend.repository.InfoUsuarioEquipoRepository;
import com.pistache.sprintops_backend.repository.NotaProyectoRepository;
import com.pistache.sprintops_backend.repository.RetroItemRepository;
import com.pistache.sprintops_backend.repository.RetroSprintRepository;
import com.pistache.sprintops_backend.repository.SprintRepository;
import com.pistache.sprintops_backend.service.HojaService;
import com.pistache.sprintops_backend.service.ProyectoPermissionCheckService;
import com.pistache.sprintops_backend.service.ProyectoService;
import com.pistache.sprintops_backend.service.UsuarioService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Escrituras del asistente. Cada método usa un servicio existente, comprueba el proyecto
 * y el permiso, y no acepta SQL ni un documento JSON armado por el modelo.
 */
@Service
public class AiActionService {

    private static final int MAX_NOTE = 2000;
    private static final int MAX_SECTION = 4000;
    private static final int MAX_SUMMARY = 4000;
    private static final Pattern HEADING = Pattern.compile("(?is)<h([1-3])\\b[^>]*>(.*?)</h\\1>");

    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private ProyectoService proyectoService;
    @Autowired
    private ProyectoPermissionCheckService permissionCheckService;
    @Autowired
    private InfoUsuarioEquipoRepository infoUsuarioEquipoRepository;
    @Autowired
    private UsuarioService usuarioService;
    @Autowired
    private HojaService hojaService;
    @Autowired
    private HojaRepository hojaRepository;
    @Autowired
    private NotaProyectoRepository notaProyectoRepository;
    @Autowired
    private SprintRepository sprintRepository;
    @Autowired
    private DescIssueRepository descIssueRepository;
    @Autowired
    private RetroSprintRepository retroSprintRepository;
    @Autowired
    private RetroItemRepository retroItemRepository;

    @Transactional
    public String createNote(Integer projectId, Integer userId, String text) {
        if (!member(userId, projectId)) return "No eres miembro de este proyecto.";
        String body = text == null ? "" : text.trim();
        if (body.isEmpty()) return "Indica el texto de la nota.";
        if (body.length() > MAX_NOTE) return "La nota admite hasta " + MAX_NOTE + " caracteres.";
        Proyecto proyecto = proyectoService.findById(projectId).orElse(null);
        Usuario autor = usuarioService.findById(userId).orElse(null);
        if (proyecto == null || autor == null) return "No pude guardar la nota.";
        NotaProyecto note = new NotaProyecto();
        note.setProyecto(proyecto);
        note.setAutor(autor);
        note.setTexto(body);
        note.setCreadoEn(Instant.now());
        note = notaProyectoRepository.save(note);
        return "Nota creada con id " + note.getIdNota() + ".";
    }

    @Transactional
    public String createDocument(Integer projectId, Integer userId, String name, List<String> blocks) {
        if (!permissionCheckService.memberHasPermission(userId, projectId, "canCreateIssue")) {
            return "Necesitas canCreateIssue para crear documentos desde el asistente.";
        }
        if (blocks == null || blocks.isEmpty()) return "Indica al menos una sección en blocks.";
        try {
            HojaDTO created = hojaService.create(userId, name, projectId, documentJson(blocks));
            if (created.projectId == null || !projectId.equals(created.projectId)) {
                return "El documento no quedó vinculado a este proyecto.";
            }
            return "Documento creado con id " + created.id + " y nombre \"" + created.name + "\".";
        } catch (ResponseStatusException ex) {
            return reason(ex);
        }
    }

    @Transactional
    public String appendSection(Integer projectId, Integer userId, Integer documentId, String heading, String body) {
        return editDocument(projectId, userId, documentId, html -> html + sectionHtml(heading, body), "Sección agregada");
    }

    @Transactional
    public String replaceSection(Integer projectId, Integer userId, Integer documentId, String heading, String body) {
        String title = heading == null ? "" : heading.trim();
        if (title.isEmpty()) return "Indica el título de la sección que hay que reescribir.";
        return editDocument(projectId, userId, documentId, html -> replaceHeading(html, title, sectionHtml(title, body)), "Sección reescrita");
    }

    @Transactional
    public String addTable(Integer projectId, Integer userId, Integer documentId, String caption, List<String> columns, List<String> rows) {
        if (columns == null || columns.isEmpty()) return "Indica las columnas de la tabla.";
        if (columns.size() > 8) return "La tabla admite hasta 8 columnas.";
        if (rows != null && rows.size() > 20) return "La tabla admite hasta 20 filas.";
        String table = tableHtml(caption, columns, rows == null ? List.of() : rows);
        return editDocument(projectId, userId, documentId, html -> html + table, "Tabla agregada");
    }

    @Transactional(readOnly = true)
    public String summarizeDocument(Integer projectId, Integer userId, Integer documentId) {
        Hoja hoja = documentInProject(documentId, projectId);
        if (hoja == null) return "Ese documento no pertenece a este proyecto.";
        try {
            String text = hojaService.plainTextFor(hoja.getIdHoja(), userId);
            if (text == null || text.isBlank()) return "El documento no tiene texto para resumir.";
            String clipped = text.length() <= MAX_SUMMARY ? text : text.substring(0, MAX_SUMMARY);
            return "Texto del documento \"" + safe(hoja.getNombre()) + "\" (id " + hoja.getIdHoja() + "). Resúmelo en la respuesta; no lo reescribas salvo que lo pidan:\n" + clipped;
        } catch (ResponseStatusException ex) {
            return reason(ex);
        }
    }

    @Transactional
    public String saveRetro(Integer projectId, Integer userId, Integer sprintId, String good, String bad, String improve) {
        if (!permissionCheckService.memberHasPermission(userId, projectId, "canViewMetrics")) {
            return "Necesitas canViewMetrics para guardar una retrospectiva.";
        }
        if (sprintId == null) return "Indica sprint_id.";
        Sprint sprint = sprintRepository.findById(sprintId).orElse(null);
        if (sprint == null || sprint.getProyecto() == null || !projectId.equals(sprint.getProyecto().getIdProyecto())) {
            return "Ese sprint no pertenece a este proyecto.";
        }
        String bueno = clip(good, 250);
        String malo = clip(bad, 250);
        String mejor = clip(improve, 250);
        if (bueno.isEmpty() && malo.isEmpty() && mejor.isEmpty()) {
            return "Indica al menos un punto bueno, malo o a mejorar.";
        }
        RetroSprint retro = retroSprintRepository.findBySprint(sprint).orElseGet(() -> {
            RetroSprint created = new RetroSprint();
            created.setSprint(sprint);
            created.setFechaRetro(LocalDate.now());
            return retroSprintRepository.save(created);
        });
        RetroItem item = new RetroItem();
        item.setRetroSprint(retro);
        item.setLoBuenoRetro(bueno);
        item.setLoMaloRetro(malo);
        item.setAMejorarRetro(mejor);
        item = retroItemRepository.save(item);
        return "Retrospectiva guardada en el sprint " + sprintId + " con id " + item.getIdItem() + ".";
    }

    @Transactional(readOnly = true)
    public String analyze(Integer projectId, Integer userId, Integer sprintId) {
        if (!permissionCheckService.memberHasPermission(userId, projectId, "canViewMetrics")) {
            return "Necesitas canViewMetrics para analizar el rendimiento.";
        }
        boolean titles = permissionCheckService.memberHasPermission(userId, projectId, "canViewAllIssues");
        List<Sprint> sprints = new ArrayList<>();
        for (Sprint sprint : sprintRepository.findByProyectoIdProyecto(projectId)) {
            if (sprint.getProyecto() != null && projectId.equals(sprint.getProyecto().getIdProyecto())) {
                if (sprintId == null || sprintId.equals(sprint.getIdSprint())) sprints.add(sprint);
            }
        }
        sprints.sort(Comparator.comparing(Sprint::getFechaInicioSprint, Comparator.nullsLast(Comparator.naturalOrder())));
        if (sprints.isEmpty()) return "No hay sprints de este proyecto para analizar.";
        StringBuilder report = new StringBuilder("Análisis de este proyecto. Usa estas cifras; no inventes otras:\n");
        List<Integer> rates = new ArrayList<>();
        LocalDate today = LocalDate.now();
        for (Sprint sprint : sprints) {
            int total = 0;
            int done = 0;
            int blocked = 0;
            int overdue = 0;
            List<String> blockedTitles = new ArrayList<>();
            for (DescIssue link : descIssueRepository.findBySprintIdSprint(sprint.getIdSprint())) {
                if (link.getSprint() == null || !sprint.getIdSprint().equals(link.getSprint().getIdSprint())) continue;
                Issues issue = link.getIssue();
                if (issue == null) continue;
                if (issue.getProyecto() != null && !projectId.equals(issue.getProyecto().getIdProyecto())) continue;
                total++;
                String state = issue.getEstadoIssue() == null ? "" : issue.getEstadoIssue().toLowerCase(Locale.ROOT);
                if ("done".equals(state)) done++;
                if ("blocked".equals(state)) {
                    blocked++;
                    if (titles && blockedTitles.size() < 8) blockedTitles.add(safe(issue.getTituloIssue()));
                }
                if (!"done".equals(state) && issue.getFechaFinIssue() != null && issue.getFechaFinIssue().isBefore(today)) {
                    overdue++;
                }
            }
            int rate = total == 0 ? 0 : (done * 100) / total;
            rates.add(rate);
            int sent = sprint.getIssuesEnviadosSiguiente() == null ? 0 : sprint.getIssuesEnviadosSiguiente();
            report.append("- Sprint ").append(sprint.getIdSprint())
                    .append(" \"").append(safe(sprint.getNombreSprint())).append("\"")
                    .append(" hechos=").append(done).append('/').append(total)
                    .append(" avance=").append(rate).append('%')
                    .append(" bloqueadas=").append(blocked)
                    .append(" vencidas=").append(overdue)
                    .append(" enviadas_al_siguiente=").append(sent);
            if (!blockedTitles.isEmpty()) report.append(" titulos_bloqueados=").append(String.join(" | ", blockedTitles));
            report.append('\n');
        }
        if (sprintId == null && rates.size() >= 2) {
            int previous = rates.get(rates.size() - 2);
            int latest = rates.get(rates.size() - 1);
            report.append("Tendencia del avance entre los dos últimos sprints: ")
                    .append(latest - previous).append(" puntos porcentuales.\n");
        }
        report.append("Redacta la recomendación a partir de estos números. No cambies tareas salvo que lo pidan.");
        return report.toString();
    }

    private String editDocument(Integer projectId, Integer userId, Integer documentId, Editor editor, String done) {
        Hoja hoja = documentInProject(documentId, projectId);
        if (hoja == null) return "Ese documento no pertenece a este proyecto.";
        if (hoja.isEliminada() || hoja.isArchivada()) return "El documento no está disponible para editar.";
        try {
            JsonNode root = objectMapper.readTree(hoja.getDocumento() == null ? "{}" : hoja.getDocumento());
            if (!(root instanceof ObjectNode tree)) return "Este archivo no es un documento de texto.";
            JsonNode pages = tree.path("doc").path("pages");
            if (!pages.isArray() || pages.isEmpty() || !(pages.get(0) instanceof ObjectNode page)) {
                return "Este archivo no es un documento de texto. Ábrelo en el editor.";
            }
            String html = page.path("html").asText("");
            String next = editor.apply(html);
            if (next == null) return "No encontré una sección con ese título.";
            java.util.Map<String, Object> previous = hojaService.createVersion(hoja.getIdHoja(), userId, "Antes del asistente");
            page.put("html", next);
            hojaService.saveDocument(hoja.getIdHoja(), userId, objectMapper.writeValueAsString(tree), hoja.getRevision());
            Object versionId = previous.get("id");
            return done + " en el documento " + hoja.getIdHoja() + ".\nundo:documento:" + hoja.getIdHoja() + ":" + versionId;
        } catch (ResponseStatusException ex) {
            return reason(ex);
        } catch (RuntimeException ex) {
            return "No pude editar el documento.";
        }
    }

    private String documentJson(List<String> blocks) {
        StringBuilder html = new StringBuilder();
        int count = 0;
        for (String block : blocks) {
            if (block == null || block.isBlank() || count >= 12) continue;
            String[] parts = block.split("\\n", 2);
            String heading = parts[0].trim();
            String body = parts.length > 1 ? parts[1].trim() : "";
            html.append(sectionHtml(heading, body));
            count++;
        }
        if (html.isEmpty()) html.append("<p></p>");
        return "{\"schemaVersion\":1,\"kind\":\"document\",\"elements\":[],\"doc\":{\"pageSize\":\"letter\",\"pageNumbers\":true,\"pages\":[{\"id\":\"page-1\",\"html\":"
                + objectMapper.writeValueAsString(html.toString()) + "}]}}";
    }

    private static String sectionHtml(String heading, String body) {
        String title = clip(heading, 180);
        String text = clip(body, MAX_SECTION);
        StringBuilder html = new StringBuilder();
        if (!title.isEmpty()) html.append("<h2>").append(esc(title)).append("</h2>");
        if (text.isEmpty()) {
            html.append("<p></p>");
        } else {
            for (String paragraph : text.split("\\n")) {
                if (!paragraph.isBlank()) html.append("<p>").append(esc(paragraph.trim())).append("</p>");
            }
        }
        return html.toString();
    }

    private static String tableHtml(String caption, List<String> columns, List<String> rows) {
        StringBuilder html = new StringBuilder();
        String title = clip(caption, 180);
        if (!title.isEmpty()) html.append("<h2>").append(esc(title)).append("</h2>");
        html.append("<table><thead><tr>");
        for (String column : columns) html.append("<th>").append(esc(clip(column, 80))).append("</th>");
        html.append("</tr></thead><tbody>");
        for (String row : rows) {
            String[] cells = row.split("\\|", -1);
            html.append("<tr>");
            for (int index = 0; index < columns.size(); index++) {
                String cell = index < cells.length ? cells[index].trim() : "";
                html.append("<td>").append(esc(clip(cell, 200))).append("</td>");
            }
            html.append("</tr>");
        }
        html.append("</tbody></table>");
        return html.toString();
    }

    private static String replaceHeading(String html, String heading, String replacement) {
        Matcher matcher = HEADING.matcher(html);
        while (matcher.find()) {
            String found = matcher.group(2).replaceAll("<[^>]+>", "");
            found = found.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").trim();
            if (!found.equalsIgnoreCase(heading)) continue;
            int from = matcher.start();
            Matcher next = HEADING.matcher(html);
            int to = html.length();
            if (next.find(matcher.end())) to = next.start();
            return html.substring(0, from) + replacement + html.substring(to);
        }
        return null;
    }

    private Hoja documentInProject(Integer documentId, Integer projectId) {
        if (documentId == null || projectId == null) return null;
        Optional<Hoja> found = hojaRepository.findById(documentId);
        if (found.isEmpty()) return null;
        Hoja hoja = found.get();
        if (hoja.getProyecto() == null || !projectId.equals(hoja.getProyecto().getIdProyecto())) return null;
        return hoja;
    }

    private boolean member(Integer userId, Integer projectId) {
        if (userId == null || projectId == null) return false;
        Optional<Proyecto> proyecto = proyectoService.findById(projectId);
        if (proyecto.isEmpty() || proyecto.get().getEquipo() == null) return false;
        Integer equipoId = proyecto.get().getEquipo().getIdEquipo();
        for (InfoUsuarioEquipo row : infoUsuarioEquipoRepository.findByEquipoIdEquipo(equipoId)) {
            if (row.getUsuario() != null && userId.equals(row.getUsuario().getIdUsuario())
                    && row.getEquipo() != null && equipoId.equals(row.getEquipo().getIdEquipo())) {
                return true;
            }
        }
        return false;
    }

    private static String reason(ResponseStatusException ex) {
        String message = ex.getReason();
        return message == null || message.isBlank() ? "No se pudo completar la acción." : message;
    }

    private static String clip(String value, int max) {
        String text = value == null ? "" : value.trim();
        return text.length() <= max ? text : text.substring(0, max);
    }

    private static String esc(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    private static String safe(String value) {
        return value == null ? "" : value.replace('\n', ' ');
    }

    @FunctionalInterface
    private interface Editor {
        String apply(String html);
    }
}
