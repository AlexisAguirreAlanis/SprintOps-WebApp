package com.pistache.sprintops_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** Un gasto de crédito del asistente, personal o compartido. */
@Entity
@Table(name = "ai_consumo_credito")
@Data
@NoArgsConstructor
public class AiConsumoCredito {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_consumo")
    private Integer idConsumo;

    @Column(name = "usuario_id", nullable = false)
    private Integer usuarioId;

    @Column(name = "proyecto_id")
    private Integer proyectoId;

    /** personal o compartido. */
    @Column(name = "bolsa", nullable = false, length = 20)
    private String bolsa;

    @Column(name = "creditos", nullable = false)
    private int creditos = 1;

    /** simple, search, summary, task, retro, sprint, planning o full. */
    @Column(name = "accion", length = 20)
    private String accion;

    /** Uso interno del modelo. No se envía al cliente. */
    @Column(name = "tokens_entrada", nullable = false)
    private int tokensEntrada;

    @Column(name = "tokens_salida", nullable = false)
    private int tokensSalida;

    @Column(name = "periodo", nullable = false, length = 7)
    private String periodo;

    @Column(name = "creado_en", nullable = false)
    private Instant creadoEn;
}
