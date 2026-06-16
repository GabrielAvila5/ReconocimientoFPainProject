const express = require('express');
const router = express.Router();
const requireJwt = require('../../middlewares/requireJwt');
const { getSettings, updateSettings, getPublicSettings } = require('./settings.controller');

// Ruta pública (sin auth) para kioscos
router.get('/public', getPublicSettings);

// Rutas protegidas (requieren admin)
router.get('/', requireJwt, getSettings);
router.put('/', requireJwt, updateSettings);

module.exports = router;
