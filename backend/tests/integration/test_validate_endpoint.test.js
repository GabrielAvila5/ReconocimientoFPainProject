/**
 * INTEGRATION TEST: Endpoint real /api/v1/attendance/validate con base de datos MySQL
 * Valida:
 * 1. Aislamiento biométrico estricto entre Kiosko Alpha y empleado Beta.
 * 2. Reconocimiento exitoso de Kiosko Alpha con su propio empleado Alpha.
 * 3. Rechazo HTTP 400 sin fallback cuando no hay companyId / x-device-token válido.
 */

require('dotenv').config();
const request = require('supertest');
const { app } = require('../../src/app');
const prisma = require('../../src/utils/prisma');
const prismaAdmin = require('../../src/utils/prismaAdmin');
const { syncCompanyCache, getFaceCache } = require('../../src/utils/faceMath');

const crypto = require('crypto');
const COMPANY_ALPHA = 'test-co-alpha-real';
const COMPANY_BETA = 'test-co-beta-real';
const KIOSK_ALPHA_RAW = 'raw-alpha-token-secret-1234567890';
const KIOSK_BETA_RAW = 'raw-beta-token-secret-1234567890';
const KIOSK_ALPHA_HASH = crypto.createHash('sha256').update(KIOSK_ALPHA_RAW).digest('hex');
const KIOSK_BETA_HASH = crypto.createHash('sha256').update(KIOSK_BETA_RAW).digest('hex');

