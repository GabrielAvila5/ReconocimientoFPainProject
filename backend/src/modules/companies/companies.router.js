const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { requireAuth, requireSuperAdmin } = require('../auth/auth.middleware');
const prisma = require('../../utils/prisma');
const { runWithTenantContext } = require('../../middlewares/tenantContext');
const { findAdminByEmailForLogin } = require('../../utils/authHelpers');
const { calculateNextBillingDate } = require('../../utils/dbMigrations');

// Exclusivo para Super Admin (Regla Zero-Trust: requiere SUPER_ADMIN y DEFAULT_PLATFORM_COMPANY_ID)
router.use(requireAuth);
router.use(requireSuperAdmin);

const PLAN_DEFAULTS = {
  STARTER: { maxEmployees: 50, maxDevices: 3, maxBranches: 1 },
  PRO: { maxEmployees: 200, maxDevices: 10, maxBranches: 1 },
  ENTERPRISE: { maxEmployees: 1000, maxDevices: 50, maxBranches: 1 },
  CUSTOM: { maxEmployees: 1000, maxDevices: 50, maxBranches: 150 }
};

/**
 * Evalúa empresas suspendidas temporalmente, verifica si su plazo de gracia ha expirado,
 * dispara alertas de alta prioridad (Notificaciones + WebSockets) y marca deletionAlertSent = true.
 */
async function checkAndTriggerSuspensionAlerts() {
  try {
    const now = new Date();
    const expiredCompanies = await prisma.company.findMany({
      where: {
        isActive: false,
        suspensionExpiresAt: {
          lte: now
        },
        deletionAlertSent: false
      }
    });

    if (!expiredCompanies.length) return [];

    const appModule = require('../../app');
    for (const comp of expiredCompanies) {
      await prisma.company.update({
        where: { id: comp.id },
        data: {
          deletionAlertSent: true,
          deletionAlertAt: now
        }
      });

      // Crear notificación de alta prioridad en Notification
      try {
        await runWithTenantContext({ companyId: comp.id, isSuperAdmin: true }, async () => {
          await prisma.notification.create({
            data: {
              companyId: comp.id,
              title: `[PRIORIDAD ALTA] Plazo de gracia vencido (${comp.name})`,
              message: `El plazo de baja temporal de ${comp.suspensionGraceDays || 30} días por falta de pago ha concluido. Requiere acción manual del administrador para baja definitiva bajo protocolo ARCO.`,
              type: 'ERROR',
              category: 'security',
              entityId: comp.id
            }
          });
        });
      } catch (notifErr) {
        console.warn('Advertencia al registrar Notification para alerta de baja:', notifErr.message);
      }

      // Emitir alerta en tiempo real a administradores
      if (appModule.io) {
        appModule.io.emit('high_priority_suspension_alert', {
          companyId: comp.id,
          companyName: comp.name,
          slug: comp.slug,
          graceDays: comp.suspensionGraceDays,
          suspendedAt: comp.suspendedAt,
          expiredAt: comp.suspensionExpiresAt,
          message: `El plazo de gracia para "${comp.name}" ha concluido. Requiere baja definitiva manual.`
        });
      }
    }
    return expiredCompanies;
  } catch (err) {
    console.error('Error al evaluar alertas de suspensión:', err);
    return [];
  }
}

/**
 * GET /api/v1/companies
 * Listar todas las empresas registradas (Super Admin) con métricas enriquecidas
 */
