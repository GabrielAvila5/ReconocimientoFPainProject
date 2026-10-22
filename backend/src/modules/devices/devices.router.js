const express = require('express');
const {
  requestDeviceAuth,
  getPendingAuthRequests,
  lookupAuthRequestByCode,
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

// --- Rutas de Emparejamiento (SUPER_ADMIN y ADMIN de empresa) ---
const requireAdmin = [requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN'])];

// Paso 1: Administrador consulta el código y ve IP y User-Agent del kiosco
router.post('/auth-requests/lookup', ...requireAdmin, lookupAuthRequestByCode);

// Paso 2: Administrador confirma la aprobación
router.post('/auth-requests/:id/approve', ...requireAdmin, approveDeviceAuth);
router.post('/auth-requests/:id/reject', ...requireAdmin, rejectDeviceAuth);

// --- Rutas Protegidas de Gestión (SUPER_ADMIN y ADMIN) ---
const requireSuperAdmin = [requireAuth, requireRole(['SUPER_ADMIN'])];

router.get('/auth-requests/pending', ...requireSuperAdmin, getPendingAuthRequests);

router.get('/', ...requireSuperAdmin, getDevices);
router.post('/', ...requireSuperAdmin, createManualDevice);
router.patch('/:id/block', ...requireSuperAdmin, toggleBlockDevice);
router.patch('/:id/status-toggle', ...requireSuperAdmin, toggleStatusDevice);
router.delete('/:id', ...requireSuperAdmin, deleteDevice);

module.exports = router;
