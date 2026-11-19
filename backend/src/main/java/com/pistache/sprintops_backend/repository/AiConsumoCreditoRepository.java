package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.AiConsumoCredito;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AiConsumoCreditoRepository extends JpaRepository<AiConsumoCredito, Integer> {
    long countByUsuarioIdAndPeriodo(Integer usuarioId, String periodo);

    @Query("select coalesce(sum(c.creditos), 0) from AiConsumoCredito c where c.usuarioId = :usuarioId and c.periodo = :periodo")
    long sumByUsuarioIdAndPeriodo(@Param("usuarioId") Integer usuarioId, @Param("periodo") String periodo);

    List<AiConsumoCredito> findTop20ByUsuarioIdAndPeriodoOrderByIdConsumoDesc(Integer usuarioId, String periodo);

    List<AiConsumoCredito> findTop12ByProyectoIdAndBolsaAndPeriodoOrderByIdConsumoDesc(Integer proyectoId, String bolsa, String periodo);
}
