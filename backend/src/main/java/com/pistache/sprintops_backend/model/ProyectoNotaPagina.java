package com.pistache.sprintops_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "proyecto_nota_pagina")
@Data
@NoArgsConstructor
public class ProyectoNotaPagina {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_pagina")
    private Integer idPagina;

    @OneToOne(optional = false)
    @JoinColumn(name = "proyecto_id", nullable = false, unique = true)
    private Proyecto proyecto;

    @Column(name = "contenido", columnDefinition = "LONGTEXT")
    private String contenido;

    @Column(name = "actualizado_en", nullable = false)
    private Instant actualizadoEn;
}
