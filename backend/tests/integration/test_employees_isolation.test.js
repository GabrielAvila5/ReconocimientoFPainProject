/**
 * PRUEBA HTTP REAL: AISLAMIENTO MULTI-TENANT DEL MÓDULO EMPLOYEES (GATE 3B - LOTE 1)
 * Verifica mediante Supertest contra MariaDB de pruebas:
 * 1. Aislamiento en GET /api/v1/employees (cada empresa solo ve sus empleados).
 * 2. Aislamiento en GET /api/v1/employees/:id (Admin B recibe 404 al consultar empleado de A).
 * 3. Aislamiento en PUT /api/v1/employees/:id (Admin B recibe 404 al intentar modificar empleado de A).
 * 4. Aislamiento en DELETE /api/v1/employees/:id (Admin B recibe 404 al intentar borrar empleado de A).
 * 5. Rechazo de conexión a departamento foráneo (Admin A no puede vincular empleado a depto de B).
 * 6. Límite de plan maxEmployees (HTTP 403 PLAN_LIMIT_EXCEEDED al superar la cuota contratada).
 * 7. Teardown determinista y limpio.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../../src/app');
const prismaAdmin = require('../../src/utils/prismaAdmin');
const { JWT_SECRET } = require('../../src/config/secrets');

const companyAlpha = 'company-alpha-emp-test';
const companyBeta = 'company-beta-emp-test';

async function runEmployeesIsolationTests() {
  console.log('================================================================');
  console.log('>>> PRUEBA HTTP REAL: AISLAMIENTO DEL MÓDULO EMPLOYEES');
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

  // Setup: Inquilinos con límites de plan explícitos
  await prismaAdmin.company.upsert({
    where: { id: companyAlpha },
    create: { 
      id: companyAlpha, 
      name: 'Empresa Alpha Empleados', 
      slug: 'alpha-emp-saas', 
      isActive: true,
      maxEmployees: 2, // Límite estricto de 2 empleados para prueba
      maxDevices: 3
    },
    update: { isActive: true, maxEmployees: 2 }
  });

  await prismaAdmin.company.upsert({
    where: { id: companyBeta },
    create: { 
      id: companyBeta, 
      name: 'Empresa Beta Empleados', 
      slug: 'beta-emp-saas', 
      isActive: true,
      maxEmployees: 50,
      maxDevices: 5
    },
    update: { isActive: true, maxEmployees: 50 }
  });

  // Asegurar admin users
  await prismaAdmin.adminUser.upsert({
    where: { id: 'admin-alpha-emp-id' },
    create: { 
      id: 'admin-alpha-emp-id', 
      companyId: companyAlpha, 
      name: 'Admin Alpha Emp', 
      role: 'ADMIN', 
      email: 'admin.alpha.emp@test.com', 
      password: 'hash' 
    },
    update: { companyId: companyAlpha }
  });

  await prismaAdmin.adminUser.upsert({
    where: { id: 'admin-beta-emp-id' },
    create: { 
      id: 'admin-beta-emp-id', 
      companyId: companyBeta, 
      name: 'Admin Beta Emp', 
      role: 'ADMIN', 
      email: 'admin.beta.emp@test.com', 
      password: 'hash' 
    },
    update: { companyId: companyBeta }
  });

  // Departamentos para cada empresa
  const deptAlpha = await prismaAdmin.department.upsert({
    where: { companyId_name: { companyId: companyAlpha, name: 'Depto Alpha Test' } },
    create: { companyId: companyAlpha, name: 'Depto Alpha Test' },
    update: {}
  });

  const deptBeta = await prismaAdmin.department.upsert({
    where: { companyId_name: { companyId: companyBeta, name: 'Depto Beta Test' } },
    create: { companyId: companyBeta, name: 'Depto Beta Test' },
    update: {}
  });

  // Tokens JWT
  const tokenAlpha = jwt.sign(
    { id: 'admin-alpha-emp-id', companyId: companyAlpha, role: 'ADMIN', email: 'admin.alpha.emp@test.com' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const tokenBeta = jwt.sign(
    { id: 'admin-beta-emp-id', companyId: companyBeta, role: 'ADMIN', email: 'admin.beta.emp@test.com' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  let empAlpha1 = null;
  let empBeta1 = null;
  let empAlpha2 = null;

  try {
    // Crear empleado base en Alpha
    empAlpha1 = await prismaAdmin.employee.create({
      data: {
        companyId: companyAlpha,
        firstName: 'Carlos',
        lastName: 'Alpha',
        identifier: 'ALPHA-001',
        email: 'carlos.alpha@test.com',
        departmentId: deptAlpha.id
      }
    });

    // Crear empleado base en Beta
    empBeta1 = await prismaAdmin.employee.create({
      data: {
        companyId: companyBeta,
        firstName: 'Diana',
        lastName: 'Beta',
        identifier: 'BETA-001',
        email: 'diana.beta@test.com',
        departmentId: deptBeta.id
      }
    });

    // 1. GET /api/v1/employees - Aislamiento de listado
    console.log('\n--- 1. Verificando aislamiento en GET /api/v1/employees ---');
    const resListAlpha = await request(app)
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${tokenAlpha}`);

    assert(resListAlpha.status === 200, 'GET /api/v1/employees para Alpha retorna HTTP 200');
    const alphaFoundInAlpha = resListAlpha.body.some(e => e.id === empAlpha1.id);
    const betaFoundInAlpha = resListAlpha.body.some(e => e.id === empBeta1.id);
    assert(alphaFoundInAlpha === true, 'Admin Alpha ve a su empleado Carlos Alpha');
    assert(betaFoundInAlpha === false, 'Admin Alpha NO ve al empleado Diana Beta de Empresa Beta');

    const resListBeta = await request(app)
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${tokenBeta}`);

    assert(resListBeta.status === 200, 'GET /api/v1/employees para Beta retorna HTTP 200');
    const alphaFoundInBeta = resListBeta.body.some(e => e.id === empAlpha1.id);
    const betaFoundInBeta = resListBeta.body.some(e => e.id === empBeta1.id);
    assert(betaFoundInBeta === true, 'Admin Beta ve a su empleado Diana Beta');
    assert(alphaFoundInBeta === false, 'Admin Beta NO ve al empleado Carlos Alpha de Empresa Alpha');

    // 2. GET /api/v1/employees/:id - Aislamiento por ID directo
    console.log('\n--- 2. Verificando aislamiento en GET /api/v1/employees/:id ---');
    const resGetCross = await request(app)
      .get(`/api/v1/employees/${empAlpha1.id}`)
      .set('Authorization', `Bearer ${tokenBeta}`);

    assert(resGetCross.status === 404, `Admin Beta recibe HTTP 404 al consultar empleado de Alpha (obtuvo ${resGetCross.status})`);
    assert(!resGetCross.body.firstName, 'Admin Beta NO recibe ningún dato del empleado ajeno');

    // 3. PUT /api/v1/employees/:id - Aislamiento en actualización
    console.log('\n--- 3. Verificando aislamiento en PUT /api/v1/employees/:id ---');
    const resPutCross = await request(app)
      .put(`/api/v1/employees/${empAlpha1.id}`)
      .set('Authorization', `Bearer ${tokenBeta}`)
      .send({
        firstName: 'HACKED_BY_BETA',
        lastName: 'Alpha',
        identifier: 'ALPHA-001',
        departmentId: deptBeta.id
      });

    assert(resPutCross.status === 404, `Admin Beta recibe HTTP 404 al intentar modificar empleado de Alpha (obtuvo ${resPutCross.status})`);
    
    // Verificar que empAlpha1 no fue alterado en base de datos
    const empAlphaCheck = await prismaAdmin.employee.findUnique({ where: { id: empAlpha1.id } });
    assert(empAlphaCheck.firstName === 'Carlos', 'El nombre del empleado de Alpha sigue siendo Carlos (sin corrupción)');

    // 4. DELETE /api/v1/employees/:id - Aislamiento en borrado
    console.log('\n--- 4. Verificando aislamiento en DELETE /api/v1/employees/:id ---');
    const resDelCross = await request(app)
      .delete(`/api/v1/employees/${empAlpha1.id}`)
      .set('Authorization', `Bearer ${tokenBeta}`);

    assert(resDelCross.status === 404, `Admin Beta recibe HTTP 404 al intentar borrar empleado de Alpha (obtuvo ${resDelCross.status})`);
    const empAlphaExists = await prismaAdmin.employee.findUnique({ where: { id: empAlpha1.id } });
    assert(empAlphaExists !== null, 'El empleado de Alpha sigue existiendo en BD tras intento de borrado ajeno');

    // 5. POST /api/v1/employees - Intento de vincular departamento de otra empresa
    console.log('\n--- 5. Verificando rechazo de departamento ajeno en creación ---');
    const resCrossDept = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${tokenAlpha}`)
      .send({
        firstName: 'Infiltrado',
        lastName: 'Alpha',
        identifier: 'ALPHA-CROSS-01',
        email: 'cross.dept@test.com',
        departmentId: deptBeta.id // Depto de Beta!
      });

    assert(resCrossDept.status === 400 || resCrossDept.status === 404, `Creación con departamento ajeno es rechazada con HTTP 400/404 (obtuvo ${resCrossDept.status})`);

    // 6. Plan Limit Enforcement (maxEmployees)
    console.log('\n--- 6. Verificando enforcement de límite de plan (maxEmployees = 2) ---');
    // Empresa Alpha ya tiene empAlpha1 (1 de 2).
    // Crear el segundo empleado (alcanza el límite de 2)
    const resEmp2 = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${tokenAlpha}`)
      .send({
        firstName: 'Eduardo',
        lastName: 'Alpha Dos',
        identifier: 'ALPHA-002',
        email: 'eduardo.alpha@test.com',
        departmentId: deptAlpha.id
      });

    assert(resEmp2.status === 201, `Creación de 2do empleado (cuota 2/2) exitosa con HTTP 201 (obtuvo ${resEmp2.status})`);
    if (resEmp2.status === 201) {
      empAlpha2 = resEmp2.body;
    }

    // Intentar crear el tercer empleado (excede el límite de 2)
    const resEmp3Exceeded = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${tokenAlpha}`)
      .send({
        firstName: 'Fernando',
        lastName: 'Alpha Tres Excedido',
        identifier: 'ALPHA-003',
        email: 'fernando.exceeded@test.com',
        departmentId: deptAlpha.id
      });

    assert(resEmp3Exceeded.status === 403, `Intento de exceder maxEmployees devuelve HTTP 403 (obtuvo ${resEmp3Exceeded.status})`);
    assert(resEmp3Exceeded.body.error === 'PLAN_LIMIT_EXCEEDED', `Error code es PLAN_LIMIT_EXCEEDED (obtuvo ${resEmp3Exceeded.body.error})`);

  } finally {
    // Teardown determinista
    console.log('\n--- Limpieza determinista de datos de prueba ---');
    try {
      if (empAlpha2 && empAlpha2.id) {
        await prismaAdmin.employee.deleteMany({ where: { id: empAlpha2.id } });
      }
      if (empAlpha1 && empAlpha1.id) {
        await prismaAdmin.employee.deleteMany({ where: { id: empAlpha1.id } });
      }
      if (empBeta1 && empBeta1.id) {
        await prismaAdmin.employee.deleteMany({ where: { id: empBeta1.id } });
      }
      // Limpiar por identificador por si falló la creación
      await prismaAdmin.employee.deleteMany({
        where: { identifier: { in: ['ALPHA-001', 'ALPHA-002', 'ALPHA-003', 'ALPHA-CROSS-01', 'BETA-001'] } }
      });
      await prismaAdmin.department.deleteMany({
        where: { id: { in: [deptAlpha.id, deptBeta.id] } }
      });
      await prismaAdmin.adminUser.deleteMany({
        where: { id: { in: ['admin-alpha-emp-id', 'admin-beta-emp-id'] } }
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
  runEmployeesIsolationTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error fatal en prueba de empleados:', err);
      process.exit(1);
    });
}

module.exports = { runEmployeesIsolationTests };
