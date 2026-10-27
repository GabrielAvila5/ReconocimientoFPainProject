/**
 * VERIFICACIÓN DE DETERMINISMO E HIGIENE TOTAL DE PRUEBAS
 * Cuenta los registros de TODAS las 14 tablas físicas antes y después
 * de dos ejecuciones completas consecutivas de todas las suites de prueba,
 * demostrando exactamente Delta = 0 en el 100% de los modelos.
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

function runSuites() {
  const suites = [
    'node backend/tests/integration/test_routers_http_real.js',
    'node backend/tests/integration/test_pairing_cross_tenant_isolation.test.js',
    'node backend/tests/integration/test_nested_writes_real_db.test.js',
    'node backend/tests/unit/test_prisma_comprehensive_matrix.test.js',
    'node backend/tests/integration/test_lote2_isolation.test.js',
    'node backend/tests/integration/test_cron_face_cache.test.js',
    'node backend/tests/integration/test_admin_employee_sync_option_a.test.js',
    'node backend/tests/integration/test_device_token_auth.test.js',
    'node backend/tests/integration/test_gate3c_kiosks_and_sockets.test.js',
    'node backend/tests/integration/test_gate4_security_and_ops.test.js'
  ];

  for (const cmd of suites) {
    execSync(cmd, { stdio: 'pipe' });
  }
}

async function main() {
  console.log('================================================================');
  console.log('>>> VERIFICACIÓN DE DETERMINISMO E HIGIENE DE PRUEBAS (14 TABLAS)');
  console.log('================================================================\n');

  try {
    // 1. Obtener conteo inicial
    const initialCounts = await getTableCounts();
    console.log('1. Conteo inicial de modelos capturado.');

    // 2. Primera ejecución de suites de prueba
    console.log('\n2. Ejecutando suites de prueba completas (EJECUCIÓN 1)...');
    runSuites();
    console.log('  ✓ Ejecución 1 finalizada exitosamente.');

    // 3. Obtener conteo tras ejecución 1
    const countsAfterRun1 = await getTableCounts();
    compareCounts(initialCounts, countsAfterRun1, 'Ejecución 1');

    // 4. Segunda ejecución consecutiva de suites de prueba
    console.log('\n3. Ejecutando suites de prueba completas (EJECUCIÓN 2 CONSECUTIVA)...');
    runSuites();
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
  console.error('\n❌ ERROR EN VERIFICACIÓN DE DETERMINISMO:', err);
  process.exit(1);
});
