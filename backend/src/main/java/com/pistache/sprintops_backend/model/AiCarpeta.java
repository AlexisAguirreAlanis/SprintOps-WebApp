package com.pistache.sprintops_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** Carpeta de conversaciones de un usuario dentro de un proyecto. Equivale a AIFolder. */
@Entity
@Table(name = "ai_carpeta")
@Data
@NoArgsConstructor
public class AiCarpeta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_carpeta")
    private Integer idCarpeta;

    @Column(name = "proyecto_id", nullable = false)
    private Integer proyectoId;

    @Column(name = "usuario_id", nullable = false)
    private Integer usuarioId;

    @Column(name = "nombre", nullable = false, length = 60)
    private String nombre;

    @Column(name = "expandida", nullable = false)
    private boolean expandida = true;

    @Column(name = "creado_en", nullable = false)
    private Instant creadoEn;
}
