package com.pistache.sprintops_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** Mensaje de una conversación. Equivale a AIMessage. */
@Entity
@Table(name = "ai_mensaje")
@Data
@NoArgsConstructor
public class AiMensaje {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_mensaje")
    private Integer idMensaje;

    @Column(name = "conversacion_id", nullable = false)
    private Integer conversacionId;

    @Column(name = "rol", nullable = false, length = 20)
    private String rol;

    @Lob
    @Column(name = "texto")
    private String texto;

    /** Tarjetas de ejecución ya mostradas en el chat. No incluye argumentos de herramientas. */
    @Lob
    @Column(name = "acciones")
    private String acciones;

    /** Fuentes de SprintOps usadas en esta respuesta. Solo enlaces que la consulta ya autorizó. */
    @Lob
    @Column(name = "fuentes")
    private String fuentes;

    /** generando, completo, interrumpido o error. Nulo en filas anteriores: se lee como completo. */
    @Column(name = "estado", length = 20)
    private String estado;

    /** Clave de la solicitud. Un reintento con la misma clave no crea otro turno. */
    @Column(name = "solicitud", length = 120, unique = true)
    private String solicitud;

    @Column(name = "creado_en", nullable = false)
    private Instant creadoEn;
}
