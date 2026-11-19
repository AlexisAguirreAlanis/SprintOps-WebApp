package com.pistache.sprintops_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** Registro de una acción ya aplicada, rechazada o automática. No se borra si la respuesta se interrumpe. */
@Entity
@Table(name = "ai_operacion")
@Data
@NoArgsConstructor
public class AiOperacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_operacion")
    private Integer idOperacion;

    @Column(name = "proyecto_id", nullable = false)
    private Integer proyectoId;

    @Column(name = "usuario_id", nullable = false)
    private Integer usuarioId;

    @Column(name = "propuesta_id")
    private Integer propuestaId;

    @Column(name = "herramienta", nullable = false, length = 60)
    private String herramienta;

    @Column(name = "resumen", nullable = false, length = 240)
    private String resumen;

    @Column(name = "modo", nullable = false, length = 20)
    private String modo;

    @Column(name = "creado_en", nullable = false)
    private Instant creadoEn;
}
