package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.AiMovimientoCredito;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AiMovimientoCreditoRepository extends JpaRepository<AiMovimientoCredito, Integer> {
    Optional<AiMovimientoCredito> findByClave(String clave);

    List<AiMovimientoCredito> findTop20ByUsuarioIdOrderByIdMovimientoDesc(Integer usuarioId);
}
