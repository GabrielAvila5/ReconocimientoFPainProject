import axios from 'axios';

export const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }
  return '';
};

export const getApiUrl = () => {
  const base = getBaseUrl();
  return `${base}/api/v1`;
};

const api = axios.create({
  baseURL: getApiUrl(),
  withCredentials: true // Important for sending/receiving httpOnly cookies
});

// Interceptor para agregar token si existe en localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const tenantId = localStorage.getItem('tenantId');
  if (tenantId) {
    config.headers['x-tenant-id'] = tenantId;
  }
  return config;
});

// Interceptor para manejar respuestas
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Dispatch a custom event to tell AuthContext to logout
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;
