const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
    }

    // Buscar admin
    const user = await prisma.adminUser.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar JWT
    const secret = process.env.JWT_SECRET || 'HostingerFallbackSecretKey2026!';
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      secret,
      { expiresIn: '12h' }
    );

    // Configurar cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const isSecure = process.env.COOKIE_SECURE === 'true';

    res.cookie('jwt', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'none' : 'lax',
      maxAge: 12 * 60 * 60 * 1000 // 12 horas en ms
    });

    // Retornar datos del usuario (sin contraseña)
    res.json({
      message: 'Login exitoso',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const logout = (req, res) => {
  res.clearCookie('jwt');
  res.json({ message: 'Logout exitoso' });
};

const getMe = async (req, res) => {
  // El middleware de autenticación (requireAuth) ya se encargó de verificar el token
  // y adjuntar req.user
  res.json({ user: req.user });
};

const getSetupStatus = async (req, res) => {
  try {
    const adminCount = await prisma.adminUser.count();
    res.json({ needsSetup: adminCount === 0 });
  } catch (error) {
    console.error('Error checking setup status:', error);
    res.status(500).json({ error: 'Error verificando el estado de configuración' });
  }
};

const setupFirstAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    // Verificar si ya existe algún administrador
    const adminCount = await prisma.adminUser.count();
    if (adminCount > 0) {
      return res.status(403).json({ error: 'El sistema ya ha sido configurado.' });
    }

    // Crear el primer administrador
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.adminUser.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'SUPER_ADMIN'
      }
    });

    // Generar JWT y loguear automáticamente
    const secret = process.env.JWT_SECRET || 'HostingerFallbackSecretKey2026!';
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      secret,
      { expiresIn: '12h' }
    );

    const isSecure = process.env.COOKIE_SECURE === 'true';

    res.cookie('jwt', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'none' : 'lax',
      maxAge: 12 * 60 * 60 * 1000
    });

    res.json({
      message: 'Configuración completada y login exitoso',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error en setup:', error);
    res.status(500).json({ error: 'Error configurando el sistema' });
  }
};

module.exports = {
  login,
  logout,
  getMe,
  getSetupStatus,
  setupFirstAdmin
};
