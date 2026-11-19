package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.AiOperacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AiOperacionRepository extends JpaRepository<AiOperacion, Integer> {
    List<AiOperacion> findTop12ByProyectoIdAndUsuarioIdOrderByIdOperacionDesc(Integer proyectoId, Integer usuarioId);
}
