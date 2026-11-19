package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.AiCreditoProyecto;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AiCreditoProyectoRepository extends JpaRepository<AiCreditoProyecto, Integer> {
    Optional<AiCreditoProyecto> findByProyectoId(Integer proyectoId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from AiCreditoProyecto c where c.proyectoId = :proyectoId")
    Optional<AiCreditoProyecto> lockByProyectoId(@Param("proyectoId") Integer proyectoId);
}
