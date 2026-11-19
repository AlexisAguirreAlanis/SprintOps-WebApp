import apiClient from '../api/apiClient';

export const notesRepository = {
  list: (projectId) => apiClient.get(`/proyectos/${projectId}/notas`),
  getPage: (projectId) => apiClient.get(`/proyectos/${projectId}/notas/pagina`),
  savePage: (projectId, userId, content) => apiClient.put(`/proyectos/${projectId}/notas/pagina`, { userId, content }),
};
