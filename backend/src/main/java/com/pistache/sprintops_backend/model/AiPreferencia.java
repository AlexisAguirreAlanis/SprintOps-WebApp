package com.pistache.sprintops_backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Ajustes del asistente por usuario. Equivale a AIUserSettings:
 * modo es approvalMode, idioma es responseLanguage, detalle es responseStyle,
 * animaciones es animationEnabled y creditosPrimero es preferredCreditSource.
 */
@Entity
@Table(name = "ai_preferencia", uniqueConstraints = @UniqueConstraint(columnNames = "usuario_id"))
@Data
@NoArgsConstructor
public class AiPreferencia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_preferencia")
    private Integer idPreferencia;

    @Column(name = "usuario_id", nullable = false)
    private Integer usuarioId;

    /** preguntar, seguras o todo. */
    @Column(name = "modo", nullable = false, length = 20)
    private String modo = "preguntar";

    @Column(name = "idioma", nullable = false, length = 5)
    private String idioma = "es";

    /** breve o detallada. */
    @Column(name = "detalle", nullable = false, length = 20)
    private String detalle = "detallada";

    @Column(name = "indicadores", nullable = false)
    private boolean indicadores = true;

    @Column(name = "animaciones", nullable = false)
    private boolean animaciones = true;

    /** personal o shared. Qué bolsa se gasta primero. */
    @Column(name = "creditos_primero", nullable = false, length = 20)
    private String creditosPrimero = "personal";
}
