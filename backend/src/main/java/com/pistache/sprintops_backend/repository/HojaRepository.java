package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.Hoja;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface HojaRepository extends JpaRepository<Hoja, Integer> {
    List<Hoja> findByPropietario_IdUsuario(Integer usuarioId);

    List<Hoja> findByProyecto_Equipo_IdEquipoIn(Collection<Integer> equipoIds);
}
