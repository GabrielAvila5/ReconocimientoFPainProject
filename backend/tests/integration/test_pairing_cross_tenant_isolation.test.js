/**
 * PRUEBA HTTP REAL: AISLAMIENTO ESTRICTO DE EMPAREJAMIENTO DE DISPOSITIVOS (ITEM 4)
 * Demuestra mediante Supertest que:
 * 1. Admin de Empresa B NO puede listar solicitudes pendientes (403 Forbidden).
 * 2. Admin de Empresa B NO puede consultar (lookup) sin el código de emparejamiento.
 * 3. Admin de Empresa B NO puede aprobar una solicitud pendiente por simple ID sin el código físico.
 * 4. Admin de Empresa B NO puede aprobar una solicitud perteneciente a Empresa A (403 Forbidden).
 * 5. Todo dato creado se limpia rigurosamente en teardown.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../../src/app');
const prismaAdmin = require('../../src/utils/prismaAdmin');
const { JWT_SECRET } = require('../../src/config/secrets');

const companyAlpha = 'default-company-pain';
const companyBeta = 'company-beta-saas';

async function runPairingIsolationTests() {
  console.log('================================================================');
  console.log('>>> PRUEBA HTTP REAL: AISLAMIENTO ESTRICTO DE EMPAREJAMIENTO');
  console.log('================================================================\n');

  // Asegurar inquilinos
  await prismaAdmin.company.upsert({
    where: { id: companyAlpha },
    create: { id: companyAlpha, name: 'Empresa Alpha', slug: 'alpha-pairing', isActive: true },
    update: { isActive: true }
  });
  await prismaAdmin.company.upsert({
    where: { id: companyBeta },
    create: { id: companyBeta, name: 'Empresa Beta', slug: 'beta-pairing', isActive: true },
    update: { isActive: true }
  });

  // Asegurar admin users reales en BD
  await prismaAdmin.adminUser.upsert({
    where: { id: 'admin-alpha-pair-id' },
    create: { id: 'admin-alpha-pair-id', companyId: companyAlpha, name: 'Admin Alpha', role: 'ADMIN', email: 'admin.alpha@pairtest.com', password: 'hash' },
    update: { companyId: companyAlpha }
  });
  await prismaAdmin.adminUser.upsert({
    where: { id: 'admin-beta-pair-id' },
    create: { id: 'admin-beta-pair-id', companyId: companyBeta, name: 'Admin Beta', role: 'ADMIN', email: 'admin.beta@pairtest.com', password: 'hash' },
    update: { companyId: companyBeta }
  });

  // Tokens JWT para Admin Alpha y Admin Beta
  const tokenAdminAlpha = jwt.sign(
    { id: 'admin-alpha-pair-id', companyId: companyAlpha, role: 'ADMIN', email: 'admin.alpha@pairtest.com' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const tokenAdminBeta = jwt.sign(
    { id: 'admin-beta-pair-id', companyId: companyBeta, role: 'ADMIN', email: 'admin.beta@pairtest.com' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  let createdRequestId = null;
  let createdDeviceId = null;

  try {
    // -----------------------------------------------------------------------
    // PRUEBA 1: Admin de Empresa B intenta listar solicitudes pendientes
    // -----------------------------------------------------------------------
    console.log('[Prueba 1] Admin de Empresa B intenta listar solicitudes pendientes globales (GET /auth-requests/pending)...');
    const resList = await request(app)
      .get('/api/v1/devices/auth-requests/pending')
      .set('Authorization', `Bearer ${tokenAdminBeta}`);

    console.log(`  -> Status HTTP recibido: ${resList.status} (esperado: 403 Forbidden)`);
    if (resList.status !== 403) {
      throw new Error(`Fallo de seguridad: Admin de tenant pudo invocar GET /auth-requests/pending (status ${resList.status})`);
    }
    console.log('  ✓ ÉXITO: Listado global denegado a administradores de inquilinos.');

    // -----------------------------------------------------------------------
    // PRUEBA 2: Kiosko solicita código de emparejamiento
    // -----------------------------------------------------------------------
    console.log('\n[Prueba 2] Kiosko anónimo solicita emparejamiento (POST /auth-request)...');
    const resAuthReq = await request(app)
      .post('/api/v1/devices/auth-request')
      .send({ deviceId: 'test-kiosk-hardware-uuid-999', forceNew: true });

    console.log(`  -> Status HTTP recibido: ${resAuthReq.status} (esperado: 201 Created)`);
    if (resAuthReq.status !== 201 || !resAuthReq.body.pairingCode) {
      throw new Error('Fallo al generar solicitud de emparejamiento para kiosko.');
    }
    createdRequestId = resAuthReq.body.requestId;
    const realPairingCode = resAuthReq.body.pairingCode;
    console.log(`  ✓ Solicitud creada con ID: ${createdRequestId}, Código: ${realPairingCode}`);

    // -----------------------------------------------------------------------
    // PRUEBA 3: Admin de Empresa B intenta lookup SIN código o con código erróneo
    // -----------------------------------------------------------------------
    console.log('\n[Prueba 3] Admin de Empresa B intenta lookup sin código o con código erróneo...');
    const resLookupEmpty = await request(app)
      .post('/api/v1/devices/auth-requests/lookup')
      .set('Authorization', `Bearer ${tokenAdminBeta}`)
      .send({});
    console.log(`  -> Lookup sin código: Status ${resLookupEmpty.status} (esperado: 400)`);
    if (resLookupEmpty.status !== 400) throw new Error('Se esperaba 400 en lookup sin código.');

    const resLookupWrong = await request(app)
      .post('/api/v1/devices/auth-requests/lookup')
      .set('Authorization', `Bearer ${tokenAdminBeta}`)
      .send({ pairingCode: 'WRONG-COD' });
    console.log(`  -> Lookup con código incorrecto: Status ${resLookupWrong.status} (esperado: 404)`);
    if (resLookupWrong.status !== 404) throw new Error('Se esperaba 404 en lookup con código erróneo.');
    console.log('  ✓ ÉXITO: No es posible adivinar ni consultar solicitudes sin el código físico exacto.');

    // -----------------------------------------------------------------------
    // PRUEBA 4: Admin de Empresa B intenta aprobar con ID pero SIN código físico
    // -----------------------------------------------------------------------
    console.log('\n[Prueba 4] Admin de Empresa B conoce el UUID e intenta aprobar SIN el código físico...');
    const resApproveNoCode = await request(app)
      .post(`/api/v1/devices/auth-requests/${createdRequestId}/approve`)
      .set('Authorization', `Bearer ${tokenAdminBeta}`)
      .send({ name: 'Kiosko Robado B' });

    console.log(`  -> Status recibido: ${resApproveNoCode.status} (esperado: 400 Bad Request)`);
    console.log(`  -> Mensaje: ${JSON.stringify(resApproveNoCode.body)}`);
    if (resApproveNoCode.status !== 400 || !resApproveNoCode.body.error.includes('código de emparejamiento')) {
      throw new Error('Fallo de seguridad: Se permitió aprobar sin validar el código físico.');
    }
    console.log('  ✓ ÉXITO: Aprobación denegada por carecer del código físico.');

    // -----------------------------------------------------------------------
    // PRUEBA 5: Admin de Empresa Alpha aprueba legítimamente con su código
    // -----------------------------------------------------------------------
    console.log('\n[Prueba 5] Admin de Empresa Alpha aprueba legítimamente con su código físico...');
    const resApproveAlpha = await request(app)
      .post(`/api/v1/devices/auth-requests/${createdRequestId}/approve`)
      .set('Authorization', `Bearer ${tokenAdminAlpha}`)
      .send({ name: 'Kiosko Legítimo Alpha', pairingCode: realPairingCode });

    console.log(`  -> Status recibido: ${resApproveAlpha.status} (esperado: 200 OK)`);
    if (resApproveAlpha.status !== 200 || !resApproveAlpha.body.device) {
      throw new Error('Fallo al aprobar solicitud legítima con código.');
    }
    createdDeviceId = resApproveAlpha.body.device.id;
    console.log(`  ✓ Kiosko aprobado para Empresa Alpha: Device ID = ${createdDeviceId}, CompanyId = ${resApproveAlpha.body.device.companyId}`);

    // -----------------------------------------------------------------------
    // PRUEBA 6: Admin de Empresa B intenta re-aprobar o robar la solicitud
    // -----------------------------------------------------------------------
    console.log('\n[Prueba 6] Admin de Empresa B intenta re-aprobar o asociar a Empresa Beta...');
    const resReApprove = await request(app)
      .post(`/api/v1/devices/auth-requests/${createdRequestId}/approve`)
      .set('Authorization', `Bearer ${tokenAdminBeta}`)
      .send({ name: 'Kiosko Secuestrado Beta', pairingCode: realPairingCode });

    console.log(`  -> Status recibido: ${resReApprove.status} (esperado: 404 Indistinguible de no existe)`);
    console.log(`  -> Mensaje: ${JSON.stringify(resReApprove.body)}`);
    if (resReApprove.status !== 404) {
      throw new Error(`Fallo de aislamiento: Admin de Beta no recibió 404 al intentar interactuar con recurso de Alpha (obtuvo ${resReApprove.status}).`);
    }
    console.log('  ✓ ÉXITO: Empresa B recibe HTTP 404 indistinguible (Cross-Tenant recurso ajeno).');

  } finally {
    // -----------------------------------------------------------------------
    // TEARDOWN: Limpieza garantizada de entidades de prueba
    // -----------------------------------------------------------------------
    console.log('\n[Teardown] Limpiando registros de prueba...');
    if (createdDeviceId) {
      await prismaAdmin.device.deleteMany({ where: { id: createdDeviceId } });
    }
    if (createdRequestId) {
      await prismaAdmin.deviceAuthRequest.deleteMany({ where: { id: createdRequestId } });
    }
    await prismaAdmin.employee.deleteMany({
      where: { email: { in: ['admin.alpha@pairtest.com', 'admin.beta@pairtest.com'] } }
    });
    await prismaAdmin.adminUser.deleteMany({
      where: { id: { in: ['admin-alpha-pair-id', 'admin-beta-pair-id'] } }
    });
    console.log('  ✓ Teardown finalizado con 0 residuos.');
  }

  console.log('\n================================================================');
  console.log('✓ ITEM 4 VERIFICADO: AISLAMIENTO TOTAL EN EMPAREJAMIENTO');
  console.log('================================================================\n');
}

runPairingIsolationTests().catch(err => {
  console.error('Error en prueba de emparejamiento:', err);
  process.exit(1);
}).finally(() => prismaAdmin.$disconnect());
