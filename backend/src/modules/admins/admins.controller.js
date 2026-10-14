const bcrypt = require('bcrypt');
const prisma = require('../../utils/prisma');
const { 
  syncAdminToEmployee, 
  syncAllAdminsToEmployees, 
  handleAdminDeleted 
} = require('../../utils/adminEmployeeSync');

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

    // Obtener información del empleado vinculado para mostrar estado biométrico en el frontend
    const emails = admins.map(a => a.email);
    const employees = await prisma.employee.findMany({
      where: { email: { in: emails } },
      select: {
        id: true,
        email: true,
        identifier: true,
        faceDescriptor: true,
        enrolledAt: true,
        department: { select: { name: true } },
        position: true,
        isActive: true
      }
    });

    const empMap = new Map();
    employees.forEach(emp => empMap.set(emp.email, emp));

    const enrichedAdmins = admins.map(admin => {
      const emp = empMap.get(admin.email);
      return {
        ...admin,
        employee: emp ? {
          id: emp.id,
          identifier: emp.identifier,
          isEnrolled: Boolean(emp.faceDescriptor && emp.faceDescriptor !== '[]' && emp.faceDescriptor.length > 10),
          enrolledAt: emp.enrolledAt,
          department: emp.department?.name,
          position: emp.position,
          isActive: emp.isActive
        } : null
      };
    });

    res.json(enrichedAdmins);
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createAdmin = async (req, res) => {
  try {
    const { name, email, password, identifier, departmentId, position } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos (nombre, email, password) son requeridos.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    // Validate email uniqueness in AdminUser
    const existingAdmin = await prisma.adminUser.findUnique({
      where: { email }
    });

    if (existingAdmin) {
      return res.status(409).json({ error: 'El correo electrónico ya está registrado como administrador.' });
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

    // Sincronizar automáticamente como Empleado (usuario del sistema)
    let syncedEmployee = null;
    try {
      syncedEmployee = await syncAdminToEmployee(newAdmin, {
        identifier,
        departmentId,
        position
      }, prisma);
    } catch (syncErr) {
      console.error('[createAdmin] Error al sincronizar administrador como empleado:', syncErr);
    }

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

    res.status(201).json({
      ...newAdmin,
      employee: syncedEmployee ? {
        id: syncedEmployee.id,
        identifier: syncedEmployee.identifier,
        isEnrolled: false
      } : null
    });
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

    // Gestionar la baja o desactivación del empleado vinculado
    await handleAdminDeleted(targetAdmin.email, prisma);

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

const syncAdminsHandler = async (req, res) => {
  try {
    const result = await syncAllAdminsToEmployees(prisma);
    res.json({ 
      success: true, 
      message: 'Todos los administradores fueron sincronizados como usuarios del sistema.',
      ...result 
    });
  } catch (error) {
    console.error('Error in syncAdminsHandler:', error);
    res.status(500).json({ error: 'Error al sincronizar administradores' });
  }
};

module.exports = {
  getAdmins,
  createAdmin,
  deleteAdmin,
  getAuditLogs,
  syncAdminsHandler
};
