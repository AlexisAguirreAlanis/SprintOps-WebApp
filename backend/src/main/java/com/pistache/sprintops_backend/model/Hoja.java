package com.pistache.sprintops_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "hoja")
@Data
@NoArgsConstructor
public class Hoja {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_hoja")
    private Integer idHoja;

    @Column(name = "nombre", nullable = false, length = 250)
    private String nombre;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "propietario_id", nullable = false)
    private Usuario propietario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "proyecto_id")
    private Proyecto proyecto;

    @Column(name = "favorita", nullable = false)
    private boolean favorita;

    @Column(name = "archivada", nullable = false)
    private boolean archivada;

    @Column(name = "eliminada", nullable = false)
    private boolean eliminada;

    @Column(name = "schema_version", nullable = false)
    private int schemaVersion = 1;

    @Column(name = "revision", nullable = false)
    private long revision;

    @Column(name = "documento", columnDefinition = "LONGTEXT")
    private String documento;

    @Column(name = "fecha_creacion", nullable = false)
    private Instant fechaCreacion;

    @Column(name = "fecha_actualizacion", nullable = false)
    private Instant fechaActualizacion;
}
