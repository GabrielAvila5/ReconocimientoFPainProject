/**
 * PRUEBA DE INTEGRACIÓN: SINCRONIZACIÓN ADMIN-EMPLEADO (OPCIÓN A)
 * 
 * Verifica que:
 * 1. Admin sin la casilla opt-in NO crea empleado ni consume cupo.
 * 2. Super Admin NUNCA genera empleado.
 * 3. Admin con casilla opt-in crea empleado y consume cupo si hay límite disponible.
 * 4. Si se excede maxEmployees con la casilla marcada, devuelve HTTP 403 PLAN_LIMIT_EXCEEDED.
 * 5. Los administradores ya enlazados a un empleado se respetan y mantienen.
 */

const request = require('supertest');
const { app } = require('../../src/app');
const prisma = require('../../src/utils/prisma');
const prismaAdmin = require('../../src/utils/prismaAdmin');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../src/config/secrets');
const { syncAdminToEmployee, syncAllAdminsToEmployees } = require('../../src/utils/adminEmployeeSync');

async function runAdminEmployeeSyncTests() {
  console.log('================================================================');
  console.log('>>> PRUEBA: SINCRONIZACIÓN ADMIN-EMPLEADO (OPCIÓN A)');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  const prefix = `sync_optA_${Date.now()}`;
  let companyId = null;
  let superAdminId = null;
  let adminCreatorId = null;
  let tokenAdminCreator = null;

  try {
    // -------------------------------------------------------------------------
    // SETUP: Empresa con límite estricto de 2 empleados
    // -------------------------------------------------------------------------
    const company = await prismaAdmin.company.create({
      data: {
        id: `${prefix}_co`,
        name: 'Empresa Test Opción A',
        slug: `${prefix}-opt-a`,
        isActive: true,
        maxEmployees: 2, // Límite estricto de 2 empleados
        maxDevices: 5
      }
    });
    companyId = company.id;

    // Crear departamento inicial
    const dept = await prismaAdmin.department.create({
      data: {
        name: 'Administración General',
        companyId
      }
    });

    // Admin creador
    const adminCreator = await prismaAdmin.adminUser.create({
      data: {
        email: `${prefix}.creator@opta.com`,
        name: 'Creador Administradores',
        password: 'hashedpassword123',
        role: 'ADMIN',
        companyId
      }
    });
    adminCreatorId = adminCreator.id;

    tokenAdminCreator = jwt.sign(
      { id: adminCreator.id, email: adminCreator.email, role: 'ADMIN', companyId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Super Admin global (sin companyId)
    const superAdmin = await prismaAdmin.adminUser.create({
      data: {
        email: `${prefix}.super@opta.com`,
        name: 'Super Admin Global',
        password: 'hashedpassword123',
        role: 'SUPER_ADMIN',
        companyId: null
      }
    });
    superAdminId = superAdmin.id;

    // -------------------------------------------------------------------------
    // CASO 1: Admin creado SIN la casilla opt-in (desmarcada por defecto)
    // -------------------------------------------------------------------------
    console.log('--- 1. Admin creado SIN la casilla opt-in (desmarcada por defecto) ---');
    const resNoSync = await request(app)
      .post('/api/v1/admins')
      .set('Authorization', `Bearer ${tokenAdminCreator}`)
      .send({
        name: 'Admin Sin Casilla',
        email: `${prefix}.nosync@opta.com`,
        password: 'Password1234!',
        syncEmployee: false // Casilla desmarcada
      });

    assert(resNoSync.status === 201, `Admin creado exitosamente con HTTP 201 (obtuvo ${resNoSync.status})`);
    assert(resNoSync.body.employee === null, 'Respuesta confirma que employee es null');

    // Verificar en BD que NO existe registro en Employee
    const empInDb = await prismaAdmin.employee.findFirst({
      where: { email: `${prefix}.nosync@opta.com`, companyId }
    });
    assert(empInDb === null, 'NO se creó ningún registro en la tabla Employee');

    // Conteo de empleados sigue siendo 0
    const countAfterNoSync = await prismaAdmin.employee.count({ where: { companyId } });
    assert(countAfterNoSync === 0, `No consumió cupo de empleados (conteo actual: ${countAfterNoSync}/2)`);

    // -------------------------------------------------------------------------
    // CASO 2: Super Admin NUNCA genera empleado
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Super Admin NUNCA genera empleado ---');
    const syncSuperResult = await syncAdminToEmployee(superAdmin, {
      syncEmployee: true,
      companyId
    }, prismaAdmin);

    assert(syncSuperResult === null, 'syncAdminToEmployee retorna null para SUPER_ADMIN');
    const superEmpInDb = await prismaAdmin.employee.findFirst({
      where: { email: superAdmin.email }
    });
    assert(superEmpInDb === null, 'Super Admin nunca tiene registro en tabla Employee');

    // -------------------------------------------------------------------------
    // CASO 3: Admin creado CON la casilla opt-in marcada (syncEmployee = true)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Admin creado CON la casilla opt-in (syncEmployee: true) ---');
    const resWithSync1 = await request(app)
      .post('/api/v1/admins')
      .set('Authorization', `Bearer ${tokenAdminCreator}`)
      .send({
        name: 'Admin Con Casilla Uno',
        email: `${prefix}.sync1@opta.com`,
        password: 'Password1234!',
        syncEmployee: true // Casilla marcada
      });

    assert(resWithSync1.status === 201, `Admin creado exitosamente con HTTP 201 (obtuvo ${resWithSync1.status})`);
    assert(resWithSync1.body.employee !== null, 'Respuesta incluye datos del empleado enlazado');

    const emp1InDb = await prismaAdmin.employee.findFirst({
      where: { email: `${prefix}.sync1@opta.com`, companyId }
    });
    assert(emp1InDb !== null, 'Se creó correctamente el registro de Employee en la empresa');
    assert(emp1InDb.firstName === 'Admin' && emp1InDb.lastName === 'Con Casilla Uno', 'Nombre dividido correctamente (firstName: Admin, lastName: Con Casilla Uno)');

    const countAfterSync1 = await prismaAdmin.employee.count({ where: { companyId } });
    assert(countAfterSync1 === 1, `Consumió exactamente 1 cupo de empleados (conteo actual: ${countAfterSync1}/2)`);

    // Crear segundo empleado para llenar el cupo (2/2)
    const resWithSync2 = await request(app)
      .post('/api/v1/admins')
      .set('Authorization', `Bearer ${tokenAdminCreator}`)
      .send({
        name: 'Admin Con Casilla Dos',
        email: `${prefix}.sync2@opta.com`,
        password: 'Password1234!',
        syncEmployee: true
      });

    assert(resWithSync2.status === 201, `Segundo admin creado llenando el cupo a 2/2 (obtuvo ${resWithSync2.status})`);
    const countAfterSync2 = await prismaAdmin.employee.count({ where: { companyId } });
    assert(countAfterSync2 === 2, `Cupo de empleados lleno (conteo actual: ${countAfterSync2}/2)`);

    // -------------------------------------------------------------------------
    // CASO 4: Intento de crear admin con opt-in cuando el cupo está agotado
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Intento con opt-in cuando cupo maxEmployees está lleno (3ro cuando max=2) ---');
    const resExceeded = await request(app)
      .post('/api/v1/admins')
      .set('Authorization', `Bearer ${tokenAdminCreator}`)
      .send({
        name: 'Admin Intento Excedido',
        email: `${prefix}.exceeded@opta.com`,
        password: 'Password1234!',
        syncEmployee: true
      });

    assert(resExceeded.status === 403, `Petición rechazada con HTTP 403 por límite de plan (obtuvo ${resExceeded.status})`);
    assert(resExceeded.body.error === 'PLAN_LIMIT_EXCEEDED', `Código de error es PLAN_LIMIT_EXCEEDED (obtuvo ${resExceeded.body.error})`);

    // Verificar rollback: el AdminUser NO debe quedar registrado sin empleado cuando se pidió sync
    const rolledBackAdmin = await prismaAdmin.adminUser.findUnique({
      where: { email: `${prefix}.exceeded@opta.com` }
    });
    assert(rolledBackAdmin === null, 'Rollback exitoso: AdminUser no fue creado');

    // -------------------------------------------------------------------------
    // CASO 5: Administrador ya enlazado se respeta y mantiene
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Administrador ya enlazado se mantiene y respeta ---');
    // Simular ejecución de syncAllAdminsToEmployees (como en migración)
    const syncMigrationRes = await syncAllAdminsToEmployees(prismaAdmin);
    assert(syncMigrationRes.success === true, 'syncAllAdminsToEmployees ejecutado exitosamente');

    // Comprobar que los empleados enlazados siguen intactos y activos
    const emp1Verify = await prismaAdmin.employee.findFirst({
      where: { email: `${prefix}.sync1@opta.com`, companyId }
    });
    assert(emp1Verify !== null && emp1Verify.isActive === true, 'Empleado ya enlazado se mantiene intacto y activo');

    // Y el admin sin casilla NO fue creado como empleado durante la migración
    const empNoSyncVerify = await prismaAdmin.employee.findFirst({
      where: { email: `${prefix}.nosync@opta.com`, companyId }
    });
    assert(empNoSyncVerify === null, 'Admin sin casilla previa NO fue convertido en empleado durante migración');

  } finally {
    // -------------------------------------------------------------------------
    // TEARDOWN: Limpieza determinista
    // -------------------------------------------------------------------------
    console.log('\n--- Limpieza determinista de datos de prueba ---');
    if (companyId) {
      await prismaAdmin.adminAuditLog.deleteMany({
        where: { targetEmail: { contains: prefix } }
      });
      await prismaAdmin.employee.deleteMany({
        where: { companyId }
      });
      await prismaAdmin.adminUser.deleteMany({
        where: { email: { contains: prefix } }
      });
      await prismaAdmin.department.deleteMany({
        where: { companyId }
      });
      await prismaAdmin.company.deleteMany({
        where: { id: companyId }
      });
    }
    console.log('Teardown completado exitosamente.');
  }

  console.log(`\nResultado final: ${passed} pasadas, ${failed} fallidas\n`);
  if (failed > 0) {
    throw new Error(`Fallaron ${failed} aserciones en test_admin_employee_sync_option_a.`);
  }
}

if (require.main === module) {
  runAdminEmployeeSyncTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error fatal en prueba de sincronización admin-empleado:', err);
      process.exit(1);
    });
}

module.exports = { runAdminEmployeeSyncTests };
