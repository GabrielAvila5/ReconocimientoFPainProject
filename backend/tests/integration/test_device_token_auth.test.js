/**
 * PRUEBA HTTP DE AISLAMIENTO Y AUTENTICACIÓN POR TOKEN DE DISPOSITIVO (x-device-token)
 * 
 * Verifica que tenantContextMiddleware rechace correctamente:
 * 1. Token inventado o inexistente -> HTTP 401 DEVICE_UNAUTHORIZED
 * 2. Dispositivo inactivo / revocado -> HTTP 403 DEVICE_DEACTIVATED
 * 3. Dispositivo bloqueado temporalmente -> HTTP 403 DEVICE_BLOCKED
 * 4. Empresa suspendida -> HTTP 403 COMPANY_SUSPENDED
 * 5. Que ninguna respuesta de rechazo filtre datos del inquilino (nombre, ID, etc.)
 * 6. Dispositivo legítimo de empresa activa -> Permitido en el contexto correcto
 */

const request = require('supertest');
const { app } = require('../../src/app');
const prismaAdmin = require('../../src/utils/prismaAdmin');
const crypto = require('crypto');

async function runDeviceTokenAuthTests() {
  console.log('================================================================');
  console.log('>>> PRUEBA HTTP: VALIDACIÓN Y AISLAMIENTO DE X-DEVICE-TOKEN');
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

  const prefix = `devtok_test_${Date.now()}`;
  let activeCompanyId = null;
  let suspendedCompanyId = null;
  let validDeviceId = null;
  let inactiveDeviceId = null;
  let blockedDeviceId = null;
  let suspendedDeviceId = null;

  const validToken = `tok_valid_${crypto.randomBytes(16).toString('hex')}`;
  const inactiveToken = `tok_inact_${crypto.randomBytes(16).toString('hex')}`;
  const blockedToken = `tok_block_${crypto.randomBytes(16).toString('hex')}`;
  const suspendedToken = `tok_susp_${crypto.randomBytes(16).toString('hex')}`;
  const fakeToken = `tok_invented_${crypto.randomBytes(16).toString('hex')}`;

  try {
    // -------------------------------------------------------------------------
    // SETUP: Creación de inquilinos y dispositivos de prueba
    // -------------------------------------------------------------------------
    const activeCompany = await prismaAdmin.company.create({
      data: {
        id: `${prefix}_active_co`,
        name: 'Empresa Activa Tokens',
        slug: `${prefix}-active-tokens`,
        isActive: true,
        maxDevices: 10,
        maxEmployees: 10
      }
    });
    activeCompanyId = activeCompany.id;

    const suspendedCompany = await prismaAdmin.company.create({
      data: {
        id: `${prefix}_susp_co`,
        name: 'Empresa Suspendida Tokens',
        slug: `${prefix}-susp-tokens`,
        isActive: false, // Empresa suspendida
        maxDevices: 10,
        maxEmployees: 10
      }
    });
    suspendedCompanyId = suspendedCompany.id;

    // 1. Dispositivo válido en empresa activa
    const validDev = await prismaAdmin.device.create({
      data: {
        companyId: activeCompanyId,
        name: 'Kiosco Activo Legítimo',
        token: null,
        tokenHash: crypto.createHash('sha256').update(validToken).digest('hex'),
        isActive: true,
        isBlocked: false,
        type: 'KIOSK'
      }
    });
    validDeviceId = validDev.id;

    // 2. Dispositivo inactivo / dado de baja
    const inactDev = await prismaAdmin.device.create({
      data: {
        companyId: activeCompanyId,
        name: 'Kiosco Dado de Baja',
        token: null,
        tokenHash: crypto.createHash('sha256').update(inactiveToken).digest('hex'),
        isActive: false,
        deactivatedReason: 'Robado en sucursal',
        isBlocked: false,
        type: 'KIOSK'
      }
    });
    inactiveDeviceId = inactDev.id;

    // 3. Dispositivo bloqueado
    const blockDev = await prismaAdmin.device.create({
      data: {
        companyId: activeCompanyId,
        name: 'Kiosco Bloqueado',
        token: null,
        tokenHash: crypto.createHash('sha256').update(blockedToken).digest('hex'),
        isActive: true,
        isBlocked: true,
        blockedReason: 'Falla de cámara reiterada',
        type: 'KIOSK'
      }
    });
    blockedDeviceId = blockDev.id;

    // 4. Dispositivo activo pero en empresa suspendida
    const suspDev = await prismaAdmin.device.create({
      data: {
        companyId: suspendedCompanyId,
        name: 'Kiosco Empresa Suspendida',
        token: null,
        tokenHash: crypto.createHash('sha256').update(suspendedToken).digest('hex'),
        isActive: true,
        isBlocked: false,
        type: 'KIOSK'
      }
    });
    suspendedDeviceId = suspDev.id;

    const apiKey = process.env.KIOSK_API_KEY || 'kiosk-secret-key-123';

    // -------------------------------------------------------------------------
    // CASO 1: Token inventado o inexistente
    // -------------------------------------------------------------------------
    console.log('--- 1. Petición con token de dispositivo inventado ---');
    const resFake = await request(app)
      .get('/api/v1/attendance/context/emp-random-123')
      .set('x-api-key', apiKey)
      .set('x-device-token', fakeToken);

    assert(resFake.status === 401, `Token inventado devuelve HTTP 401 (obtuvo ${resFake.status})`);
    assert(resFake.body.error === 'DEVICE_UNAUTHORIZED', `Código de error es DEVICE_UNAUTHORIZED (obtuvo ${resFake.body.error})`);
    assert(!resFake.body.companyId && !resFake.body.company, 'No revela companyId ni metadatos de inquilino');

    // -------------------------------------------------------------------------
    // CASO 2: Dispositivo inactivo / revocado
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Petición con dispositivo inactivo / revocado ---');
    const resInactive = await request(app)
      .get('/api/v1/attendance/context/emp-random-123')
      .set('x-api-key', apiKey)
      .set('x-device-token', inactiveToken);

    assert(resInactive.status === 403, `Dispositivo inactivo devuelve HTTP 403 (obtuvo ${resInactive.status})`);
    assert(resInactive.body.error === 'DEVICE_DEACTIVATED', `Código de error es DEVICE_DEACTIVATED (obtuvo ${resInactive.body.error})`);
    assert(!resInactive.body.companyId && !resInactive.body.company, 'No revela companyId ni metadatos de empresa');
    assert(resInactive.body.message.includes('Robado en sucursal'), 'Informa la razón de desactivación sin filtrar inquilino');

    // -------------------------------------------------------------------------
    // CASO 3: Dispositivo bloqueado temporalmente
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Petición con dispositivo bloqueado ---');
    const resBlocked = await request(app)
      .get('/api/v1/attendance/context/emp-random-123')
      .set('x-api-key', apiKey)
      .set('x-device-token', blockedToken);

    assert(resBlocked.status === 403, `Dispositivo bloqueado devuelve HTTP 403 (obtuvo ${resBlocked.status})`);
    assert(resBlocked.body.error === 'DEVICE_BLOCKED', `Código de error es DEVICE_BLOCKED (obtuvo ${resBlocked.body.error})`);
    assert(!resBlocked.body.companyId && !resBlocked.body.company, 'No revela companyId ni metadatos de empresa');

    // -------------------------------------------------------------------------
    // CASO 4: Dispositivo de una empresa suspendida
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Petición con dispositivo de empresa suspendida ---');
    const resSuspended = await request(app)
      .get('/api/v1/attendance/context/emp-random-123')
      .set('x-api-key', apiKey)
      .set('x-device-token', suspendedToken);

    assert(resSuspended.status === 403, `Empresa suspendida devuelve HTTP 403 (obtuvo ${resSuspended.status})`);
    assert(resSuspended.body.error === 'COMPANY_SUSPENDED', `Código de error es COMPANY_SUSPENDED (obtuvo ${resSuspended.body.error})`);
    assert(!resSuspended.body.companyId && !resSuspended.body.company, 'No revela companyId ni nombre de la empresa suspendida');

    // -------------------------------------------------------------------------
    // CASO 5: Dispositivo legítimo de empresa activa
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Petición con dispositivo legítimo y activo ---');
    const resValid = await request(app)
      .get('/api/v1/attendance/context/emp-no-existe-en-co')
      .set('x-api-key', apiKey)
      .set('x-device-token', validToken);

    // Debe pasar la autenticación del dispositivo y context middleware, llegando al handler de la ruta
    // El handler busca el empleado en el inquilino y devuelve 404 porque no existe
    assert(resValid.status === 404, `Dispositivo legítimo pasa autenticación y ejecuta dentro del tenant (obtuvo ${resValid.status})`);
    assert(resValid.body.error === 'Empleado no encontrado', 'Handler de negocio se ejecuta dentro del tenant aislado');

  } finally {
    // -------------------------------------------------------------------------
    // TEARDOWN: Limpieza determinista
    // -------------------------------------------------------------------------
    console.log('\n--- Limpieza determinista de datos de prueba ---');
    const deviceIds = [validDeviceId, inactiveDeviceId, blockedDeviceId, suspendedDeviceId].filter(Boolean);
    if (deviceIds.length > 0) {
      await prismaAdmin.device.deleteMany({ where: { id: { in: deviceIds } } });
    }
    const companyIds = [activeCompanyId, suspendedCompanyId].filter(Boolean);
    if (companyIds.length > 0) {
      await prismaAdmin.company.deleteMany({ where: { id: { in: companyIds } } });
    }
    console.log('Teardown completado exitosamente.');
  }

  console.log(`\nResultado final: ${passed} pasadas, ${failed} fallidas\n`);
  if (failed > 0) {
    throw new Error(`Fallaron ${failed} aserciones en test_device_token_auth.`);
  }
}

if (require.main === module) {
  runDeviceTokenAuthTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error fatal en prueba de autenticación de dispositivo:', err);
      process.exit(1);
    });
}

module.exports = { runDeviceTokenAuthTests };
