package com.pistache.sprintops_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Billetera personal. Equivale a AICreditWallet con ownerType usuario y ownerId = usuarioId. */
@Entity
@Table(name = "ai_credito_usuario", uniqueConstraints = @UniqueConstraint(columnNames = "usuario_id"))
@Data
@NoArgsConstructor
public class AiCreditoUsuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_credito_usuario")
    private Integer idCreditoUsuario;

    @Column(name = "usuario_id", nullable = false)
    private Integer usuarioId;

    @Column(name = "limite_mensual", nullable = false)
    private int limiteMensual = 200;

    /** free, pro o business. El cupo mensual sale de la configuración, no de esta columna. */
    @Column(name = "plan", length = 20)
    private String plan = "free";

    /** Créditos comprados. No se borran al renovar el mes. */
    @Column(name = "extra", nullable = false)
    private int extra;

    @Column(name = "usados", nullable = false)
    private int usados;

    @Column(name = "periodo", nullable = false, length = 7)
    private String periodo;
}
