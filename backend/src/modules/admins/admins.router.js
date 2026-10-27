const express = require('express');
const { getAdmins, createAdmin, deleteAdmin, getAuditLogs, syncAdminsHandler } = require('./admins.controller');
const { requireAuth, requireRole } = require('../auth/auth.middleware');

const router = express.Router();

// En SaaS multi-tenant, administradores de inquilino y Super Admin pueden gestionar administradores de su empresa
router.use(requireAuth);
router.use(requireRole(['ADMIN', 'SUPER_ADMIN']));

router.get('/', getAdmins);
router.post('/', createAdmin);
router.get('/audit-log', getAuditLogs);
router.post('/sync-users', requireRole(['SUPER_ADMIN']), syncAdminsHandler);
router.delete('/:id', deleteAdmin);

// ENDPOINT MANUAL DE DESARROLLO/DEBUG
// Ejecuta la lógica del cron de asistencia manualmente.
// Protegido por requireAuth y requireRole('SUPER_ADMIN').
router.post('/run-attendance-cron', async (req, res) => {
  try {
    const { processAutoCheckout } = require('../../jobs/attendanceCron');
    await processAutoCheckout();
    res.json({ success: true, message: 'Cron de auto-cierre de asistencia ejecutado manualmente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al ejecutar cron manualmente.' });
  }
});

module.exports = router;
