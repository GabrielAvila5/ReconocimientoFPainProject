const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../../src/app');
const prisma = require('../../src/utils/prisma');
const { JWT_SECRET } = require('../../src/config/secrets');
const companyAlpha = 'default-company-pain';
const companyBeta = 'company-beta-saas';

// Tokens para pruebas
const tokenAdminAlpha = jwt.sign(
  { id: 'admin-alpha-test', role: 'ADMIN', companyId: companyAlpha },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const tokenAdminBeta = jwt.sign(
  { id: 'admin-beta-test', role: 'ADMIN', companyId: companyBeta },
  JWT_SECRET,
  { expiresIn: '1h' }
);

async function main() {
  console.log('================================================================');
  console.log('>>> ITEM 7: DEMOSTRACIÓN DE EMPAREJAMIENTO EN 2 PASOS Y AISLAMIENTO');
  console.log('================================================================\n');

  // Asegurar que existan los admin users en la BD para que requireAuth pase
  await prisma.$base.adminUser.upsert({
    where: { id: 'admin-alpha-test' },
    create: { id: 'admin-alpha-test', name: 'Admin Alpha', email: 'admin.alpha.pairing@test.com', password: 'hash', role: 'ADMIN', companyId: companyAlpha },
    update: { companyId: companyAlpha }
  });

  await prisma.$base.adminUser.upsert({
    where: { id: 'admin-beta-test' },
    create: { id: 'admin-beta-test', name: 'Admin Beta', email: 'admin.beta.pairing@test.com', password: 'hash', role: 'ADMIN', companyId: companyBeta },
    update: { companyId: companyBeta }
  });

  // 1. Kiosko solicita emparejamiento (Público)
  console.log('[Kiosco] Solicitando nuevo código de emparejamiento...');
  const resKiosk = await request(app)
    .post('/api/v1/devices/auth-request')
    .set('User-Agent', 'KioskBrowser/1.0 (Linux; Raspberry Pi 4)')
    .send({ deviceId: 'kiosk-hardware-unique-fingerprint-001' });

  console.log(`✓ Kiosko recibió HTTP ${resKiosk.status}`);
  console.log(`  - Código generado: ${resKiosk.body.pairingCode}`);
  console.log(`  - ID Solicitud: ${resKiosk.body.requestId}`);

  const { pairingCode, requestId } = resKiosk.body;

  // 2. Paso 1: Administrador de Empresa Alpha consulta el código
  console.log('\n[Paso 1] Administrador Alpha ingresa el código en Dashboard para ver detalles...');
  const resLookup = await request(app)
    .post('/api/v1/devices/auth-requests/lookup')
    .set('Authorization', `Bearer ${tokenAdminAlpha}`)
    .send({ pairingCode });

  console.log(`✓ Status recibido: ${resLookup.status} (esperado: 200)`);
  console.log(`✓ Datos presentados al Administrador para verificación visual:`);
  console.log(`  - IP del Kiosko: ${resLookup.body.ipAddress}`);
  console.log(`  - Navegador / User-Agent: ${resLookup.body.userAgent}`);
  console.log(`  - Expira en: ${resLookup.body.expiresAt}`);

  if (resLookup.status !== 200 || !resLookup.body.ipAddress || !resLookup.body.userAgent) {
    throw new Error('Fallo en Paso 1: No se recibieron los datos del dispositivo.');
  }

  // 3. Simular que la solicitud pertenece a Empresa Alpha y Admin Beta intenta aprobarla
  // Asociamos la solicitud a Empresa Alpha
  await prisma.$base.deviceAuthRequest.update({
    where: { id: requestId },
    data: { companyId: companyAlpha }
  });

  console.log('\n[Prueba de Rechazo Cross-Tenant] Administrador de Empresa Beta intenta aprobar solicitud de Alpha...');
  const resCrossTenant = await request(app)
    .post(`/api/v1/devices/auth-requests/${requestId}/approve`)
    .set('Authorization', `Bearer ${tokenAdminBeta}`)
    .send({ name: 'Kiosko Hackeado por Beta' });

  console.log(`✓ Status recibido: ${resCrossTenant.status} (esperado: 403 Forbidden)`);
  console.log(`✓ Mensaje de error: ${JSON.stringify(resCrossTenant.body)}`);

  if (resCrossTenant.status !== 403) {
    throw new Error(`Fallo de seguridad: Admin Beta recibió status ${resCrossTenant.status} en lugar de 403 Forbidden.`);
  }

  // 4. Paso 2: Administrador legítimo de Empresa Alpha confirma la aprobación
  console.log('\n[Paso 2] Administrador legítimo de Empresa Alpha confirma la aprobación...');
  const resApprove = await request(app)
    .post(`/api/v1/devices/auth-requests/${requestId}/approve`)
    .set('Authorization', `Bearer ${tokenAdminAlpha}`)
    .send({ name: 'Kiosko Entrada Alpha Oficial' });

  console.log(`✓ Status recibido: ${resApprove.status} (esperado: 200)`);
  const dbDevice = await prisma.$base.device.findUnique({ where: { id: resApprove.body.device.id } });
  console.log(`✓ Dispositivo verificado en base de datos:`);
  console.log(`  - Device ID: ${dbDevice.id}`);
  console.log(`  - Nombre: ${dbDevice.name}`);
  console.log(`  - Token Hash SHA-256 en BD: ${dbDevice.tokenHash ? 'PRESENTE (' + dbDevice.tokenHash.substring(0, 16) + '...)' : 'FALTA'}`);
  console.log(`  - Empresa asignada: ${dbDevice.companyId} (esperado: ${companyAlpha})`);

  if (resApprove.status !== 200 || dbDevice.companyId !== companyAlpha || !dbDevice.tokenHash) {
    throw new Error('Fallo en Paso 2: Dispositivo no fue aprobado correctamente para Empresa Alpha.');
  }

  // Limpieza de datos de prueba
  await prisma.$base.device.deleteMany({ where: { id: resApprove.body.device.id } });
  await prisma.$base.deviceAuthRequest.deleteMany({ where: { id: requestId } });
  await prisma.$base.adminUser.deleteMany({ where: { id: { in: ['admin-alpha-test', 'admin-beta-test'] } } });

  console.log('\n================================================================');
  console.log('✓ ITEM 7 DEMOSTRADO EXITOSAMENTE: FLUJO 2 PASOS Y RECHAZO CROSS-TENANT 403');
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Error en prueba Item 7:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
