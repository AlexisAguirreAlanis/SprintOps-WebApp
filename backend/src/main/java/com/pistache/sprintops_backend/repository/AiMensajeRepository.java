package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.AiMensaje;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface AiMensajeRepository extends JpaRepository<AiMensaje, Integer> {
    List<AiMensaje> findByConversacionIdOrderByIdMensajeAsc(Integer conversacionId);

    Optional<AiMensaje> findBySolicitud(String solicitud);

    @Modifying
    @Query("delete from AiMensaje m where m.conversacionId = :conversationId and m.idMensaje > :messageId")
    void deleteAfter(Integer conversationId, Integer messageId);
}
