const express = require('express');
const router = express.Router();
const prisma = require('../../utils/prisma');
const { requireAuth, requireCorporateOrSuperAdmin } = require('../auth/auth.middleware');
const { runWithTenantContext } = require('../../middlewares/tenantContext');

// Todas las rutas de sucursales requieren autenticación y rol CORPORATE_ADMIN o SUPER_ADMIN
router.use(requireAuth);
router.use(requireCorporateOrSuperAdmin);

/**
 * GET /api/v1/branches
 * Listar sucursales de la empresa matriz (Holding) con métricas consolidadas.
 * - Si es CORPORATE_ADMIN: lista únicamente sus sucursales (parentCompanyId === req.user.companyId).
 * - Si es SUPER_ADMIN: puede listar por ?holdingId=xxx o todas las sucursales del sistema.
 */
router.get('/', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const holdingId = isSuperAdmin ? (req.query.holdingId || null) : req.user.companyId;

    let whereClause = { parentCompanyId: { not: null } };
    if (holdingId) {
      whereClause = { parentCompanyId: holdingId };
    }

    // 1. Obtener datos del Holding
    let holding = null;
    if (holdingId) {
      holding = await prisma.company.findUnique({
        where: { id: holdingId },
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          isHolding: true,
          maxBranches: true,
          maxEmployees: true,
          maxDevices: true,
          isActive: true
        }
      });

      if (!holding) {
        return res.status(404).json({ error: 'Empresa matriz no encontrada.' });
      }

      if (!holding.isHolding && !isSuperAdmin) {
        return res.status(403).json({
          error: 'HOLDING_REQUIRED',
          message: 'Su empresa no tiene habilitada la modalidad Holding Multi-Sucursal.'
        });
      }
    }

    // 2. Obtener sucursales
    const branches = await prisma.company.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        isActive: true,
        parentCompanyId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            employees: true,
            devices: true,
            branchAccesses: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 3. Métricas agregadas de la red de sucursales
    let holdingMetrics = null;
    if (holding) {
      const allCompanyIds = [holding.id, ...branches.map((b) => b.id)];
      const totalEmployees = await prisma.employee.count({
        where: { companyId: { in: allCompanyIds } }
      });
      const totalDevices = await prisma.device.count({
        where: { companyId: { in: allCompanyIds } }
      });

      const maxBranches = holding.maxBranches || 1;
      const currentBranches = branches.length;
      const remainingBranches = Math.max(0, maxBranches - currentBranches);

      holdingMetrics = {
        holdingId: holding.id,
        holdingName: holding.name,
        maxBranches,
        currentBranches,
        remainingBranches,
        maxEmployees: holding.maxEmployees,
        totalEmployees,
        maxDevices: holding.maxDevices,
        totalDevices
      };
    }

    return res.json({
      success: true,
      holding: holdingMetrics,
      branches
    });
  } catch (error) {
    console.error('Error al listar sucursales:', error);
    return res.status(500).json({ error: 'Error al listar sucursales', message: error.message });
  }
});

/**
 * GET /api/v1/branches/:id
 * Detalle completo de una sucursal específica con aislamiento estricto.
 */
router.get('/:id', async (req, res) => {
  try {
    const branchId = req.params.id;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';

    const branch = await prisma.company.findUnique({
      where: { id: branchId },
      include: {
        settings: true,
        devices: {
          select: { id: true, name: true, type: true, status: true, ipAddress: true, isActive: true, lastSeenAt: true }
        },
        _count: {
          select: {
            employees: true,
            devices: true,
            attendances: true,
            branchAccesses: true
          }
        }
      }
    });

    if (!branch) {
      return res.status(404).json({ error: 'Sucursal no encontrada.' });
    }

    // Aislamiento Holding: el CORPORATE_ADMIN solo puede consultar sus propias sucursales
    if (!isSuperAdmin && branch.parentCompanyId !== req.user.companyId) {
      return res.status(403).json({
        error: 'TENANT_SPOOFING_DETECTED',
        message: 'Acceso denegado: esta sucursal pertenece a otra organización.'
      });
    }

    return res.json({
      success: true,
      branch
    });
  } catch (error) {
    console.error('Error al obtener sucursal:', error);
    return res.status(500).json({ error: 'Error al obtener sucursal', message: error.message });
  }
});

