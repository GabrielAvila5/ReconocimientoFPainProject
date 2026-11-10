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

const { DEFAULT_PLATFORM_COMPANY_ID } = require('../../middlewares/rbac');

const createAdmin = async (req, res) => {
  try {
    const { name, email, password, identifier, departmentId, position, syncEmployee, role, companyId } = req.body;
    const isSyncOptIn = syncEmployee === true || syncEmployee === 'true';

    const isPlatformSuperAdmin = 
      req.user?.role === 'SUPER_ADMIN' && 
      req.user?.companyId === DEFAULT_PLATFORM_COMPANY_ID;

    // Regla Zero-Trust y Mitigación de Mass Assignment de Roles y Tenant
    let finalRole = 'ADMIN';
    let targetCompanyId = req.user.companyId;

    if (isPlatformSuperAdmin) {
      // Super Admin de la plataforma puede asignar cualquier rol y destinar a cualquier empresa
      if (role && ['SUPER_ADMIN', 'CORPORATE_ADMIN', 'ADMIN', 'VIEWER'].includes(role)) {
        finalRole = role;
      }
      if (companyId) {
        targetCompanyId = companyId;
      }
    } else if (req.user?.role === 'CORPORATE_ADMIN') {
      // Corporate Admin solo puede crear administradores locales de sus sucursales o visores
      if (role === 'SUPER_ADMIN' || role === 'CORPORATE_ADMIN') {
        return res.status(403).json({
          error: 'ACCESO_DENEGADO',
          message: 'Solo el Super Administrador de la plataforma puede otorgar roles de SUPER_ADMIN o CORPORATE_ADMIN.'
        });
      }
      if (role && ['ADMIN', 'VIEWER'].includes(role)) {
        finalRole = role;
      }
      // Si especifica sucursal, validar que sea hija de su matriz
      if (companyId && companyId !== req.user.companyId) {
        const branch = await prisma.company.findUnique({
          where: { id: companyId },
          select: { id: true, parentCompanyId: true }
        });
        if (!branch || branch.parentCompanyId !== req.user.companyId) {
          return res.status(403).json({
            error: 'TENANT_SPOOFING_DETECTED',
            message: 'No puede asignar administradores a una sucursal que no pertenece a su holding.'
          });
        }
        targetCompanyId = companyId;
      }
    } else {
      // Administrador regular: estrictamente restringido a su propia empresa y roles locales
      if (role === 'SUPER_ADMIN' || role === 'CORPORATE_ADMIN') {
        return res.status(403).json({
          error: 'ACCESO_DENEGADO',
          message: 'Privilegios insuficientes para asignar roles de nivel plataforma o corporativo.'
        });
      }
      if (role && ['ADMIN', 'VIEWER'].includes(role)) {
        finalRole = role;
      }
      targetCompanyId = req.user.companyId;
    }

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

    // Create user with sanitized role and companyId
    const newAdmin = await prisma.adminUser.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: finalRole,
        companyId: targetCompanyId,
        createdBy: req.user.id
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
        createdAt: true,
        createdByUser: {
          select: {
            name: true
          }
        }
      }
    });

    // Sincronizar como Empleado según Opción A (opt-in desmarcado por defecto)
    let syncedEmployee = null;
    try {
      syncedEmployee = await syncAdminToEmployee(newAdmin, {
        companyId: newAdmin.companyId || req.user.companyId,
        identifier,
        departmentId,
        position,
        syncEmployee: isSyncOptIn
      }, prisma);
    } catch (syncErr) {
      if (syncErr.code === 'PLAN_LIMIT_EXCEEDED') {
        // Rollback creación de administrador ante falta de cupo de empleado solicitado
        await prisma.adminUser.delete({ where: { id: newAdmin.id } });
        return res.status(403).json({
          error: 'PLAN_LIMIT_EXCEEDED',
          message: syncErr.message || 'Límite de empleados alcanzado para el plan de su empresa.'
        });
      }
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
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
    }
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

    // Regla Zero-Trust: Jamás permitir la eliminación de un SUPER_ADMIN
    if (targetAdmin.role === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'No se puede eliminar a un Super Administrador.' });
    }

    // Un CORPORATE_ADMIN no puede eliminar a otro CORPORATE_ADMIN ni administradores fuera de su red
    if (req.user.role === 'CORPORATE_ADMIN') {
      if (targetAdmin.role === 'CORPORATE_ADMIN') {
        return res.status(403).json({ error: 'No autorizado para eliminar a un Administrador Corporativo.' });
      }
      const allowedCompanyIds = [
        req.user.companyId,
        ...(await prisma.company.findMany({ where: { parentCompanyId: req.user.companyId }, select: { id: true } })).map((b) => b.id)
      ];
      if (!allowedCompanyIds.includes(targetAdmin.companyId)) {
        return res.status(403).json({ error: 'ACCESO_DENEGADO', message: 'No puede eliminar administradores de otra organización.' });
      }
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
    await handleAdminDeleted(targetAdmin.email, targetAdmin.companyId, prisma);

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
