const prisma = require('./prisma');
const { runWithTenantContext } = require('../middlewares/tenantContext');

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
 * Valida la unicidad dentro de la empresa del administrador.
 */
async function generateAdminIdentifier(companyId, prismaClient = prisma) {
  for (let i = 0; i < 20; i++) {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const candidate = `ADM-${randomNum}`;
    const exists = await prismaClient.employee.findFirst({
      where: {
        identifier: candidate,
        companyId
      }
    });
    if (!exists) return candidate;
  }
  return `ADM-${Date.now().toString().slice(-6)}`;
}

/**
 * Obtiene el ID del departamento para el administrador dentro de su empresa
 */
async function getDefaultAdminDepartmentId(companyId, prismaClient = prisma, preferredDeptId = null) {
  if (preferredDeptId) {
    const parsedId = parseInt(preferredDeptId, 10);
    if (!isNaN(parsedId)) {
      const dept = await prismaClient.department.findFirst({
        where: { id: parsedId, companyId }
      });
      if (dept) return dept.id;
    }
  }

  // Buscar departamento ADMINISTRACION o Administración dentro de la empresa
  const adminDept = await prismaClient.department.findFirst({
    where: {
      companyId,
      name: {
        in: ['ADMINISTRACION', 'Administración', 'Administracion', 'RH', 'TI', 'Dirección']
      }
    }
  });
  if (adminDept) return adminDept.id;

  // Fallback al primer departamento de la empresa
  const firstDept = await prismaClient.department.findFirst({
    where: { companyId }
  });
  return firstDept ? firstDept.id : null;
}

/**
 * Sincroniza un AdminUser hacia la tabla Employee de su propia empresa (OPCIÓN A).
 * - Casilla opt-in desmarcada por defecto (syncEmployee === true).
 * - Super Admin NUNCA genera empleado.
 * - Administradores ya enlazados se respetan y mantienen sin consumir cuota adicional.
 * - Si syncEmployee es true y no existe empleado previo, se valida límite de plan maxEmployees.
 */
async function syncAdminToEmployee(adminUser, options = {}, prismaClient = prisma) {
  if (!adminUser || !adminUser.email) return null;

  // REGLA INVIOLABLE: El Super Admin NUNCA genera empleado
  if (adminUser.role === 'SUPER_ADMIN') {
    return null;
  }

  const targetCompanyId = adminUser.companyId || options.companyId;
  if (!targetCompanyId) {
    return null;
  }

  return runWithTenantContext({ companyId: targetCompanyId }, async () => {
    const adminEmail = adminUser.email.trim();

    // 1. Buscar si ya existe un empleado con este correo en ESTA empresa
    let existingEmployee = await prismaClient.employee.findFirst({
      where: {
        email: adminEmail,
        companyId: targetCompanyId
      }
    });

    const defaultPosition = 'Administrador';

    // Si ya existe un empleado enlazado, se respeta y se mantiene (no consume cuota nueva)
    if (existingEmployee) {
      const dataToUpdate = {
        isActive: true,
        position: options.position || existingEmployee.position || defaultPosition
      };

      const updated = await prismaClient.employee.update({
        where: { id: existingEmployee.id },
        data: dataToUpdate
      });
      return updated;
    }

    // 2. Si no existe empleado previamente enlazado:
    // Solo se crea si la casilla opt-in fue marcada explícitamente (syncEmployee === true)
    if (!options.syncEmployee) {
      return null;
    }

    // 3. Validar límite de empleados del plan (maxEmployees)
    const company = await prisma.company.findUnique({
      where: { id: targetCompanyId },
      select: { maxEmployees: true }
    });

    if (company && company.maxEmployees !== null && company.maxEmployees !== undefined) {
      const currentEmployeeCount = await prismaClient.employee.count({
        where: { companyId: targetCompanyId }
      });
      if (currentEmployeeCount >= company.maxEmployees) {
        const error = new Error('Límite de empleados alcanzado para el plan de su empresa.');
        error.code = 'PLAN_LIMIT_EXCEEDED';
        error.status = 403;
        throw error;
      }
    }

    // 4. Crear el nuevo empleado en el inquilino
    const { firstName, lastName } = splitFullName(adminUser.name);
    
    let identifier = options.identifier;
    if (!identifier) {
      identifier = await generateAdminIdentifier(targetCompanyId, prismaClient);
    } else {
      const taken = await prismaClient.employee.findFirst({
        where: { identifier, companyId: targetCompanyId }
      });
      if (taken) {
        identifier = await generateAdminIdentifier(targetCompanyId, prismaClient);
      }
    }

    const departmentId = await getDefaultAdminDepartmentId(targetCompanyId, prismaClient, options.departmentId);
    const position = options.position || defaultPosition;

    const newEmployee = await prismaClient.employee.create({
      data: {
        firstName,
        lastName,
        email: adminEmail,
        identifier,
        position,
        departmentId,
        companyId: targetCompanyId,
        isActive: true
      }
    });

    console.log(`[AdminSync] Empleado creado para administrador ${adminEmail} en empresa ${targetCompanyId} (ID: ${newEmployee.id})`);
    return newEmployee;
  });
}

