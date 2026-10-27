/**
 * SUITE INTEGRAL DE VALIDACIÓN GATE 4: SEGURIDAD, CRIPTOGRAFÍA Y OPERACIÓN
 * 
 * Verifica:
 * 1. Rate limiting compuesto en login por tupla IP + email (bloqueo al 6to intento, aislamiento por email en misma IP).
 * 2. Emisión de cookies con HttpOnly y SameSite=Strict.
 * 3. Protección CSRF en mutaciones autenticadas por cookie + exención para Bearer y x-device-token.
 * 4. CORS estricto con lista blanca y rechazo HTTP 403 a orígenes no autorizados.
 * 5. Pentest de spoofing: ignorar x-tenant-id en ADMIN, ignorar companyId en body, obligatoriedad en SUPER_ADMIN.
 * 6. Ejecución real de rotación de claves criptográficas y reconciliación ARCO post-restauración.
 */

const assert = require('assert');
const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

const { app } = require('../../src/app');
const prismaAdmin = require('../../src/utils/prismaAdmin');
const { JWT_SECRET, ENCRYPTION_KEY } = require('../../src/config/secrets');
const { rotateEncryptionKeys, encryptWithKey, decryptWithKey } = require('../../scripts/rotate_encryption_key');
const { reconcileRevokedCompanies, appendToPurgeLedger } = require('../../scripts/post_restore_reconcile');

const TEST_PREFIX = `gate4_test_${Date.now()}`;
const companyAlphaId = `${TEST_PREFIX}_alpha`;
const companyBetaId = `${TEST_PREFIX}_beta`;

let adminAlphaUser;
let adminBetaUser;
let superAdminUser;

let adminAlphaToken;
let adminBetaToken;
let superAdminToken;

let rawDeviceTokenAlpha = `kiosk_gate4_alpha_${Date.now()}`;
let tokenHashAlpha = crypto.createHash('sha256').update(rawDeviceTokenAlpha).digest('hex');
let testEmployeeId;

