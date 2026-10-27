const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../utils/prisma');
const { JWT_SECRET } = require('../../config/secrets');
const { syncAdminToEmployee } = require('../../utils/adminEmployeeSync');
const { findAdminByEmailForLogin } = require('../../utils/authHelpers');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
    }

    // Buscar admin deterministicamente mediante helper estrecho
    const user = await findAdminByEmailForLogin(email);

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Verificar si la empresa está suspendida
    if (user.company && !user.company.isActive) {
      return res.status(403).json({
        error: 'COMPANY_SUSPENDED',
        message: 'La empresa se encuentra suspendida. Contacte al administrador.'
      });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar JWT con companyId
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, companyId: user.companyId },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    // Configurar cookies seguras de sesión y CSRF
    const isProd = process.env.NODE_ENV === 'production';
    const isSecure = isProd || process.env.COOKIE_SECURE === 'true';

    res.cookie('jwt', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      maxAge: 12 * 60 * 60 * 1000 // 12 horas en ms
    });

    const crypto = require('crypto');
    const csrfToken = crypto.randomBytes(24).toString('hex');
    res.cookie('XSRF-TOKEN', csrfToken, {
      httpOnly: false,
      secure: isSecure,
      sameSite: 'strict',
      maxAge: 12 * 60 * 60 * 1000
    });

    // Retornar datos del usuario (sin contraseña) y token
    res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const logout = (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  const isSecure = isProd || process.env.COOKIE_SECURE === 'true';
  res.clearCookie('jwt', { httpOnly: true, secure: isSecure, sameSite: 'strict' });
  res.clearCookie('XSRF-TOKEN', { httpOnly: false, secure: isSecure, sameSite: 'strict' });
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

    // Sincronizar automáticamente al Super Administrador como empleado/usuario del sistema
    try {
      await syncAdminToEmployee(user, req.body, prisma);
    } catch (syncErr) {
      console.error('[setupFirstAdmin] Error al sincronizar empleado:', syncErr);
    }

    // Generar JWT y loguear automáticamente
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, companyId: user.companyId },
      JWT_SECRET,
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
      token,
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

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id; // user is attached by requireAuth

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'La contraseña actual y la nueva son obligatorias' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }

    const user = await prisma.adminUser.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.adminUser.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    console.error('Error al cambiar la contraseña:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  login,
  logout,
  getMe,
  getSetupStatus,
  setupFirstAdmin,
  changePassword
};
