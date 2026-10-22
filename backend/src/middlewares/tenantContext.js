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

    if (req.user) {
      if (req.user.role === 'SUPER_ADMIN') {
        isSuperAdmin = true;
        if (headerTenantId) {
          companyId = Array.isArray(headerTenantId) ? headerTenantId[0] : headerTenantId;
          isImpersonating = true;
        }
      } else {
        // Administrador de empresa: su companyId es fijo desde el token JWT
        companyId = req.user.companyId || null;
        // Se ignora deliberadamente x-tenant-id enviado por un no-superadmin para evitar spoofing
      }
    } else if (req.device) {
      companyId = req.device.companyId || null;
    }

    // Rutas públicas y de superadmin
    const isSuperAdminRoute = req.originalUrl?.startsWith('/api/v1/superadmin') || 
                             req.originalUrl?.startsWith('/api/v1/companies');
    const isPublicAuthRoute = req.originalUrl?.startsWith('/api/v1/auth') || 
                             req.originalUrl?.startsWith('/api/v1/devices/auth-request');

    // Regla de Super Admin: Obligatorio x-tenant-id en rutas operativas de inquilino
    if (isSuperAdmin && !companyId && !isSuperAdminRoute && !isPublicAuthRoute) {
      return res.status(400).json({
        error: 'TENANT_HEADER_REQUIRED',
        message: 'Super Administrador debe especificar la cabecera x-tenant-id para operar en rutas de empresa.'
      });
    }

    // Regla de Empresa Suspendida: 403 Forbidden
    if (companyId && !isSuperAdmin) {
      const prisma = require('../utils/prisma');
      const comp = await prisma.$base.company.findUnique({
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
