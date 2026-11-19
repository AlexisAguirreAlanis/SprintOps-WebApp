package com.pistache.sprintops_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** Registro interno de una solicitud al asistente. No se envía al cliente. */
@Entity
@Table(name = "ai_observacion")
@Data
@NoArgsConstructor
public class AiObservacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_observacion")
    private Integer idObservacion;

    @Column(name = "clave", length = 120, unique = true)
    private String clave;

    @Column(name = "usuario_id", nullable = false)
    private Integer usuarioId;

    @Column(name = "proyecto_id")
    private Integer proyectoId;

    @Column(name = "modelo", length = 80)
    private String modelo;

    @Column(name = "tokens_entrada", nullable = false)
    private int tokensEntrada;

    @Column(name = "tokens_salida", nullable = false)
    private int tokensSalida;

    /** Suma de tokens por la tarifa en centavos de dólar por millón. Dividir entre 1_000_000 da centavos. */
    @Column(name = "costo", nullable = false)
    private long costo;

    @Column(name = "creditos", nullable = false)
    private int creditos;

    @Column(name = "duracion_ms", nullable = false)
    private long duracionMs;

    @Column(name = "herramientas", length = 400)
    private String herramientas;

    @Column(name = "error", length = 400)
    private String error;

    @Column(name = "periodo", nullable = false, length = 7)
    private String periodo;

    @Column(name = "creado_en", nullable = false)
    private Instant creadoEn;
}
