const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('./auth.controller');
const { requireAuth } = require('./auth.middleware');

/**
 * Rate Limiting Compuesto para Inicio de Sesión
 * Límite por tupla IP + email normalizado (lowercase/trim):
 * Máximo 5 intentos fallidos en 15 minutos.
 * Responde HTTP 429 { error: 'TOO_MANY_LOGIN_ATTEMPTS' }.
 * Las peticiones exitosas se descuentan (skipSuccessfulRequests: true).
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  validate: { default: true, keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const email = (req.body?.email || '').trim().toLowerCase();
    return `${ip}:${email}`;
  },
  handler: (req, res) => {
    return res.status(429).json({
      error: 'TOO_MANY_LOGIN_ATTEMPTS',
      message: 'Demasiados intentos fallidos de inicio de sesión. Por favor espere 15 minutos.'
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/login', loginLimiter, authController.login);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.getMe);
router.get('/setup-status', authController.getSetupStatus);
router.post('/setup', loginLimiter, authController.setupFirstAdmin);
router.put('/change-password', requireAuth, authController.changePassword);

module.exports = router;
