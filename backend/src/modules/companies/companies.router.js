const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { requireAuth, requireRole } = require('../auth/auth.middleware');
const prisma = require('../../utils/prisma');
const { runWithTenantContext } = require('../../middlewares/tenantContext');
const { findAdminByEmailForLogin } = require('../../utils/authHelpers');

// Exclusivo para Super Admin
router.use(requireAuth);
router.use(requireRole(['SUPER_ADMIN']));

const PLAN_DEFAULTS = {
  STARTER: { maxEmployees: 50, maxDevices: 3 },
  PRO: { maxEmployees: 200, maxDevices: 10 },
  ENTERPRISE: { maxEmployees: 1000, maxDevices: 50 }
};

/**
 * GET /api/v1/companies
 * Listar todas las empresas registradas (Super Admin) con métricas enriquecidas
 */
router.get('/', async (req, res) => {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        adminUsers: {
          select: { id: true, name: true, email: true, role: true, createdAt: true },
          take: 3
        },
        _count: {
          select: {
            employees: true,
            devices: true,
            departments: true,
            shifts: true,
            attendances: true,
            adminUsers: true
          }
        }
      }
    });

    // Enriquecer con conteo de empleados con enrolamiento biométrico completado
    const enrichedCompanies = await Promise.all(
      companies.map(async (comp) => {
        const enrolledCount = await runWithTenantContext({ companyId: comp.id, isSuperAdmin: true }, async () => {
          return prisma.employee.count({
            where: {
              companyId: comp.id,
              faceDescriptor: { not: null }
            }
          });
        });
        return {
          ...comp,
          _count: {
            ...comp._count,
            enrolledEmployees: enrolledCount
          }
        };
      })
    );

    res.json(enrichedCompanies);
  } catch (error) {
    console.error('Error al listar empresas:', error);
    res.status(500).json({ error: 'Error al listar empresas' });
  }
});

/**
 * GET /api/v1/companies/:id
 * Detalle completo y enriquecido de una empresa específica (Super Admin)
 */
