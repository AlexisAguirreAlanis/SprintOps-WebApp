package com.pistache.sprintops_backend.dto;

import java.util.List;
import java.util.Map;

public class HojaDTO {
    public Integer id;
    public String name;
    public boolean favorite;
    public boolean archived;
    public boolean deleted;
    public String updatedAt;
    public String createdAt;
    public Integer ownerId;
    public String ownerName;
    public Integer projectId;
    public String projectName;
    public boolean shared;
    public boolean team;
    public boolean canManage;
    public boolean canEdit;
    public boolean canComment;
    public String role;
    public String visibility;
    public boolean filterTeam;
    public int elementCount;
    public long revision;
    public int schemaVersion;
    public List<Map<String, Object>> preview;
    public String document;
}
