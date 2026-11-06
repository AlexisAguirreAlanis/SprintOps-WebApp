package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.HojaVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HojaVersionRepository extends JpaRepository<HojaVersion, Integer> {
    List<HojaVersion> findTop60ByHoja_IdHojaOrderByFechaDesc(Integer hojaId);

    Optional<HojaVersion> findFirstByHoja_IdHojaOrderByFechaDesc(Integer hojaId);
}
