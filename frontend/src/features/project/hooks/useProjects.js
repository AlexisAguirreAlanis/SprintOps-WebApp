import { useState, useEffect, useCallback } from 'react';
import { projectsRepository } from '../../../data/repositories/projectsRepository';
import { API_BASE } from '../../../data/api/apiClient';

function buildCardImageUrl(project) {
  if (project.cardCoverCustom) {
    const v = project.cardCoverVersion ?? 0;
    return `${API_BASE}/proyectos/${project.id}/card-cover?v=${v}`;
  }
  return null;
}

const enrichProject = (project) => {
  const progress = Number.isFinite(project.progress) ? project.progress : null;
  return {
    ...project,
    progress,
    status: project.status || 'A',
    start: project.start || null,
    end: project.end || null,
    issuesTotal: Number.isFinite(project.issuesTotal) ? project.issuesTotal : null,
    issuesDone: Number.isFinite(project.issuesDone) ? project.issuesDone : null,
    membersPreview: Array.isArray(project.membersPreview) ? project.membersPreview : [],
    memberCount: Number.isFinite(project.memberCount) ? project.memberCount : (project.membersPreview?.length || 0),
    image: buildCardImageUrl(project),
  };
};

export const useProjects = (userId) => {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      let data = [];
      if (userId) {
        data = await projectsRepository.getByUserId(userId);
      } else {
        data = await projectsRepository.getAll();
      }
      setProjects((data || []).map(enrichProject));
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addProject = async (projectData) => {
    const result = await projectsRepository.create({ ...projectData, ownerId: userId });
    fetchData();
    return result;
  };

  const getProject = async (id) => {
    const project = await projectsRepository.getById(id);
    return project ? enrichProject(project) : null;
  };

  return { projects, isLoading, error, addProject, getProject, refetch: fetchData };
};
