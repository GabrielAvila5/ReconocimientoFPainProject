/**
 * PRUEBA HTTP REAL: AISLAMIENTO MULTI-TENANT DEL MÓDULO DEVICES (GATE 3B - LOTE 1)
 * Verifica mediante Supertest contra MariaDB de pruebas:
 * 1. Aislamiento en GET /api/v1/devices (cada empresa solo ve sus dispositivos checadores).
 * 2. Aislamiento en PATCH /api/v1/devices/:id/block (Admin B recibe 404 al intentar bloquear dispositivo de A).
 * 3. Aislamiento en DELETE /api/v1/devices/:id (Admin B recibe 404 al intentar eliminar dispositivo de A).
 * 4. Límite de plan maxDevices (HTTP 403 PLAN_LIMIT_EXCEEDED al intentar aprobar un dispositivo superando la cuota).
 * 5. Límite de plan maxDevices en creación manual (HTTP 403 PLAN_LIMIT_EXCEEDED).
 * 6. Teardown determinista y limpio.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { app } = require('../../src/app');
const prismaAdmin = require('../../src/utils/prismaAdmin');
const { JWT_SECRET } = require('../../src/config/secrets');

const companyAlpha = 'company-alpha-dev-test';
const companyBeta = 'company-beta-dev-test';

async function runDevicesIsolationTests() {
  console.log('================================================================');
  console.log('>>> PRUEBA HTTP REAL: AISLAMIENTO DEL MÓDULO DEVICES');
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

  // Setup: Crear empresas con límite de plan explícito
  await prismaAdmin.company.upsert({
    where: { id: companyAlpha },
    create: { 
      id: companyAlpha, 
      name: 'Empresa Alpha Dispositivos', 
      slug: 'alpha-dev-saas', 
      isActive: true,
      maxDevices: 1 // Límite estricto de 1 dispositivo
    },
    update: { isActive: true, maxDevices: 1 }
  });

  await prismaAdmin.company.upsert({
    where: { id: companyBeta },
    create: { 
      id: companyBeta, 
      name: 'Empresa Beta Dispositivos', 
      slug: 'beta-dev-saas', 
      isActive: true,
      maxDevices: 5 
    },
    update: { isActive: true, maxDevices: 5 }
  });

  // Admin users
  await prismaAdmin.adminUser.upsert({
    where: { id: 'admin-alpha-dev-id' },
    create: { id: 'admin-alpha-dev-id', companyId: companyAlpha, name: 'Admin Alpha Dev', role: 'ADMIN', email: 'admin.alpha.dev@test.com', password: 'hash' },
    update: { companyId: companyAlpha }
  });

  await prismaAdmin.adminUser.upsert({
    where: { id: 'admin-beta-dev-id' },
    create: { id: 'admin-beta-dev-id', companyId: companyBeta, name: 'Admin Beta Dev', role: 'ADMIN', email: 'admin.beta.dev@test.com', password: 'hash' },
    update: { companyId: companyBeta }
  });

  const tokenAdminAlpha = jwt.sign(
    { id: 'admin-alpha-dev-id', companyId: companyAlpha, role: 'ADMIN', email: 'admin.alpha.dev@test.com' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const tokenAdminBeta = jwt.sign(
    { id: 'admin-beta-dev-id', companyId: companyBeta, role: 'ADMIN', email: 'admin.beta.dev@test.com' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  let devAlpha1 = null;
  let devBeta1 = null;
  let pairingReqAlpha = null;

  try {
    // Dispositivo 1 de Alpha (Alcanza cuota 1/1)
    devAlpha1 = await prismaAdmin.device.create({
      data: {
        companyId: companyAlpha,
        name: 'Kiosco Alpha Principal',
        token: null,
        tokenHash: crypto.createHash('sha256').update('token-dev-alpha-1-test').digest('hex'),
        status: 'ONLINE',
        isActive: true
      }
    });

    // Dispositivo 1 de Beta
    devBeta1 = await prismaAdmin.device.create({
      data: {
        companyId: companyBeta,
        name: 'Kiosco Beta Principal',
        token: null,
        tokenHash: crypto.createHash('sha256').update('token-dev-beta-1-test').digest('hex'),
        status: 'ONLINE',
        isActive: true
      }
    });

    // 1. GET /api/v1/devices - Aislamiento en listado
    console.log('--- 1. Verificando aislamiento en GET /api/v1/devices ---');
    const resListAlpha = await request(app)
      .get('/api/v1/devices')
      .set('Authorization', `Bearer ${tokenAdminAlpha}`);

    assert(resListAlpha.status === 200, `GET /api/v1/devices para Alpha responde HTTP 200 (obtuvo ${resListAlpha.status})`);
    const alphaFoundInAlpha = Array.isArray(resListAlpha.body) && resListAlpha.body.some(d => d.id === devAlpha1.id);
    const betaFoundInAlpha = Array.isArray(resListAlpha.body) && resListAlpha.body.some(d => d.id === devBeta1.id);
    assert(alphaFoundInAlpha === true, 'Admin Alpha ve su Kiosco Alpha Principal');
    assert(betaFoundInAlpha === false, 'Admin Alpha NO ve el Kiosco Beta Principal de Empresa Beta');

    const resListBeta = await request(app)
      .get('/api/v1/devices')
      .set('Authorization', `Bearer ${tokenAdminBeta}`);

    assert(resListBeta.status === 200, `GET /api/v1/devices para Beta responde HTTP 200 (obtuvo ${resListBeta.status})`);
    const betaFoundInBeta = Array.isArray(resListBeta.body) && resListBeta.body.some(d => d.id === devBeta1.id);
    const alphaFoundInBeta = Array.isArray(resListBeta.body) && resListBeta.body.some(d => d.id === devAlpha1.id);
    assert(betaFoundInBeta === true, 'Admin Beta ve su Kiosco Beta Principal');
    assert(alphaFoundInBeta === false, 'Admin Beta NO ve el Kiosco Alpha Principal de Empresa Alpha');

    // 2. PATCH /api/v1/devices/:id/block - Aislamiento en bloqueo
    console.log('\n--- 2. Verificando aislamiento en PATCH /api/v1/devices/:id/block ---');
    const resBlockCross = await request(app)
      .patch(`/api/v1/devices/${devAlpha1.id}/block`)
      .set('Authorization', `Bearer ${tokenAdminBeta}`)
      .send({ isBlocked: true, reason: 'Intrusión no autorizada' });

    assert(resBlockCross.status === 404, `Admin Beta recibe HTTP 404 al intentar bloquear dispositivo de Alpha (obtuvo ${resBlockCross.status})`);
    const devAlphaCheck = await prismaAdmin.device.findUnique({ where: { id: devAlpha1.id } });
    assert(devAlphaCheck.isBlocked === false, 'El dispositivo de Alpha permanece desbloqueado');

    // 3. DELETE /api/v1/devices/:id - Aislamiento en borrado
    console.log('\n--- 3. Verificando aislamiento en DELETE /api/v1/devices/:id ---');
    const resDeleteCross = await request(app)
      .delete(`/api/v1/devices/${devAlpha1.id}`)
      .set('Authorization', `Bearer ${tokenAdminBeta}`);

    assert(resDeleteCross.status === 404, `Admin Beta recibe HTTP 404 al intentar borrar dispositivo de Alpha (obtuvo ${resDeleteCross.status})`);
    const devAlphaExists = await prismaAdmin.device.findUnique({ where: { id: devAlpha1.id } });
    assert(devAlphaExists !== null, 'El dispositivo de Alpha sigue existiendo en BD');

    // 4. Límite de plan maxDevices en aprobación de nuevo kiosco
    console.log('\n--- 4. Verificando límite de plan maxDevices en aprobación de kiosco ---');
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 15);
    pairingReqAlpha = await prismaAdmin.deviceAuthRequest.create({
      data: {
        pairingCode: 'CODEEXC1',
        status: 'PENDING',
        expiresAt: expires,
        ipAddress: '192.168.1.100',
        userAgent: 'Test Kiosk Exceeded'
      }
    });

    const resApproveExceeded = await request(app)
      .post(`/api/v1/devices/auth-requests/${pairingReqAlpha.id}/approve`)
      .set('Authorization', `Bearer ${tokenAdminAlpha}`)
      .send({
        name: 'Kiosco Alpha Excedido',
        pairingCode: 'CODEEXC1'
      });

    assert(resApproveExceeded.status === 403, `Intento de exceder maxDevices devuelve HTTP 403 (obtuvo ${resApproveExceeded.status})`);
    assert(resApproveExceeded.body.error === 'PLAN_LIMIT_EXCEEDED', `Código de error es PLAN_LIMIT_EXCEEDED (obtuvo ${resApproveExceeded.body.error})`);

    // 5. Límite de plan maxDevices en creación manual
    console.log('\n--- 5. Verificando límite de plan maxDevices en creación manual ---');
    const resManualExceeded = await request(app)
      .post('/api/v1/devices')
      .set('Authorization', `Bearer ${tokenAdminAlpha}`)
      .send({
        name: 'Torniquete Manual Excedido',
        type: 'TURNSTILE'
      });

    assert(resManualExceeded.status === 403, `Intento manual de exceder maxDevices devuelve HTTP 403 (obtuvo ${resManualExceeded.status})`);
    assert(resManualExceeded.body.error === 'PLAN_LIMIT_EXCEEDED', `Código de error es PLAN_LIMIT_EXCEEDED (obtuvo ${resManualExceeded.body.error})`);

  } finally {
    console.log('\n--- Limpieza determinista de datos de prueba ---');
    try {
      if (pairingReqAlpha) {
        await prismaAdmin.deviceAuthRequest.deleteMany({ where: { id: pairingReqAlpha.id } });
      }
      await prismaAdmin.deviceAuthRequest.deleteMany({ where: { pairingCode: 'CODEEXC1' } });
      if (devAlpha1) {
        await prismaAdmin.device.deleteMany({ where: { id: devAlpha1.id } });
      }
      if (devBeta1) {
        await prismaAdmin.device.deleteMany({ where: { id: devBeta1.id } });
      }
      await prismaAdmin.device.deleteMany({
        where: { name: { in: ['Kiosco Alpha Principal', 'Kiosco Beta Principal', 'Kiosco Alpha Excedido', 'Kiosco Manual Excedido'] } }
      });
      await prismaAdmin.adminUser.deleteMany({
        where: { id: { in: ['admin-alpha-dev-id', 'admin-beta-dev-id'] } }
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
  runDevicesIsolationTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error fatal en prueba de dispositivos:', err);
      process.exit(1);
    });
}

module.exports = { runDevicesIsolationTests };
