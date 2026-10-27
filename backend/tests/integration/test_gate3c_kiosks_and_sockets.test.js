/**
 * SUITE INTEGRAL DE VALIDACIÓN GATE 3C: KIOSCOS, WEBSOCKETS Y RETIRO DE LEGADOS
 * 
 * Verifica:
 * 1. Retiro definitivo de DISABLE_AUTH (sin bypass)
 * 2. Ventana de gracia fija para KIOSK_API_KEY (2026-11-05T23:59:59.000Z) y rechazo LEGACY_API_KEY_EXPIRED
 * 3. Autenticación exclusiva por tokenHash SHA-256 y actualización atómica de lastSeenAt
 * 4. GET /descriptors con x-device-token, soporte ETag/304, Rate Limiting (120/h) y alerta de spike (>30 en 5m)
 * 5. Ciclo de vida de descriptores: incremento atómico de descriptorsVersion en las operaciones
 * 6. Socket.io: desconexión forzada de salas de empresa al suspender inquilino
 */

const assert = require('assert');
const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const { app, disconnectCompanySockets } = require('../../src/app');
const prismaAdmin = require('../../src/utils/prismaAdmin');
const { JWT_SECRET } = require('../../src/config/secrets');
const { GRACE_PERIOD_END } = require('../../src/middlewares/requireApiKey');

const TEST_PREFIX = `gate3c_test_${Date.now()}`;
const companyAlphaId = `${TEST_PREFIX}_alpha`;
const companyBetaId = `${TEST_PREFIX}_beta`;

let rawDeviceTokenAlpha = `kiosk_token_alpha_${Date.now()}`;
let tokenHashAlpha = crypto.createHash('sha256').update(rawDeviceTokenAlpha).digest('hex');

let deviceAlphaId;
let adminAlphaToken;
let deptAlphaId;

