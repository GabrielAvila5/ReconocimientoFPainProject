const crypto = require('crypto');

/**
 * Middleware de protección CSRF (Double Submit Cookie) para rutas mutativas
 * autenticadas mediante cookie de sesión (req.cookies.jwt).
 */
const csrfProtection = (req, res, next) => {
  // Asegurar que la cookie XSRF-TOKEN exista para el cliente
  if (!req.cookies || !req.cookies['XSRF-TOKEN']) {
    const token = crypto.randomBytes(24).toString('hex');
    const isProd = process.env.NODE_ENV === 'production';
    const isSecure = isProd || process.env.COOKIE_SECURE === 'true';
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false,
      secure: isSecure,
      sameSite: 'strict',
      maxAge: 12 * 60 * 60 * 1000
    });
    if (!req.cookies) req.cookies = {};
    req.cookies['XSRF-TOKEN'] = token;
  }

  const method = req.method.toUpperCase();
  // Métodos seguros (GET, HEAD, OPTIONS) no requieren verificación CSRF
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }

  // EXENCIÓN 1: Peticiones autenticadas explícitamente por cabecera Bearer (sin depender de cookie)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  // EXENCIÓN 2: Peticiones de Kioscos autenticadas por x-device-token
  if (req.headers['x-device-token']) {
    return next();
  }

  // EXENCIÓN 3: Rutas de autenticación pública inicial o emparejamiento físico de dispositivos
  const url = req.originalUrl || req.path || '';
  if (
    url.startsWith('/api/v1/auth/login') ||
    url.startsWith('/api/v1/devices/auth-request')
  ) {
    return next();
  }

  // Si la petición NO tiene cookie de sesión JWT, no depende de la sesión de navegador
  if (!req.cookies.jwt) {
    return next();
  }

  // Para mutaciones autenticadas mediante cookie de sesión, exigir cabecera CSRF coincidente
  const clientCsrfToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
  const cookieCsrfToken = req.cookies['XSRF-TOKEN'];

  if (!clientCsrfToken || !cookieCsrfToken || clientCsrfToken !== cookieCsrfToken) {
    return res.status(403).json({
      error: 'CSRF_TOKEN_INVALID',
      message: 'Token CSRF inválido o ausente en petición autenticada por cookie.'
    });
  }

  next();
};

module.exports = { csrfProtection };
