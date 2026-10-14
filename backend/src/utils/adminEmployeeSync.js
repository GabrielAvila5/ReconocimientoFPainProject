const prisma = require('./prisma');

/**
 * Divide un nombre completo en firstName y lastName de forma inteligente
 */
function splitFullName(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    return { firstName: 'Administrador', lastName: 'Sistema' };
  }
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: 'Administrador', lastName: 'Sistema' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: 'Administrador' };
  }
  if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1] };
  }

  // Nombres compuestos hispanos comunes en el primer nombre (ej. Jose Luis, Juan Carlos, Maria Jose)
  const compoundFirstNames = ['jose', 'juan', 'maria', 'luis', 'carlos', 'ana', 'pedro', 'jorge'];
  if (compoundFirstNames.includes(parts[0].toLowerCase()) && parts.length >= 3) {
    return {
      firstName: `${parts[0]} ${parts[1]}`,
      lastName: parts.slice(2).join(' ')
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

/**
 * Genera un identificador único para el empleado administrador (ej. ADM-123456)
 */
async function generateAdminIdentifier(prismaClient = prisma) {
  for (let i = 0; i < 20; i++) {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const candidate = `ADM-${randomNum}`;
    const exists = await prismaClient.employee.findUnique({
      where: { identifier: candidate }
    });
    if (!exists) return candidate;
  }
  return `ADM-${Date.now().toString().slice(-6)}`;
}

/**
 * Obtiene el ID del departamento para el administrador (por defecto 'ADMINISTRACION')
 */
async function getDefaultAdminDepartmentId(prismaClient = prisma, preferredDeptId = null) {
  if (preferredDeptId) {
    const parsedId = parseInt(preferredDeptId, 10);
    if (!isNaN(parsedId)) {
      const dept = await prismaClient.department.findUnique({ where: { id: parsedId } });
      if (dept) return dept.id;
    }
  }

  // Buscar departamento ADMINISTRACION o Administración
  const adminDept = await prismaClient.department.findFirst({
    where: {
      name: {
        in: ['ADMINISTRACION', 'Administración', 'Administracion', 'RH', 'TI', 'Dirección']
      }
    }
  });
  if (adminDept) return adminDept.id;

  // Fallback al primer departamento que exista
  const firstDept = await prismaClient.department.findFirst();
  return firstDept ? firstDept.id : null;
}

/**
 * Sincroniza un AdminUser hacia la tabla Employee
 */
async function syncAdminToEmployee(adminUser, options = {}, prismaClient = prisma) {
  if (!adminUser || !adminUser.email) return null;

  // Buscar si ya existe un empleado con este correo
  const existingEmployee = await prismaClient.employee.findUnique({
    where: { email: adminUser.email }
  });

  const defaultPosition = adminUser.role === 'SUPER_ADMIN' ? 'Super Administrador' : 'Administrador';

  if (existingEmployee) {
    // Si ya existe, nos aseguramos de que esté activo y con cargo asignado
    const updated = await prismaClient.employee.update({
      where: { id: existingEmployee.id },
      data: {
        isActive: true,
        position: existingEmployee.position || options.position || defaultPosition
      }
    });
    return updated;
  }

  // Si no existe, lo creamos
  const { firstName, lastName } = splitFullName(adminUser.name);
  
  // Validar si nos dieron un identifier o lo generamos
  let identifier = options.identifier;
  if (!identifier) {
    identifier = await generateAdminIdentifier(prismaClient);
  } else {
    // Verificar si el identifier proporcionado ya está ocupado
    const taken = await prismaClient.employee.findUnique({ where: { identifier } });
    if (taken) {
      identifier = await generateAdminIdentifier(prismaClient);
    }
  }

  const departmentId = await getDefaultAdminDepartmentId(prismaClient, options.departmentId);
  const position = options.position || defaultPosition;

  const newEmployee = await prismaClient.employee.create({
    data: {
      firstName,
      lastName,
      email: adminUser.email,
      identifier,
      position,
      departmentId,
      isActive: true
    }
  });

  console.log(`[AdminSync] Empleado creado para el administrador ${adminUser.email} (ID: ${newEmployee.id}, Identificador: ${identifier})`);
  return newEmployee;
}

/**
 * Sincroniza todos los administradores existentes para garantizar que aparezcan como empleados
 */
async function syncAllAdminsToEmployees(prismaClient = prisma) {
  try {
    const admins = await prismaClient.adminUser.findMany();
    let createdCount = 0;

    for (const admin of admins) {
      const existing = await prismaClient.employee.findUnique({
        where: { email: admin.email }
      });
      if (!existing) {
        await syncAdminToEmployee(admin, {}, prismaClient);
        createdCount++;
      }
    }

    if (createdCount > 0) {
      console.log(`[AdminSync] Se sincronizaron y crearon ${createdCount} empleado(s) a partir de administradores.`);
    }
    return { success: true, count: createdCount };
  } catch (error) {
    console.error('[AdminSync] Error al sincronizar administradores a empleados:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Maneja la eliminación o baja de un administrador en el personal
 */
async function handleAdminDeleted(adminEmail, prismaClient = prisma) {
  if (!adminEmail) return;

  try {
    const emp = await prismaClient.employee.findUnique({
      where: { email: adminEmail },
      include: { attendances: { take: 1 } }
    });

    if (!emp) return;

    if (emp.attendances && emp.attendances.length > 0) {
      // Tiene historial de asistencia: desactivar para preservar reportes
      await prismaClient.employee.update({
        where: { id: emp.id },
        data: { isActive: false }
      });
      console.log(`[AdminSync] Empleado ${adminEmail} desactivado (conservando historial de asistencias).`);
    } else {
      // No tiene asistencias: eliminar de forma segura
      await prismaClient.employeeShift.deleteMany({ where: { employeeId: emp.id } });
      await prismaClient.notification.deleteMany({ where: { employeeId: emp.id } });
      await prismaClient.notification.deleteMany({ where: { entityId: emp.id } });
      await prismaClient.employee.delete({ where: { id: emp.id } });
      console.log(`[AdminSync] Empleado ${adminEmail} eliminado del sistema.`);
    }
  } catch (error) {
    console.error(`[AdminSync] Error al gestionar baja de empleado para admin ${adminEmail}:`, error);
  }
}

module.exports = {
  splitFullName,
  generateAdminIdentifier,
  getDefaultAdminDepartmentId,
  syncAdminToEmployee,
  syncAllAdminsToEmployees,
  handleAdminDeleted
};