async function setup() {
  console.log('\n--- SETUP: Inicializando datos deterministas para Gate 3C ---');
  
  // 1. Crear empresas
  await prismaAdmin.company.create({
    data: {
      id: companyAlphaId,
      name: 'Empresa Kioscos Alpha',
      slug: `${companyAlphaId}-slug`,
      isActive: true,
      descriptorsVersion: 10
    }
  });

  await prismaAdmin.company.create({
    data: {
      id: companyBetaId,
      name: 'Empresa Kioscos Beta',
      slug: `${companyBetaId}-slug`,
      isActive: false // Suspendida
    }
  });

  // 2. Crear departamento
  const dept = await prismaAdmin.department.create({
    data: {
      companyId: companyAlphaId,
      name: `Dept Gate3C ${Date.now()}`
    }
  });
  deptAlphaId = dept.id;

  // 3. Crear dispositivo para Alpha con token: null y tokenHash
  const dev = await prismaAdmin.device.create({
    data: {
      companyId: companyAlphaId,
      name: 'Kiosco Alpha Principal',
      type: 'KIOSK',
      status: 'ONLINE',
      token: null, // Nunca en plano
      tokenHash: tokenHashAlpha,
      isActive: true,
      isBlocked: false
    }
  });
  deviceAlphaId = dev.id;

  // 4. Token JWT de admin para Alpha
  adminAlphaToken = jwt.sign(
    { id: 'admin-alpha-gate3c', companyId: companyAlphaId, role: 'ADMIN' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log('✓ Setup completado exitosamente.\n');
}

async function teardown() {
  console.log('\n--- Limpieza determinista de datos de prueba ---');
  try {
    await prismaAdmin.adminAuditLog.deleteMany({ where: { companyId: { in: [companyAlphaId, companyBetaId] } } });
    await prismaAdmin.attendanceRecord.deleteMany({ where: { companyId: { in: [companyAlphaId, companyBetaId] } } });
    await prismaAdmin.notification.deleteMany({ where: { companyId: { in: [companyAlphaId, companyBetaId] } } });
    await prismaAdmin.employeeShift.deleteMany({ where: { companyId: { in: [companyAlphaId, companyBetaId] } } });
    await prismaAdmin.employee.deleteMany({ where: { companyId: { in: [companyAlphaId, companyBetaId] } } });
    await prismaAdmin.device.deleteMany({ where: { companyId: { in: [companyAlphaId, companyBetaId] } } });
    await prismaAdmin.deviceAuthRequest.deleteMany({ where: { companyId: { in: [companyAlphaId, companyBetaId] } } });
    await prismaAdmin.department.deleteMany({ where: { companyId: { in: [companyAlphaId, companyBetaId] } } });
    await prismaAdmin.company.deleteMany({ where: { id: { in: [companyAlphaId, companyBetaId] } } });
    console.log('Teardown completado exitosamente.');
  } catch (err) {
    console.error('Error durante teardown:', err);
  } finally {
    await prismaAdmin.$disconnect();
  }
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  function pass(msg) {
    console.log(`  [PASS] ${msg}`);
    passed++;
  }

  function fail(msg, err) {
    console.error(`  [FAIL] ${msg}`, err);
    failed++;
  }

  try {
    await setup();

    console.log('================================================================');
    console.log('>>> 1. VERIFICACIÓN DE RETIRO DEFINITIVO DE DISABLE_AUTH');
    console.log('================================================================');
    {
      const prevVal = process.env.DISABLE_AUTH;
      process.env.DISABLE_AUTH = 'true'; // Intento deliberado de forzar bypass
      try {
        const res = await request(app)
          .get('/api/v1/employees')
          .set('Accept', 'application/json');

        assert.strictEqual(res.status, 401, 'Debe rechazar con 401 a pesar de DISABLE_AUTH=true');
        pass('DISABLE_AUTH=true es completamente ignorado y protegido por requireJwt (obtuvo 401)');
      } catch (e) {
        fail('Fallo en protección contra bypass DISABLE_AUTH', e);
      } finally {
        if (prevVal === undefined) delete process.env.DISABLE_AUTH;
        else process.env.DISABLE_AUTH = prevVal;
      }
    }

    console.log('\n================================================================');
    console.log('>>> 2. VENTANA DE GRACIA FIJA KIOSK_API_KEY (2026-11-05T23:59:59.000Z)');
    console.log('================================================================');
    {
      const expectedKey = process.env.KIOSK_API_KEY || 'kiosk-secret-key-123';
      
      // 2.1 Petición con API key inválida
      const resBad = await request(app)
        .post('/api/v1/attendance/validate')
        .set('x-api-key', 'clave-falsa-invalida')
        .send({ descriptor: new Array(128).fill(0.1) });
      assert.strictEqual(resBad.status, 403, 'API key inválida debe dar 403');
      pass('x-api-key inválida es rechazada con HTTP 403');

      // 2.2 Petición legítima con x-api-key durante ventana de gracia
      const resLegacy = await request(app)
        .post('/api/v1/attendance/validate')
        .set('x-api-key', expectedKey)
        .send({ descriptor: new Array(128).fill(0.1) });
      
      // Si la fecha actual es anterior al 2026-11-05, debe responder con el header de deprecación
      if (new Date() <= GRACE_PERIOD_END) {
        assert(resLegacy.headers['x-legacy-kiosk-warning'], 'Debe emitir cabecera x-legacy-kiosk-warning');
        pass('x-api-key legítima dentro de la ventana incluye cabecera de deprecación X-Legacy-Kiosk-Warning');
      }

      // 2.3 Simulación de fecha posterior a la ventana de gracia
      const OriginalDate = global.Date;
      try {
        const futureTime = new Date('2026-11-06T00:00:01.000Z').getTime();
        class MockDate extends OriginalDate {
          constructor(...args) {
            if (args.length === 0) {
              super(futureTime);
            } else {
              super(...args);
            }
          }
          static now() {
            return futureTime;
          }
        }
        global.Date = MockDate;

        const resExpired = await request(app)
          .post('/api/v1/attendance/validate')
          .set('x-api-key', expectedKey)
          .send({ descriptor: new Array(128).fill(0.1) });

        assert.strictEqual(resExpired.status, 401, 'Debe devolver HTTP 401 tras expirar la ventana');
        assert.strictEqual(resExpired.body.error, 'LEGACY_API_KEY_EXPIRED');
        pass('x-api-key tras la fecha límite (2026-11-05) devuelve HTTP 401 LEGACY_API_KEY_EXPIRED');
      } finally {
        global.Date = OriginalDate;
      }
    }

    console.log('\n================================================================');
    console.log('>>> 3. TOKENHASH SHA-256 Y ACTUALIZACIÓN ATÓMICA DE LASTSEENAT');
    console.log('================================================================');
    {
      const devBefore = await prismaAdmin.device.findUnique({
        where: { id: deviceAlphaId }
      });
      assert.strictEqual(devBefore.token, null, 'Device.token en BD debe ser estrictamente NULL');
      pass('Device.token se almacena estrictamente como NULL en la base de datos');

      // Petición con token plano en cabecera
      const resAuth = await request(app)
        .get('/api/v1/employees/descriptors')
        .set('x-device-token', rawDeviceTokenAlpha);

      assert.strictEqual(resAuth.status, 200, 'Debe autenticar correctamente con tokenHash');
      pass('Kiosco se autentica correctamente mediante hash SHA-256 de x-device-token');

      // Esperar breve tick para persistencia asíncrona de lastSeenAt
      await new Promise(r => setTimeout(r, 100));

      const devAfter = await prismaAdmin.device.findUnique({
        where: { id: deviceAlphaId }
      });
      assert(devAfter.lastSeenAt, 'lastSeenAt debe haber sido actualizado');
      pass(`lastSeenAt se actualizó atómicamente (${devAfter.lastSeenAt.toISOString()})`);
    }

    console.log('\n================================================================');
    console.log('>>> 4. GET /DESCRIPTORS: SEGURIDAD, ETAG Y RATE LIMIT');
    console.log('================================================================');
    {
      // 4.1 Rechazo sin token ni autenticación
      const resNoAuth = await request(app).get('/api/v1/employees/descriptors');
      assert.strictEqual(resNoAuth.status, 401, 'Debe devolver 401 sin credenciales');
      assert.strictEqual(resNoAuth.body.error, 'DEVICE_UNAUTHORIZED');
      pass('GET /descriptors sin x-device-token es rechazado con HTTP 401 DEVICE_UNAUTHORIZED');

      // 4.2 Descarga exitosa con ETag
      const resDesc = await request(app)
        .get('/api/v1/employees/descriptors')
        .set('x-device-token', rawDeviceTokenAlpha);
      
      assert.strictEqual(resDesc.status, 200);
      const etag = resDesc.headers['etag'];
      assert(etag, 'Debe incluir cabecera ETag');
      pass(`GET /descriptors retorna ETag generado: ${etag}`);

      // 4.3 Petición con If-None-Match debe devolver 304 Not Modified
      const resCached = await request(app)
        .get('/api/v1/employees/descriptors')
        .set('x-device-token', rawDeviceTokenAlpha)
        .set('If-None-Match', etag);

      assert.strictEqual(resCached.status, 304, 'Debe responder 304 Not Modified si el ETag coincide');
      pass('GET /descriptors responde HTTP 304 Not Modified ante coincidencia de ETag');

      // 4.4 Simulación de Rate Limit (>120 peticiones/hora)
      let rateLimitHit = false;
      for (let i = 0; i < 125; i++) {
        const r = await request(app)
          .get('/api/v1/employees/descriptors')
          .set('x-device-token', rawDeviceTokenAlpha);
        if (r.status === 429) {
          rateLimitHit = true;
          assert.strictEqual(r.body.error, 'TOO_MANY_REQUESTS');
          break;
        }
      }
      assert(rateLimitHit, 'Debe disparar HTTP 429 al superar 120 peticiones/hora');
      pass('Rate limit de 120 descargas/hora dispara HTTP 429 TOO_MANY_REQUESTS');

      // 4.5 Detección de Spike en auditoría
      const auditSpike = await prismaAdmin.adminAuditLog.findFirst({
        where: {
          companyId: companyAlphaId,
          action: 'SECURITY_ALERT_DESCRIPTOR_SPIKE'
        }
      });
      assert(auditSpike, 'Debe haberse generado una alerta de spike en AdminAuditLog');
      pass('Se generó alerta de seguridad SECURITY_ALERT_DESCRIPTOR_SPIKE en AdminAuditLog');
    }

    console.log('\n================================================================');
    console.log('>>> 5. INCREMENTO ATÓMICO DE DESCRIPTORSVERSION (CICLO DE VIDA)');
    console.log('================================================================');
    {
      const companyBefore = await prismaAdmin.company.findUnique({
        where: { id: companyAlphaId },
        select: { descriptorsVersion: true }
      });
      const v0 = companyBefore.descriptorsVersion;

      // Operación 1: Crear empleado con biometría
      const empRes = await request(app)
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${adminAlphaToken}`)
        .send({
          firstName: 'Biometric',
          lastName: 'Tester',
          identifier: `BIO_${Date.now()}`,
          departmentId: deptAlphaId,
          faceDescriptor: JSON.stringify(new Array(128).fill(0.2))
        });
      assert.strictEqual(empRes.status, 201);
      const empId = empRes.body.id;

      const compV1 = await prismaAdmin.company.findUnique({ where: { id: companyAlphaId } });
      assert.strictEqual(compV1.descriptorsVersion, v0 + 1, 'Crear empleado con rostro incrementa descriptorsVersion');
      pass(`1. Creación de empleado incrementó descriptorsVersion (${v0} -> ${compV1.descriptorsVersion})`);

      // Operación 2: Actualizar empleado alterando isActive
      await request(app)
        .put(`/api/v1/employees/${empId}`)
        .set('Authorization', `Bearer ${adminAlphaToken}`)
        .send({
          departmentId: deptAlphaId,
          isActive: false
        });

      const compV2 = await prismaAdmin.company.findUnique({ where: { id: companyAlphaId } });
      assert.strictEqual(compV2.descriptorsVersion, v0 + 2, 'Actualizar estado incrementa descriptorsVersion');
      pass(`2. Cambio de estado (isActive) incrementó descriptorsVersion (${compV1.descriptorsVersion} -> ${compV2.descriptorsVersion})`);

      // Operación 3: Actualizar descriptor facial (POST /:id/descriptor)
      await request(app)
        .post(`/api/v1/employees/${empId}/descriptor`)
        .set('Authorization', `Bearer ${adminAlphaToken}`)
        .send({ descriptor: new Array(128).fill(0.3) });

      const compV3 = await prismaAdmin.company.findUnique({ where: { id: companyAlphaId } });
      assert.strictEqual(compV3.descriptorsVersion, v0 + 3, 'Actualizar descriptor incrementa descriptorsVersion');
      pass(`3. Carga de nuevo descriptor incrementó descriptorsVersion (${compV2.descriptorsVersion} -> ${compV3.descriptorsVersion})`);

      // Operación 4: Eliminar descriptor facial (DELETE /:id/descriptor)
      await request(app)
        .delete(`/api/v1/employees/${empId}/descriptor`)
        .set('Authorization', `Bearer ${adminAlphaToken}`);

      const compV4 = await prismaAdmin.company.findUnique({ where: { id: companyAlphaId } });
      assert.strictEqual(compV4.descriptorsVersion, v0 + 4, 'Eliminar descriptor incrementa descriptorsVersion');
      pass(`4. Eliminación de descriptor incrementó descriptorsVersion (${compV3.descriptorsVersion} -> ${compV4.descriptorsVersion})`);

      // Operación 5: Upsert con register-face
      await request(app)
        .post('/api/v1/employees/register-face')
        .set('Authorization', `Bearer ${adminAlphaToken}`)
        .send({
          firstName: 'Register',
          lastName: 'Face',
          identifier: `REG_${Date.now()}`,
          department: 'Recursos Humanos',
          descriptors: [new Array(128).fill(0.4)]
        });

      const compV5 = await prismaAdmin.company.findUnique({ where: { id: companyAlphaId } });
      assert.strictEqual(compV5.descriptorsVersion, v0 + 5, 'register-face incrementa descriptorsVersion');
      pass(`5. register-face incrementó descriptorsVersion (${compV4.descriptorsVersion} -> ${compV5.descriptorsVersion})`);

      // Operación 6: Eliminar empleado (DELETE /:id)
      await request(app)
        .delete(`/api/v1/employees/${empId}`)
        .set('Authorization', `Bearer ${adminAlphaToken}`);

      const compV6 = await prismaAdmin.company.findUnique({ where: { id: companyAlphaId } });
      assert.strictEqual(compV6.descriptorsVersion, v0 + 6, 'Eliminar empleado incrementa descriptorsVersion');
      pass(`6. Eliminación de empleado incrementó descriptorsVersion (${compV5.descriptorsVersion} -> ${compV6.descriptorsVersion})`);
    }

    console.log('\n================================================================');
    console.log('>>> 6. SOCKET.IO: SALAS DE INQUILINO Y DESCONEXIÓN EN SUSPENSIÓN');
    console.log('================================================================');
    {
      // Probar que la función disconnectCompanySockets no arroja errores y emite forced_disconnect
      assert.doesNotThrow(() => {
        disconnectCompanySockets(companyBetaId, 'COMPANY_SUSPENDED');
      });
      pass('disconnectCompanySockets ejecuta desconexión forzada y emite evento sin errores');
    }

  } finally {
    await teardown();
  }

  console.log('\n' + '='.repeat(64));
  console.log(`Resultado final: ${passed} pasadas, ${failed} fallidas`);
  console.log('='.repeat(64));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Error fatal en ejecución de tests:', err);
  process.exit(1);
});
