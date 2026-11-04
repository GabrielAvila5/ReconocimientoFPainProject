import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css'; // Importando los estilos globales

// Interceptor global de fetch:
// 1. Inyecta x-csrf-token para peticiones mutativas (POST, PUT, PATCH, DELETE).
// 2. Inyecta x-tenant-id si no viene en los encabezados.
// 3. Captura respuestas 401 y despacha 'auth:unauthorized' para cerrar sesión limpia en el frontend.
if (typeof window !== 'undefined' && window.fetch) {
  const originalFetch = window.fetch;
  window.fetch = async (input, init = {}) => {
    init = init || {};
    const url = typeof input === 'string' ? input : (input?.url || '');
    const isApiCall = url.includes('/api/v1');

    // 1. CSRF
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

    // 2. Inyección de x-tenant-id
    if (isApiCall) {
      const tenantId = localStorage.getItem('tenantId') || 'default-company-pain';
      const existingHeaders = init.headers || {};
      const hasTenantHeader = (existingHeaders instanceof Headers)
        ? (existingHeaders.has('x-tenant-id') || existingHeaders.has('x-company-id'))
        : (existingHeaders['x-tenant-id'] || existingHeaders['x-company-id']);

      if (!hasTenantHeader && tenantId) {
        if (existingHeaders instanceof Headers) {
          existingHeaders.set('x-tenant-id', tenantId);
        } else {
          init.headers = {
            ...existingHeaders,
            'x-tenant-id': tenantId
          };
        }
      }
    }

    const response = await originalFetch(input, init);

    // 3. Centralized 401 Unauthorized handling
    if (response.status === 401 && isApiCall && !url.includes('/api/v1/auth/login')) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    return response;
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
