const express = require('express');
const { getAdmins, createAdmin, deleteAdmin, getAuditLogs } = require('./admins.controller');
const { requireAuth, requireRole } = require('../auth/auth.middleware');

const router = express.Router();

// All routes here require the user to be authenticated and have SUPER_ADMIN role
router.use(requireAuth);
router.use(requireRole(['SUPER_ADMIN']));

router.get('/', getAdmins);
router.post('/', createAdmin);
router.get('/audit-log', getAuditLogs);
router.delete('/:id', deleteAdmin);

module.exports = router;
