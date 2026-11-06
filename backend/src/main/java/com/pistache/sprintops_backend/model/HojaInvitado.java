package com.pistache.sprintops_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "hoja_invitado",
        uniqueConstraints = @UniqueConstraint(columnNames = {"hoja_id", "usuario_id", "origen"})
)
@Data
@NoArgsConstructor
public class HojaInvitado {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hoja_id", nullable = false)
    private Hoja hoja;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    /** invitado: por correo. equipo: miembro elegido del proyecto vinculado. */
    @Column(name = "origen", nullable = false, length = 20)
    private String origen;

    /** editor, comentador o lector. Null equivale a editor (filas anteriores). */
    @Column(name = "permiso", length = 20)
    private String permiso;
}
