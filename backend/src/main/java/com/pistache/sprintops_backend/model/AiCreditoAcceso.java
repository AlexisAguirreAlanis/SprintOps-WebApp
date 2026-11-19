package com.pistache.sprintops_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Colaborador autorizado a gastar los créditos compartidos de un proyecto. */
@Entity
@Table(name = "ai_credito_acceso", uniqueConstraints = @UniqueConstraint(columnNames = {"proyecto_id", "usuario_id"}))
@Data
@NoArgsConstructor
public class AiCreditoAcceso {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_acceso")
    private Integer idAcceso;

    @Column(name = "proyecto_id", nullable = false)
    private Integer proyectoId;

    @Column(name = "usuario_id", nullable = false)
    private Integer usuarioId;
}
