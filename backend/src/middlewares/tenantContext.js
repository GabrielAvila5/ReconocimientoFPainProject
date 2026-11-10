/**
 * TENANT CONTEXT MIDDLEWARE (AsyncLocalStorage)
 * Gestiona el contexto de ejecución multi-tenant a lo largo del ciclo de vida de la petición.
 */

const { AsyncLocalStorage } = require('async_hooks');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/secrets');

const tenantStorage = new AsyncLocalStorage();

class TenantContextRequiredError extends Error {
  constructor(message = 'Acceso a datos de inquilino requiere contexto de empresa (companyId) activo.') {
    super(message);
    this.name = 'TenantContextRequiredError';
    this.code = 'TENANT_CONTEXT_REQUIRED';
    this.status = 400;
  }
}

/**
 * Ejecuta una función síncrona o asíncrona dentro de un contexto de inquilino.
 * @param {Object} context - { companyId: string, isSuperAdmin?: boolean, isImpersonating?: boolean }
 * @param {Function} callback - Función a ejecutar
 */
function runWithTenantContext(context, callback) {
  return tenantStorage.run(context, callback);
}

/**
 * Obtiene el contexto actual del inquilino desde AsyncLocalStorage.
 * @returns {Object|undefined}
 */
function getTenantContext() {
  return tenantStorage.getStore();
}

/**
 * Middleware de Express para poblar y ejecutar en el contexto del inquilino.
 */
