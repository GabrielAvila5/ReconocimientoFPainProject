import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css'; // Importando los estilos globales

// Interceptor global de CSRF: inyecta automáticamente la cabecera x-csrf-token
// leída desde la cookie XSRF-TOKEN en todas las peticiones mutativas (POST, PUT, PATCH, DELETE).
if (typeof window !== 'undefined' && window.fetch) {
  const originalFetch = window.fetch;
  window.fetch = async (input, init = {}) => {
    const method = (init.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
      const csrfToken = match ? decodeURIComponent(match[1]) : null;
      if (csrfToken) {
        init.headers = {
          ...(init.headers || {}),
          'x-csrf-token': csrfToken
        };
      }
    }
    return originalFetch(input, init);
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