router.get('/:id', async (req, res) => {
  try {
    const companyId = req.params.id;
    if (!companyId) {
      return res.status(400).json({ error: 'ID de empresa inválido' });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        adminUsers: {
          select: { id: true, name: true, email: true, role: true, createdAt: true }
        },
        settings: true,
        departments: {
          select: { id: true, name: true, _count: { select: { employees: true } } }
        },
        shifts: {
          select: { id: true, name: true, startTime: true, endTime: true, isActive: true }
        },
        devices: {
          select: { id: true, name: true, type: true, status: true, ipAddress: true, isActive: true, createdAt: true, lastSeenAt: true }
        },
        _count: {
          select: {
            employees: true,
            devices: true,
            departments: true,
            shifts: true,
            attendances: true,
            adminUsers: true
          }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    // Contar empleados enrolados biométricamente
    const enrolledEmployees = await runWithTenantContext({ companyId: company.id, isSuperAdmin: true }, async () => {
      return prisma.employee.count({
        where: {
          companyId: company.id,
          faceDescriptor: { not: null }
        }
      });
    });

    res.json({
      ...company,
      _count: {
        ...company._count,
        enrolledEmployees
      }
    });
  } catch (error) {
    console.error('Error al obtener empresa:', error);
    res.status(500).json({ error: 'Error al obtener empresa' });
  }
});

/**
 * POST /api/v1/companies
 * Alta manual de una nueva empresa cliente por el Super Admin (Onboarding B2B)
 */
router.post('/', async (req, res) => {
  const {
    name,
    slug,
    plan = 'STARTER',
    maxEmployees,
    maxDevices,
    timezone = 'America/Mexico_City',
    customDomain,
    adminName,
    adminEmail,
    adminPassword
  } = req.body;

  // 1. Validaciones básicas de campos
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'El nombre de la empresa es obligatorio (mínimo 2 caracteres).' });
  }

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'El slug identificador es obligatorio.' });
  }

  const normalizedSlug = slug.trim().toLowerCase();
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(normalizedSlug) || normalizedSlug.length < 2 || normalizedSlug.length > 50) {
    return res.status(400).json({
      error: 'El slug debe contener únicamente letras minúsculas, números y guiones (ej. "empresa-acme").'
    });
  }

  const normalizedPlan = (plan || 'STARTER').toUpperCase();
  if (!['STARTER', 'PRO', 'ENTERPRISE'].includes(normalizedPlan)) {
    return res.status(400).json({ error: 'Plan inválido. Opciones permitidas: STARTER, PRO, ENTERPRISE.' });
  }

  if (!adminName || typeof adminName !== 'string' || adminName.trim().length < 2) {
    return res.status(400).json({ error: 'El nombre del administrador inicial es obligatorio.' });
  }

  if (!adminEmail || typeof adminEmail !== 'string') {
    return res.status(400).json({ error: 'El correo del administrador es obligatorio.' });
  }

  const normalizedEmail = adminEmail.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ error: 'El correo del administrador no tiene un formato válido.' });
  }

  if (!adminPassword || typeof adminPassword !== 'string' || adminPassword.length < 6) {
    return res.status(400).json({ error: 'La contraseña inicial debe tener al menos 6 caracteres.' });
  }

  // 2. Resolver cuotas según plan si no se especificaron
  const defaults = PLAN_DEFAULTS[normalizedPlan] || PLAN_DEFAULTS.STARTER;
  const parsedMaxEmployees = Number.isInteger(Number(maxEmployees)) && Number(maxEmployees) > 0
    ? Number(maxEmployees)
    : defaults.maxEmployees;
  const parsedMaxDevices = Number.isInteger(Number(maxDevices)) && Number(maxDevices) > 0
    ? Number(maxDevices)
    : defaults.maxDevices;

  let createdCompany = null;

  try {
    // 3. Validar unicidad previa de slug y correo de administrador
    const existingSlug = await prisma.company.findUnique({
      where: { slug: normalizedSlug }
    });
    if (existingSlug) {
      return res.status(409).json({
        error: 'SLUG_ALREADY_EXISTS',
        message: `Ya existe una empresa con el identificador "${normalizedSlug}". Elige otro identificador.`
      });
    }

    const existingAdmin = await findAdminByEmailForLogin(normalizedEmail);
    if (existingAdmin) {
      return res.status(409).json({
        error: 'EMAIL_ALREADY_EXISTS',
        message: `El correo "${normalizedEmail}" ya está registrado en el sistema.`
      });
    }

    if (customDomain) {
      const existingDomain = await prisma.company.findUnique({
        where: { customDomain: customDomain.trim().toLowerCase() }
      });
      if (existingDomain) {
        return res.status(409).json({
          error: 'DOMAIN_ALREADY_EXISTS',
          message: `El dominio personalizado "${customDomain}" ya está asociado a otra empresa.`
        });
      }
    }

    // 4. Crear registro Company
    createdCompany = await prisma.company.create({
      data: {
        name: name.trim(),
        slug: normalizedSlug,
        plan: normalizedPlan,
        maxEmployees: parsedMaxEmployees,
        maxDevices: parsedMaxDevices,
        timezone: timezone || 'America/Mexico_City',
        customDomain: customDomain ? customDomain.trim().toLowerCase() : null,
        isActive: true
      }
    });

    // 5. Configurar SystemSettings y primer AdminUser dentro del contexto de la nueva empresa
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const result = await runWithTenantContext({ companyId: createdCompany.id, isSuperAdmin: true }, async () => {
      // 5.1 SystemSettings iniciales
      const settings = await prisma.systemSettings.create({
        data: {
          companyId: createdCompany.id,
          companyName: createdCompany.name,
          timezone: createdCompany.timezone
        }
      });

      // 5.2 Usuario Administrador de la empresa (sin ficha de empleado, syncEmployee: false)
      const adminUser = await prisma.adminUser.create({
        data: {
          companyId: createdCompany.id,
          name: adminName.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          role: 'ADMIN',
          createdBy: req.user.id
        }
      });

      // 5.3 Auditoría de alta de empresa
      await prisma.adminAuditLog.create({
        data: {
          action: 'CREATE_COMPANY',
          performedById: req.user.id,
          performedByName: req.user.name || req.user.email || 'Super Admin',
          targetName: createdCompany.name,
          targetEmail: adminUser.email,
          companyId: createdCompany.id
        }
      });

      return { settings, adminUser };
    });

    return res.status(201).json({
      success: true,
      message: `Empresa "${createdCompany.name}" dada de alta exitosamente.`,
      company: createdCompany,
      admin: {
        id: result.adminUser.id,
        name: result.adminUser.name,
        email: result.adminUser.email,
        role: result.adminUser.role
      }
    });

  } catch (error) {
    console.error('Error al crear empresa:', error);

    // Rollback de seguridad si la empresa se creó pero fallaron las entidades hijas
    if (createdCompany?.id) {
      try {
        await runWithTenantContext({ companyId: createdCompany.id, isSuperAdmin: true }, async () => {
          await prisma.systemSettings.deleteMany({ where: { companyId: createdCompany.id } });
          await prisma.adminUser.deleteMany({ where: { companyId: createdCompany.id } });
          await prisma.adminAuditLog.deleteMany({ where: { companyId: createdCompany.id } });
        });
        await prisma.company.delete({ where: { id: createdCompany.id } });
      } catch (rollbackErr) {
        console.error('Error en rollback de empresa:', rollbackErr);
      }
    }

    return res.status(500).json({
      error: 'Error interno al dar de alta la empresa',
      message: error.message
    });
  }
});

