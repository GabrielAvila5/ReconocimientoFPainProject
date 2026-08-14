const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const requireAuth = async (req, res, next) => {
  try {
    // 1. Obtener token desde las cookies
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({ error: 'No autorizado. Token no encontrado.' });
    }

    // 2. Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Verificar que el usuario aún exista en la BD
    const user = await prisma.adminUser.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, role: true }
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

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acceso denegado. Rol insuficiente.' });
    }
    next();
  };
};

module.exports = {
  requireAuth,
  requireRole
};
