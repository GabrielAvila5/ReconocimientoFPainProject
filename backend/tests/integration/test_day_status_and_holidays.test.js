require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl.includes('reconocimiento_test_copia_saas') && !dbUrl.includes('_test')) {
  console.error('\n🚨 ERROR CRÍTICO: No es la base de datos de prueba.');
  process.exit(1);
}

const request = require('supertest');
const { app } = require('../../src/app');
const prismaAdmin = require('../../src/utils/prismaAdmin');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const COMPANY_ID = 'test-co-daystatus-phase2';
const EMP_ID = 'emp-daystatus-phase2';
const KIOSK_RAW = 'raw-kiosk-phase2-secret-token-12345';
const KIOSK_HASH = crypto.createHash('sha256').update(KIOSK_RAW).digest('hex');

const jwtToken = jwt.sign(
  { id: 'admin-phase2-id', email: 'admin@phase2.com', role: 'ADMIN', companyId: COMPANY_ID },
  process.env.JWT_SECRET || 'super-secret-key-for-jwt-32bytes'
);

async function runPhase2IntegrationTests() {
  console.log('================================================================');
  console.log('>>> TEST DE INTEGRACIÓN: Fase 2 (Festivos, Descansos, Snapshots)');
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

  try {
    // 1. Setup en BD
    console.log('[Setup] Creando empresa, admin, dispositivo y empleado de prueba...');
    await prismaAdmin.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'Empresa Fase 2 Test', slug: 'co-phase2-slug', isActive: true },
      update: { isActive: true }
    });

    await prismaAdmin.adminUser.upsert({
      where: { id: 'admin-phase2-id' },
      create: { id: 'admin-phase2-id', companyId: COMPANY_ID, name: 'Admin P2', email: 'admin@phase2.com', password: 'hash', role: 'ADMIN' },
      update: { companyId: COMPANY_ID }
    });

    await prismaAdmin.device.upsert({
      where: { id: 'kiosk-phase2-id' },
      create: { id: 'kiosk-phase2-id', companyId: COMPANY_ID, name: 'Kiosko P2', tokenHash: KIOSK_HASH, isActive: true },
      update: { tokenHash: KIOSK_HASH, isActive: true }
    });

    // Empleado con turno de Martes a Domingo (Lunes descansa)
    const shiftSchedule = {
      "1": { enabled: false }, // Descansa Lunes
      "2": { enabled: true, startTime: "08:00", endTime: "16:00", tolerance: 10 },
      "3": { enabled: true, startTime: "08:00", endTime: "16:00", tolerance: 10 },
      "4": { enabled: true, startTime: "08:00", endTime: "16:00", tolerance: 10 },
      "5": { enabled: true, startTime: "08:00", endTime: "16:00", tolerance: 10 },
      "6": { enabled: true, startTime: "08:00", endTime: "16:00", tolerance: 10 },
      "7": { enabled: true, startTime: "08:00", endTime: "16:00", tolerance: 10 }
    };

    const shift = await prismaAdmin.shift.upsert({
      where: { companyId_name: { companyId: COMPANY_ID, name: 'Turno Martes a Domingo' } },
      create: {
        companyId: COMPANY_ID,
        name: 'Turno Martes a Domingo',
        startTime: '08:00',
        endTime: '16:00',
        tolerance: 10,
        scheduleByDay: shiftSchedule
      },
      update: { scheduleByDay: shiftSchedule }
    });

    await prismaAdmin.employee.upsert({
      where: { companyId_identifier: { companyId: COMPANY_ID, identifier: 'EMP-P2-01' } },
      create: {
        id: EMP_ID,
        companyId: COMPANY_ID,
        firstName: 'Carlos',
        lastName: 'Pruebas',
        identifier: 'EMP-P2-01',
        isActive: true
      },
      update: { isActive: true }
    });

    await prismaAdmin.employeeShift.upsert({
      where: { employeeId_shiftId: { employeeId: EMP_ID, shiftId: shift.id } },
      create: { companyId: COMPANY_ID, employeeId: EMP_ID, shiftId: shift.id },
      update: {}
    });

    // 2. Test CRUD Festivos (/api/v1/holidays)
    console.log('\n[Prueba 1] CRUD de Días Festivos...');
    const createHolRes = await request(app)
      .post('/api/v1/holidays')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        name: 'Día de la Constitución Test',
        date: '2026-02-05',
        isMandatory: true
      });

    assert(createHolRes.status === 201, 'POST /api/v1/holidays crea festivo con status 201');
    assert(createHolRes.body.name === 'Día de la Constitución Test', 'El festivo tiene el nombre correcto');
    const createdHolId = createHolRes.body.id;

    const getHolsRes = await request(app)
      .get('/api/v1/holidays')
      .set('Authorization', `Bearer ${jwtToken}`);
    assert(getHolsRes.status === 200, 'GET /api/v1/holidays responde 200');
    assert(Array.isArray(getHolsRes.body) && getHolsRes.body.length >= 1, 'Lista de festivos contiene al menos 1 elemento');

    // 3. Test Checada en día de descanso / Kiosko (/api/v1/attendance/register)
    console.log('\n[Prueba 2] Checada en Kiosko en Día de Descanso o Turno Personalizado...');
    const regRes = await request(app)
      .post('/api/v1/attendance/register')
      .set('x-device-token', KIOSK_RAW)
      .send({
        employeeId: EMP_ID,
        action: 'entrada'
      });

    assert(regRes.status === 200, 'POST /api/v1/attendance/register responde 200 para entrada');
    assert(regRes.body.entrada !== undefined, 'Registra entrada correctamente');

    // 4. Test Consulta de rango /status-range
    console.log('\n[Prueba 3] Consulta consolidada de estados (/api/v1/attendance/status-range)...');
    const todayStr = new Date().toISOString().slice(0, 10);
    const statusRangeRes = await request(app)
      .get(`/api/v1/attendance/status-range?startDate=${todayStr}&endDate=${todayStr}`)
      .set('Authorization', `Bearer ${jwtToken}`);

    assert(statusRangeRes.status === 200, 'GET /api/v1/attendance/status-range responde 200');
    assert(Array.isArray(statusRangeRes.body), 'El resultado es un array estructurado');
    const empStatus = statusRangeRes.body.find(s => s.employeeId === EMP_ID);
    assert(empStatus !== undefined, 'El empleado evaluado se encuentra en la respuesta');
    assert(empStatus?.status !== undefined, `Estado devuelto para el empleado: ${empStatus?.status}`);

    // 5. Cleanup de festivo
    if (createdHolId) {
      const delHolRes = await request(app)
        .delete(`/api/v1/holidays/${createdHolId}`)
        .set('Authorization', `Bearer ${jwtToken}`);
      assert(delHolRes.status === 200, 'DELETE /api/v1/holidays/:id elimina el festivo correctamente');
    }

  } finally {
    // Teardown
    console.log('\n[Teardown] Limpiando registros creados para el test...');
    await prismaAdmin.attendanceDayStatus.deleteMany({ where: { companyId: COMPANY_ID } }).catch(() => {});
    await prismaAdmin.attendanceRecord.deleteMany({ where: { companyId: COMPANY_ID } }).catch(() => {});
    await prismaAdmin.employeeShift.deleteMany({ where: { companyId: COMPANY_ID } }).catch(() => {});
    await prismaAdmin.shift.deleteMany({ where: { companyId: COMPANY_ID } }).catch(() => {});
    await prismaAdmin.employee.deleteMany({ where: { companyId: COMPANY_ID } }).catch(() => {});
    await prismaAdmin.companyHoliday.deleteMany({ where: { companyId: COMPANY_ID } }).catch(() => {});
    await prismaAdmin.device.deleteMany({ where: { companyId: COMPANY_ID } }).catch(() => {});
    await prismaAdmin.adminUser.deleteMany({ where: { companyId: COMPANY_ID } }).catch(() => {});
    await prismaAdmin.company.deleteMany({ where: { id: COMPANY_ID } }).catch(() => {});
  }

  console.log(`\n================================================================`);
  console.log(`TOTAL RESULTADOS: ${passed} pasados, ${failed} fallados.`);
  console.log(`================================================================\n`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runPhase2IntegrationTests().catch(err => {
  console.error('Error durante pruebas de integración de Fase 2:', err);
  process.exit(1);
});