/**
 * POST /api/v1/branches
 * Alta de una nueva sucursal dependiente de una matriz Holding.
 * Valida de forma atómica la cuota máxima de sucursales (maxBranches).
 */
router.post('/', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const holdingId = isSuperAdmin ? (req.body.parentCompanyId || req.user.companyId) : req.user.companyId;

    if (!holdingId) {
      return res.status(400).json({ error: 'Se requiere especificar la empresa matriz (parentCompanyId).' });
    }

    const { name, slug, timezone } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'El nombre de la sucursal es obligatorio (mínimo 2 caracteres).' });
    }

    // 1. Obtener la matriz Holding y validar cuotas
    const holding = await prisma.company.findUnique({
      where: { id: holdingId },
      include: {
        branches: { select: { id: true } }
      }
    });

    if (!holding) {
      return res.status(404).json({ error: 'Empresa matriz no encontrada.' });
    }

    if (!holding.isHolding && !isSuperAdmin) {
      return res.status(403).json({
        error: 'HOLDING_REQUIRED',
        message: 'La empresa especificada no cuenta con la modalidad Holding activa.'
      });
    }

    const maxBranches = holding.maxBranches || 1;
    const currentBranchesCount = holding.branches.length;

    if (currentBranchesCount >= maxBranches) {
      return res.status(403).json({
        error: 'BRANCH_LIMIT_EXCEEDED',
        message: `Límite de sucursales alcanzado (${maxBranches} sucursales permitidas para este Holding). Contacte a soporte para ampliar su cupo.`
      });
    }

    // 2. Normalizar slug de la sucursal prefijándolo con el slug de la matriz para evitar colisiones
    const sanitizedName = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const userSlug = slug ? slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : sanitizedName;
    let finalSlug = `${holding.slug}-${userSlug}`;

    // Validar si el slug ya existe y si es necesario agregar sufijo numérico
    const existingBranchSlug = await prisma.company.findUnique({ where: { slug: finalSlug } });
    if (existingBranchSlug) {
      finalSlug = `${finalSlug}-${Date.now().toString(36).slice(-4)}`;
    }

    // 3. Crear sucursal heredando configuración básica
    const newBranch = await prisma.company.create({
      data: {
        name: name.trim(),
        slug: finalSlug,
        plan: holding.plan,
        isHolding: false,
        parentCompanyId: holding.id,
        maxEmployees: holding.maxEmployees,
        maxDevices: holding.maxDevices,
        maxBranches: 0,
        timezone: timezone || holding.timezone || 'America/Mexico_City',
        isActive: true
      }
    });

    // 4. Inicializar SystemSettings para la nueva sucursal
    await runWithTenantContext({ companyId: newBranch.id, isSuperAdmin: true }, async () => {
      await prisma.systemSettings.create({
        data: {
          companyId: newBranch.id,
          companyName: newBranch.name,
          timezone: newBranch.timezone
        }
      });

      // Registro de Auditoría
      await prisma.adminAuditLog.create({
        data: {
          action: 'CREATE_BRANCH',
          performedById: req.user.id,
          performedByName: req.user.name || req.user.email || 'Admin',
          targetName: newBranch.name,
          targetEmail: req.user.email,
          companyId: holding.id
        }
      });
    });

    return res.status(201).json({
      success: true,
      message: `Sucursal "${newBranch.name}" creada con éxito.`,
      branch: newBranch
    });
  } catch (error) {
    console.error('Error al crear sucursal:', error);
    return res.status(500).json({ error: 'Error interno al crear sucursal', message: error.message });
  }
});

/**
 * PATCH /api/v1/branches/:id
 * Actualizar datos de una sucursal (nombre, timezone, estado activo).
 */
