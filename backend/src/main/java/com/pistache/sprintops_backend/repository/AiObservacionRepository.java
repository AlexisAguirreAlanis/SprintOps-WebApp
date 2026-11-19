package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.AiObservacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AiObservacionRepository extends JpaRepository<AiObservacion, Integer> {
    Optional<AiObservacion> findByClave(String clave);

    List<AiObservacion> findTop2000ByPeriodoOrderByIdObservacionDesc(String periodo);

    @Query("select coalesce(sum(o.creditos), 0) from AiObservacion o where o.usuarioId = :usuarioId and o.periodo = :periodo")
    long sumCreditsByUsuario(@Param("usuarioId") Integer usuarioId, @Param("periodo") String periodo);

    @Query("select coalesce(sum(o.creditos), 0) from AiObservacion o where o.proyectoId = :proyectoId and o.periodo = :periodo")
    long sumCreditsByProyecto(@Param("proyectoId") Integer proyectoId, @Param("periodo") String periodo);

    @Query("select coalesce(sum(o.tokensEntrada + o.tokensSalida), 0) from AiObservacion o where o.usuarioId = :usuarioId and o.periodo = :periodo")
    long sumTokensByUsuario(@Param("usuarioId") Integer usuarioId, @Param("periodo") String periodo);

    @Query("select coalesce(sum(o.tokensEntrada + o.tokensSalida), 0) from AiObservacion o where o.proyectoId = :proyectoId and o.periodo = :periodo")
    long sumTokensByProyecto(@Param("proyectoId") Integer proyectoId, @Param("periodo") String periodo);
}
