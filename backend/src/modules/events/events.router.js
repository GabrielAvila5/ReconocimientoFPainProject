const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../auth/auth.middleware');
const eventsController = require('./events.controller');

// Todas las rutas protegidas para admin
router.use(requireAuth);
router.use(requireRole(['SUPER_ADMIN', 'ADMIN']));

router.get('/', eventsController.getEvents);
router.post('/', eventsController.createEvent);
router.put('/:id', eventsController.updateEvent);
router.delete('/:id', eventsController.deleteEvent);

module.exports = router;
