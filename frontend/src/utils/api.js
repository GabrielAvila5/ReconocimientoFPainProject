import axios from 'axios';

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return 'http://localhost:4000/api/v1';
  return envUrl.endsWith('/api/v1') ? envUrl : `${envUrl}/api/v1`;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true // Important for sending/receiving httpOnly cookies
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
