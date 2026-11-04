import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css'; // Importando los estilos globales

// Interceptor global de fetch:
// 1. Inyecta x-csrf-token para peticiones mutativas (POST, PUT, PATCH, DELETE).
// 2. Inyecta Authorization (Bearer) desde localStorage si no viene en los encabezados.
// 3. Inyecta x-tenant-id desde localStorage si no viene en los encabezados.
// 4. Captura respuestas 401 y despacha 'auth:unauthorized' para cerrar sesión limpia en el frontend.
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

    // 2. Inyección de Authorization y x-tenant-id para la API
    if (isApiCall) {
      const token = localStorage.getItem('token');
      const tenantId = localStorage.getItem('tenantId');
      const currentHeaders = init.headers || {};

      // 2.1 Inyectar Authorization Bearer si no está presente
      const hasAuth = (currentHeaders instanceof Headers)
        ? currentHeaders.has('authorization')
        : (currentHeaders['Authorization'] || currentHeaders['authorization']);

      if (!hasAuth && token) {
        if (currentHeaders instanceof Headers) {
          currentHeaders.set('authorization', `Bearer ${token}`);
        } else {
          init.headers = {
            ...currentHeaders,
            'Authorization': `Bearer ${token}`
          };
        }
      }

      // 2.2 Inyectar x-tenant-id si existe en localStorage y no fue pasado explícitamente
      const updatedHeaders = init.headers || currentHeaders;
      const hasTenantHeader = (updatedHeaders instanceof Headers)
        ? (updatedHeaders.has('x-tenant-id') || updatedHeaders.has('x-company-id'))
        : (updatedHeaders['x-tenant-id'] || updatedHeaders['x-company-id']);

      if (!hasTenantHeader && tenantId) {
        if (updatedHeaders instanceof Headers) {
          updatedHeaders.set('x-tenant-id', tenantId);
        } else {
          init.headers = {
            ...updatedHeaders,
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