/**
 * PATCH /api/v1/companies/:id
 * Actualizar datos de empresa, plan y cuotas (Super Admin)
 */
router.patch('/:id', async (req, res) => {
  try {
    const companyId = req.params.id;
    const { name, plan, maxEmployees, maxDevices, timezone, customDomain } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'ID de empresa inválido' });
    }

    const currentCompany = await prisma.company.findUnique({
      where: { id: companyId }
    });
    if (!currentCompany) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    const dataToUpdate = {};
    if (name && typeof name === 'string' && name.trim().length >= 2) {
      dataToUpdate.name = name.trim();
    }
    if (plan && ['STARTER', 'PRO', 'ENTERPRISE'].includes(plan.toUpperCase())) {
      dataToUpdate.plan = plan.toUpperCase();
    }
    if (maxEmployees !== undefined && Number.isInteger(Number(maxEmployees)) && Number(maxEmployees) > 0) {
      dataToUpdate.maxEmployees = Number(maxEmployees);
    }
    if (maxDevices !== undefined && Number.isInteger(Number(maxDevices)) && Number(maxDevices) > 0) {
      dataToUpdate.maxDevices = Number(maxDevices);
    }
    if (timezone && typeof timezone === 'string') {
      dataToUpdate.timezone = timezone.trim();
    }
    if (customDomain !== undefined) {
      dataToUpdate.customDomain = customDomain ? customDomain.trim().toLowerCase() : null;
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: dataToUpdate
    });

    // Auditoría
    await runWithTenantContext({ companyId: updated.id, isSuperAdmin: true }, async () => {
      await prisma.adminAuditLog.create({
        data: {
          action: 'UPDATE_COMPANY_DETAILS',
          performedById: req.user.id,
          performedByName: req.user.name || req.user.email || 'Super Admin',
          targetName: updated.name,
          targetEmail: req.user.email || 'superadmin@system.local',
          companyId: updated.id
        }
      });
    });

    res.json({
      success: true,
      message: 'Empresa actualizada exitosamente',
      company: updated
    });
  } catch (error) {
    console.error('Error al actualizar empresa:', error);
    res.status(500).json({ error: 'Error al actualizar empresa' });
  }
});

/**
 * PATCH /api/v1/companies/:id/status
 * Activar o suspender una empresa.
 * Si se suspende (isActive: false), desconecta forzosamente todos los sockets
 * de dicha empresa en tiempo real invocando disconnectCompanySockets.
 * Registra día, fecha, hora exacta y administrador que ejecutó la suspensión.
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

    const currentCompany = await prisma.company.findUnique({
      where: { id: companyId }
    });
    if (!currentCompany) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    const adminIdentity = req.user.name 
      ? `${req.user.name} (${req.user.email})` 
      : (req.user.email || 'Super Admin');

    const updateData = {
      isActive
    };

    if (!isActive) {
      updateData.suspendedAt = new Date();
      updateData.suspensionReason = reason && typeof reason === 'string' && reason.trim()
        ? reason.trim()
        : 'Empresa suspendida por Super Admin';
      updateData.suspendedById = req.user.id;
      updateData.suspendedByName = adminIdentity;
    } else {
      // Al reactivar, limpiamos los datos de suspensión activa
      updateData.suspendedAt = null;
      updateData.suspensionReason = null;
      updateData.suspendedById = null;
      updateData.suspendedByName = null;
    }

    const company = await prisma.company.update({
      where: { id: companyId },
      data: updateData
    });

    // Auditoría de acción de Super Admin en AdminAuditLog
    await runWithTenantContext({ companyId: company.id, isSuperAdmin: true }, async () => {
      await prisma.adminAuditLog.create({
        data: {
          action: isActive ? 'REACTIVATE_COMPANY' : 'SUSPEND_COMPANY',
          performedById: req.user.id,
          performedByName: adminIdentity,
          targetName: company.name,
          targetEmail: req.user.email || 'superadmin@system.local',
          companyId: company.id
        }
      });
    });

    // Si se suspende la empresa, forzar desconexión de todos sus sockets
    if (!isActive) {
      const appModule = require('../../app');
      if (typeof appModule.disconnectCompanySockets === 'function') {
        appModule.disconnectCompanySockets(companyId, updateData.suspensionReason || 'COMPANY_SUSPENDED');
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

/**
 * POST /api/v1/companies/:id/reset-admin-password
 * Restablecer o regenerar contraseña del administrador de la empresa (Super Admin)
 */
