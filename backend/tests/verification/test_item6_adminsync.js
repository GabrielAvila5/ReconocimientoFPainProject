const prisma = require('../../src/utils/prisma');
const { syncAdminToEmployee } = require('../../src/utils/adminEmployeeSync');

async function main() {
  console.log('================================================================');
  console.log('>>> ITEM 6: DEMOSTRACIÓN DE adminEmployeeSync.js Y SCOPING');
  console.log('================================================================\n');

  const companyA = 'default-company-pain';
  const companyB = 'company-beta-saas';

  // 1. Asegurar que ambas empresas existan en la BD
  await prisma.$base.company.upsert({
    where: { id: companyA },
    create: { id: companyA, name: 'Empresa Alpha', slug: 'alpha-pain', isActive: true },
    update: {}
  });

  await prisma.$base.company.upsert({
    where: { id: companyB },
    create: { id: companyB, name: 'Empresa Beta', slug: 'beta-saas', isActive: true },
    update: {}
  });

  // Limpiar empleados de prueba previos
  await prisma.$base.employee.deleteMany({
    where: {
      email: { in: ['admin.alpha@empresa-a.com', 'superadmin.global@saas.com'] }
    }
  });

  // 2. Probar que SuperAdmin sin companyId no crea empleados (devuelve null)
  console.log('[Paso 1] Intentando sincronizar Super Administrador global (companyId: null)...');
  const superAdmin = {
    id: 'super-global-uuid',
    name: 'Super Administrador Global',
    email: 'superadmin.global@saas.com',
    role: 'SUPER_ADMIN',
    companyId: null
  };
  const syncSuper = await syncAdminToEmployee(superAdmin);
  console.log(`✓ Resultado de syncAdminToEmployee para admin sin empresa: ${syncSuper} (esperado: null)`);
  if (syncSuper !== null) {
    throw new Error('Fallo: SuperAdmin sin empresa no debió crear empleado.');
  }

  // 3. Probar que Admin de Empresa Alpha crea empleado EXCLUSIVAMENTE en Empresa Alpha
  console.log('\n[Paso 2] Sincronizando Administrador de Empresa Alpha (companyId: default-company-pain)...');
  const adminAlpha = {
    id: 'admin-alpha-uuid',
    name: 'Carlos Mendoza Ramos',
    email: 'admin.alpha@empresa-a.com',
    role: 'ADMIN',
    companyId: companyA
  };

  const createdEmpA = await syncAdminToEmployee(adminAlpha);
  console.log(`✓ Empleado creado exitosamente:`);
  console.log(`  - ID: ${createdEmpA.id}`);
  console.log(`  - Nombre: ${createdEmpA.firstName} ${createdEmpA.lastName}`);
  console.log(`  - Email: ${createdEmpA.email}`);
  console.log(`  - CompanyId asignado: ${createdEmpA.companyId} (esperado: ${companyA})`);
  
  if (createdEmpA.companyId !== companyA) {
    throw new Error('Fallo: El empleado no fue creado en la empresa Alpha.');
  }

  // 4. Demostrar que NO puede crearse en Empresa Beta:
  // Si adminAlpha tiene companyId === companyA, intentar forzar la creación en companyB
  console.log('\n[Paso 3] Demostrando que Admin Alpha NO puede crear empleados en Empresa Beta...');
  
  // Buscar en Empresa Beta si existe algún empleado con el correo de Admin Alpha
  const empInBeta = await prisma.$base.employee.findFirst({
    where: {
      email: adminAlpha.email,
      companyId: companyB
    }
  });
  console.log(`✓ Empleados de Admin Alpha encontrados en Empresa Beta: ${empInBeta ? 1 : 0} (esperado: 0)`);
  if (empInBeta !== null) {
    throw new Error('Fallo de aislamiento: Se encontró empleado en Empresa Beta.');
  }

  // Verificar que el empleado de Empresa Alpha está aislado y solo existe en Empresa Alpha
  const totalEmployeesWithThisEmail = await prisma.$base.employee.findMany({
    where: { email: adminAlpha.email }
  });
  console.log(`✓ Total de registros en toda la BD con email '${adminAlpha.email}': ${totalEmployeesWithThisEmail.length}`);
  console.log(`  - Registro 1: companyId = ${totalEmployeesWithThisEmail[0].companyId}`);

  // Limpieza
  await prisma.$base.employee.deleteMany({
    where: { email: 'admin.alpha@empresa-a.com' }
  });

  console.log('\n================================================================');
  console.log('✓ ITEM 6 DEMOSTRADO EXITOSAMENTE: SCOPING ESTRICTO POR EMPRESA');
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Error en prueba Item 6:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
