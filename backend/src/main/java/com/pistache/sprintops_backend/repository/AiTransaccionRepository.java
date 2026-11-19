package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.AiTransaccion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AiTransaccionRepository extends JpaRepository<AiTransaccion, Integer> {
    Optional<AiTransaccion> findByClave(String clave);

    List<AiTransaccion> findTop20ByUsuarioIdOrderByIdTransaccionDesc(Integer usuarioId);
}
