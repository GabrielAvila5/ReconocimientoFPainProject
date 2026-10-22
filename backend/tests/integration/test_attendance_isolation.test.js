/**
 * PRUEBA HTTP REAL: AISLAMIENTO MULTI-TENANT DEL MÓDULO ATTENDANCE (GATE 3B - LOTE 1)
 * Verifica mediante Supertest contra MariaDB de pruebas:
 * 1. Aislamiento en GET /api/v1/attendance (Admin A solo ve checadas de su empresa, nunca de B).
 * 2. Rechazo de checada cross-tenant en POST /api/v1/attendance/register (dispositivo de Beta intentando checar a empleado de Alpha).
 * 3. Checada legítima en POST /api/v1/attendance/register (dispositivo de Alpha checando a empleado de Alpha con asignación segura de companyId).
 * 4. Teardown determinista y limpio.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../../src/app');
const prismaAdmin = require('../../src/utils/prismaAdmin');
const { JWT_SECRET } = require('../../src/config/secrets');

const companyAlpha = 'company-alpha-att-test';
const companyBeta = 'company-beta-att-test';

const KIOSK_API_KEY = process.env.KIOSK_API_KEY || 'kiosk-secret-key-123';

async function runAttendanceIsolationTests() {
  console.log('================================================================');
  console.log('>>> PRUEBA HTTP REAL: AISLAMIENTO DEL MÓDULO ATTENDANCE');
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

  // Setup: Crear empresas de prueba
  await prismaAdmin.company.upsert({
    where: { id: companyAlpha },
    create: { id: companyAlpha, name: 'Empresa Alpha Asistencias', slug: 'alpha-att-saas', isActive: true },
    update: { isActive: true }
  });

  await prismaAdmin.company.upsert({
    where: { id: companyBeta },
    create: { id: companyBeta, name: 'Empresa Beta Asistencias', slug: 'beta-att-saas', isActive: true },
    update: { isActive: true }
  });

  // Admin users
  await prismaAdmin.adminUser.upsert({
    where: { id: 'admin-alpha-att-id' },
    create: { id: 'admin-alpha-att-id', companyId: companyAlpha, name: 'Admin Alpha Att', role: 'ADMIN', email: 'admin.alpha.att@test.com', password: 'hash' },
    update: { companyId: companyAlpha }
  });

  await prismaAdmin.adminUser.upsert({
    where: { id: 'admin-beta-att-id' },
    create: { id: 'admin-beta-att-id', companyId: companyBeta, name: 'Admin Beta Att', role: 'ADMIN', email: 'admin.beta.att@test.com', password: 'hash' },
    update: { companyId: companyBeta }
  });

  const tokenAdminAlpha = jwt.sign(
    { id: 'admin-alpha-att-id', companyId: companyAlpha, role: 'ADMIN', email: 'admin.alpha.att@test.com' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const tokenAdminBeta = jwt.sign(
    { id: 'admin-beta-att-id', companyId: companyBeta, role: 'ADMIN', email: 'admin.beta.att@test.com' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Departamentos
  const deptAlpha = await prismaAdmin.department.upsert({
    where: { companyId_name: { companyId: companyAlpha, name: 'Depto Alpha Att' } },
    create: { companyId: companyAlpha, name: 'Depto Alpha Att' },
    update: {}
  });

  const deptBeta = await prismaAdmin.department.upsert({
    where: { companyId_name: { companyId: companyBeta, name: 'Depto Beta Att' } },
    create: { companyId: companyBeta, name: 'Depto Beta Att' },
    update: {}
  });

  let empAlpha = null;
  let empBeta = null;
  let devAlpha = null;
  let devBeta = null;
  let attAlphaInitial = null;
  let attBetaInitial = null;

  try {
    // Empleados
    empAlpha = await prismaAdmin.employee.create({
      data: {
        companyId: companyAlpha,
        firstName: 'Elena',
        lastName: 'Alpha',
        identifier: 'ATT-ALPHA-01',
        departmentId: deptAlpha.id
      }
    });

    empBeta = await prismaAdmin.employee.create({
      data: {
        companyId: companyBeta,
        firstName: 'Mateo',
        lastName: 'Beta',
        identifier: 'ATT-BETA-01',
        departmentId: deptBeta.id
      }
    });

    // Dispositivos (Kioscos)
    const tokenDevAlpha = 'dev-token-alpha-uuid-12345';
    const tokenDevBeta = 'dev-token-beta-uuid-67890';

    devAlpha = await prismaAdmin.device.create({
      data: {
        companyId: companyAlpha,
        name: 'Kiosco Puerta Alpha',
        token: tokenDevAlpha,
        status: 'ONLINE',
        isActive: true
      }
    });

    devBeta = await prismaAdmin.device.create({
      data: {
        companyId: companyBeta,
        name: 'Kiosco Puerta Beta',
        token: tokenDevBeta,
        status: 'ONLINE',
        isActive: true
      }
    });

    // Asistencia inicial para cada uno
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    attAlphaInitial = await prismaAdmin.attendanceRecord.create({
      data: {
        companyId: companyAlpha,
        employeeId: empAlpha.id,
        date: today,
        entrada: new Date(),
        deviceId: devAlpha.id
      }
    });

    attBetaInitial = await prismaAdmin.attendanceRecord.create({
      data: {
        companyId: companyBeta,
        employeeId: empBeta.id,
        date: today,
        entrada: new Date(),
        deviceId: devBeta.id
      }
    });

    // 1. GET /api/v1/attendance - Aislamiento en panel administrativo
    console.log('--- 1. Verificando aislamiento en GET /api/v1/attendance ---');
    const resListAlpha = await request(app)
      .get('/api/v1/attendance')
      .set('Authorization', `Bearer ${tokenAdminAlpha}`);

    assert(resListAlpha.status === 200, 'GET /api/v1/attendance para Alpha responde HTTP 200');
    const alphaRecordsInAlpha = resListAlpha.body.records?.some(r => r.id === attAlphaInitial.id);
    const betaRecordsInAlpha = resListAlpha.body.records?.some(r => r.id === attBetaInitial.id);
    assert(alphaRecordsInAlpha === true, 'Admin Alpha ve el registro de asistencia de Elena Alpha');
    assert(betaRecordsInAlpha === false, 'Admin Alpha NO ve el registro de asistencia de Mateo Beta');

    const resListBeta = await request(app)
      .get('/api/v1/attendance')
      .set('Authorization', `Bearer ${tokenAdminBeta}`);

    assert(resListBeta.status === 200, 'GET /api/v1/attendance para Beta responde HTTP 200');
    const betaRecordsInBeta = resListBeta.body.records?.some(r => r.id === attBetaInitial.id);
    const alphaRecordsInBeta = resListBeta.body.records?.some(r => r.id === attAlphaInitial.id);
    assert(betaRecordsInBeta === true, 'Admin Beta ve el registro de asistencia de Mateo Beta');
    assert(alphaRecordsInBeta === false, 'Admin Beta NO ve el registro de asistencia de Elena Alpha');

    // 2. POST /api/v1/attendance/register - Intento de checada Cross-Tenant
    // Dispositivo Beta intentando checar a Elena Alpha (Empresa Alpha)
    console.log('\n--- 2. Verificando rechazo de checada cross-tenant en /register ---');
    const resCrossClockin = await request(app)
      .post('/api/v1/attendance/register')
      .set('x-api-key', KIOSK_API_KEY)
      .set('x-device-token', tokenDevBeta) // Dispositivo de Beta
      .send({
        employeeId: empAlpha.id, // Empleado de Alpha!
        action: 'salida'
      });

    assert(
      resCrossClockin.status === 400 || resCrossClockin.status === 403 || resCrossClockin.status === 404,
      `Checada cross-tenant rechazada con HTTP 400/403/404 (obtuvo ${resCrossClockin.status})`
    );

    // 3. POST /api/v1/attendance/register - Checada legítima de salida
    console.log('\n--- 3. Verificando checada legítima para empleado y dispositivo de la misma empresa ---');
    const resValidClockin = await request(app)
      .post('/api/v1/attendance/register')
      .set('x-api-key', KIOSK_API_KEY)
      .set('x-device-token', tokenDevAlpha) // Dispositivo de Alpha
      .send({
        employeeId: empAlpha.id, // Empleado de Alpha
        action: 'salida'
      });

    assert(resValidClockin.status === 200, `Checada legítima aceptada con HTTP 200 (obtuvo ${resValidClockin.status})`);
    
    // Verificar en BD que el registro de salida pertenece a companyAlpha y deviceAlpha
    const updatedRecord = await prismaAdmin.attendanceRecord.findUnique({
      where: { id: attAlphaInitial.id }
    });
    assert(updatedRecord.salida !== null, 'La hora de salida fue registrada');
    assert(updatedRecord.companyId === companyAlpha, 'El registro de asistencia mantiene companyId = companyAlpha');
    assert(updatedRecord.deviceId === devAlpha.id, 'El registro de asistencia mantiene deviceId = devAlpha');

  } finally {
    console.log('\n--- Limpieza determinista de datos de prueba ---');
    try {
      if (empAlpha) {
        await prismaAdmin.attendanceRecord.deleteMany({ where: { employeeId: empAlpha.id } });
      }
      if (empBeta) {
        await prismaAdmin.attendanceRecord.deleteMany({ where: { employeeId: empBeta.id } });
      }
      if (devAlpha) {
        await prismaAdmin.device.deleteMany({ where: { id: devAlpha.id } });
      }
      if (devBeta) {
        await prismaAdmin.device.deleteMany({ where: { id: devBeta.id } });
      }
      if (empAlpha) {
        await prismaAdmin.employee.deleteMany({ where: { id: empAlpha.id } });
      }
      if (empBeta) {
        await prismaAdmin.employee.deleteMany({ where: { id: empBeta.id } });
      }
      await prismaAdmin.department.deleteMany({
        where: { id: { in: [deptAlpha.id, deptBeta.id] } }
      });
      await prismaAdmin.adminUser.deleteMany({
        where: { id: { in: ['admin-alpha-att-id', 'admin-beta-att-id'] } }
      });
      await prismaAdmin.company.deleteMany({
        where: { id: { in: [companyAlpha, companyBeta] } }
      });
      console.log('Teardown completado exitosamente.');
    } catch (cleanupErr) {
      console.error('Error durante teardown:', cleanupErr.message);
    }
  }

  console.log(`\nResultado final: ${passed} pasadas, ${failed} fallidas`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runAttendanceIsolationTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error fatal en prueba de asistencias:', err);
      process.exit(1);
    });
}

module.exports = { runAttendanceIsolationTests };
