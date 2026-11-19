package com.pistache.sprintops_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** Conversación del asistente. Equivale a AIConversation y queda aislada por proyecto y usuario. */
@Entity
@Table(name = "ai_conversacion")
@Data
@NoArgsConstructor
public class AiConversacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_conversacion")
    private Integer idConversacion;

    @Column(name = "proyecto_id", nullable = false)
    private Integer proyectoId;

    @Column(name = "usuario_id", nullable = false)
    private Integer usuarioId;

    @Column(name = "titulo", nullable = false, length = 80)
    private String titulo;

    @Column(name = "carpeta_id")
    private Integer carpetaId;

    @Column(name = "archivada", nullable = false)
    private boolean archivada;

    @Column(name = "creado_en", nullable = false)
    private Instant creadoEn;

    @Column(name = "actualizado_en", nullable = false)
    private Instant actualizadoEn;

    /** Resumen de los mensajes ya salidos de la ventana reciente. No incluye el proyecto. */
    @Lob
    @Column(name = "resumen")
    private String resumen;

    @Column(name = "resumen_hasta")
    private Integer resumenHasta;
}
