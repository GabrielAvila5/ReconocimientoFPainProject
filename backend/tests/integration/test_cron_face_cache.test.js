/**
 * PRUEBA DE VERIFICACIÓN: IDEMPOTENCIA DE ATTENDANCE CRON Y CACHÉ FACIAL AISLADA
 * Requisitos evaluados:
 * 1. attendanceCron (lastAbsenceDateRun): Idempotencia comprobada al ejecutar 2 veces el mismo día.
 * 2. faceMath (reloadCompanyFaceCache): Recarga exclusivamente la caché en RAM de una empresa sin tocar a las demás.
 */

const prismaAdmin = require('../../src/utils/prismaAdmin');
const { processAbsences } = require('../../src/jobs/attendanceCron');
const { reloadCompanyFaceCache, getFaceCache } = require('../../src/utils/faceMath');
const { getStartOfDay, DEFAULT_TZ } = require('../../src/utils/timeUtils');

async function runCronFaceCacheTests() {
  console.log('================================================================');
  console.log('>>> PRUEBA: CRON IDEMPOTENCIA Y CACHÉ FACIAL MULTI-TENANT');
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

  const prefix = `cron_test_${Date.now()}`;
  let companyAlphaId = null;
  let companyBetaId = null;
  let empAlpha1Id = null;
  let empAlpha2Id = null;
  let empBeta1Id = null;

  try {
    // -------------------------------------------------------------------------
    // SETUP
    // -------------------------------------------------------------------------
    const coAlpha = await prismaAdmin.company.create({
      data: {
        id: `${prefix}_co_alpha`,
        name: 'Alpha Cron Test',
        slug: `${prefix}-co-alpha`,
        isActive: true,
        timezone: 'America/Mexico_City'
      }
    });
    companyAlphaId = coAlpha.id;

    const coBeta = await prismaAdmin.company.create({
      data: {
        id: `${prefix}_co_beta`,
        name: 'Beta Cron Test',
        slug: `${prefix}-co-beta`,
        isActive: true,
        timezone: 'America/Mexico_City'
      }
    });
    companyBetaId = coBeta.id;

    // Configuración para Alpha
    await prismaAdmin.systemSettings.create({
      data: {
        companyId: companyAlphaId,
        companyName: 'Alpha Cron Test',
        timezone: 'America/Mexico_City'
      }
    });

    // 2 empleados en Alpha sin asistencia registrada hoy
    const empAlpha1 = await prismaAdmin.employee.create({
      data: {
        companyId: companyAlphaId,
        firstName: 'Juan',
        lastName: 'Pérez',
        identifier: `CRON-A1-${Date.now().toString().slice(-4)}`,
        isActive: true
      }
    });
    empAlpha1Id = empAlpha1.id;

    const empAlpha2 = await prismaAdmin.employee.create({
      data: {
        companyId: companyAlphaId,
        firstName: 'María',
        lastName: 'López',
        identifier: `CRON-A2-${Date.now().toString().slice(-4)}`,
        isActive: true
      }
    });
    empAlpha2Id = empAlpha2.id;

    // 1 empleado en Beta
    const empBeta1 = await prismaAdmin.employee.create({
      data: {
        companyId: companyBetaId,
        firstName: 'Carlos',
        lastName: 'Beta',
        identifier: `CRON-B1-${Date.now().toString().slice(-4)}`,
        isActive: true
      }
    });
    empBeta1Id = empBeta1.id;

    // -------------------------------------------------------------------------
    // PRUEBA 1: Idempotencia de attendanceCron con lastAbsenceDateRun
    // -------------------------------------------------------------------------
    console.log('--- 1. Idempotencia de attendanceCron (processAbsences) ---');
    
    // Ejecución 1: Debe procesar inasistencias y crear notificaciones
    const absencesRun1 = await processAbsences(companyAlphaId);
    assert(absencesRun1 === 2, `Primera corrida procesa inasistencias para Alpha (total registradas: ${absencesRun1})`);

    const notifsAlphaRun1 = await prismaAdmin.notification.findMany({
      where: {
        companyId: companyAlphaId,
        category: 'attendance'
      }
    });
    assert(notifsAlphaRun1.length === 2, `Se crearon exactamente 2 notificaciones de inasistencia en Alpha (obtuvo ${notifsAlphaRun1.length})`);

    // Verificar que lastAbsenceDateRun de Alpha quedó actualizado a la fecha de hoy
    const compAlphaUpdated = await prismaAdmin.company.findUnique({
      where: { id: companyAlphaId },
      select: { lastAbsenceDateRun: true }
    });
    assert(compAlphaUpdated.lastAbsenceDateRun !== null, 'Company.lastAbsenceDateRun fue actualizado en base de datos');

    const todayStart = getStartOfDay(new Date(), 'America/Mexico_City');
    const todayStr = todayStart.toISOString().split('T')[0];
    const dbRunStr = new Date(compAlphaUpdated.lastAbsenceDateRun).toISOString().split('T')[0];
    assert(todayStr === dbRunStr, `Company.lastAbsenceDateRun coincide exactamente con la fecha actual (${todayStr} === ${dbRunStr})`);

    // Ejecución 2 (EL MISMO DÍA): Debe omitir a Alpha y no generar notificaciones duplicadas
    console.log('\n--- Ejecutando processAbsences por segunda vez en el mismo día ---');
    const absencesRun2 = await processAbsences(companyAlphaId);
    assert(absencesRun2 === 0, `Segunda corrida devuelve 0 inasistencias procesadas por idempotencia (obtuvo ${absencesRun2})`);

    const notifsAlphaRun2 = await prismaAdmin.notification.findMany({
      where: {
        companyId: companyAlphaId,
        category: 'attendance'
      }
    });
    assert(notifsAlphaRun2.length === 2, 
      `Total de notificaciones en Alpha permanece en 2 (CERO duplicados generados: ${notifsAlphaRun2.length})`);

    // -------------------------------------------------------------------------
    // PRUEBA 2: Recarga aislada de Face Cache en RAM (reloadCompanyFaceCache)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Aislamiento en recarga de Caché Facial en RAM (reloadCompanyFaceCache) ---');
    
    // Descriptor dummy de 128 float32 para pruebas
    const dummyDescriptor = Array(128).fill(0.123456);
    const jsonDescriptor = JSON.stringify(dummyDescriptor);

    // Actualizar empleado Alpha con descriptor
    await prismaAdmin.employee.update({
      where: { id: empAlpha1Id },
      data: {
        faceDescriptor: jsonDescriptor,
        enrolledAt: new Date()
      }
    });

    // Simular que Beta ya tiene en memoria su propia caché con datos previos
    const betaInitialCache = [
      { id: empBeta1Id, name: 'Carlos Beta', descriptor: dummyDescriptor, customMarker: 'BETA_SAFE_VALUE' }
    ];
    global.cachedUsersByCompany.set(companyBetaId, betaInitialCache);

    // Alpha inicialmente no tiene caché
    global.cachedUsersByCompany.delete(companyAlphaId);

    // Ejecutar recarga EXCLUSIVA para Alpha
    await reloadCompanyFaceCache(companyAlphaId);

    // 1. Verificar que Alpha cargó su rostro desde BD
    const alphaCache = getFaceCache(companyAlphaId);
    assert(alphaCache.length === 1, `Alpha cargó exitosamente su rostro a memoria (longitud: ${alphaCache.length})`);
    assert(alphaCache[0].id === empAlpha1Id, `Rostro cargado en Alpha corresponde al empleado correcto (${empAlpha1Id})`);

    // 2. Verificar que la caché de Beta en RAM quedó 100% INTACTA y no fue vaciada ni modificada
    const betaCacheAfter = getFaceCache(companyBetaId);
    assert(betaCacheAfter.length === 1, `Caché de Beta en RAM conservó sus registros intactos (longitud: ${betaCacheAfter.length})`);
    assert(betaCacheAfter[0].customMarker === 'BETA_SAFE_VALUE', 'Valores de la caché de Beta en RAM no fueron alterados');
    assert(betaCacheAfter[0].id === empBeta1Id, 'Identidad de los registros de Beta en RAM se mantiene íntegra');

  } finally {
    // TEARDOWN
    console.log('\n--- Teardown determinista ---');
    const coIds = [companyAlphaId, companyBetaId].filter(Boolean);
    if (coIds.length > 0) {
      await prismaAdmin.notification.deleteMany({ where: { companyId: { in: coIds } } });
      await prismaAdmin.employee.deleteMany({ where: { companyId: { in: coIds } } });
      await prismaAdmin.systemSettings.deleteMany({ where: { companyId: { in: coIds } } });
      await prismaAdmin.company.deleteMany({ where: { id: { in: coIds } } });
    }
    // Limpiar mapas de memoria
    if (companyAlphaId) global.cachedUsersByCompany.delete(companyAlphaId);
    if (companyBetaId) global.cachedUsersByCompany.delete(companyBetaId);
    console.log('Teardown completado exitosamente.');
  }

  console.log(`\nResultado final: ${passed} pasadas, ${failed} fallidas\n`);
  if (failed > 0) {
    throw new Error(`Fallaron ${failed} aserciones en test_cron_face_cache.`);
  }
}

if (require.main === module) {
  runCronFaceCacheTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error fatal en prueba de Cron / Face Cache:', err);
      process.exit(1);
    });
}

module.exports = { runCronFaceCacheTests };
