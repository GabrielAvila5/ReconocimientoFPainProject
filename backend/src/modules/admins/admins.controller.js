const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getAdmins = async (req, res) => {
  try {
    const admins = await prisma.adminUser.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        createdByUser: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json(admins);
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos (nombre, email, password) son requeridos.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    // Validate email uniqueness
    const existingAdmin = await prisma.adminUser.findUnique({
      where: { email }
    });

    if (existingAdmin) {
      return res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user (force role to ADMIN)
    const newAdmin = await prisma.adminUser.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'ADMIN',
        createdBy: req.user.id
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        createdByUser: {
          select: {
            name: true
          }
        }
      }
    });

    // Create audit log
    await prisma.adminAuditLog.create({
      data: {
        action: 'CREATE_ADMIN',
        performedById: req.user.id,
        performedByName: req.user.name,
        targetName: newAdmin.name,
        targetEmail: newAdmin.email
      }
    });

    res.status(201).json(newAdmin);
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const targetAdmin = await prisma.adminUser.findUnique({
      where: { id }
    });

    if (!targetAdmin) {
      return res.status(404).json({ error: 'Administrador no encontrado.' });
    }

    // NEVER allow deletion of a SUPER_ADMIN
    if (targetAdmin.role === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'No se puede eliminar a un Super Administrador.' });
    }

    // Audit log before deleting to capture targetName and targetEmail
    await prisma.adminAuditLog.create({
      data: {
        action: 'DELETE_ADMIN',
        performedById: req.user.id,
        performedByName: req.user.name,
        targetName: targetAdmin.name,
        targetEmail: targetAdmin.email
      }
    });

    await prisma.adminUser.delete({
      where: { id }
    });

    res.json({ message: 'Administrador eliminado exitosamente.' });
  } catch (error) {
    console.error('Error deleting admin:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getAuditLogs = async (req, res) => {
  try {
    const logs = await prisma.adminAuditLog.findMany({
      orderBy: {
        timestamp: 'desc'
      }
    });
    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getAdmins,
  createAdmin,
  deleteAdmin,
  getAuditLogs
};
