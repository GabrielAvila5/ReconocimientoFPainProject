/**
 * Middleware de transición y compatibilidad con kioscos legados.
 * Permite x-device-token moderno sin restricciones de API Key.
 * Permite x-api-key heredado ÚNICAMENTE durante la ventana de gracia fija.
 */

const GRACE_PERIOD_END = new Date('2026-11-05T23:59:59.000Z');

// Registro en memoria de accesos de kioscos legados para auditoría
const legacyKiosksAuditLog = [];

const requireApiKey = (req, res, next) => {
  // 1. Si el dispositivo ya fue autenticado vía x-device-token en tenantContext
  if (req.device) {
    return next();
  }

  // 2. Si trae x-device-token pero no fue autenticado previamente
  if (req.headers['x-device-token']) {
    return res.status(401).json({
      error: 'DEVICE_UNAUTHORIZED',
      message: 'Token de dispositivo no válido o no autorizado.'
    });
  }

  // 3. Verificación de x-api-key legado
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Se requiere cabecera x-device-token o x-api-key.'
    });
  }

  const now = new Date();
  if (now > GRACE_PERIOD_END) {
    return res.status(401).json({
      error: 'LEGACY_API_KEY_EXPIRED',
      message: 'La ventana de gracia para x-api-key finalizó el 2026-11-05T23:59:59.000Z. Migre su kiosco al emparejamiento con x-device-token.'
    });
  }

  const expectedApiKey = process.env.KIOSK_API_KEY || 'kiosk-secret-key-123';
  if (apiKey !== expectedApiKey) {
    return res.status(403).json({ error: 'Forbidden: Invalid API Key' });
  }

  // Registrar acceso legado para monitoreo y migración
  legacyKiosksAuditLog.push({
    ip: req.ip,
    userAgent: req.headers['user-agent'] || 'Desconocido',
    path: req.originalUrl,
    timestamp: now.toISOString()
  });

  if (legacyKiosksAuditLog.length > 200) {
    legacyKiosksAuditLog.shift();
  }

  res.setHeader('X-Legacy-Kiosk-Warning', 'DeprecationNotice: x-api-key expires 2026-11-05T23:59:59.000Z. Migrate to x-device-token.');
  next();
};

function getLegacyKiosksAudit() {
  return [...legacyKiosksAuditLog];
}

module.exports = requireApiKey;
module.exports.getLegacyKiosksAudit = getLegacyKiosksAudit;
module.exports.GRACE_PERIOD_END = GRACE_PERIOD_END;
