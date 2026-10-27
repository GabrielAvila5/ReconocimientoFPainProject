const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../auth/auth.middleware');
const prisma = require('../../utils/prisma');

// Exclusivo para Super Admin
router.use(requireAuth);
router.use(requireRole(['SUPER_ADMIN']));

/**
 * GET /api/v1/companies
 * Listar todas las empresas registradas (Super Admin)
 */
router.get('/', async (req, res) => {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(companies);
  } catch (error) {
    console.error('Error al listar empresas:', error);
    res.status(500).json({ error: 'Error al listar empresas' });
  }
});

/**
 * GET /api/v1/companies/:id
 * Detalle de una empresa específica
 */
router.get('/:id', async (req, res) => {
  try {
    const companyId = req.params.id;
    if (!companyId) {
      return res.status(400).json({ error: 'ID de empresa inválido' });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    res.json(company);
  } catch (error) {
    console.error('Error al obtener empresa:', error);
    res.status(500).json({ error: 'Error al obtener empresa' });
  }
});

/**
 * PATCH /api/v1/companies/:id/status
 * Activar o suspender una empresa.
 * Si se suspende (isActive: false), desconecta forzosamente todos los sockets
 * de dicha empresa en tiempo real invocando disconnectCompanySockets.
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const companyId = req.params.id;
    const { isActive, reason } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'ID de empresa inválido' });
    }
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'El campo booleano isActive es obligatorio' });
    }

    const company = await prisma.company.update({
      where: { id: companyId },
      data: { isActive }
    });

    // Si se suspende la empresa, forzar desconexión de todos sus sockets
    if (!isActive) {
      const appModule = require('../../app');
      if (typeof appModule.disconnectCompanySockets === 'function') {
        appModule.disconnectCompanySockets(companyId, reason || 'COMPANY_SUSPENDED');
      }
    }

    res.json({
      success: true,
      message: isActive ? 'Empresa activada exitosamente' : 'Empresa suspendida exitosamente',
      company
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }
    console.error('Error al actualizar estado de la empresa:', error);
    res.status(500).json({ error: 'Error al actualizar estado de la empresa' });
  }
});

module.exports = router;
