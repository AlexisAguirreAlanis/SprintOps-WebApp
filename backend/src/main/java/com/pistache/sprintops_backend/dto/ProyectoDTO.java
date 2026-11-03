package com.pistache.sprintops_backend.dto;

import com.pistache.sprintops_backend.model.Proyecto;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class ProyectoDTO {
    private Integer id;
    private String name;
    private String description;
    private String codigo;
    private String status;
    private LocalDate start;
    private LocalDate end;
    private Integer equipoId;
    private Integer creadorId;
    private String creadorName;
    /** true si hay imagen de card subida al servidor (todos los miembros la ven). */
    private Boolean cardCoverCustom;
    private Long cardCoverVersion;
    /** agil | tiempo */
    private String modo;
    private Boolean cotizacionHabilitada;
    private BigDecimal tarifaHora;
    private BigDecimal margenUtilidad;

    /** Issues del proyecto. progress es null cuando no hay issues: no se inventa un porcentaje. */
    private Integer issuesTotal;
    private Integer issuesDone;
    private Integer progress;
    /** Fecha más reciente entre creación y fin de issues. Null si no hay actividad registrada. */
    private LocalDate lastActivity;
    private Integer memberCount;
    private String myRole;
    private java.util.List<MiembroEquipoDTO> membersPreview;

    public static ProyectoDTO fromEntity(Proyecto p) {
        ProyectoDTO dto = new ProyectoDTO();
        dto.setId(p.getIdProyecto());
        dto.setName(p.getNombreProyecto());
        dto.setDescription(p.getDescripcionProyecto());
        dto.setCodigo(p.getCodigoProyecto());
        dto.setStatus(p.getEstadoDelProyecto());
        dto.setStart(p.getFechaInicioProyecto());
        dto.setEnd(p.getFechaFinProyecto());
        if (p.getEquipo() != null) {
            dto.setEquipoId(p.getEquipo().getIdEquipo());
        }
        if (p.getCreador() != null) {
            dto.setCreadorId(p.getCreador().getIdUsuario());
            dto.setCreadorName(p.getCreador().getNombreUsuario());
        }
        dto.setCardCoverCustom(Boolean.TRUE.equals(p.getCardCoverCustom()));
        dto.setCardCoverVersion(p.getCardCoverVersion() != null ? p.getCardCoverVersion() : 0L);
        String modo = p.getModoProyecto();
        dto.setModo(modo == null || modo.isBlank() ? "agil" : modo);
        dto.setCotizacionHabilitada(Boolean.TRUE.equals(p.getCotizacionHabilitada()));
        dto.setTarifaHora(p.getTarifaHora());
        dto.setMargenUtilidad(p.getMargenUtilidad());
        return dto;
    }
}