async function setup() {
  console.log('\n--- SETUP: Inicializando datos para Gate 4 ---');

  // 1. Crear empresas
  await prismaAdmin.company.create({
    data: {
      id: companyAlphaId,
      name: 'Empresa Alpha Seguridad',
      slug: `${companyAlphaId}-slug`,
      isActive: true,
      descriptorsVersion: 1
    }
  });

  await prismaAdmin.company.create({
    data: {
      id: companyBetaId,
      name: 'Empresa Beta Seguridad',
      slug: `${companyBetaId}-slug`,
      isActive: true,
      descriptorsVersion: 1
    }
  });

  // Hash de contraseña para usuarios de prueba
  const hashedPassword = await bcrypt.hash('PasswordSeguro2026!', 6);

  // 2. Crear administradores
  adminAlphaUser = await prismaAdmin.adminUser.create({
    data: {
      email: `${TEST_PREFIX}.admin@alpha.com`,
      name: 'Admin Alpha Gate4',
      password: hashedPassword,
      role: 'ADMIN',
      companyId: companyAlphaId
    }
  });

  adminBetaUser = await prismaAdmin.adminUser.create({
    data: {
      email: `${TEST_PREFIX}.admin@beta.com`,
      name: 'Admin Beta Gate4',
      password: hashedPassword,
      role: 'ADMIN',
      companyId: companyBetaId
    }
  });

  superAdminUser = await prismaAdmin.adminUser.create({
    data: {
      email: `${TEST_PREFIX}.superadmin@global.com`,
      name: 'Super Admin Gate4',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      companyId: null
    }
  });

  // Generar tokens
  adminAlphaToken = jwt.sign(
    { id: adminAlphaUser.id, email: adminAlphaUser.email, role: 'ADMIN', companyId: companyAlphaId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  adminBetaToken = jwt.sign(
    { id: adminBetaUser.id, email: adminBetaUser.email, role: 'ADMIN', companyId: companyBetaId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  superAdminToken = jwt.sign(
    { id: superAdminUser.id, email: superAdminUser.email, role: 'SUPER_ADMIN', companyId: null },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // 3. Crear departamento para Alpha
  const dept = await prismaAdmin.department.create({
    data: {
      companyId: companyAlphaId,
      name: `Dept Sec Gate4 ${Date.now()}`
    }
  });

  // 4. Crear empleado con biometría cifrada para Alpha
  const sampleDescriptor = JSON.stringify(new Array(128).fill(0.123));
  const initialEncrypted = encryptWithKey(sampleDescriptor, ENCRYPTION_KEY);

  const emp = await prismaAdmin.employee.create({
    data: {
      companyId: companyAlphaId,
      departmentId: dept.id,
      firstName: 'Seguridad',
      lastName: 'Biométrica',
      identifier: `EMP_SEC_${Date.now()}`,
      faceDescriptor: initialEncrypted,
      isActive: true
    }
  });
  testEmployeeId = emp.id;

  // 5. Crear dispositivo para Alpha
  await prismaAdmin.device.create({
    data: {
      companyId: companyAlphaId,
      name: 'Kiosco Seguridad Gate4',
      type: 'KIOSK',
      status: 'ONLINE',
      token: null,
      tokenHash: tokenHashAlpha,
      isActive: true
    }
  });

  console.log('✓ Setup de Gate 4 completado exitosamente.');
}

async function teardown() {
  console.log('\n--- Limpieza de datos de Gate 4 ---');
  try {
    await prismaAdmin.adminAuditLog.deleteMany({ where: { companyId: { in: [companyAlphaId, companyBetaId] } } });
    await prismaAdmin.attendanceRecord.deleteMany({ where: { companyId: { in: [companyAlphaId, companyBetaId] } } });
    await prismaAdmin.notification.deleteMany({ where: { companyId: { in: [companyAlphaId, companyBetaId] } } });
    await prismaAdmin.employee.deleteMany({ where: { companyId: { in: [companyAlphaId, companyBetaId] } } });
    await prismaAdmin.device.deleteMany({ where: { companyId: { in: [companyAlphaId, companyBetaId] } } });
    await prismaAdmin.deviceAuthRequest.deleteMany({ where: { companyId: { in: [companyAlphaId, companyBetaId] } } });
    await prismaAdmin.department.deleteMany({ where: { companyId: { in: [companyAlphaId, companyBetaId] } } });
    await prismaAdmin.adminUser.deleteMany({
      where: {
        email: {
          in: [
            `${TEST_PREFIX}.admin@alpha.com`,
            `${TEST_PREFIX}.admin@beta.com`,
            `${TEST_PREFIX}.superadmin@global.com`
          ]
        }
      }
    });
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

  try {
    await setup();

    console.log('================================================================');
    console.log('>>> 1. RATE LIMITING COMPUESTO EN LOGIN (IP + EMAIL)');
    console.log('================================================================');
    {
      const targetEmail1 = `ratelimit_${Date.now()}_1@alpha.com`;
      const targetEmail2 = `ratelimit_${Date.now()}_2@alpha.com`;

      // Intentos 1 a 5 con contraseña errónea para targetEmail1
      for (let i = 1; i <= 5; i++) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: targetEmail1, password: 'wrongpassword' });
        assert.strictEqual(res.status, 401, `Intento ${i} debe devolver 401`);
      }
      pass('5 intentos fallidos consecutivos devuelven HTTP 401');

      // 6to intento para targetEmail1 debe ser bloqueado con 429
      const resBlocked = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: targetEmail1, password: 'wrongpassword' });
      assert.strictEqual(resBlocked.status, 429, '6to intento debe devolver HTTP 429');
      assert.strictEqual(resBlocked.body.error, 'TOO_MANY_LOGIN_ATTEMPTS');
      pass('6to intento para targetEmail1 bloqueado con HTTP 429 (TOO_MANY_LOGIN_ATTEMPTS)');

      // targetEmail2 desde la MISMA IP no debe estar bloqueado
      const resOtherUser = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: targetEmail2, password: 'wrongpassword' });
      assert.strictEqual(resOtherUser.status, 401, 'targetEmail2 en la misma IP no debe ser bloqueado');
      pass('Aislamiento por tupla IP+email: bloquear targetEmail1 no afecta a targetEmail2 en la misma IP');
    }

    console.log('\n================================================================');
    console.log('>>> 2. COOKIES SEGURAS: HTTPONLY Y SAMESITE=STRICT');
    console.log('================================================================');
    {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: `${TEST_PREFIX}.admin@alpha.com`, password: 'PasswordSeguro2026!' });

      assert.strictEqual(loginRes.status, 200, 'Login debe ser exitoso');
      const cookies = loginRes.headers['set-cookie'];
      assert(cookies && cookies.length > 0, 'Debe emitir cookies');

      const jwtCookie = cookies.find(c => c.startsWith('jwt='));
      assert(jwtCookie, 'Debe emitir cookie jwt');
      assert(jwtCookie.includes('HttpOnly'), 'Cookie jwt debe tener flag HttpOnly');
      assert(jwtCookie.toLowerCase().includes('samesite=strict'), 'Cookie jwt debe tener SameSite=Strict');
      pass('Cookie jwt configurada con HttpOnly: true y SameSite=Strict');

      const xsrfCookie = cookies.find(c => c.startsWith('XSRF-TOKEN='));
      assert(xsrfCookie, 'Debe emitir cookie XSRF-TOKEN');
      assert(xsrfCookie.toLowerCase().includes('samesite=strict'), 'Cookie XSRF-TOKEN debe tener SameSite=Strict');
      pass('Cookie XSRF-TOKEN emitida y accesible por frontend con SameSite=Strict');
    }

    console.log('\n================================================================');
    console.log('>>> 3. PROTECCIÓN CSRF Y EXENCIONES SEGURAS');
    console.log('================================================================');
    {
      // 3.1 Mutación con cookie de sesión pero sin token CSRF -> 403 CSRF_TOKEN_INVALID
      const resNoCsrf = await request(app)
        .post('/api/v1/departments')
        .set('Cookie', [`jwt=${adminAlphaToken}`, `XSRF-TOKEN=valid_csrf_token_123`])
        .send({ name: 'Depto Sin CSRF' });

      assert.strictEqual(resNoCsrf.status, 403, 'Debe rechazar con 403 por falta de cabecera CSRF');
      assert.strictEqual(resNoCsrf.body.error, 'CSRF_TOKEN_INVALID');
      pass('Mutación con cookie sin cabecera x-csrf-token rechazada con HTTP 403 (CSRF_TOKEN_INVALID)');

      // 3.2 Mutación con cookie y cabecera CSRF coincidente -> 201 Created
      const csrfToken = 'valid_csrf_token_abcdef123456';
      const resWithCsrf = await request(app)
        .post('/api/v1/departments')
        .set('Cookie', [`jwt=${adminAlphaToken}`, `XSRF-TOKEN=${csrfToken}`])
        .set('x-csrf-token', csrfToken)
        .send({ name: `Depto Con CSRF ${Date.now()}` });

      assert.strictEqual(resWithCsrf.status, 201, 'Mutación con CSRF válido debe responder 201');
      pass('Mutación con cookie y cabecera x-csrf-token coincidente procesada exitosamente (HTTP 201)');

      // 3.3 Exención: Petición con cabecera Authorization: Bearer (sin cookie) -> 201 Created
      const resBearer = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${adminAlphaToken}`)
        .send({ name: `Depto Bearer ${Date.now()}` });

      assert.strictEqual(resBearer.status, 201, 'Petición Bearer sin cookie no requiere CSRF');
      pass('Exención segura: peticiones con Authorization: Bearer operan sin requerir CSRF');

      // 3.4 Exención: Petición de kiosco con x-device-token -> NO bloqueada por CSRF
      const resKiosk = await request(app)
        .post('/api/v1/attendance/validate')
        .set('x-device-token', rawDeviceTokenAlpha)
        .send({ descriptor: new Array(128).fill(0.123) });

      assert.notStrictEqual(resKiosk.status, 403, 'Kiosco con x-device-token nunca debe ser bloqueado por CSRF');
      pass('Exención segura: kiosco con x-device-token opera sin bloqueo de CSRF');
    }

    console.log('\n================================================================');
    console.log('>>> 4. CORS ESTRICTO CON LISTA BLANCA Y RECHAZO A ORIGEN NO AUTORIZADO');
    console.log('================================================================');
    {
      // Origen no autorizado
      const resBadCors = await request(app)
        .get('/api/v1/settings/public')
        .set('Origin', 'https://sitio-malicioso-phishing.com');

      assert.strictEqual(resBadCors.status, 403, 'Origen no autorizado debe ser rechazado con 403');
      assert.strictEqual(resBadCors.body.error, 'CORS_NOT_ALLOWED');
      pass('Origen no autorizado https://sitio-malicioso-phishing.com rechazado con HTTP 403');

      // Origen autorizado en lista blanca (localhost:8080)
      const resGoodCors = await request(app)
        .get('/api/v1/settings/public')
        .set('Origin', 'http://localhost:8080');

      assert.strictEqual(resGoodCors.status, 200);
      assert.strictEqual(resGoodCors.headers['access-control-allow-origin'], 'http://localhost:8080');
      pass('Origen en lista blanca (http://localhost:8080) admitido con cabecera Access-Control-Allow-Origin');
    }

    console.log('\n================================================================');
    console.log('>>> 5. PENTEST DE SPOOFING CROSS-TENANT');
    console.log('================================================================');
    {
      // 5.1 Admin Alpha enviando x-tenant-id ajeno es ignorado por tenantContext
      const resSpoofHeader = await request(app)
        .get('/api/v1/employees')
        .set('Authorization', `Bearer ${adminAlphaToken}`)
        .set('x-tenant-id', companyBetaId);

      assert.strictEqual(resSpoofHeader.status, 200);
      const employees = resSpoofHeader.body.employees || resSpoofHeader.body;
      assert(Array.isArray(employees), 'Debe devolver array de empleados');
      const hasBeta = employees.some(e => e.companyId === companyBetaId);
      assert.strictEqual(hasBeta, false, 'No debe filtrar empleados de Beta');
      pass('Admin de inquilino enviando x-tenant-id ajeno es ignorado (aislamiento estricto a su JWT)');

      // 5.2 companyId inyectado en body de creación es sobreescrito
      const resSpoofBody = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${adminAlphaToken}`)
        .send({
          name: `Dept Anti-Spoof ${Date.now()}`,
          companyId: companyBetaId // Intento de inyectar tenant ajeno en el body
        });

      assert.strictEqual(resSpoofBody.status, 201);
      assert.strictEqual(resSpoofBody.body.companyId, companyAlphaId, 'El companyId debe pertenecer estrictamente a Alpha');
      pass('companyId ajeno inyectado en el body de mutación es sanitizado/sobreescrito al inquilino del JWT');

      // 5.3 Super Admin en ruta operativa SIN x-tenant-id -> 400 TENANT_HEADER_REQUIRED
      const resSuperNoHeader = await request(app)
        .get('/api/v1/employees')
        .set('Authorization', `Bearer ${superAdminToken}`);

      assert.strictEqual(resSuperNoHeader.status, 400);
      assert.strictEqual(resSuperNoHeader.body.error, 'TENANT_HEADER_REQUIRED');
      pass('Super Admin sin x-tenant-id en ruta operativa de inquilino es rechazado con HTTP 400');

      // 5.4 Super Admin en ruta operativa CON x-tenant-id -> 200 OK
      const resSuperWithHeader = await request(app)
        .get('/api/v1/employees')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-tenant-id', companyAlphaId);

      assert.strictEqual(resSuperWithHeader.status, 200);
      pass('Super Admin con x-tenant-id opera correctamente en contexto del inquilino especificado');
    }

    console.log('\n================================================================');
    console.log('>>> 6. ROTACIÓN CRIPTOGRÁFICA Y RECONCILIACIÓN ARCO');
    console.log('================================================================');
    {
      // 6.1 Rotación de claves de cifrado
      const keyA = ENCRYPTION_KEY;
      const keyB = crypto.randomBytes(32);

      const empBefore = await prismaAdmin.employee.findUnique({
        where: { id: testEmployeeId },
        select: { faceDescriptor: true }
      });

      const plainBefore = decryptWithKey(empBefore.faceDescriptor, keyA);
      assert(plainBefore, 'El descriptor debe descifrarse con la llave A');

      // Rotar de llave A a llave B
      await rotateEncryptionKeys({
        oldKey: keyA.toString('hex'),
        newKey: keyB.toString('hex'),
        employeeId: testEmployeeId
      });

      const empAfter = await prismaAdmin.employee.findUnique({
        where: { id: testEmployeeId },
        select: { faceDescriptor: true }
      });

      // El ciphertext debe ser diferente
      assert.notStrictEqual(empAfter.faceDescriptor, empBefore.faceDescriptor, 'El ciphertext debe cambiar tras la rotación');
      // Debe descifrar con llave B al mismo vector idéntico
      const plainAfter = decryptWithKey(empAfter.faceDescriptor, keyB);
      assert.strictEqual(plainAfter, plainBefore, 'El contenido descifrado con la nueva llave debe ser idéntico');
      pass('Rotación criptográfica ejecutada: ciphertext cambió y descifra idénticamente con la nueva clave');

      // Revertir a la llave original de prueba
      await rotateEncryptionKeys({
        oldKey: keyB.toString('hex'),
        newKey: keyA.toString('hex'),
        employeeId: testEmployeeId
      });
      pass('Descriptor biométrico restaurado a la llave original del entorno de prueba');

      // 6.2 Reconciliación ARCO post-restauración
      const tempCompanyId = `purge_arco_test_${Date.now()}`;
      const tempLedgerFile = path.join(__dirname, `../../ledger/test_ledger_${Date.now()}.jsonl`);

      // Crear empresa temporal en BD que simula haber reaparecido tras restaurar un backup
      await prismaAdmin.company.create({
        data: {
          id: tempCompanyId,
          name: 'Empresa Revocada Reaparecida',
          slug: `${tempCompanyId}-slug`,
          isActive: false
        }
      });

      // Registrar purga en el libro mayor externo inmutable
      appendToPurgeLedger({
        companyId: tempCompanyId,
        reason: 'ARCO_DERECHO_AL_OLVIDO_REVOCADO',
        arcomRequestId: 'ARCO-2026-9999'
      }, tempLedgerFile);

      // Prueba en modo DRY-RUN: Detecta pero no purga
      const dryResult = await reconcileRevokedCompanies({
        dryRun: true,
        ledgerPath: tempLedgerFile
      });
      assert.strictEqual(dryResult.found, 1, 'Modo dry-run debe encontrar la empresa');
      assert.strictEqual(dryResult.purged, 0, 'Modo dry-run no debe eliminar la empresa');

      const stillExists = await prismaAdmin.company.findUnique({ where: { id: tempCompanyId } });
      assert(stillExists, 'La empresa aún existe tras dry-run');
      pass('post_restore_reconcile en modo --dry-run detectó la empresa revocada sin alterarla');

      // Prueba en modo CONFIRM: Purga transaccional real
      const confirmResult = await reconcileRevokedCompanies({
        dryRun: false,
        ledgerPath: tempLedgerFile
      });
      assert.strictEqual(confirmResult.found, 1);
      assert.strictEqual(confirmResult.purged, 1, 'Modo confirm debe purgar la empresa');

      const deletedCompany = await prismaAdmin.company.findUnique({ where: { id: tempCompanyId } });
      assert.strictEqual(deletedCompany, null, 'La empresa debe quedar purgada de la BD');
      pass('post_restore_reconcile en modo --confirm ejecutó purga ARCO transaccional completa');

      // Limpieza de archivo de ledger de prueba
      if (fs.existsSync(tempLedgerFile)) {
        fs.unlinkSync(tempLedgerFile);
      }
    }

  } finally {
    await teardown();
  }

  console.log('\n' + '='.repeat(64));
  console.log(`Resultado final Gate 4: ${passed} pasadas, ${failed} fallidas`);
  console.log('='.repeat(64));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Error fatal en ejecución de tests Gate 4:', err);
  process.exit(1);
});

