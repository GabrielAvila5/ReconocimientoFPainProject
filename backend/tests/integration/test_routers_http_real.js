/**
 * PRUEBAS DE INTEGRACIÓN HTTP REALES CON SUPERTEST
 * Valida respuestas HTTP reales (P2003 -> 409 y desactivación -> 200)
 * utilizando datos efímeros creados y destruidos en la propia prueba.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../../src/app');
const prismaAdmin = require('../../src/utils/prismaAdmin');

const JWT_SECRET = process.env.JWT_SECRET || 'HostingerFallbackSecretKey2026!';

async function runRealHttpTests() {
  console.log('================================================================');
  console.log('>>> [7] PRUEBAS HTTP REALES CON SUPERTEST CONTRA EXPRESS APP');
  console.log('================================================================\n');

  // Asegurar que el turno original 3 permanezca activo
  await prismaAdmin.shift.updateMany({
    where: { id: 3 },
    data: { isActive: true }
  });

  // 1. Generar token JWT auténtico para administrador con companyId
  const token = jwt.sign(
    { id: 'admin-supertest-id', companyId: 'default-company-pain', email: 'admin@supertest.com', role: 'ADMIN', name: 'Admin Supertest' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log('🔑 Token JWT de autenticación generado.');

  let testDept = null;
  let testEmp = null;
  let testShift = null;
  let testAtt = null;

  try {
    // Crear datos de prueba aislados y efímeros
    testDept = await prismaAdmin.department.create({
      data: {
        name: `Depto Test Http-${Date.now()}`,
        companyId: 'default-company-pain'
      }
    });

    testEmp = await prismaAdmin.employee.create({
      data: {
        firstName: 'Empleado',
        lastName: 'Test Http',
        identifier: `HTTP-EMP-${Date.now()}`,
        companyId: 'default-company-pain',
        departmentId: testDept.id
      }
    });

    testShift = await prismaAdmin.shift.create({
      data: {
        name: `Turno Test Http-${Date.now()}`,
        startTime: '08:00',
        endTime: '16:00',
        companyId: 'default-company-pain',
        isActive: true
      }
    });

    testAtt = await prismaAdmin.attendanceRecord.create({
      data: {
        date: new Date(),
        companyId: 'default-company-pain',
        employeeId: testEmp.id,
        shiftId: testShift.id
      }
    });

    // Test 7.1: DELETE /api/v1/departments/:id con empleados vinculados (dispara P2003 en MariaDB y retorna 409)
    console.log('\n* Test 7.1: Petición HTTP DELETE /api/v1/departments/:id (con empleados asignados -> P2003 capturado)...');
    const deptRes = await request(app)
      .delete(`/api/v1/departments/${testDept.id}`)
      .set('Authorization', `Bearer ${token}`);

    console.log(`  -> Status HTTP recibido: ${deptRes.status}`);
    console.log('  -> Headers Content-Type:', deptRes.headers['content-type']);
    console.log('  -> Body recibido:', JSON.stringify(deptRes.body, null, 2));

    if (deptRes.status === 409 && deptRes.body.error && deptRes.body.error.includes('No se puede eliminar el departamento')) {
      console.log('  ✅ TEST 7.1 EXITOSO: MariaDB FK restrict disparó P2003, capturado por el router y respondido como HTTP 409.');
    } else {
      throw new Error(`TEST 7.1 FALLIDO: Se esperaba 409 pero se recibió ${deptRes.status}`);
    }

    // Test 7.2: DELETE /api/v1/shifts/:id con asistencias vinculadas (regla de negocio: desactivar)
    console.log('\n* Test 7.2: Petición HTTP DELETE /api/v1/shifts/:id (con asistencias -> desactivar)...');
    const shiftAttRes = await request(app)
      .delete(`/api/v1/shifts/${testShift.id}`)
      .set('Authorization', `Bearer ${token}`);

    console.log(`  -> Status HTTP recibido: ${shiftAttRes.status}`);
    console.log('  -> Body recibido:', JSON.stringify(shiftAttRes.body, null, 2));

    if (shiftAttRes.status === 200 && shiftAttRes.body.shift && shiftAttRes.body.shift.isActive === false) {
      console.log('  ✅ TEST 7.2 EXITOSO: HTTP 200 devuelto con turno desactivado (isActive: false).');
    } else {
      throw new Error(`TEST 7.2 FALLIDO: Se esperaba 200 con isActive: false pero se recibió ${shiftAttRes.status}`);
    }

  } finally {
    // TEARDOWN RIGUROSO
    if (testAtt) {
      await prismaAdmin.attendanceRecord.deleteMany({ where: { id: testAtt.id } });
    }
    if (testEmp) {
      await prismaAdmin.employee.deleteMany({ where: { id: testEmp.id } });
    }
    if (testDept) {
      await prismaAdmin.department.deleteMany({ where: { id: testDept.id } });
    }
    if (testShift) {
      await prismaAdmin.shift.deleteMany({ where: { id: testShift.id } });
    }
  }

  console.log('\n================================================================');
  console.log('  TODAS LAS PRUEBAS HTTP CON SUPERTEST HAN PASADO SATISFACTORIAMENTE');
  console.log('================================================================');
}

runRealHttpTests().catch(err => {
  console.error('❌ Error en pruebas Supertest:', err);
  process.exit(1);
}).finally(() => prismaAdmin.$disconnect());
