package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.NotaProyecto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotaProyectoRepository extends JpaRepository<NotaProyecto, Integer> {
    List<NotaProyecto> findByProyectoIdProyectoOrderByCreadoEnDesc(Integer proyectoId);
}
