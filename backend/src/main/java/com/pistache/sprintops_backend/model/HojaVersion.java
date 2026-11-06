package com.pistache.sprintops_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "hoja_version", indexes = @Index(name = "idx_hoja_version_hoja", columnList = "hoja_id"))
@Data
@NoArgsConstructor
public class HojaVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_version")
    private Integer idVersion;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hoja_id", nullable = false)
    private Hoja hoja;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "autor_id")
    private Usuario autor;

    @Column(name = "etiqueta", length = 120)
    private String etiqueta;

    @Column(name = "revision", nullable = false)
    private long revision;

    @Column(name = "documento", columnDefinition = "LONGTEXT")
    private String documento;

    @Column(name = "fecha", nullable = false)
    private Instant fecha;
}
