/**
 * RBAC MIDDLEWARE (Role-Based Access Control)
 * Control de acceso basado en roles con política Zero-Trust para Super Administradores y Holdings.
 */

const DEFAULT_PLATFORM_COMPANY_ID = process.env.DEFAULT_COMPANY_ID || 'default-company-pain';

/**
 * Middleware que exige rol de Super Administrador con regla Zero-Trust:
 * Solo usuarios con role === 'SUPER_ADMIN' y pertenecientes estrictamente
 * a la empresa raíz de la plataforma ('default-company-pain') son autorizados.
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'NO_AUTENTICADO', message: 'Se requiere inicio de sesión previo.' });
  }

  const effectiveCompanyId = req.user.companyId || DEFAULT_PLATFORM_COMPANY_ID;
  const isZeroTrustSuperAdmin = 
    req.user.role === 'SUPER_ADMIN' && 
    effectiveCompanyId === DEFAULT_PLATFORM_COMPANY_ID;

  if (!isZeroTrustSuperAdmin) {
    return res.status(403).json({
      error: 'ACCESO_DENEGADO',
      message: 'Acceso denegado: Se requieren privilegios exclusivos de Super Administrador de la plataforma.'
    });
  }

  next();
};

/**
 * Middleware que permite acceso a Super Administrador global o Administrador Corporativo (Holding).
 */
const requireCorporateOrSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'NO_AUTENTICADO', message: 'Se requiere inicio de sesión previo.' });
  }

  const effectiveCompanyId = req.user.companyId || DEFAULT_PLATFORM_COMPANY_ID;
  const isZeroTrustSuperAdmin = 
    req.user.role === 'SUPER_ADMIN' && 
    effectiveCompanyId === DEFAULT_PLATFORM_COMPANY_ID;

  const isCorporateAdmin = req.user.role === 'CORPORATE_ADMIN';

  if (!isZeroTrustSuperAdmin && !isCorporateAdmin) {
    return res.status(403).json({
      error: 'ACCESO_DENEGADO',
      message: 'Acceso denegado: Se requieren permisos corporativos de holding o de Super Administrador.'
    });
  }

  next();
};

/**
 * Middleware genérico para verificar lista blanca de roles.
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'ACCESO_DENEGADO',
        message: 'Acceso denegado. Rol insuficiente para realizar esta acción.'
      });
    }
    next();
  };
};

module.exports = {
  DEFAULT_PLATFORM_COMPANY_ID,
  requireSuperAdmin,
  requireCorporateOrSuperAdmin,
  requireRole
};

