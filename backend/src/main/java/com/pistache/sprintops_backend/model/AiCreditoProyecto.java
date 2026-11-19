package com.pistache.sprintops_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Billetera del proyecto. Equivale a AICreditWallet con ownerType proyecto y ownerId = proyectoId.
 * No se mezcla con la billetera personal ni con otros proyectos.
 */
@Entity
@Table(name = "ai_credito_proyecto", uniqueConstraints = @UniqueConstraint(columnNames = "proyecto_id"))
@Data
@NoArgsConstructor
public class AiCreditoProyecto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_credito")
    private Integer idCredito;

    @Column(name = "proyecto_id", nullable = false)
    private Integer proyectoId;

    /** El cupo lo comparten los miembros de este proyecto, no la cuenta global. */
    @Column(name = "compartido", nullable = false)
    private boolean compartido = true;

    @Column(name = "limite_mensual", nullable = false)
    private int limiteMensual = 400;

    /** Créditos que el propietario agrega encima del límite mensual. */
    @Column(name = "extra", nullable = false)
    private int extra;

    /** Cuando es verdadero, solo gastan los colaboradores de la lista. */
    @Column(name = "acceso_explicito", nullable = false)
    private boolean accesoExplicito;

    @Column(name = "usados", nullable = false)
    private int usados;

    /** Mes calendario yyyy-MM. Al cambiar, el contador vuelve a cero. */
    @Column(name = "periodo", nullable = false, length = 7)
    private String periodo;
}
