package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.AiCreditoAcceso;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AiCreditoAccesoRepository extends JpaRepository<AiCreditoAcceso, Integer> {
    List<AiCreditoAcceso> findByProyectoId(Integer proyectoId);

    long countByProyectoId(Integer proyectoId);

    boolean existsByProyectoIdAndUsuarioId(Integer proyectoId, Integer usuarioId);

    @Modifying(flushAutomatically = true)
    @Query("delete from AiCreditoAcceso a where a.proyectoId = :proyectoId")
    void deleteByProyectoId(@Param("proyectoId") Integer proyectoId);
}
