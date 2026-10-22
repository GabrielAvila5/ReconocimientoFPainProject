/**
 * VERIFICACIÓN DE DETERMINISMO E HIGIENE TOTAL DE PRUEBAS (ITEM 7)
 * Cuenta los registros de TODAS las tablas de la base de pruebas antes y después
 * de dos ejecuciones completas de las suites de prueba, demostrando delta = 0.
 */

const { execSync } = require('child_process');
const prismaAdmin = require('../../src/utils/prismaAdmin');

const ALL_TABLES = [
  'Company',
  'Department',
  'Employee',
  'AttendanceRecord',
  'Shift',
  'DepartmentShift',
  'EmployeeShift',
  'AdminUser',
  'AdminAuditLog',
  'Notification',
  'EventRequest',
  'SystemSettings',
  'Device',
  'DeviceAuthRequest'
];

async function getTableCounts() {
  const counts = {};
  for (const model of ALL_TABLES) {
    const delegate = model.charAt(0).toLowerCase() + model.slice(1);
    counts[model] = await prismaAdmin[delegate].count();
  }
  return counts;
}

function compareCounts(countsBefore, countsAfter, runName) {
  console.log(`\nComparando conteos de modelos para: ${runName}`);
  let hadDeltas = false;

  const comparison = [];
  for (const [table, beforeCount] of Object.entries(countsBefore)) {
    const afterCount = countsAfter[table] !== undefined ? countsAfter[table] : 'N/A';
    const delta = afterCount - beforeCount;
    if (delta !== 0) hadDeltas = true;
    comparison.push({
      Modelo: table,
      'Antes': beforeCount,
      'Después': afterCount,
      Delta: delta === 0 ? '0 (OK)' : `${delta > 0 ? '+' : ''}${delta} (RESIDUO)`
    });
  }

  console.table(comparison);

  if (hadDeltas) {
    throw new Error(`Se detectaron deltas en las tablas de la base de datos tras ${runName}`);
  }
}

async function main() {
  console.log('================================================================');
  console.log('>>> VERIFICACIÓN DE DETERMINISMO E HIGIENE DE PRUEBAS (ITEM 7)');
  console.log('================================================================\n');

  try {
    // 1. Obtener conteo inicial
    const initialCounts = await getTableCounts();
    console.log('1. Conteo inicial de modelos capturado.');

    // 2. Primera ejecución de suites de prueba
    console.log('\n2. Ejecutando suites de prueba (EJECUCIÓN 1)...');
    execSync('node backend/tests/integration/test_routers_http_real.js', { stdio: 'pipe' });
    execSync('node backend/tests/integration/test_pairing_cross_tenant_isolation.test.js', { stdio: 'pipe' });
    execSync('node backend/tests/integration/test_nested_writes_real_db.test.js', { stdio: 'pipe' });
    execSync('node backend/tests/unit/test_prisma_comprehensive_matrix.test.js', { stdio: 'pipe' });
    console.log('  ✓ Ejecución 1 finalizada exitosamente.');

    // 3. Obtener conteo tras ejecución 1
    const countsAfterRun1 = await getTableCounts();
    compareCounts(initialCounts, countsAfterRun1, 'Ejecución 1');

    // 4. Segunda ejecución consecutiva de suites de prueba
    console.log('\n3. Ejecutando suites de prueba (EJECUCIÓN 2 CONSECUTIVA)...');
    execSync('node backend/tests/integration/test_routers_http_real.js', { stdio: 'pipe' });
    execSync('node backend/tests/integration/test_pairing_cross_tenant_isolation.test.js', { stdio: 'pipe' });
    execSync('node backend/tests/integration/test_nested_writes_real_db.test.js', { stdio: 'pipe' });
    execSync('node backend/tests/unit/test_prisma_comprehensive_matrix.test.js', { stdio: 'pipe' });
    console.log('  ✓ Ejecución 2 finalizada exitosamente.');

    // 5. Obtener conteo tras ejecución 2
    const countsAfterRun2 = await getTableCounts();
    compareCounts(initialCounts, countsAfterRun2, 'Ejecución 2');

    console.log('\n================================================================');
    console.log('✓ HIGIENE CONFIRMADA: 100% DE MODELOS TIENEN EXACTAMENTE DELTA = 0');
    console.log('================================================================\n');

  } finally {
    await prismaAdmin.$disconnect();
  }
}

main().catch(err => {
  console.error('❌ Error en verificación de higiene:', err.message);
  process.exit(1);
});
