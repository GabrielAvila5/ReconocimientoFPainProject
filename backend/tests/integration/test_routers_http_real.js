/**
 * PRUEBAS DE INTEGRACIÓN HTTP REALES CON SUPERTEST
 * Ejecuta peticiones HTTP reales contra la aplicación Express (app.js)
 * para validar la captura de errores P2003 y respuestas HTTP 409.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../../src/app');
const prisma = require('../../src/utils/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'HostingerFallbackSecretKey2026!';

async function runRealHttpTests() {
  console.log('================================================================');
  console.log('>>> [7] PRUEBAS HTTP REALES CON SUPERTEST CONTRA EXPRESS APP');
  console.log('================================================================\n');

  // 1. Generar token JWT auténtico para administrador con companyId
  const token = jwt.sign(
    { id: 'admin-supertest-id', companyId: 'default-company-pain', email: 'admin@supertest.com', role: 'ADMIN', name: 'Admin Supertest' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log('🔑 Token JWT de autenticación generado.');

  // Test 7.1: DELETE /api/v1/departments/:id con empleados vinculados (dispara P2003 en MariaDB y retorna 409)
  console.log('\n* Test 7.1: Petición HTTP DELETE /api/v1/departments/:id (con empleados asignados -> P2003 capturado)...');
  
  // Buscar un departamento que tenga empleados en la base actual
  const deptWithEmp = await (prisma.$base || prisma).department.findFirst({
    where: {
      employees: { some: {} }
    }
  });

  if (!deptWithEmp) {
    throw new Error('No se encontró departamento con empleados para la prueba.');
  }

  const deptRes = await request(app)
    .delete(`/api/v1/departments/${deptWithEmp.id}`)
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
  const shiftWithAtt = await (prisma.$base || prisma).shift.findFirst({
    where: {
      attendances: { some: {} }
    }
  });

  if (!shiftWithAtt) {
    throw new Error('No se encontró turno con asistencias para la prueba.');
  }

  const shiftAttRes = await request(app)
    .delete(`/api/v1/shifts/${shiftWithAtt.id}`)
    .set('Authorization', `Bearer ${token}`);

  console.log(`  -> Status HTTP recibido: ${shiftAttRes.status}`);
  console.log('  -> Body recibido:', JSON.stringify(shiftAttRes.body, null, 2));

  if (shiftAttRes.status === 200 && shiftAttRes.body.shift && shiftAttRes.body.shift.isActive === false) {
    console.log('  ✅ TEST 7.2 EXITOSO: HTTP 200 devuelto con turno desactivado (isActive: false).');
  } else {
    throw new Error(`TEST 7.2 FALLIDO: Se esperaba 200 con isActive: false pero se recibió ${shiftAttRes.status}`);
  }

  console.log('\n================================================================');
  console.log('  TODAS LAS PRUEBAS HTTP CON SUPERTEST HAN PASADO SATISFACTORIAMENTE');
  console.log('================================================================');
}

runRealHttpTests()
  .catch((err) => {
    console.error('❌ Error en pruebas Supertest:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