router.post('/:id/reset-admin-password', async (req, res) => {
  try {
    const companyId = req.params.id;
    const { newPassword } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'ID de empresa inválido' });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        adminUsers: {
          where: { role: 'ADMIN' },
          orderBy: { createdAt: 'asc' },
          take: 1
        }
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    const admin = company.adminUsers[0];
    if (!admin) {
      return res.status(404).json({ error: 'La empresa no cuenta con un usuario Administrador registrado.' });
    }

    // Generar contraseña aleatoria si no fue provista
    let finalPassword = newPassword;
    if (!finalPassword || typeof finalPassword !== 'string' || finalPassword.length < 6) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
      finalPassword = '';
      for (let i = 0; i < 12; i++) {
        finalPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }

    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    await runWithTenantContext({ companyId: company.id, isSuperAdmin: true }, async () => {
      await prisma.adminUser.update({
        where: {
          id_companyId: {
            id: admin.id,
            companyId: company.id
          }
        },
        data: {
          password: hashedPassword
        }
      });

      await prisma.adminAuditLog.create({
        data: {
          action: 'RESET_ADMIN_PASSWORD',
          performedById: req.user.id,
          performedByName: req.user.name || req.user.email || 'Super Admin',
          targetName: company.name,
          targetEmail: admin.email,
          companyId: company.id
        }
      });
    });

    res.json({
      success: true,
      message: `Contraseña del administrador "${admin.email}" restablecida exitosamente.`,
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        plan: company.plan,
        maxEmployees: company.maxEmployees,
        maxDevices: company.maxDevices
      },
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email
      },
      newPassword: finalPassword
    });
  } catch (error) {
    console.error('Error al restablecer contraseña de administrador:', error);
    res.status(500).json({ error: 'Error al restablecer contraseña', message: error.message });
  }
});

/**
 * DELETE /api/v1/companies/:id
 * Dar de baja por completo a una empresa cliente (Derecho ARCO y Purga de Datos)
 */
router.delete('/:id', async (req, res) => {
  try {
    const companyId = req.params.id;

    if (!companyId) {
      return res.status(400).json({ error: 'ID de empresa inválido' });
    }

    // Regla de salvaguarda: No permitir eliminar la empresa matriz principal
    if (companyId === 'default-company-pain' || companyId === req.user.companyId) {
      return res.status(400).json({
        error: 'CANNOT_DELETE_PRIMARY_COMPANY',
        message: 'No está permitido eliminar la empresa principal o la empresa del usuario actual en sesión.'
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    // 1. Desconectar sockets y kioskos en tiempo real
    const appModule = require('../../app');
    if (typeof appModule.disconnectCompanySockets === 'function') {
      appModule.disconnectCompanySockets(companyId, 'COMPANY_PURGED');
    }

    // 2. Cascada de eliminación limpia en orden de integridad referencial
    await runWithTenantContext({ companyId: company.id, isSuperAdmin: true }, async () => {
      // 2.1 Eventos y Asistencias
      await prisma.eventRequest.deleteMany({ where: { companyId } });
      await prisma.attendanceRecord.deleteMany({ where: { companyId } });

      // 2.2 Turnos y Asignaciones
      await prisma.employeeShift.deleteMany({ where: { companyId } });
      await prisma.departmentShift.deleteMany({ where: { companyId } });
      await prisma.shift.deleteMany({ where: { companyId } });

      // 2.3 Empleados y Departamentos
      await prisma.employee.deleteMany({ where: { companyId } });
      await prisma.department.deleteMany({ where: { companyId } });

      // 2.4 Kioskos y Solicitudes de Emparejamiento
      await prisma.deviceAuthRequest.deleteMany({ where: { companyId } });
      await prisma.device.deleteMany({ where: { companyId } });

      // 2.5 Notificaciones, Auditorías, Usuarios Administradores y Settings
      await prisma.notification.deleteMany({ where: { companyId } });
      await prisma.adminAuditLog.deleteMany({ where: { companyId } });
      await prisma.adminUser.deleteMany({ where: { companyId } });
      await prisma.systemSettings.deleteMany({ where: { companyId } });
    });

    // 2.6 Registro principal de la Empresa
    await prisma.company.delete({
      where: { id: companyId }
    });

    res.json({
      success: true,
      message: `Empresa "${company.name}" (${company.slug}) y la totalidad de sus datos fueron eliminados de forma definitiva.`
    });
  } catch (error) {
    console.error('Error al dar de baja empresa:', error);
    res.status(500).json({ error: 'Error al dar de baja la empresa', message: error.message });
  }
});

module.exports = router;
