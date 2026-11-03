package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.HojaInvitado;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HojaInvitadoRepository extends JpaRepository<HojaInvitado, Integer> {
    List<HojaInvitado> findByHoja_IdHoja(Integer hojaId);

    List<HojaInvitado> findByUsuario_IdUsuarioAndOrigen(Integer userId, String origen);

    Optional<HojaInvitado> findByHoja_IdHojaAndUsuario_IdUsuarioAndOrigen(Integer hojaId, Integer userId, String origen);

    void deleteByHoja_IdHojaAndUsuario_IdUsuario(Integer hojaId, Integer userId);

    void deleteByHoja_IdHojaAndOrigen(Integer hojaId, String origen);
}
