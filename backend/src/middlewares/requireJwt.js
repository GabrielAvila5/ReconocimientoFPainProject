const jwt = require('jsonwebtoken');

const requireJwt = (req, res, next) => {
  // Bypass de autenticación para desarrollo
  if (process.env.DISABLE_AUTH === 'true') {
    console.warn("⚠️ AUTENTICACIÓN DESHABILITADA - Solo para desarrollo");
    req.user = { id: 'dev-admin', role: 'ADMIN' };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = requireJwt;