router.patch('/:id', async (req, res) => {
  try {
    const branchId = req.params.id;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const { name, timezone, isActive } = req.body;

    const currentBranch = await prisma.company.findUnique({
      where: { id: branchId }
    });

    if (!currentBranch || !currentBranch.parentCompanyId) {
      return res.status(404).json({ error: 'Sucursal no encontrada.' });
    }

    // Aislamiento: El CORPORATE_ADMIN solo puede modificar sus propias sucursales
    if (!isSuperAdmin && currentBranch.parentCompanyId !== req.user.companyId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'No está autorizado para modificar sucursales de otra matriz.'
      });
    }

    const dataToUpdate = {};
    if (name && typeof name === 'string' && name.trim().length >= 2) {
      dataToUpdate.name = name.trim();
    }
    if (timezone && typeof timezone === 'string') {
      dataToUpdate.timezone = timezone.trim();
    }
    if (typeof isActive === 'boolean') {
      dataToUpdate.isActive = isActive;
    }

    const updatedBranch = await prisma.company.update({
      where: { id: branchId },
      data: dataToUpdate
    });

    // Auditoría
    await runWithTenantContext({ companyId: currentBranch.parentCompanyId, isSuperAdmin: true }, async () => {
      await prisma.adminAuditLog.create({
        data: {
          action: 'UPDATE_BRANCH',
          performedById: req.user.id,
          performedByName: req.user.name || req.user.email || 'Admin',
          targetName: updatedBranch.name,
          targetEmail: req.user.email,
          companyId: currentBranch.parentCompanyId
        }
      });
    });

    return res.json({
      success: true,
      message: 'Sucursal actualizada exitosamente.',
      branch: updatedBranch
    });
  } catch (error) {
    console.error('Error al actualizar sucursal:', error);
    return res.status(500).json({ error: 'Error al actualizar sucursal', message: error.message });
  }
});

/**
 * POST /api/v1/branches/:id/assign-employee
 * Asigna un empleado de la red del Holding a una sucursal mediante el pivote EmployeeBranchAccess.
 */
router.post('/:id/assign-employee', async (req, res) => {
  try {
    const branchId = req.params.id;
    const { employeeId } = req.body;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';

    if (!employeeId) {
      return res.status(400).json({ error: 'El campo employeeId es obligatorio.' });
    }

    const branch = await prisma.company.findUnique({
      where: { id: branchId }
    });

    if (!branch || !branch.parentCompanyId) {
      return res.status(404).json({ error: 'Sucursal no encontrada.' });
    }

    if (!isSuperAdmin && branch.parentCompanyId !== req.user.companyId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'No tiene acceso a esta sucursal.' });
    }

    // Verificar que el empleado pertenezca al holding o a alguna sucursal de la red
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, companyId: true, firstName: true, lastName: true }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Empleado no encontrado.' });
    }

    const validHoldingIds = isSuperAdmin
      ? null
      : [req.user.companyId, ...(await prisma.company.findMany({ where: { parentCompanyId: req.user.companyId }, select: { id: true } })).map((b) => b.id)];

    if (!isSuperAdmin && !validHoldingIds.includes(employee.companyId)) {
      return res.status(403).json({
        error: 'TENANT_SPOOFING_DETECTED',
        message: 'El empleado seleccionado no pertenece a la red de su empresa matriz.'
      });
    }

    const access = await prisma.employeeBranchAccess.upsert({
      where: {
        employeeId_branchId: {
          employeeId,
          branchId
        }
      },
      create: {
        employeeId,
        branchId
      },
      update: {}
    });

    return res.json({
      success: true,
      message: `Acceso asignado para ${employee.firstName} ${employee.lastName} a la sucursal "${branch.name}".`,
      access
    });
  } catch (error) {
    console.error('Error al asignar empleado a sucursal:', error);
    return res.status(500).json({ error: 'Error al asignar empleado a sucursal', message: error.message });
  }
});

/**
 * DELETE /api/v1/branches/:id/assign-employee/:employeeId
 * Revoca el acceso de un empleado a una sucursal específica.
 */
router.delete('/:id/assign-employee/:employeeId', async (req, res) => {
  try {
    const { id: branchId, employeeId } = req.params;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';

    const branch = await prisma.company.findUnique({
      where: { id: branchId }
    });

    if (!branch || !branch.parentCompanyId) {
      return res.status(404).json({ error: 'Sucursal no encontrada.' });
    }

    if (!isSuperAdmin && branch.parentCompanyId !== req.user.companyId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'No tiene acceso a esta sucursal.' });
    }

    await prisma.employeeBranchAccess.deleteMany({
      where: {
        employeeId,
        branchId
      }
    });

    return res.json({
      success: true,
      message: 'Acceso revocado exitosamente.'
    });
  } catch (error) {
    console.error('Error al revocar acceso:', error);
    return res.status(500).json({ error: 'Error al revocar acceso', message: error.message });
  }
});

module.exports = router;

