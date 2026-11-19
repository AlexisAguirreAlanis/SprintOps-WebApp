package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.AiConversacion;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AiConversacionRepository extends JpaRepository<AiConversacion, Integer> {
    List<AiConversacion> findByProyectoIdAndUsuarioIdOrderByActualizadoEnDesc(Integer proyectoId, Integer usuarioId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from AiConversacion c where c.idConversacion = :id")
    Optional<AiConversacion> lockById(@Param("id") Integer id);
}
