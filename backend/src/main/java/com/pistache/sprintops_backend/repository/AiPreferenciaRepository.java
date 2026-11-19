package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.AiPreferencia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AiPreferenciaRepository extends JpaRepository<AiPreferencia, Integer> {
    Optional<AiPreferencia> findByUsuarioId(Integer usuarioId);
}
