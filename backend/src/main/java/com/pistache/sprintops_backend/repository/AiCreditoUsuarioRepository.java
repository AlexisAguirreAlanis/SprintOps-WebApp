package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.AiCreditoUsuario;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AiCreditoUsuarioRepository extends JpaRepository<AiCreditoUsuario, Integer> {
    Optional<AiCreditoUsuario> findByUsuarioId(Integer usuarioId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from AiCreditoUsuario c where c.usuarioId = :usuarioId")
    Optional<AiCreditoUsuario> lockByUsuarioId(@Param("usuarioId") Integer usuarioId);
}