async function runRealValidateIntegrationTest() {
  console.log('================================================================');
  console.log('>>> TEST DE INTEGRACIÓN REAL: /api/v1/attendance/validate (MySQL)');
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
    // 1. Setup en Base de Datos Real
    console.log('[Setup] Creando empresas, dispositivos y empleados en MySQL...');

    await prismaAdmin.company.upsert({
      where: { id: COMPANY_ALPHA },
      create: { id: COMPANY_ALPHA, name: 'Empresa Alpha Real', slug: 'alpha-val-real', isActive: true },
      update: { isActive: true }
    });

    await prismaAdmin.company.upsert({
      where: { id: COMPANY_BETA },
      create: { id: COMPANY_BETA, name: 'Empresa Beta Real', slug: 'beta-val-real', isActive: true },
      update: { isActive: true }
    });

    // Kioskos en tabla Device
    await prismaAdmin.device.upsert({
      where: { id: 'device-alpha-val' },
      create: {
        id: 'device-alpha-val',
        companyId: COMPANY_ALPHA,
        name: 'Kiosko Alpha Entrada',
        type: 'KIOSK',
        tokenHash: KIOSK_ALPHA_HASH,
        isActive: true,
        isBlocked: false
      },
      update: { companyId: COMPANY_ALPHA, tokenHash: KIOSK_ALPHA_HASH, isActive: true, isBlocked: false }
    });

    await prismaAdmin.device.upsert({
      where: { id: 'device-beta-val' },
      create: {
        id: 'device-beta-val',
        companyId: COMPANY_BETA,
        name: 'Kiosko Beta Entrada',
        type: 'KIOSK',
        tokenHash: KIOSK_BETA_HASH,
        isActive: true,
        isBlocked: false
      },
      update: { companyId: COMPANY_BETA, tokenHash: KIOSK_BETA_HASH, isActive: true, isBlocked: false }
    });

    // Descriptores faciales (128 flotantes)
    const descriptorAlpha = new Array(128).fill(0.12);
    const descriptorBeta = new Array(128).fill(0.88);

    const encDescriptorAlpha = JSON.stringify(descriptorAlpha);
    const encDescriptorBeta = JSON.stringify(descriptorBeta);

    await prismaAdmin.employee.upsert({
      where: { id: 'emp-alpha-val-1' },
      create: {
        id: 'emp-alpha-val-1',
        companyId: COMPANY_ALPHA,
        firstName: 'Alejandro',
        lastName: 'Montes',
        identifier: 'EMP-A01',
        faceDescriptor: encDescriptorAlpha,
        isActive: true
      },
      update: { companyId: COMPANY_ALPHA, faceDescriptor: encDescriptorAlpha, isActive: true }
    });

    await prismaAdmin.employee.upsert({
      where: { id: 'emp-beta-val-1' },
      create: {
        id: 'emp-beta-val-1',
        companyId: COMPANY_BETA,
        firstName: 'Beatriz',
        lastName: 'Salas',
        identifier: 'EMP-B01',
        faceDescriptor: encDescriptorBeta,
        isActive: true
      },
      update: { companyId: COMPANY_BETA, faceDescriptor: encDescriptorBeta, isActive: true }
    });

    // Sincronizar cache en memoria desde la BD
    await syncCompanyCache(COMPANY_ALPHA);
    await syncCompanyCache(COMPANY_BETA);

    // TEST 1: Kiosko Alpha envía descriptor de empleado Beta
    console.log('\n[Paso 1] Kiosko Alpha consulta /validate con rostro de empleado Beta...');
    const resCross = await request(app)
      .post('/api/v1/attendance/validate')
      .set('x-device-token', KIOSK_ALPHA_RAW)
      .send({ descriptor: descriptorBeta });

    assert(resCross.status === 200, `Status code es 200 (obtenido ${resCross.status})`);
    assert(resCross.body.match === false, `Resultado match === false (obtenido ${resCross.body.match})`);
    assert(resCross.body.distance > 0.55, `Distancia es superior al umbral (obtenido ${resCross.body.distance?.toFixed(4)})`);

    // TEST 2: Kiosko Alpha envía descriptor de su propio empleado Alpha
    console.log('\n[Paso 2] Kiosko Alpha consulta /validate con su propio empleado Alpha...');
    const resOwn = await request(app)
      .post('/api/v1/attendance/validate')
      .set('x-device-token', KIOSK_ALPHA_RAW)
      .send({ descriptor: descriptorAlpha });

    assert(resOwn.status === 200, `Status code es 200 (obtenido ${resOwn.status})`);
    assert(resOwn.body.match === true, `Resultado match === true (obtenido ${resOwn.body.match})`);
    assert(resOwn.body.employee && resOwn.body.employee.firstName === 'Alejandro', `Identificó al empleado Alejandro Montes correctamente`);

    // TEST 3: Petición con token inexistente o no registrado
    console.log('\n[Paso 3] Petición a /validate con x-device-token inválido/desconocido...');
    const resUnknownToken = await request(app)
      .post('/api/v1/attendance/validate')
      .set('x-device-token', 'token-no-registrado-en-bd')
      .send({ descriptor: descriptorAlpha });

    assert(resUnknownToken.status === 401, `Status code es 401 Unauthorized (obtenido ${resUnknownToken.status})`);
    assert(resUnknownToken.body.error === 'DEVICE_UNAUTHORIZED', `Error es DEVICE_UNAUTHORIZED (obtenido ${resUnknownToken.body.error})`);

    console.log('\n----------------------------------------------------------------');
    console.log(`RESULTADO FINAL PRUEBAS DE INTEGRACIÓN: ${passed} PASADAS, ${failed} FALLADAS`);
    console.log('----------------------------------------------------------------\n');
  } catch (err) {
    console.error('Error durante el test de integración:', err);
    failed++;
  } finally {
    // Teardown determinista
    console.log('[Teardown] Limpiando registros de prueba en MySQL...');
    try {
      await prismaAdmin.employee.deleteMany({ where: { companyId: { in: [COMPANY_ALPHA, COMPANY_BETA] } } });
      await prismaAdmin.device.deleteMany({ where: { companyId: { in: [COMPANY_ALPHA, COMPANY_BETA] } } });
      await prismaAdmin.company.deleteMany({ where: { id: { in: [COMPANY_ALPHA, COMPANY_BETA] } } });
    } catch (e) {
      console.warn('Advertencia en teardown:', e.message);
    }
    await prisma.$disconnect();
    await prismaAdmin.$disconnect();
  }

  process.exit(failed > 0 ? 1 : 0);
}

runRealValidateIntegrationTest();
