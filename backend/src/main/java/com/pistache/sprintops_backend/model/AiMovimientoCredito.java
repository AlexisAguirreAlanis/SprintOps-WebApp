package com.pistache.sprintops_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** Movimiento de una billetera. Equivale a AICreditTransaction: tipo es transactionType y clave es referenceId. */
@Entity
@Table(name = "ai_movimiento_credito", uniqueConstraints = @UniqueConstraint(columnNames = "clave"))
@Data
@NoArgsConstructor
public class AiMovimientoCredito {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_movimiento")
    private Integer idMovimiento;

    /** Identifica el reintento. La misma clave no vuelve a mover el saldo. */
    @Column(name = "clave", nullable = false, length = 120)
    private String clave;

    @Column(name = "usuario_id", nullable = false)
    private Integer usuarioId;

    @Column(name = "proyecto_id")
    private Integer proyectoId;

    /** consumo, renovacion, asignacion o recarga. */
    @Column(name = "tipo", nullable = false, length = 20)
    private String tipo;

    /** mensual, comprado, compartido o mixto. */
    @Column(name = "bolsa", nullable = false, length = 20)
    private String bolsa;

    @Column(name = "creditos", nullable = false)
    private int creditos;

    @Column(name = "del_plan", nullable = false)
    private int delPlan;

    @Column(name = "comprados", nullable = false)
    private int comprados;

    @Column(name = "compartidos", nullable = false)
    private int compartidos;

    @Column(name = "accion", length = 40)
    private String accion;

    @Column(name = "creado_en", nullable = false)
    private Instant creadoEn;
}
