const express = require('express');
const {
  requestDeviceAuth,
  getPendingAuthRequests,
  approveDeviceAuth,
  rejectDeviceAuth,
  verifyDeviceToken,
  getDevices,
  toggleBlockDevice,
  toggleStatusDevice,
  createManualDevice,
  deleteDevice
} = require('./devices.controller');
const { requireAuth, requireRole } = require('../auth/auth.middleware');

const router = express.Router();

// --- Rutas Públicas (Utilizadas por el Kiosko) ---
router.post('/auth-request', requestDeviceAuth);
router.post('/verify', verifyDeviceToken);

// --- Rutas Protegidas (Exclusivas para SUPER_ADMIN) ---
const requireSuperAdmin = [requireAuth, requireRole(['SUPER_ADMIN'])];

router.get('/auth-requests/pending', ...requireSuperAdmin, getPendingAuthRequests);
router.post('/auth-requests/:id/approve', ...requireSuperAdmin, approveDeviceAuth);
router.post('/auth-requests/:id/reject', ...requireSuperAdmin, rejectDeviceAuth);

router.get('/', ...requireSuperAdmin, getDevices);
router.post('/', ...requireSuperAdmin, createManualDevice);
router.patch('/:id/block', ...requireSuperAdmin, toggleBlockDevice);
router.patch('/:id/status-toggle', ...requireSuperAdmin, toggleStatusDevice);
router.delete('/:id', ...requireSuperAdmin, deleteDevice);

module.exports = router;
