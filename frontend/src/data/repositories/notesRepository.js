import apiClient from '../api/apiClient';

export const notesRepository = {
  list: (projectId) => apiClient.get(`/proyectos/${projectId}/notas`),
  create: (projectId, userId, text) => apiClient.post(`/proyectos/${projectId}/notas`, { userId, text }),
  remove: (projectId, noteId, userId) => apiClient.delete(`/proyectos/${projectId}/notas/${noteId}?userId=${encodeURIComponent(userId)}`),
};
