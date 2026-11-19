package com.pistache.sprintops_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Preferencia de ejecución del asistente. Una fila por usuario y proyecto.
 */
@Entity
@Table(name = "ai_autorizacion", uniqueConstraints = @UniqueConstraint(columnNames = {"proyecto_id", "usuario_id"}))
@Data
@NoArgsConstructor
public class AiAutorizacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_autorizacion")
    private Integer idAutorizacion;

    @Column(name = "proyecto_id", nullable = false)
    private Integer proyectoId;

    @Column(name = "usuario_id", nullable = false)
    private Integer usuarioId;

    @Column(name = "permitir_todo", nullable = false)
    private boolean permitirTodo;

    @Column(name = "tareas", nullable = false)
    private boolean tareas = true;

    @Column(name = "sprints", nullable = false)
    private boolean sprints = true;

    @Column(name = "documentos", nullable = false)
    private boolean documentos = true;

    @Column(name = "notas", nullable = false)
    private boolean notas = true;
}