router.get('/', async (req, res) => {
  try {
    // Evaluar y disparar alertas de alta prioridad si hay plazos vencidos
    await checkAndTriggerSuspensionAlerts();

    const companies = await prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        parentCompany: {
          select: { id: true, name: true, slug: true }
        },
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
            adminUsers: true,
            branches: true
          }
        }
      }
    });

    const now = new Date();

    // Enriquecer con conteo de empleados con enrolamiento biométrico y estado del timer de gracia
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

        const isGraceExpired = !comp.isActive && comp.suspensionExpiresAt && new Date(comp.suspensionExpiresAt) <= now;
        const msRemaining = !comp.isActive && comp.suspensionExpiresAt 
          ? (new Date(comp.suspensionExpiresAt).getTime() - now.getTime()) 
          : null;
        const daysRemaining = msRemaining !== null 
          ? Math.ceil(msRemaining / (1000 * 60 * 60 * 24)) 
          : null;

        const isExempt = Boolean(
          comp.isExempt || 
          comp.id === 'default-company-pain' || 
          comp.slug === 'pain' || 
          (comp.billingCycle || '').toUpperCase() === 'EXENTO'
        );

        const billingNoticeDays = comp.billingNoticeDays || 15;
        let diffDaysBilling = null;
        let isBillingDueSoon = false;
        let isBillingPastDue = false;
        let nextBilling = null;

        if (!isExempt) {
          const billingCycle = comp.billingCycle || 'MENSUAL';
          nextBilling = comp.nextBillingDate 
            ? new Date(comp.nextBillingDate) 
            : calculateNextBillingDate(comp.createdAt, billingCycle);
          
          diffDaysBilling = Math.ceil((nextBilling.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          isBillingDueSoon = diffDaysBilling <= billingNoticeDays && diffDaysBilling >= 0;
          isBillingPastDue = diffDaysBilling < 0;
        }

        const billingEmail = comp.billingEmail || comp.adminUsers?.[0]?.email || null;
        const billingPhone = comp.billingPhone || null;
        const billingContactName = comp.billingContactName || null;
        const lastReminderSentAt = comp.lastReminderSentAt || null;

        return {
          ...comp,
          isExempt,
          billingCycle: isExempt ? 'EXENTO' : (comp.billingCycle || 'MENSUAL'),
          nextBillingDate: isExempt ? null : nextBilling,
          licenseStartDate: comp.licenseStartDate || comp.createdAt,
          billingEmail,
          billingPhone,
          billingContactName,
          billingNoticeDays,
          lastReminderSentAt,
          diffDaysBilling,
          isBillingDueSoon,
          isBillingPastDue,
          isGraceExpired: !!isGraceExpired,
          daysRemaining,
          msRemaining,
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
 * GET /api/v1/companies/upcoming-payments
 * Listado consolidado de cobranza, licencias por vencer y métricas de ingresos proyectados (Super Admin)
 */
router.get('/upcoming-payments', async (req, res) => {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        adminUsers: {
          select: { id: true, name: true, email: true, role: true },
          take: 2
        },
        _count: {
          select: { employees: true, devices: true }
        }
      }
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);

    const PRICING_ESTIMATES = {
      STARTER: 990,
      PRO: 2490,
      ENTERPRISE: 5990,
      CUSTOM: 9990
    };

    let totalProjectedMonthly = 0;
    let countPastDue = 0;
    let countDueSoon = 0;
    let countCurrent = 0;
    let countExempt = 0;

    const list = companies.map(comp => {
      const isExempt = Boolean(
        comp.isExempt || 
        comp.id === 'default-company-pain' || 
        comp.slug === 'pain' || 
        (comp.billingCycle || '').toUpperCase() === 'EXENTO'
      );

      const billingNoticeDays = comp.billingNoticeDays || 15;
      const billingEmail = comp.billingEmail || comp.adminUsers?.[0]?.email || null;
      const billingPhone = comp.billingPhone || null;
      const billingContactName = comp.billingContactName || comp.adminUsers?.[0]?.name || null;
      const lastReminderSentAt = comp.lastReminderSentAt || null;

      let diffDays = null;
      let status = 'current'; // 'expired' | 'due_today' | 'due_soon' | 'current' | 'exempt'
      let nextBilling = null;
      let monthlyEstimate = 0;

      if (isExempt) {
        status = 'exempt';
        countExempt++;
      } else {
        const billingCycle = comp.billingCycle || 'MENSUAL';
        nextBilling = comp.nextBillingDate 
          ? new Date(comp.nextBillingDate) 
          : calculateNextBillingDate(comp.createdAt, billingCycle);

        const target = new Date(nextBilling.getFullYear(), nextBilling.getMonth(), nextBilling.getDate(), 12, 0, 0);
        diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        const basePrice = comp.customPrice !== null && comp.customPrice !== undefined 
          ? Number(comp.customPrice) 
          : (PRICING_ESTIMATES[comp.plan] || 990);

        if (billingCycle === 'ANUAL') monthlyEstimate = Math.round(basePrice / 12);
        else if (billingCycle === 'SEMESTRAL') monthlyEstimate = Math.round(basePrice / 6);
        else if (billingCycle === 'TRIMESTRAL') monthlyEstimate = Math.round(basePrice / 3);
        else monthlyEstimate = basePrice;

        totalProjectedMonthly += monthlyEstimate;

        if (diffDays < 0) {
          status = 'expired';
          countPastDue++;
        } else if (diffDays === 0) {
          status = 'due_today';
          countDueSoon++;
        } else if (diffDays <= billingNoticeDays) {
          status = 'due_soon';
          countDueSoon++;
        } else {
          status = 'current';
          countCurrent++;
        }
      }

      return {
        id: comp.id,
        name: comp.name,
        slug: comp.slug,
        plan: comp.plan,
        isActive: comp.isActive,
        isExempt,
        billingCycle: isExempt ? 'EXENTO' : (comp.billingCycle || 'MENSUAL'),
        licenseStartDate: comp.licenseStartDate || comp.createdAt,
        nextBillingDate: isExempt ? null : nextBilling,
        billingEmail,
        billingPhone,
        billingContactName,
        billingNoticeDays,
        lastReminderSentAt,
        diffDays,
        status,
        monthlyEstimate,
        customPrice: comp.customPrice,
        employeesCount: comp._count?.employees || 0,
        devicesCount: comp._count?.devices || 0
      };
    });

    res.json({
      summary: {
        total: companies.length,
        pastDue: countPastDue,
        dueSoon: countDueSoon,
        current: countCurrent,
        exempt: countExempt,
        totalProjectedMonthly
      },
      companies: list
    });
  } catch (error) {
    console.error('Error al obtener próximos pagos:', error);
    res.status(500).json({ error: 'Error al consultar próximos pagos y cobranza' });
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
        parentCompany: {
          select: { id: true, name: true, slug: true }
        },
        branches: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            timezone: true,
            createdAt: true,
            maxEmployees: true,
            maxDevices: true,
            adminUsers: {
              select: { id: true, name: true, email: true, role: true },
              take: 2
            },
            _count: { select: { employees: true, devices: true, departments: true, shifts: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            employees: true,
            devices: true,
            departments: true,
            shifts: true,
            attendances: true,
            adminUsers: true,
            branches: true
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

    const now = new Date();
    const isGraceExpired = !company.isActive && company.suspensionExpiresAt && new Date(company.suspensionExpiresAt) <= now;
    const msRemaining = !company.isActive && company.suspensionExpiresAt 
      ? (new Date(company.suspensionExpiresAt).getTime() - now.getTime()) 
      : null;
    const daysRemaining = msRemaining !== null 
      ? Math.ceil(msRemaining / (1000 * 60 * 60 * 24)) 
      : null;

    const isExempt = Boolean(
      company.isExempt || 
      company.id === 'default-company-pain' || 
      company.slug === 'pain' || 
      (company.billingCycle || '').toUpperCase() === 'EXENTO'
    );

    const billingNoticeDays = company.billingNoticeDays || 15;
    let diffDaysBilling = null;
    let isBillingDueSoon = false;
    let isBillingPastDue = false;
    let nextBilling = null;

    if (!isExempt) {
      const billingCycle = company.billingCycle || 'MENSUAL';
      nextBilling = company.nextBillingDate 
        ? new Date(company.nextBillingDate) 
        : calculateNextBillingDate(company.createdAt, billingCycle);
      
      diffDaysBilling = Math.ceil((nextBilling.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      isBillingDueSoon = diffDaysBilling <= billingNoticeDays && diffDaysBilling >= 0;
      isBillingPastDue = diffDaysBilling < 0;
    }

    const billingEmail = company.billingEmail || company.adminUsers?.[0]?.email || null;
    const billingPhone = company.billingPhone || null;
    const billingContactName = company.billingContactName || null;
    const lastReminderSentAt = company.lastReminderSentAt || null;

    res.json({
      ...company,
      isExempt,
      billingCycle: isExempt ? 'EXENTO' : (company.billingCycle || 'MENSUAL'),
      nextBillingDate: isExempt ? null : nextBilling,
      licenseStartDate: company.licenseStartDate || company.createdAt,
      billingEmail,
      billingPhone,
      billingContactName,
      billingNoticeDays,
      lastReminderSentAt,
      diffDaysBilling,
      isBillingDueSoon,
      isBillingPastDue,
      isGraceExpired: !!isGraceExpired,
      daysRemaining,
      msRemaining,
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
    maxBranches,
    isHolding,
    customPrice,
    timezone = 'America/Mexico_City',
    customDomain,
    billingCycle = 'MENSUAL',
    licenseStartDate,
    nextBillingDate,
    isExempt = false,
    billingEmail,
    billingPhone,
    billingContactName,
    billingNoticeDays = 15,
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
  if (!['STARTER', 'PRO', 'ENTERPRISE', 'CUSTOM'].includes(normalizedPlan)) {
    return res.status(400).json({ error: 'Plan inválido. Opciones permitidas: STARTER, PRO, ENTERPRISE, CUSTOM.' });
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
  const parsedMaxBranches = Number.isInteger(Number(maxBranches)) && Number(maxBranches) > 0
    ? Number(maxBranches)
    : (defaults.maxBranches || 1);
  const parsedIsHolding = typeof isHolding === 'boolean'
    ? isHolding
    : (normalizedPlan === 'CUSTOM');
  const parsedCustomPrice = customPrice !== undefined && customPrice !== null && !isNaN(Number(customPrice))
    ? Number(customPrice)
    : null;

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

    const isExemptCompany = Boolean(isExempt);
    const normalizedBillingCycle = isExemptCompany
      ? 'EXENTO'
      : (['MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'].includes(String(billingCycle || '').toUpperCase())
        ? String(billingCycle).toUpperCase()
        : 'MENSUAL');

    const computedStartDate = licenseStartDate ? new Date(licenseStartDate) : new Date();
    const computedNextBilling = isExemptCompany 
      ? null 
      : (nextBillingDate 
          ? new Date(nextBillingDate) 
          : calculateNextBillingDate(computedStartDate, normalizedBillingCycle));

    const parsedNoticeDays = Number.isInteger(Number(billingNoticeDays)) && Number(billingNoticeDays) > 0 
      ? Number(billingNoticeDays) 
      : 15;

    // 4. Crear registro Company
    createdCompany = await prisma.company.create({
      data: {
        name: name.trim(),
        slug: normalizedSlug,
        plan: normalizedPlan,
        maxEmployees: parsedMaxEmployees,
        maxDevices: parsedMaxDevices,
        maxBranches: parsedMaxBranches,
        isHolding: parsedIsHolding,
        customPrice: parsedCustomPrice,
        timezone: timezone || 'America/Mexico_City',
        customDomain: customDomain ? customDomain.trim().toLowerCase() : null,
        isExempt: isExemptCompany,
        billingCycle: normalizedBillingCycle,
        licenseStartDate: computedStartDate,
        nextBillingDate: computedNextBilling,
        billingEmail: billingEmail && typeof billingEmail === 'string' ? billingEmail.trim().toLowerCase() : null,
        billingPhone: billingPhone && typeof billingPhone === 'string' ? billingPhone.trim() : null,
        billingContactName: billingContactName && typeof billingContactName === 'string' ? billingContactName.trim() : null,
        billingNoticeDays: parsedNoticeDays,
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

      // 5.2 Usuario Administrador de la empresa (si es Holding, CORPORATE_ADMIN; si es estándar, ADMIN)
      const initialAdminRole = (createdCompany.isHolding || normalizedPlan === 'CUSTOM') ? 'CORPORATE_ADMIN' : 'ADMIN';
      const adminUser = await prisma.adminUser.create({
        data: {
          companyId: createdCompany.id,
          name: adminName.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          role: initialAdminRole,
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
    const { 
      name, 
      plan, 
      maxEmployees, 
      maxDevices, 
      maxBranches, 
      isHolding, 
      customPrice, 
      timezone, 
      customDomain, 
      billingCycle, 
      nextBillingDate, 
      licenseStartDate,
      isExempt,
      billingEmail,
      billingPhone,
      billingContactName,
      billingNoticeDays
    } = req.body;

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
    if (plan && ['STARTER', 'PRO', 'ENTERPRISE', 'CUSTOM'].includes(plan.toUpperCase())) {
      dataToUpdate.plan = plan.toUpperCase();
    }
    if (maxEmployees !== undefined && Number.isInteger(Number(maxEmployees)) && Number(maxEmployees) > 0) {
      dataToUpdate.maxEmployees = Number(maxEmployees);
    }
    if (maxDevices !== undefined && Number.isInteger(Number(maxDevices)) && Number(maxDevices) > 0) {
      dataToUpdate.maxDevices = Number(maxDevices);
    }
    if (maxBranches !== undefined && Number.isInteger(Number(maxBranches)) && Number(maxBranches) > 0) {
      dataToUpdate.maxBranches = Number(maxBranches);
    }
    if (typeof isHolding === 'boolean') {
      dataToUpdate.isHolding = isHolding;
    }
    if (customPrice !== undefined) {
      const parsedPrice = (customPrice === null || customPrice === '' || isNaN(Number(customPrice))) ? null : Number(customPrice);
      dataToUpdate.customPrice = (plan === 'CUSTOM' || currentCompany.plan === 'CUSTOM') ? parsedPrice : null;
    }
    if (timezone && typeof timezone === 'string') {
      dataToUpdate.timezone = timezone.trim();
    }
    if (customDomain !== undefined) {
      dataToUpdate.customDomain = customDomain ? customDomain.trim().toLowerCase() : null;
    }

    // Manejo de exención de pago
    if (typeof isExempt === 'boolean') {
      dataToUpdate.isExempt = isExempt;
      if (isExempt) {
        dataToUpdate.billingCycle = 'EXENTO';
        dataToUpdate.nextBillingDate = null;
      }
    }

    // Si no está exenta (o se desactivó la exención)
    if (!dataToUpdate.isExempt && currentCompany.isExempt !== true) {
      if (billingCycle && ['MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'].includes(billingCycle.toUpperCase())) {
        dataToUpdate.billingCycle = billingCycle.toUpperCase();
        if (!nextBillingDate && currentCompany.billingCycle !== billingCycle.toUpperCase()) {
          dataToUpdate.nextBillingDate = calculateNextBillingDate(currentCompany.nextBillingDate || currentCompany.createdAt, billingCycle.toUpperCase());
        }
      }
      if (nextBillingDate !== undefined) {
        if (!nextBillingDate) {
          dataToUpdate.nextBillingDate = null;
        } else {
          const d = new Date(nextBillingDate);
          dataToUpdate.nextBillingDate = isNaN(d.getTime()) ? null : d;
        }
      }
    } else if (dataToUpdate.isExempt === false && currentCompany.isExempt === true) {
      // Pasó de exenta a con cobro
      const cycle = billingCycle || 'MENSUAL';
      dataToUpdate.billingCycle = cycle;
      dataToUpdate.nextBillingDate = nextBillingDate ? new Date(nextBillingDate) : calculateNextBillingDate(new Date(), cycle);
    }

    if (billingEmail !== undefined) {
      dataToUpdate.billingEmail = billingEmail && typeof billingEmail === 'string' ? billingEmail.trim().toLowerCase() : null;
    }
    if (billingPhone !== undefined) {
      dataToUpdate.billingPhone = billingPhone && typeof billingPhone === 'string' ? billingPhone.trim() : null;
    }
    if (billingContactName !== undefined) {
      dataToUpdate.billingContactName = billingContactName && typeof billingContactName === 'string' ? billingContactName.trim() : null;
    }
    if (billingNoticeDays !== undefined) {
      const parsedDays = Number(billingNoticeDays);
      dataToUpdate.billingNoticeDays = Number.isInteger(parsedDays) && parsedDays > 0 ? parsedDays : 15;
    }

    if (licenseStartDate !== undefined) {
      if (!licenseStartDate) {
        dataToUpdate.licenseStartDate = null;
      } else {
        const d = new Date(licenseStartDate);
        dataToUpdate.licenseStartDate = isNaN(d.getTime()) ? null : d;
      }
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
    res.status(500).json({ error: error.message || 'Error al actualizar empresa' });
  }
});

/**
 * POST /api/v1/companies/:id/renew-license
 * Registra el pago y renovación de licencia de la empresa, extendiendo nextBillingDate un ciclo completo.
 */
router.post('/:id/renew-license', async (req, res) => {
  try {
    const companyId = req.params.id;
    const { customNextBillingDate, notes } = req.body || {};

    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    const isExempt = Boolean(
      company.isExempt || 
      company.id === 'default-company-pain' || 
      company.slug === 'pain' || 
      (company.billingCycle || '').toUpperCase() === 'EXENTO'
    );

    if (isExempt) {
      return res.status(400).json({ error: 'Esta empresa cuenta con licencia exenta/propietaria y no requiere renovación de pago.' });
    }

    const billingCycle = company.billingCycle || 'MENSUAL';
    const baseDate = (company.nextBillingDate && new Date(company.nextBillingDate) > new Date())
      ? new Date(company.nextBillingDate)
      : new Date();

    const newNextBillingDate = customNextBillingDate 
      ? new Date(customNextBillingDate)
      : calculateNextBillingDate(baseDate, billingCycle);

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        nextBillingDate: newNextBillingDate,
        isActive: true // Al renovar licencia, si estaba suspendida por impago, se reactiva
      }
    });

    // Auditoría
    await runWithTenantContext({ companyId: updated.id, isSuperAdmin: true }, async () => {
      await prisma.adminAuditLog.create({
        data: {
          action: 'RENEW_LICENSE',
          performedById: req.user.id,
          performedByName: req.user.name || req.user.email || 'Super Admin',
          targetName: updated.name,
          targetEmail: `${billingCycle} renovado hasta ${newNextBillingDate.toISOString().slice(0, 10)}${notes ? ` - ${notes}` : ''}`,
          companyId: updated.id
        }
      });
    });

    res.json({
      success: true,
      message: `Licencia de "${updated.name}" renovada con éxito (${billingCycle}) hasta el ${newNextBillingDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      company: updated
    });
  } catch (error) {
    console.error('Error al renovar licencia:', error);
    res.status(500).json({ error: 'Error interno al renovar licencia' });
  }
});

/**
 * POST /api/v1/companies/:id/send-payment-reminder
 * Dispara un recordatorio de cobranza formal:
 * 1. Genera Notification in-app de alta prioridad en el tenant del cliente
 * 2. Actualiza lastReminderSentAt en la base de datos
 * 3. Registra en AdminAuditLog
 * 4. Prepara plantilla de correo (subject, bodyMessage, mailtoUrl) y enlace a WhatsApp si cuenta con teléfono
 */
router.post('/:id/send-payment-reminder', async (req, res) => {
  try {
    const companyId = req.params.id;
    const { customSubject, customMessage, bankAccountInfo } = req.body || {};

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        adminUsers: {
          select: { id: true, name: true, email: true, role: true },
          take: 2
        }
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    const isExempt = Boolean(
      company.isExempt || 
      company.id === 'default-company-pain' || 
      company.slug === 'pain' || 
      (company.billingCycle || '').toUpperCase() === 'EXENTO'
    );

    if (isExempt) {
      return res.status(400).json({ error: 'Esta empresa tiene licencia exenta/vitalicia y no genera cobros ni recordatorios.' });
    }

    const now = new Date();
    const billingCycle = company.billingCycle || 'MENSUAL';
    const nextBilling = company.nextBillingDate 
      ? new Date(company.nextBillingDate) 
      : calculateNextBillingDate(company.createdAt, billingCycle);

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    const target = new Date(nextBilling.getFullYear(), nextBilling.getMonth(), nextBilling.getDate(), 12, 0, 0);
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const recipientEmail = company.billingEmail || company.adminUsers?.[0]?.email || '';
    const recipientName = company.billingContactName || company.adminUsers?.[0]?.name || company.name;
    const phone = company.billingPhone || '';

    const formattedDate = nextBilling.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const isExpired = diffDays < 0;
    const isDueToday = diffDays === 0;

    let defaultSubject = '';
    let urgencyBadge = '';
    if (isExpired) {
      defaultSubject = `[URGENTE] Licencia Vencida - Sistema Biométrico PAIN (${company.name})`;
      urgencyBadge = `Vencida hace ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'día' : 'días'}`;
    } else if (isDueToday) {
      defaultSubject = `[PAGO HOY] Aviso de Vencimiento de Licencia - ${company.name}`;
      urgencyBadge = 'Vence Hoy';
    } else {
      defaultSubject = `Aviso de Próximo Pago de Licencia - ${company.name} (${diffDays} días restantes)`;
      urgencyBadge = `Vence en ${diffDays} días`;
    }

    const subject = customSubject?.trim() || defaultSubject;

    const bankDetails = bankAccountInfo || `Datos para Transferencia (SPEI):
Banco: BBVA México
Beneficiario: PAIN Biometría y Sistemas S.A.P.I. de C.V.
CLABE: 012180001234567890
Referencia / Concepto: LIC-${company.slug.toUpperCase()}`;

    const bodyMessage = customMessage?.trim() || (isExpired
      ? `Estimado(a) ${recipientName}:

Le informamos que la licencia de uso del Sistema de Asistencia Facial PAIN para la empresa "${company.name}" (Plan ${company.plan}) ha vencido el pasado ${formattedDate} (${Math.abs(diffDays)} días de mora).

Para mantener la operatividad ininterrumpida de sus kioscos biométricos y evitar la suspensión temporal del servicio, le solicitamos atentamente realizar la liquidación de su cuota ${billingCycle.toLowerCase()}.

${bankDetails}

Una vez realizado su pago, por favor comparta el comprobante respondiendo a este mensaje para aplicar la renovación inmediata.

Atentamente,
Departamento de Cobranza y Licenciamiento
PAIN - Sistema de Control y Asistencia Facial`
      : `Estimado(a) ${recipientName}:

Esperamos que se encuentre muy bien. Le enviamos un cordial recordatorio de que la licencia de uso del Sistema de Asistencia Facial PAIN para la empresa "${company.name}" (Plan ${company.plan} - ${billingCycle}) tiene programado su próximo pago el día:

📅 ${formattedDate} (${diffDays === 0 ? 'HOY' : `en ${diffDays} días`})

Agradecemos programar su pago con anticipación para asegurar la continuidad de su servicio y sincronización biométrica sin interrupciones.

${bankDetails}

Una vez efectuada la transferencia, favor de enviar su comprobante por este medio.

Agradecemos su confianza.
Atentamente,
Departamento de Cobranza y Licenciamiento
PAIN - Sistema de Control y Asistencia Facial`);

    // 1. Guardar notificación interna en la plataforma para los administradores de la empresa
    await runWithTenantContext({ companyId: company.id, isSuperAdmin: true }, async () => {
      await prisma.notification.create({
        data: {
          companyId: company.id,
          title: isExpired ? `[URGENTE] Licencia Vencida (${company.name})` : `Recordatorio de Cuota de Licencia (${company.name})`,
          message: isExpired
            ? `Su licencia venció hace ${Math.abs(diffDays)} días. Favor de regularizar su pago para evitar la suspensión temporal de los kioscos biométricos.`
            : `Su próximo pago de licencia (${billingCycle}) vence el ${formattedDate} (${diffDays === 0 ? 'hoy' : `en ${diffDays} días`}).`,
          type: isExpired ? 'ERROR' : 'WARNING',
          category: 'system',
          entityId: company.id
        }
      });
    });

    // 2. Actualizar fecha de último recordatorio enviado
    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        lastReminderSentAt: now
      }
    });

    // 3. Registrar en Auditoría
    const adminIdentity = req.user.name ? `${req.user.name} (${req.user.email})` : (req.user.email || 'Super Admin');
    await runWithTenantContext({ companyId: company.id, isSuperAdmin: true }, async () => {
      await prisma.adminAuditLog.create({
        data: {
          action: 'SEND_PAYMENT_REMINDER',
          performedById: req.user.id,
          performedByName: adminIdentity,
          targetName: company.name,
          targetEmail: recipientEmail || 'Sin correo',
          companyId: company.id
        }
      });
    });

    // 4. Preparar URLs directas para webmail (Gmail, Outlook) y cliente de correo local
    const gmailUrl = recipientEmail 
      ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyMessage)}`
      : null;

    const outlookUrl = recipientEmail
      ? `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(recipientEmail)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyMessage)}`
      : null;

    const mailtoUrl = recipientEmail 
      ? `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyMessage)}`
      : null;

    let whatsappUrl = null;
    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      if (cleanPhone.length >= 10) {
        whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`${subject}\n\n${bodyMessage}`)}`;
      }
    }

    res.json({
      success: true,
      message: `Recordatorio registrado exitosamente para "${company.name}". Notificación emitida en el sistema.`,
      company: updatedCompany,
      reminder: {
        recipientEmail,
        recipientName,
        phone,
        subject,
        bodyMessage,
        diffDays,
        urgencyBadge,
        nextBillingDate: nextBilling,
        formattedDate,
        sentAt: now,
        gmailUrl,
        outlookUrl,
        mailtoUrl,
        whatsappUrl
      }
    });
  } catch (error) {
    console.error('Error al enviar recordatorio de pago:', error);
    res.status(500).json({ error: error.message || 'Error al enviar recordatorio de pago' });
  }
});

/**
 * PATCH /api/v1/companies/:id/status
 * Activar o suspender una empresa.
 * Si se suspende (isActive: false), desconecta forzosamente todos los sockets
 * de dicha empresa en tiempo real invocando disconnectCompanySockets.
 * Registra día, fecha, hora exacta, administrador que ejecutó la suspensión,
 * y configura el timer de gracia temporal antes de emitir alerta de baja definitiva manual.
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const companyId = req.params.id;
    const { isActive, reason, graceDays, customExpiresAt } = req.body;

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
      const parsedGraceDays = Number.isInteger(Number(graceDays)) && Number(graceDays) > 0 
        ? Number(graceDays) 
        : (currentCompany.suspensionGraceDays || 30);

      let expiresAt = null;
      if (customExpiresAt) {
        const d = new Date(customExpiresAt);
        if (!isNaN(d.getTime())) {
          expiresAt = d;
        }
      }
      if (!expiresAt) {
        expiresAt = new Date(Date.now() + (parsedGraceDays * 24 * 60 * 60 * 1000));
      }

      updateData.suspendedAt = new Date();
      updateData.suspensionReason = reason && typeof reason === 'string' && reason.trim()
        ? reason.trim()
        : 'Empresa suspendida temporalmente por falta de pago';
      updateData.suspendedById = req.user.id;
      updateData.suspendedByName = adminIdentity;
      updateData.suspensionGraceDays = parsedGraceDays;
      updateData.suspensionExpiresAt = expiresAt;
      updateData.deletionAlertSent = false;
      updateData.deletionAlertAt = null;
    } else {
      // Al reactivar, limpiamos los datos de suspensión activa y el timer
      updateData.suspendedAt = null;
      updateData.suspensionReason = null;
      updateData.suspendedById = null;
      updateData.suspendedByName = null;
      updateData.suspensionGraceDays = null;
      updateData.suspensionExpiresAt = null;
      updateData.deletionAlertSent = false;
      updateData.deletionAlertAt = null;
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
      message: isActive 
        ? 'Empresa activada exitosamente' 
        : `Empresa suspendida temporalmente. Plazo de gracia: ${updateData.suspensionGraceDays} días.`,
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
 * PATCH /api/v1/companies/:id/grace-period
 * Extender o modificar el plazo de gracia temporal de una empresa suspendida (Super Admin)
 */
router.patch('/:id/grace-period', async (req, res) => {
  try {
    const companyId = req.params.id;
    const { additionalDays, totalGraceDays, customExpiresAt, reason } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'ID de empresa inválido' });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    if (company.isActive) {
      return res.status(400).json({ error: 'La empresa está activa. El plazo de gracia solo aplica a empresas en baja temporal.' });
    }

    const currentBase = company.suspendedAt ? new Date(company.suspendedAt) : new Date();
    let newGraceDays = company.suspensionGraceDays || 30;

    if (additionalDays && Number.isInteger(Number(additionalDays)) && Number(additionalDays) > 0) {
      newGraceDays += Number(additionalDays);
    } else if (totalGraceDays && Number.isInteger(Number(totalGraceDays)) && Number(totalGraceDays) > 0) {
      newGraceDays = Number(totalGraceDays);
    }

    let newExpiresAt = null;
    if (customExpiresAt) {
      const d = new Date(customExpiresAt);
      if (!isNaN(d.getTime())) {
        newExpiresAt = d;
      }
    }
    if (!newExpiresAt) {
      newExpiresAt = new Date(currentBase.getTime() + (newGraceDays * 24 * 60 * 60 * 1000));
    }

    const isNowExpired = newExpiresAt <= new Date();

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        suspensionGraceDays: newGraceDays,
        suspensionExpiresAt: newExpiresAt,
        deletionAlertSent: isNowExpired ? company.deletionAlertSent : false,
        deletionAlertAt: isNowExpired ? company.deletionAlertAt : null,
        ...(reason && typeof reason === 'string' && reason.trim() ? { suspensionReason: reason.trim() } : {})
      }
    });

    const adminIdentity = req.user.name ? `${req.user.name} (${req.user.email})` : (req.user.email || 'Super Admin');
    await runWithTenantContext({ companyId: company.id, isSuperAdmin: true }, async () => {
      await prisma.adminAuditLog.create({
        data: {
          action: 'EXTEND_SUSPENSION_GRACE_PERIOD',
          performedById: req.user.id,
          performedByName: adminIdentity,
          targetName: company.name,
          targetEmail: req.user.email || 'superadmin@system.local',
          companyId: company.id
        }
      });
    });

    res.json({
      success: true,
      message: `Plazo de gracia temporal actualizado a ${newGraceDays} días (Vence: ${newExpiresAt.toLocaleDateString('es-MX')})`,
      company: updated
    });
  } catch (error) {
    console.error('Error al actualizar plazo de gracia:', error);
    res.status(500).json({ error: 'Error al actualizar plazo de gracia' });
  }
});

/**
 * POST /api/v1/companies/:id/reset-admin-password
 * Restablecer o regenerar contraseña del administrador de la empresa (Super Admin)
 */
router.post('/:id/reset-admin-password', async (req, res) => {
  try {
    const companyId = req.params.id;
    const { newPassword, adminEmail, adminId } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'ID de empresa inválido' });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        adminUsers: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    if (!company.adminUsers || company.adminUsers.length === 0) {
      return res.status(404).json({ error: 'La empresa no cuenta con usuarios administradores registrados.' });
    }

    // Buscar admin específico si fue solicitado, o tomar el primer admin disponible
    let admin = null;
    if (adminEmail && typeof adminEmail === 'string') {
      admin = company.adminUsers.find(a => a.email.toLowerCase().trim() === adminEmail.toLowerCase().trim());
    }
    if (!admin && adminId && typeof adminId === 'string') {
      admin = company.adminUsers.find(a => a.id === adminId);
    }
    if (!admin) {
      // Priorizar roles directivos si no se especificó un admin puntual
      admin = company.adminUsers.find(a => ['ADMIN', 'CORPORATE_ADMIN', 'SUPER_ADMIN'].includes(a.role)) || company.adminUsers[0];
    }

    // Generar contraseña aleatoria si no fue provista
    let finalPassword = typeof newPassword === 'string' ? newPassword.trim() : '';
    if (!finalPassword || finalPassword.length < 6) {
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
        email: admin.email,
        role: admin.role
      },
      adminEmail: admin.email,
      adminName: admin.name,
      adminRole: admin.role,
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
