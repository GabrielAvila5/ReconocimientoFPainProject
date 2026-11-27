const express = require('express');
const {
  requestDeviceAuth,
  getPendingAuthRequests,
  lookupAuthRequestByCode,
  approveDeviceAuth,
  rejectDeviceAuth,
  getAuthRequestStatus,
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
router.get('/auth-requests/:id/status', getAuthRequestStatus);
router.post('/verify', verifyDeviceToken);

// --- Rutas de Emparejamiento (SUPER_ADMIN, CORPORATE_ADMIN y ADMIN de empresa) ---
const requireAdmin = [requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN', 'CORPORATE_ADMIN'])];

// Paso 1: Administrador consulta el código y ve IP y User-Agent del kiosco
router.post('/auth-requests/lookup', ...requireAdmin, lookupAuthRequestByCode);

// Paso 2: Administrador confirma la aprobación
router.post('/auth-requests/:id/approve', ...requireAdmin, approveDeviceAuth);
router.post('/auth-requests/:id/reject', ...requireAdmin, rejectDeviceAuth);

// --- Rutas Protegidas de Gestión (SUPER_ADMIN, CORPORATE_ADMIN y ADMIN de empresa) ---
router.get('/auth-requests/pending', ...requireAdmin, getPendingAuthRequests);

router.get('/', ...requireAdmin, getDevices);
router.post('/', ...requireAdmin, createManualDevice);
router.patch('/:id/block', ...requireAdmin, toggleBlockDevice);
router.patch('/:id/status-toggle', ...requireAdmin, toggleStatusDevice);
router.delete('/:id', ...requireAdmin, deleteDevice);

module.exports = router;
