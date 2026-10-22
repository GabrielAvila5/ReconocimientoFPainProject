const request = require('supertest');
const { app } = require('../../src/app');
const prisma = require('../../src/utils/prisma');

async function main() {
  console.log('================================================================');
  console.log('>>> ITEM 8: DEMOSTRACIÓN DE descriptorsVersion Y ETAG / 304   ');
  console.log('================================================================\n');

  const testCompanyId = 'default-company-pain';

  // 1. Resetear versión de la empresa a 1
  await prisma.$base.company.update({
    where: { id: testCompanyId },
    data: { descriptorsVersion: 1 }
  });

  // 2. Primera petición: Sin cabecera If-None-Match -> Espera HTTP 200 con ETag
  console.log('[Paso 1] Realizando primera solicitud GET /api/v1/employees/descriptors (sin If-None-Match)...');
  const res1 = await request(app)
    .get('/api/v1/employees/descriptors')
    .set('x-tenant-id', testCompanyId);

  console.log(`✓ Status recibido: ${res1.status} (esperado: 200)`);
  console.log(`✓ Cabecera ETag: ${res1.headers['etag']}`);
  console.log(`✓ Cabecera X-Descriptors-Version: ${res1.headers['x-descriptors-version']}`);
  console.log(`✓ Cantidad de descriptores recibidos: ${Array.isArray(res1.body) ? res1.body.length : 0}`);
  
  const etagv1 = res1.headers['etag'];
  if (res1.status !== 200 || !etagv1) {
    throw new Error('Fallo en Paso 1: No se recibió HTTP 200 o falta ETag.');
  }

  // 3. Segunda petición: Enviando If-None-Match con el ETag recibido -> Espera HTTP 304 Not Modified
  console.log(`\n[Paso 2] Realizando segunda solicitud con If-None-Match: ${etagv1}...`);
  const res2 = await request(app)
    .get('/api/v1/employees/descriptors')
    .set('x-tenant-id', testCompanyId)
    .set('if-none-match', etagv1);

  console.log(`✓ Status recibido: ${res2.status} (esperado: 304 Not Modified)`);
  console.log(`✓ Cuerpo de la respuesta (debe ser vacío): ${JSON.stringify(res2.body)}`);
  
  if (res2.status !== 304) {
    throw new Error(`Fallo en Paso 2: Se esperaba HTTP 304 pero se recibió ${res2.status}`);
  }

  // 4. Modificar versión de descriptores en la empresa (simula enrolamiento/baja de empleado)
  console.log('\n[Paso 3] Incrementando descriptorsVersion en la empresa (simulando nuevo enrolamiento)...');
  const updatedCompany = await prisma.$base.company.update({
    where: { id: testCompanyId },
    data: { descriptorsVersion: { increment: 1 } }
  });
  console.log(`✓ Nueva descriptorsVersion en base de datos: ${updatedCompany.descriptorsVersion}`);

  // 5. Tercera petición: Enviando el ETag viejo -> Como la versión cambió, debe invalidar y retornar HTTP 200
  console.log(`\n[Paso 4] Realizando tercera solicitud con ETag viejo (${etagv1})...`);
  const res3 = await request(app)
    .get('/api/v1/employees/descriptors')
    .set('x-tenant-id', testCompanyId)
    .set('if-none-match', etagv1);

  console.log(`✓ Status recibido: ${res3.status} (esperado: 200 OK tras invalidación de caché)`);
  console.log(`✓ Nuevo ETag recibido: ${res3.headers['etag']}`);
  console.log(`✓ Nueva versión recibida: ${res3.headers['x-descriptors-version']}`);

  if (res3.status !== 200 || res3.headers['x-descriptors-version'] !== '2') {
    throw new Error('Fallo en Paso 4: Debería retornar HTTP 200 con versión 2.');
  }

  // 6. Restaurar versión
  await prisma.$base.company.update({
    where: { id: testCompanyId },
    data: { descriptorsVersion: 1 }
  });

  console.log('\n================================================================');
  console.log('✓ ITEM 8 DEMOSTRADO EXITOSAMENTE CON SALIDA REAL: ETAG / 304');
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Error en prueba Item 8:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