async function tenantContextMiddleware(req, res, next) {
  try {
    // 1. Extraer usuario de token JWT si aún no fue decodificado
    if (!req.user) {
      let token = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      } else if (req.cookies && req.cookies.jwt) {
        token = req.cookies.jwt;
      }

      if (token) {
        try {
          req.user = jwt.verify(token, JWT_SECRET);
        } catch (err) {}
      }
    }

    let companyId = null;
    let isSuperAdmin = false;
    let isImpersonating = false;
    let isCorporateAdmin = false;
    let isCorporateHolding = false;
    let holdingCompanyIds = null;
    let impersonatingBranchId = null;

    const DEFAULT_PLATFORM_COMPANY_ID = process.env.DEFAULT_COMPANY_ID || 'default-company-pain';
    const headerTenantId = req.headers['x-tenant-id'] || req.headers['x-company-id'];

    // Rutas públicas y de superadmin
    const isSuperAdminRoute = req.originalUrl?.startsWith('/api/v1/superadmin') || 
                             req.originalUrl?.startsWith('/api/v1/companies');
    const isPublicAuthRoute = req.originalUrl?.startsWith('/api/v1/auth') || 
                             req.originalUrl?.startsWith('/api/v1/devices/auth-request');

    if (req.user) {
      // Regla Zero-Trust: Solo usuarios con rol SUPER_ADMIN de la empresa 'default-company-pain' son Super Admin globales
      const effectiveCompanyId = req.user.companyId || DEFAULT_PLATFORM_COMPANY_ID;
      const isZeroTrustSuperAdmin = 
        req.user.role === 'SUPER_ADMIN' && 
        effectiveCompanyId === DEFAULT_PLATFORM_COMPANY_ID;

      if (isZeroTrustSuperAdmin) {
        isSuperAdmin = true;
        if (isSuperAdminRoute) {
          // En rutas de superadmin (gestión global de empresas y plataforma), operar sin filtro de inquilino
          companyId = null;
          isImpersonating = false;
        } else if (headerTenantId) {
          companyId = Array.isArray(headerTenantId) ? headerTenantId[0] : headerTenantId;
          isImpersonating = true;
        } else if (req.user.companyId) {
          // Si el Super Admin tiene una empresa base asociada en su usuario, usarla por defecto
          companyId = req.user.companyId;
        }
      } else if (req.user.role === 'CORPORATE_ADMIN') {
        // Administrador de Holding Corporativo (Plan Personalizado Multi-Sucursal)
        isCorporateAdmin = true;
        const headerBranchId = req.headers['x-branch-id'] || req.headers['x-branch'];

        if (headerBranchId) {
          const targetBranchId = Array.isArray(headerBranchId) ? headerBranchId[0] : headerBranchId;
          const prisma = require('../utils/prisma');

          // Validar en la BD que la sucursal solicitada tenga como parentCompanyId el companyId del usuario
          const branch = await prisma.company.findUnique({
            where: { id: targetBranchId },
            select: { id: true, parentCompanyId: true, isActive: true }
          });

          if (!branch || branch.parentCompanyId !== req.user.companyId) {
            return res.status(403).json({
              error: 'TENANT_SPOOFING_DETECTED',
              message: 'Acceso denegado: La sucursal solicitada no pertenece a su holding corporativo.'
            });
          }

          if (!branch.isActive) {
            return res.status(403).json({
              error: 'BRANCH_SUSPENDED',
              message: 'La sucursal solicitada se encuentra suspendida.'
            });
          }

          // Impersonación segura de sucursal: inyectar el x-branch-id en el contexto
          companyId = branch.id;
          isImpersonating = true;
          impersonatingBranchId = branch.id;
        } else {
          // Vista de Dashboard Nacional / Consolidada (sin x-branch-id)
          const prisma = require('../utils/prisma');
          const childBranches = await prisma.company.findMany({
            where: { parentCompanyId: req.user.companyId, isActive: true },
            select: { id: true }
          });

          companyId = req.user.companyId;
          isCorporateHolding = true;
          holdingCompanyIds = [req.user.companyId, ...childBranches.map(b => b.id)];
        }
      } else {
        // Administrador regular de sucursal o de empresa estándar: companyId fijo desde token
        companyId = req.user.companyId || null;
        // Se ignora deliberadamente x-tenant-id y x-branch-id para evitar spoofing
      }
    } else if (req.device) {
      companyId = req.device.companyId || null;
    } else {
      const deviceToken = req.headers['x-device-token'];
      if (deviceToken) {
        const { getDeviceByToken, updateDeviceLastSeen } = require('../utils/authHelpers');
        const dev = await getDeviceByToken(deviceToken);
        if (!dev) {
          return res.status(401).json({
            error: 'DEVICE_UNAUTHORIZED',
            message: 'Token de dispositivo no válido.'
          });
        }
        if (!dev.isActive) {
          return res.status(403).json({
            error: 'DEVICE_DEACTIVATED',
            message: dev.deactivatedReason || 'Dispositivo dado de baja.'
          });
        }
        if (dev.isBlocked) {
          return res.status(403).json({
            error: 'DEVICE_BLOCKED',
            message: dev.blockedReason || 'Dispositivo bloqueado temporalmente.'
          });
        }
        req.device = dev;
        companyId = dev.companyId;
        // Registro asíncrono de actividad del dispositivo
        updateDeviceLastSeen(dev.id);
      }
    }

    // Regla de Super Admin: Si no especificó x-tenant-id ni tiene companyId y navega en rutas operativas,
    // usar por defecto la empresa piloto ('default-company-pain') para garantizar disponibilidad continua
    if (isSuperAdmin && !companyId && !isSuperAdminRoute && !isPublicAuthRoute) {
      companyId = process.env.DEFAULT_COMPANY_ID || 'default-company-pain';
      isImpersonating = true;
    }

    // Regla de Empresa Suspendida: 403 Forbidden
    if (companyId && !isSuperAdmin) {
      const prisma = require('../utils/prisma');
      const comp = await prisma.company.findUnique({
        where: { id: companyId },
        select: { isActive: true }
      });
      if (comp && !comp.isActive) {
        return res.status(403).json({
          error: 'COMPANY_SUSPENDED',
          message: 'La empresa se encuentra suspendida. Acceso no autorizado.'
        });
      }
    }

    const context = {
      companyId,
      isSuperAdmin,
      isImpersonating,
      isCorporateAdmin,
      isCorporateHolding,
      holdingCompanyIds,
      impersonatingBranchId,
      userId: req.user?.id || null
    };

    // Auditoría automática de acciones de Super Admin operando con x-tenant-id sobre un inquilino
    if (isSuperAdmin && isImpersonating && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      res.on('finish', async () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          try {
            const prisma = require('../utils/prisma');
            await runWithTenantContext({ companyId }, async () => {
              await prisma.adminAuditLog.create({
                data: {
                  action: `SUPER_ADMIN_${req.method}`,
                  performedById: req.user.id,
                  performedByName: req.user.name || req.user.email || 'Super Admin',
                  targetName: `${req.method} ${req.originalUrl}`,
                  targetEmail: req.user.email || 'superadmin@system.com',
                  companyId
                }
              });
            });
          } catch (auditErr) {
            console.error('[TenantContext] Error logging Super Admin audit:', auditErr);
          }
        }
      });
    }

    runWithTenantContext(context, () => next());
  } catch (error) {
    next(error);
  }
}

module.exports = {
  tenantStorage,
  TenantContextRequiredError,
  runWithTenantContext,
  getTenantContext,
  tenantContextMiddleware
};
