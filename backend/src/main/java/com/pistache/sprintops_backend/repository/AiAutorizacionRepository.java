package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.AiAutorizacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AiAutorizacionRepository extends JpaRepository<AiAutorizacion, Integer> {
    Optional<AiAutorizacion> findByProyectoIdAndUsuarioId(Integer proyectoId, Integer usuarioId);

    boolean existsByUsuarioIdAndPermitirTodoTrue(Integer usuarioId);
}
