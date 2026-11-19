package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.AsignacionIssues;
import com.pistache.sprintops_backend.model.AsignacionIssues.AsignacionIssuesId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;

@Repository
public interface AsignacionIssuesRepository extends JpaRepository<AsignacionIssues, AsignacionIssuesId> {
    List<AsignacionIssues> findByUsuarioIdUsuario(Integer usuarioId);
    List<AsignacionIssues> findByIssueIdIssue(Integer issueId);

    @Query("SELECT a FROM AsignacionIssues a WHERE a.issue.idIssue IN :ids")
    List<AsignacionIssues> findByIssueIdIssueIn(@Param("ids") Collection<Integer> ids);
}
