import apiClient from '../api/apiClient';

const q = (userId) => `userId=${encodeURIComponent(userId)}`;

export const portfolioRepository = {
  list: (userId) => apiClient.get(`/hojas?${q(userId)}`),
  get: (id, userId) => apiClient.get(`/hojas/${id}?${q(userId)}`),
  create: (body) => apiClient.post('/hojas', body),
  update: (id, body) => apiClient.put(`/hojas/${id}`, body),
  saveDocument: (id, body) => apiClient.put(`/hojas/${id}/documento`, body),
  duplicate: (id, userId) => apiClient.post(`/hojas/${id}/duplicar?${q(userId)}`),
  access: (id, userId) => apiClient.get(`/hojas/${id}/acceso?${q(userId)}`),
  updateAccess: (id, body) => apiClient.put(`/hojas/${id}/acceso`, body),
  presence: (id, userId, cursor) => apiClient.post(`/hojas/${id}/presencia`, { userId, cursor }),
  revision: (id, userId) => apiClient.get(`/hojas/${id}/revision?${q(userId)}`),
  versions: (id, userId) => apiClient.get(`/hojas/${id}/versiones?${q(userId)}`),
  version: (id, versionId, userId) => apiClient.get(`/hojas/${id}/versiones/${versionId}?${q(userId)}`),
  createVersion: (id, userId, label) => apiClient.post(`/hojas/${id}/versiones`, { userId, label }),
  restoreVersion: (id, versionId, userId) => apiClient.post(`/hojas/${id}/versiones/${versionId}/restaurar`, { userId }),
  mentions: (id, body) => apiClient.post(`/hojas/${id}/menciones`, body),
  ai: (id, body) => apiClient.post(`/hojas/${id}/ia`, body),
  search: (userId, query) => apiClient.get(`/hojas/buscar?${q(userId)}&q=${encodeURIComponent(query)}`),
  importLegacyDoc: (file) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.upload('/hojas/importar-doc', form);
  },
};
