package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.AiCarpeta;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AiCarpetaRepository extends JpaRepository<AiCarpeta, Integer> {
    List<AiCarpeta> findByProyectoIdAndUsuarioIdOrderByCreadoEnAsc(Integer proyectoId, Integer usuarioId);
}
