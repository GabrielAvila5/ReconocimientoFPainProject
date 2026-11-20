/**
 * TEST DE INTEGRACIÓN: SEGURIDAD ZERO-TRUST EN CABECERAS DE TENANT
 * 
 * Verifica:
 * 1. ADMIN estándar enviando x-tenant-id / x-branch-id (deben ser completamente ignorados).
 * 2. CORPORATE_ADMIN enviando x-branch-id de sucursal ajena -> 403 TENANT_SPOOFING_DETECTED.
 * 3. CORPORATE_ADMIN enviando x-branch-id de sucursal propia -> 200 OK.
 */

require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || '';
// Salvaguarda: Negarse rotundamente a correr si la base de datos no es la réplica local de pruebas
if (!dbUrl.includes('reconocimiento_test_copia_saas') && !dbUrl.includes('_test')) {
  console.error('\n🚨 ERROR CRÍTICO DE SEGURIDAD: Intentando ejecutar pruebas de integración sobre una BD que no es de pruebas.');
  console.error(`DATABASE_URL actual apunta a: ${dbUrl}`);
  console.error('Abortando ejecución para proteger la base de datos de producción.\n');
  process.exit(1);
}

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../../src/app');
const prisma = require('../../src/utils/prisma');
const prismaAdmin = require('../../src/utils/prismaAdmin');
const { JWT_SECRET } = require('../../src/config/secrets');

const CO_ALPHA = 'co-sec-alpha';
const CO_BETA = 'co-sec-beta';
const HOLDING_1 = 'holding-sec-1';
const BRANCH_1 = 'branch-sec-h1-a';
const BRANCH_INACTIVE = 'branch-sec-h1-inactive';
const HOLDING_2 = 'holding-sec-2';
const BRANCH_2 = 'branch-sec-h2-b';

