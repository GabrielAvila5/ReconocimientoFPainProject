const jwt = require('jsonwebtoken');
const prisma = require('../../utils/prisma');
const { JWT_SECRET } = require('../../config/secrets');

const requireAuth = async (req, res, next) => {
  try {
    // 1. Obtener token desde encabezado Authorization (Bearer) o cookies
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return res.status(401).json({ error: 'No autorizado. Token no encontrado.' });
    }

    // 2. Verificar token
    const decoded = jwt.verify(token, JWT_SECRET);

    // 3. Verificar que el usuario aún exista en la BD
    const user = await prisma.adminUser.findUnique({
      where: { id: decoded.id },
      select: { id: true, companyId: true, email: true, name: true, role: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'El usuario ya no existe.' });
    }

    // 4. Agregar usuario a la request
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error.message);
    return res.status(401).json({ error: 'No autorizado. Token inválido o expirado.' });
  }
};

const { 
  requireSuperAdmin, 
  requireCorporateOrSuperAdmin, 
  requireRole: rbacRequireRole 
} = require('../../middlewares/rbac');

const requireRole = rbacRequireRole;

module.exports = {
  requireAuth,
  requireRole,
  requireSuperAdmin,
  requireCorporateOrSuperAdmin
};
