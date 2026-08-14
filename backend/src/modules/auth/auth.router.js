const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('./auth.controller');
const { requireAuth } = require('./auth.middleware');

// Limitador de intentos para login (max 5 por IP cada 15 min)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5,
  message: { error: 'Demasiados intentos de login. Por favor, inténtelo de nuevo en 15 minutos.' }
});

router.post('/login', loginLimiter, authController.login);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.getMe);
router.get('/setup-status', authController.getSetupStatus);
router.post('/setup', loginLimiter, authController.setupFirstAdmin);

module.exports = router;
