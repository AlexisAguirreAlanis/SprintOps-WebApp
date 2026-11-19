package com.pistache.sprintops_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Acción que el asistente quiere ejecutar y todavía puede estar pendiente.
 * Equivale a AIAction junto con AiOperacion. requestedBy es usuarioId,
 * actionType es herramienta, proposedChanges es vista y executedAt es resueltoEn.
 */
@Entity
@Table(name = "ai_propuesta")
@Data
@NoArgsConstructor
public class AiPropuesta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_propuesta")
    private Integer idPropuesta;

    @Column(name = "proyecto_id", nullable = false)
    private Integer proyectoId;

    @Column(name = "usuario_id", nullable = false)
    private Integer usuarioId;

    @Column(name = "conversacion_id")
    private Integer conversacionId;

    @Column(name = "mensaje_id")
    private Integer mensajeId;

    @Column(name = "herramienta", nullable = false, length = 60)
    private String herramienta;

    @Lob
    @Column(name = "argumentos", nullable = false)
    private String argumentos;

    /** Huella de los argumentos aprobados. Autorizar no acepta otros cambios. */
    @Column(name = "huella", length = 64)
    private String huella;

    @Lob
    @Column(name = "vista", nullable = false)
    private String vista;

    @Column(name = "estado", nullable = false, length = 20)
    private String estado;

    @Column(name = "resultado", length = 400)
    private String resultado;

    @Column(name = "creado_en", nullable = false)
    private Instant creadoEn;

    @Column(name = "resuelto_en")
    private Instant resueltoEn;
}
