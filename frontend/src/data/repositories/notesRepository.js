import apiClient from '../api/apiClient';

export const notesRepository = {
  getPage: (projectId) => apiClient.get(`/proyectos/${projectId}/notas/pagina`),
  savePage: (projectId, userId, content) => apiClient.put(`/proyectos/${projectId}/notas/pagina`, { userId, content }),
};
