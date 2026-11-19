package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.AiPropuesta;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface AiPropuestaRepository extends JpaRepository<AiPropuesta, Integer> {
    List<AiPropuesta> findTop20ByProyectoIdAndUsuarioIdOrderByIdPropuestaDesc(Integer proyectoId, Integer usuarioId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE AiPropuesta p SET p.estado = 'aplicando' WHERE p.idPropuesta = :id AND p.proyectoId = :projectId AND p.usuarioId = :userId AND p.estado = 'pendiente'")
    int claim(@Param("id") Integer id, @Param("projectId") Integer projectId, @Param("userId") Integer userId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE AiPropuesta p SET p.estado = 'rechazada', p.resultado = 'Rechazado', p.resueltoEn = :now WHERE p.idPropuesta = :id AND p.proyectoId = :projectId AND p.usuarioId = :userId AND p.estado = 'pendiente'")
    int rejectPending(@Param("id") Integer id, @Param("projectId") Integer projectId, @Param("userId") Integer userId, @Param("now") Instant now);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE AiPropuesta p SET p.estado = 'aplicando' WHERE p.idPropuesta = :id AND p.proyectoId = :projectId AND p.usuarioId = :userId AND p.estado = 'fallida'")
    int claimRetry(@Param("id") Integer id, @Param("projectId") Integer projectId, @Param("userId") Integer userId);
}