async function runTenantSecurityHeadersTest() {
  console.log('================================================================');
  console.log('>>> TEST DE INTEGRACIÓN: CABECERAS MULTI-TENANT Y ANTI-SPOOFING');
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
    console.log('[Setup] Creando empresas, holdings y sucursales en MySQL...');

    // Empresas estándar Alpha y Beta
    await prismaAdmin.company.upsert({
      where: { id: CO_ALPHA },
      create: { id: CO_ALPHA, name: 'Empresa Alpha Sec', slug: 'alpha-sec-saas', isActive: true },
      update: { isActive: true }
    });

    await prismaAdmin.company.upsert({
      where: { id: CO_BETA },
      create: { id: CO_BETA, name: 'Empresa Beta Sec', slug: 'beta-sec-saas', isActive: true },
      update: { isActive: true }
    });

    // Holdings y Sucursales
    await prismaAdmin.company.upsert({
      where: { id: HOLDING_1 },
      create: { id: HOLDING_1, name: 'Holding 1 Sec', slug: 'holding-1-sec', isHolding: true, plan: 'CUSTOM', maxBranches: 1, isActive: true },
      update: { isHolding: true, maxBranches: 1, isActive: true }
    });

    await prismaAdmin.company.upsert({
      where: { id: BRANCH_1 },
      create: { id: BRANCH_1, parentCompanyId: HOLDING_1, name: 'Sucursal 1 Propia Activa', slug: 'sucursal-1-sec', isActive: true },
      update: { parentCompanyId: HOLDING_1, isActive: true }
    });

    await prismaAdmin.company.upsert({
      where: { id: BRANCH_INACTIVE },
      create: { id: BRANCH_INACTIVE, parentCompanyId: HOLDING_1, name: 'Sucursal Inactiva Esperando Cupo', slug: 'sucursal-inactiva-sec', isActive: false },
      update: { parentCompanyId: HOLDING_1, isActive: false }
    });

    await prismaAdmin.company.upsert({
      where: { id: HOLDING_2 },
      create: { id: HOLDING_2, name: 'Holding 2 Ajeno', slug: 'holding-2-sec', isHolding: true, plan: 'CUSTOM', maxBranches: 5, isActive: true },
      update: { isHolding: true, isActive: true }
    });

    await prismaAdmin.company.upsert({
      where: { id: BRANCH_2 },
      create: { id: BRANCH_2, parentCompanyId: HOLDING_2, name: 'Sucursal 2 Ajena', slug: 'sucursal-2-sec', isActive: true },
      update: { parentCompanyId: HOLDING_2, isActive: true }
    });

    // Empleados para probar aislamiento de datos
    await prismaAdmin.employee.upsert({
      where: { id: 'emp-alpha-sec-1' },
      create: { id: 'emp-alpha-sec-1', companyId: CO_ALPHA, firstName: 'Juan', lastName: 'Alpha', identifier: 'SEC-A1', isActive: true },
      update: { companyId: CO_ALPHA, isActive: true }
    });

    await prismaAdmin.employee.upsert({
      where: { id: 'emp-beta-sec-1' },
      create: { id: 'emp-beta-sec-1', companyId: CO_BETA, firstName: 'Pedro', lastName: 'Beta', identifier: 'SEC-B1', isActive: true },
      update: { companyId: CO_BETA, isActive: true }
    });

    // Admin User para Corporate Admin en MySQL
    await prismaAdmin.adminUser.upsert({
      where: { id: 'corp-admin-h1-id' },
      create: {
        id: 'corp-admin-h1-id',
        companyId: HOLDING_1,
        name: 'Corp Admin Holding 1',
        email: 'corp@holding1.com',
        role: 'CORPORATE_ADMIN',
        password: 'hashed-password-123'
      },
      update: { companyId: HOLDING_1, role: 'CORPORATE_ADMIN' }
    });

    // Tokens JWT firmados
    const adminAlphaToken = jwt.sign(
      { id: 'admin-alpha-id', role: 'ADMIN', companyId: CO_ALPHA, email: 'admin@alpha.com' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const corporateAdminToken = jwt.sign(
      { id: 'corp-admin-h1-id', role: 'CORPORATE_ADMIN', companyId: HOLDING_1, email: 'corp@holding1.com' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // -------------------------------------------------------------------------
    // TEST 1: ADMIN estándar intentando suplantar con x-tenant-id / x-branch-id
    // -------------------------------------------------------------------------
    console.log('\n[Paso 1] ADMIN de Alpha intenta enviar x-tenant-id = Beta para consultar empleados...');
    const resAdminSpoof = await request(app)
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${adminAlphaToken}`)
      .set('x-tenant-id', CO_BETA)
      .set('x-branch-id', BRANCH_2);

    assert(resAdminSpoof.status === 200, `Petición exitosa 200 OK (obtenido ${resAdminSpoof.status})`);
    const returnedEmployees = Array.isArray(resAdminSpoof.body) ? resAdminSpoof.body : (resAdminSpoof.body.employees || []);
    const hasAlphaEmp = returnedEmployees.some(e => e.companyId === CO_ALPHA || e.firstName === 'Juan');
    const hasBetaEmp = returnedEmployees.some(e => e.companyId === CO_BETA || e.firstName === 'Pedro');

    assert(hasAlphaEmp === true, `Retornó únicamente los empleados de su propia empresa Alpha`);
    assert(hasBetaEmp === false, `NUNCA retornó empleados de la empresa Beta (x-tenant-id fue ignorado)`);

    // -------------------------------------------------------------------------
    // TEST 2: CORPORATE_ADMIN intentando impersonar sucursal ajena (Spoofing)
    // -------------------------------------------------------------------------
    console.log('\n[Paso 2] CORPORATE_ADMIN de Holding 1 intenta acceder con x-branch-id a sucursal de Holding 2...');
    const resCorpSpoof = await request(app)
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${corporateAdminToken}`)
      .set('x-branch-id', BRANCH_2); // BRANCH_2 pertenece a HOLDING_2

    assert(resCorpSpoof.status === 403, `Status code es 403 Forbidden (obtenido ${resCorpSpoof.status})`);
    assert(resCorpSpoof.body.error === 'TENANT_SPOOFING_DETECTED', `Error es TENANT_SPOOFING_DETECTED (obtenido ${resCorpSpoof.body.error})`);

    // -------------------------------------------------------------------------
    // TEST 3: CORPORATE_ADMIN accediendo legítimamente a su propia sucursal
    // -------------------------------------------------------------------------
    console.log('\n[Paso 3] CORPORATE_ADMIN de Holding 1 accede legítimamente a su propia sucursal 1...');
    const resCorpLegit = await request(app)
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${corporateAdminToken}`)
      .set('x-branch-id', BRANCH_1); // BRANCH_1 pertenece legítimamente a HOLDING_1

    assert(resCorpLegit.status === 200, `Status code es 200 OK (obtenido ${resCorpLegit.status})`);

    // -------------------------------------------------------------------------
    // TEST 4: Reactivación de sucursal respetando cupo del plan (maxBranches)
    // -------------------------------------------------------------------------
    console.log('\n[Paso 4] Intento de reactivar sucursal cuando el Holding ya alcanzó su límite (maxBranches: 1)...');
    const resOverLimit = await request(app)
      .patch(`/api/v1/branches/${BRANCH_INACTIVE}`)
      .set('Authorization', `Bearer ${corporateAdminToken}`)
      .send({ isActive: true });

    assert(resOverLimit.status === 403, `Status code es 403 Forbidden por cupo excedido (obtenido ${resOverLimit.status})`);
    assert(resOverLimit.body.error === 'BRANCH_LIMIT_EXCEEDED', `Error es BRANCH_LIMIT_EXCEEDED (obtenido ${resOverLimit.body.error})`);

    // Aumentar cupo a 2 y verificar que ahora sí permite reactivar
    console.log('\n[Paso 4.b] Aumentando cupo del Holding a 2 y reintentando reactivación...');
    await prismaAdmin.company.update({
      where: { id: HOLDING_1 },
      data: { maxBranches: 2 }
    });

    const resReactivateAllowed = await request(app)
      .patch(`/api/v1/branches/${BRANCH_INACTIVE}`)
      .set('Authorization', `Bearer ${corporateAdminToken}`)
      .send({ isActive: true });

    assert(resReactivateAllowed.status === 200, `Status code es 200 OK tras ampliar cupo (obtenido ${resReactivateAllowed.status})`);
    assert(resReactivateAllowed.body.branch && resReactivateAllowed.body.branch.isActive === true, `Sucursal reactivada correctamente`);

    console.log('\n----------------------------------------------------------------');
    console.log(`RESULTADO FINAL PRUEBAS ZERO-TRUST: ${passed} PASADAS, ${failed} FALLADAS`);
    console.log('----------------------------------------------------------------\n');
  } catch (err) {
    console.error('Error durante pruebas de seguridad:', err);
    failed++;
  } finally {
    console.log('[Teardown] Limpiando entidades de seguridad en MySQL...');
    try {
      await prismaAdmin.adminAuditLog.deleteMany({ where: { companyId: { in: [CO_ALPHA, CO_BETA, HOLDING_1, BRANCH_1, BRANCH_INACTIVE, HOLDING_2, BRANCH_2] } } });
      await prismaAdmin.adminUser.deleteMany({ where: { id: 'corp-admin-h1-id' } });
      await prismaAdmin.employee.deleteMany({ where: { companyId: { in: [CO_ALPHA, CO_BETA, HOLDING_1, BRANCH_1, BRANCH_INACTIVE, HOLDING_2, BRANCH_2] } } });
      await prismaAdmin.company.deleteMany({ where: { id: { in: [BRANCH_1, BRANCH_INACTIVE, BRANCH_2] } } });
      await prismaAdmin.company.deleteMany({ where: { id: { in: [CO_ALPHA, CO_BETA, HOLDING_1, HOLDING_2] } } });
    } catch (e) {
      console.warn('Advertencia en teardown:', e.message);
    }
    await prisma.$disconnect();
    await prismaAdmin.$disconnect();
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTenantSecurityHeadersTest();
