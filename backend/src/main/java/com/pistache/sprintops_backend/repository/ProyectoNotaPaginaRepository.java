package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.ProyectoNotaPagina;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProyectoNotaPaginaRepository extends JpaRepository<ProyectoNotaPagina, Integer> {
    Optional<ProyectoNotaPagina> findByProyectoIdProyecto(Integer proyectoId);
}
