const express = require('express');
const router = express.Router();
const notificationController = require('./notification.controller');

// Obtener todas las notificaciones (paginadas)
router.get('/', notificationController.getNotifications);

// Obtener conteo de no leídas
router.get('/unread-count', notificationController.getUnreadCount);

// Marcar todas como leídas
router.put('/read-all', notificationController.markAllAsRead);

// Marcar una como leída
router.put('/:id/read', notificationController.markAsRead);

// Eliminar todas las leídas
router.delete('/read', notificationController.deleteReadNotifications);

// Eliminar una
router.delete('/:id', notificationController.deleteNotification);

// Seed data (Solo para desarrollo)
router.post('/seed', notificationController.seedNotifications);

module.exports = router;
