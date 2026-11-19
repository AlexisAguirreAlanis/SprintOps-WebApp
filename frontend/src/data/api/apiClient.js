/**
 * Base del API:
 *  - En desarrollo apunta a http://localhost:8080/api por defecto.
 *  - En producción se usa /api (mismo origen que el frontend, nginx hace proxy al backend).
 *  - Se puede forzar con VITE_API_BASE en build-time si quieres apuntar a otro origen.
 */
const RAW_API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV
    ? 'http://localhost:8080/api'
    : '/api');

const API_BASE = String(RAW_API_BASE).replace(/\/+$/, '');

/** Origen del backend (sin /api), para OAuth y redirecciones */
const API_ORIGIN = API_BASE.endsWith('/api')
  ? API_BASE.slice(0, -4)
  : (typeof window !== 'undefined' ? window.location.origin : '');

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    ...options,
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const base =
      errorBody.error ||
      errorBody.message ||
      errorBody.detail ||
      (errorBody.path && response.status === 404
        ? `Ruta no encontrada en el servidor: ${errorBody.path}`
        : null) ||
      `HTTP ${response.status}`;
    const error = new Error(base);
    error.status = response.status;
    if (errorBody.retryAfterSeconds != null) {
      error.retryAfterSeconds = Number(errorBody.retryAfterSeconds);
    }
    throw error;
  }

  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
}

async function uploadRequest(path, formData) {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    cache: 'no-store',
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP ${response.status}`);
  }
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
}

async function getRaw(path) {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  return response;
}

async function requestBlob(path) {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(errText || `HTTP ${response.status}`);
  }
  return response.blob();
}

const apiClient = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
  upload: (path, formData) => uploadRequest(path, formData),
  getRaw: (path) => getRaw(path),
  getBlob: (path) => requestBlob(path),
};

export default apiClient;
export { API_BASE, API_ORIGIN };
