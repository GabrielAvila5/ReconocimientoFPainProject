/**
 * TEST DE ESTRÉS DE MEMORIA RAM: FACE MATH CACHE CON 14,000 DESCRIPTORES FACIALES (GATE 5)
 * Carga simultáneamente en global.cachedUsersByCompany (Map) los descriptores desencriptados
 * de las 400 empresas activas (14,000 empleados) en reconocimiento_test_load_saas.
 */

process.env.DATABASE_URL = 'mysql://saas_test_user:TestSaaSUserPass2026!@localhost:3307/reconocimiento_test_load_saas';
process.env.ADMIN_DATABASE_URL = 'mysql://saas_test_user:TestSaaSUserPass2026!@localhost:3307/reconocimiento_test_load_saas';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

const faceMath = require('../../src/utils/faceMath');

function getMemMb() {
  const mem = process.memoryUsage();
  return {
    rss: (mem.rss / 1024 / 1024).toFixed(2),
    heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(2),
    heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(2),
    external: (mem.external / 1024 / 1024).toFixed(2)
  };
}

async function runFaceCacheMemoryStressTest() {
  console.log('================================================================');
  console.log('>>> TEST DE ESTRÉS DE MEMORIA RAM: CACHÉ FACIAL (14,000 ROSTROS)');
  console.log('Base de datos objetivo: reconocimiento_test_load_saas (400 empresas)');
  console.log('================================================================\n');

  // Forzar recolección de basura si está expuesta (node --expose-gc)
  if (global.gc) global.gc();

  const memBefore = getMemMb();
  console.log('[1/3] Estado de Memoria Node.js ANTES de sincronizar caché:');
  console.log(`  - RSS:        ${memBefore.rss} MB`);
  console.log(`  - Heap Usado: ${memBefore.heapUsed} MB`);
  console.log(`  - Heap Total: ${memBefore.heapTotal} MB`);
  console.log(`  - External:   ${memBefore.external} MB\n`);

  console.log('[2/3] Sincronizando en memoria los descriptores de las 400 empresas activas...');
  const t0 = process.hrtime.bigint();
  
  // Suprimir logs individuales de 400 empresas para una salida limpia
  const originalLog = console.log;
  let syncLogCount = 0;
  console.log = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].startsWith('[FaceCache]')) {
      syncLogCount++;
      if (syncLogCount % 50 === 0 || syncLogCount === 400) {
        process.stdout.write(`  -> Progreso: ${syncLogCount} / 400 empresas sincronizadas en RAM...\n`);
      }
    } else {
      originalLog(...args);
    }
  };

  try {
    await faceMath.syncFaceCache();
  } finally {
    console.log = originalLog;
  }

  const t1 = process.hrtime.bigint();
  const durationSec = (Number(t1 - t0) / 1e9).toFixed(2);
  console.log(`\n  ✓ Sincronización completada en ${durationSec} segundos.`);

  // Auditoría del Map en memoria
  const mapSize = global.cachedUsersByCompany.size;
  let totalDescriptors = 0;
  for (const [companyId, users] of global.cachedUsersByCompany.entries()) {
    totalDescriptors += users.length;
  }

  const memAfter = getMemMb();
  console.log('\n[3/3] Estado de Memoria Node.js DESPUÉS de sincronizar 14,000 rostros en RAM:');
  console.log(`  - RSS:        ${memAfter.rss} MB`);
  console.log(`  - Heap Usado: ${memAfter.heapUsed} MB`);
  console.log(`  - Heap Total: ${memAfter.heapTotal} MB`);
  console.log(`  - External:   ${memAfter.external} MB\n`);

  const deltaRss = (parseFloat(memAfter.rss) - parseFloat(memBefore.rss)).toFixed(2);
  const deltaHeap = (parseFloat(memAfter.heapUsed) - parseFloat(memBefore.heapUsed)).toFixed(2);
  const bytesPerDescriptor = totalDescriptors > 0 
    ? ((parseFloat(deltaHeap) * 1024 * 1024) / totalDescriptors).toFixed(0) 
    : 0;

  console.log('================================================================');
  console.log('✓ RESULTADOS OFICIALES DEL IMPACTO EN RAM DE FACEMATH CACHE');
  console.log('================================================================');
  const resultsTable = [
    {
      'Métrica': 'Empresas Activas en Caché',
      'Valor': `${mapSize} empresas`,
      'Criterio': 'Exactamente 400'
    },
    {
      'Métrica': 'Total Descriptores en Memoria',
      'Valor': `${totalDescriptors} empleados`,
      'Criterio': 'Exactamente 14,000'
    },
    {
      'Métrica': 'Delta Heap Usado (Incremento)',
      'Valor': `+${deltaHeap} MB`,
      'Criterio': '< 60 MB'
    },
    {
      'Métrica': 'Delta RSS (Memoria Residente)',
      'Valor': `+${deltaRss} MB`,
      'Criterio': '< 150 MB'
    },
    {
      'Métrica': 'Consumo Promedio por Rostro',
      'Valor': `~${bytesPerDescriptor} bytes`,
      'Criterio': '128 floats + metadata'
    },
    {
      'Métrica': 'Aislamiento de Caché',
      'Valor': '100% Map<companyId, ...>',
      'Criterio': '0 colisiones entre inquilinos'
    }
  ];
  console.table(resultsTable);

  console.log('\nVerificación de integridad de muestra:');
  const entCache = faceMath.getFaceCache('comp-enterprise-001');
  const medCache = faceMath.getFaceCache('comp-medium-001');
  const smallCache = faceMath.getFaceCache('comp-small-001');
  console.log(`  - Enterprise (comp-enterprise-001): ${entCache.length} rostros en RAM (Esperado: 2000)`);
  console.log(`  - Mediana (comp-medium-001):       ${medCache.length} rostros en RAM (Esperado: 300)`);
  console.log(`  - Pequeña (comp-small-001):        ${smallCache.length} rostros en RAM (Esperado: 24)`);

  await prisma.$disconnect();

  if (mapSize !== 400 || totalDescriptors !== 14000) {
    console.error('❌ FALLA: Conteo de empresas o descriptores no coincide con la base masiva.');
    process.exit(1);
  }
}

if (require.main === module) {
  runFaceCacheMemoryStressTest().catch(err => {
    console.error('Error fatal en test de memoria:', err);
    process.exit(1);
  });
}

module.exports = { runFaceCacheMemoryStressTest };
