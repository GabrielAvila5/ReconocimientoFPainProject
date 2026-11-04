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

    const headerTenantId = req.headers['x-tenant-id'] || req.headers['x-company-id'];

    // Rutas públicas y de superadmin
    const isSuperAdminRoute = req.originalUrl?.startsWith('/api/v1/superadmin') || 
                             req.originalUrl?.startsWith('/api/v1/companies');
    const isPublicAuthRoute = req.originalUrl?.startsWith('/api/v1/auth') || 
                             req.originalUrl?.startsWith('/api/v1/devices/auth-request');

    if (req.user) {
      if (req.user.role === 'SUPER_ADMIN') {
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
      } else {
        // Administrador de empresa: su companyId es fijo desde el token JWT
        companyId = req.user.companyId || null;
        // Se ignora deliberadamente x-tenant-id enviado por un no-superadmin para evitar spoofing
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
