package com.pistache.sprintops_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** Recarga preparada. No acredita créditos mientras no haya un proveedor de pagos. */
@Entity
@Table(name = "ai_transaccion", uniqueConstraints = @UniqueConstraint(columnNames = "clave"))
@Data
@NoArgsConstructor
public class AiTransaccion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_transaccion")
    private Integer idTransaccion;

    @Column(name = "clave", nullable = false, length = 120)
    private String clave;

    @Column(name = "usuario_id", nullable = false)
    private Integer usuarioId;

    @Column(name = "creditos", nullable = false)
    private int creditos;

    @Column(name = "precio_mxn", nullable = false)
    private int precioMxn;

    @Column(name = "moneda", nullable = false, length = 8)
    private String moneda = "MXN";

    /** preparada o acreditada. El usuario solo puede dejarla en preparada. */
    @Column(name = "estado", nullable = false, length = 20)
    private String estado = "preparada";

    @Column(name = "proveedor", length = 40)
    private String proveedor;

    @Column(name = "creado_en", nullable = false)
    private Instant creadoEn;
}