/**
 * Sincroniza todos los administradores pertenecientes a empresas activas.
 * Respeta la Opción A: los administradores ya enlazados a un empleado se mantienen.
 */
async function syncAllAdminsToEmployees(prismaClient = prisma) {
  try {
    const admins = await runWithTenantContext({ companyId: null, isSuperAdmin: true }, async () => {
      return prismaClient.adminUser.findMany({
        where: {
          companyId: { not: null },
          role: { not: 'SUPER_ADMIN' }
        }
      });
    });

    let syncCount = 0;
    for (const admin of admins) {
      if (!admin.companyId) continue;
      await runWithTenantContext({ companyId: admin.companyId, isSuperAdmin: true }, async () => {
        const existing = await prismaClient.employee.findFirst({
          where: { email: admin.email, companyId: admin.companyId }
        });
        if (existing) {
          await syncAdminToEmployee(admin, { syncEmployee: true }, prismaClient);
          syncCount++;
        }
      });
    }

    if (syncCount > 0) {
      console.log(`[AdminSync] Se respetaron y sincronizaron ${syncCount} administrador(es) enlazados a empleados.`);
    }
    return { success: true, count: syncCount };
  } catch (error) {
    console.error('[AdminSync] Error al sincronizar administradores a empleados:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Maneja la baja de un administrador en el personal de su empresa.
 */
async function handleAdminDeleted(adminEmail, companyId, prismaClient = prisma) {
  if (!adminEmail || !companyId) return;

  return runWithTenantContext({ companyId }, async () => {
    try {
      const emp = await prismaClient.employee.findFirst({
        where: { email: adminEmail, companyId },
        include: { attendances: { take: 1 } }
      });

      if (!emp) return;

      if (emp.attendances && emp.attendances.length > 0) {
        await prismaClient.employee.update({
          where: { id: emp.id },
          data: { isActive: false }
        });
        console.log(`[AdminSync] Empleado ${adminEmail} desactivado en empresa ${companyId}.`);
      } else {
        await prismaClient.employeeShift.deleteMany({ where: { employeeId: emp.id } });
        await prismaClient.notification.deleteMany({ where: { employeeId: emp.id } });
        await prismaClient.employee.delete({ where: { id: emp.id } });
        console.log(`[AdminSync] Empleado ${adminEmail} eliminado en empresa ${companyId}.`);
      }
    } catch (error) {
      console.error(`[AdminSync] Error al gestionar baja para admin ${adminEmail}:`, error);
    }
  });
}

module.exports = {
  splitFullName,
  generateAdminIdentifier,
  getDefaultAdminDepartmentId,
  syncAdminToEmployee,
  syncAllAdminsToEmployees,
  handleAdminDeleted
};
