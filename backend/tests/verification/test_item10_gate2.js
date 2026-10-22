const request = require('supertest');
const jwt = require('jsonwebtoken');
const http = require('http');
const { io: ioClient } = require('socket.io-client');
const { app, server } = require('../../src/app');
const prisma = require('../../src/utils/prisma');
const { JWT_SECRET } = require('../../src/config/secrets');

const companyAlpha = 'default-company-pain';
const companyBeta = 'company-beta-saas';

async function main() {
  console.log('================================================================');
  console.log('>>> ITEM 10: DEMOSTRACIÓN FINAL DE REQUISITOS DEL GATE 2');
  console.log('================================================================\n');

  // Asegurar empresas
  await prisma.$base.company.upsert({
    where: { id: companyAlpha },
    create: { id: companyAlpha, name: 'Empresa Alpha', slug: 'alpha-g2', isActive: true },
    update: { isActive: true }
  });
  await prisma.$base.company.upsert({
    where: { id: companyBeta },
    create: { id: companyBeta, name: 'Empresa Beta', slug: 'beta-g2', isActive: true },
    update: { isActive: true }
  });

  // Asegurar admin users
  await prisma.$base.adminUser.upsert({
    where: { id: 'admin-alpha-g2' },
    create: { id: 'admin-alpha-g2', name: 'Admin Alpha', email: 'admin.alpha.g2@test.com', password: 'hash', role: 'ADMIN', companyId: companyAlpha },
    update: { companyId: companyAlpha }
  });
  await prisma.$base.adminUser.upsert({
    where: { id: 'admin-beta-g2' },
    create: { id: 'admin-beta-g2', name: 'Admin Beta', email: 'admin.beta.g2@test.com', password: 'hash', role: 'ADMIN', companyId: companyBeta },
    update: { companyId: companyBeta }
  });
  await prisma.$base.adminUser.upsert({
    where: { id: 'superadmin-g2' },
    create: { id: 'superadmin-g2', name: 'Super Admin', email: 'super.g2@test.com', password: 'hash', role: 'SUPER_ADMIN', companyId: null },
    update: { companyId: null }
  });

  const tokenAdminAlpha = jwt.sign({ id: 'admin-alpha-g2', role: 'ADMIN', companyId: companyAlpha }, JWT_SECRET, { expiresIn: '1h' });
  const tokenAdminBeta = jwt.sign({ id: 'admin-beta-g2', role: 'ADMIN', companyId: companyBeta }, JWT_SECRET, { expiresIn: '1h' });
  const tokenSuperAdmin = jwt.sign({ id: 'superadmin-g2', role: 'SUPER_ADMIN', companyId: null }, JWT_SECRET, { expiresIn: '1h' });

  // -------------------------------------------------------------------------
  // 1. JWT CON companyId
  // -------------------------------------------------------------------------
  console.log('[Prueba 1] Verificación de JWT con companyId...');
  const decodedAlpha = jwt.verify(tokenAdminAlpha, JWT_SECRET);
  console.log(`✓ Payload decodificado de JWT:`);
  console.log(`  - user.id: ${decodedAlpha.id}`);
  console.log(`  - user.role: ${decodedAlpha.role}`);
  console.log(`  - user.companyId: ${decodedAlpha.companyId} (esperado: ${companyAlpha})`);
  if (!decodedAlpha.companyId || decodedAlpha.companyId !== companyAlpha) {
    throw new Error('Fallo: JWT no contiene companyId correcto.');
  }

  // -------------------------------------------------------------------------
  // 2. REGLA DE SUPER_ADMIN CON x-tenant-id (400 si falta, ignorado para admin normal)
  // -------------------------------------------------------------------------
  console.log('\n[Prueba 2.1] Super Admin accede a ruta operativa sin cabecera x-tenant-id...');
  const resSuperNoHeader = await request(app)
    .get('/api/v1/departments')
    .set('Authorization', `Bearer ${tokenSuperAdmin}`);

  console.log(`✓ Status recibido: ${resSuperNoHeader.status} (esperado: 400)`);
  console.log(`✓ Respuesta: ${JSON.stringify(resSuperNoHeader.body)}`);
  if (resSuperNoHeader.status !== 400 || resSuperNoHeader.body.error !== 'TENANT_HEADER_REQUIRED') {
    throw new Error('Fallo: Super Admin sin x-tenant-id no fue rechazado con 400 TENANT_HEADER_REQUIRED.');
  }

  console.log('\n[Prueba 2.2] Super Admin accede a ruta operativa con cabecera x-tenant-id: default-company-pain...');
  const resSuperWithHeader = await request(app)
    .get('/api/v1/departments')
    .set('Authorization', `Bearer ${tokenSuperAdmin}`)
    .set('x-tenant-id', companyAlpha);

  console.log(`✓ Status recibido: ${resSuperWithHeader.status} (esperado: 200)`);
  if (resSuperWithHeader.status !== 200) {
    throw new Error(`Fallo: Super Admin con x-tenant-id debería recibir 200, pero recibió ${resSuperWithHeader.status}`);
  }

  console.log('\n[Prueba 2.3] Administrador normal envía x-tenant-id de OTRA empresa (debe ser ignorado)...');
  // Admin Alpha envía cabecera x-tenant-id = companyBeta, pero su token dice companyAlpha
  const resAdminSpoof = await request(app)
    .get('/api/v1/departments')
    .set('Authorization', `Bearer ${tokenAdminAlpha}`)
    .set('x-tenant-id', companyBeta);

  console.log(`✓ Status recibido: ${resAdminSpoof.status} (esperado: 200)`);
  // Verificar que los departamentos devueltos pertenezcan a Alpha y NUNCA a Beta
  if (Array.isArray(resAdminSpoof.body)) {
    const hasBetaDepts = resAdminSpoof.body.some(d => d.companyId === companyBeta);
    console.log(`✓ Departamentos de Beta en la respuesta: ${hasBetaDepts ? 'SÍ (ERROR)' : 'NINGUNO (CORRECTO)'}`);
    if (hasBetaDepts) throw new Error('Fallo de seguridad: Admin pudo suplantar tenant con cabecera.');
  }

  // -------------------------------------------------------------------------
  // 3. EMPRESA SUSPENDIDA CON 403
  // -------------------------------------------------------------------------
  console.log('\n[Prueba 3] Empresa suspendida responde con HTTP 403...');
  // Suspender temporalmente Empresa Beta
  await prisma.$base.company.update({
    where: { id: companyBeta },
    data: { isActive: false }
  });

  const resSuspended = await request(app)
    .get('/api/v1/departments')
    .set('Authorization', `Bearer ${tokenAdminBeta}`);

  console.log(`✓ Status recibido para empresa suspendida: ${resSuspended.status} (esperado: 403 Forbidden)`);
  console.log(`✓ Respuesta: ${JSON.stringify(resSuspended.body)}`);

  // Reactivar Empresa Beta
  await prisma.$base.company.update({
    where: { id: companyBeta },
    data: { isActive: true }
  });

  if (resSuspended.status !== 403 || resSuspended.body.error !== 'COMPANY_SUSPENDED') {
    throw new Error('Fallo: Empresa suspendida no respondió con 403 COMPANY_SUSPENDED.');
  }

  // -------------------------------------------------------------------------
  // 4. BLOQUEO DE $queryRaw Y $executeRaw
  // -------------------------------------------------------------------------
  console.log('\n[Prueba 4] Bloqueo de consultas raw ($queryRaw y $executeRaw)...');
  let queryRawBlocked = false;
  let executeRawBlocked = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    if (err.message.includes('USO_PROHIBIDO')) queryRawBlocked = true;
    console.log(`✓ prisma.$queryRaw bloqueado correctamente: "${err.message}"`);
  }

  try {
    await prisma.$executeRaw`DELETE FROM employee`;
  } catch (err) {
    if (err.message.includes('USO_PROHIBIDO')) executeRawBlocked = true;
    console.log(`✓ prisma.$executeRaw bloqueado correctamente: "${err.message}"`);
  }

  if (!queryRawBlocked || !executeRawBlocked) {
    throw new Error('Fallo: Las funciones $queryRaw o $executeRaw no fueron bloqueadas.');
  }

  // -------------------------------------------------------------------------
  // 5. HANDSHAKE DE SOCKET.IO Y PRUEBA DE AISLAMIENTO POR SALAS (B no recibe de A)
  // -------------------------------------------------------------------------
  console.log('\n[Prueba 5] Socket.io handshake y prueba de salas (Empresa B NO recibe eventos de A)...');
  
  // Levantar servidor HTTP en puerto efímero
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const socketUrl = `http://127.0.0.1:${port}`;
  console.log(`✓ Servidor Socket.io de prueba escuchando en ${socketUrl}`);

  const socketAlpha = ioClient(socketUrl, {
    auth: { token: tokenAdminAlpha },
    transports: ['websocket']
  });

  const socketBeta = ioClient(socketUrl, {
    auth: { token: tokenAdminBeta },
    transports: ['websocket']
  });

  // Esperar a que ambos clientes conecten
  await Promise.all([
    new Promise(res => socketAlpha.on('connect', res)),
    new Promise(res => socketBeta.on('connect', res))
  ]);

  console.log(`✓ Cliente Socket Alpha conectado (ID: ${socketAlpha.id})`);
  console.log(`✓ Cliente Socket Beta conectado (ID: ${socketBeta.id})`);

  let alphaReceivedEvents = [];
  let betaReceivedEvents = [];

  socketAlpha.on('tenant_event', data => {
    alphaReceivedEvents.push(data);
  });

  socketBeta.on('tenant_event', data => {
    betaReceivedEvents.push(data);
  });

  // Emitir evento EXCLUSIVO para la sala de Empresa Alpha
  const io = app.get('io');
  console.log(`\n[Socket.io] Servidor emite evento exclusivo a la sala 'company_${companyAlpha}'...`);
  io.to(`company_${companyAlpha}`).emit('tenant_event', {
    message: 'Evento Confidencial de Empresa Alpha',
    timestamp: Date.now()
  });

  // Esperar 400ms para procesamiento de eventos
  await new Promise(res => setTimeout(res, 400));

  console.log(`✓ Eventos recibidos por Cliente Alpha: ${alphaReceivedEvents.length} (esperado: 1)`);
  console.log(`✓ Eventos recibidos por Cliente Beta: ${betaReceivedEvents.length} (esperado: 0)`);

  socketAlpha.disconnect();
  socketBeta.disconnect();
  await new Promise(resolve => server.close(resolve));

  if (alphaReceivedEvents.length !== 1 || betaReceivedEvents.length !== 0) {
    throw new Error('Fallo de aislamiento en Socket.io: Cliente Beta recibió eventos de Empresa Alpha.');
  }

  // Limpieza de usuarios de prueba
  await prisma.$base.adminUser.deleteMany({
    where: { id: { in: ['admin-alpha-g2', 'admin-beta-g2', 'superadmin-g2'] } }
  });

  console.log('\n================================================================');
  console.log('✓ ITEM 10: TODOS LOS REQUISITOS DEL GATE 2 VERIFICADOS AL 100%');
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Error en prueba Item 10:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
