package com.pistache.sprintops_backend.repository;

import com.pistache.sprintops_backend.model.LogsIssues;
import com.pistache.sprintops_backend.model.Issues;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;

@Repository
public interface LogsIssuesRepository extends JpaRepository<LogsIssues, Integer> {
    List<LogsIssues> findByIssue(Issues issue);
    List<LogsIssues> findByIssueIdIssue(Integer issueId);

    @Query("SELECT l FROM LogsIssues l WHERE l.issue.idIssue IN :ids")
    List<LogsIssues> findByIssueIdIssueIn(@Param("ids") Collection<Integer> ids);
    List<LogsIssues> findByTipoAccion(String tipoAccion);
}
