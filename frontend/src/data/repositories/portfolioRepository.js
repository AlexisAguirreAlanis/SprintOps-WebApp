import apiClient from '../api/apiClient';

export const portfolioRepository = {
  list: (userId) => apiClient.get(`/hojas?userId=${encodeURIComponent(userId)}`),
  get: (id, userId) => apiClient.get(`/hojas/${id}?userId=${encodeURIComponent(userId)}`),
  create: (body) => apiClient.post('/hojas', body),
  update: (id, body) => apiClient.put(`/hojas/${id}`, body),
  saveDocument: (id, body) => apiClient.put(`/hojas/${id}/documento`, body),
  duplicate: (id, userId) => apiClient.post(`/hojas/${id}/duplicar?userId=${encodeURIComponent(userId)}`),
  access: (id, userId) => apiClient.get(`/hojas/${id}/acceso?userId=${encodeURIComponent(userId)}`),
  updateAccess: (id, body) => apiClient.put(`/hojas/${id}/acceso`, body),
  presence: (id, userId) => apiClient.post(`/hojas/${id}/presencia`, { userId }),
};
