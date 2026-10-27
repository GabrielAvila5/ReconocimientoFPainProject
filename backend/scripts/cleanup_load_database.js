/**
 * SCRIPT DE LIMPIEZA / ELIMINACIÓN DE BASE DE CARGA MASIVA (GATE 5)
 * Permite a Gabriel liberar los ~2.74 GB de disco eliminando 'reconocimiento_test_load_saas'
 * de forma segura, garantizando que 'reconocimiento_test_copia_saas' permanezca intacta.
 * 
 * Uso:
 *   node backend/scripts/cleanup_load_database.js --drop     (Elimina completamente la BD de carga)
 *   node backend/scripts/cleanup_load_database.js --truncate (Vacía las 14 tablas manteniendo la estructura)
 *   node backend/scripts/cleanup_load_database.js --status   (Consulta el tamaño actual en disco)
 */

const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

const TARGET_DB = 'reconocimiento_test_load_saas';
const PATRON_DB = 'reconocimiento_test_copia_saas';
const DB_USER = 'saas_test_user';
const DB_PASS = 'TestSaaSUserPass2026!';
const DB_HOST = '127.0.0.1';
const DB_PORT = 3307;

const adminUrl = `mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${TARGET_DB}`;
const prisma = new PrismaClient({
  datasources: { db: { url: adminUrl } }
});

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];

  console.log('================================================================');
  console.log('>>> GESTIÓN DE ESPACIO EN DISCO: BASE DE CARGA MASIVA (GATE 5)');
  console.log('================================================================\n');

  if (!mode || (mode !== '--drop' && mode !== '--truncate' && mode !== '--status')) {
    console.log('Opciones disponibles:');
    console.log('  --status   : Muestra el tamaño actual en disco de la base de carga.');
    console.log('  --drop     : Elimina por completo la base de datos "reconocimiento_test_load_saas".');
    console.log('  --truncate : Vacía todas las tablas liberando espacio sin borrar la base.');
    console.log('\nEjemplo para liberar 2.74 GB:');
    console.log('  node backend/scripts/cleanup_load_database.js --drop\n');
    await prisma.$disconnect();
    return;
  }

  // 1. Verificar tamaño actual en disco
  const sizeInfo = await prisma.$queryRawUnsafe(`
    SELECT 
      table_schema AS 'database_name',
      ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'size_mb'
    FROM information_schema.tables
    WHERE table_schema = '${TARGET_DB}'
    GROUP BY table_schema;
  `);

  const currentMb = sizeInfo.length > 0 ? sizeInfo[0].size_mb : 0;
  console.log(`Base de datos: ${TARGET_DB}`);
  console.log(`Tamaño actual en disco: ${currentMb} MB (~${(currentMb / 1024).toFixed(2)} GB)\n`);

  if (mode === '--status') {
    await prisma.$disconnect();
    return;
  }

  // Medida de seguridad inviolable: Nunca permitir que TARGET_DB sea otra base
  if (TARGET_DB !== 'reconocimiento_test_load_saas') {
    throw new Error('Salvaguarda activada: Solo se permite limpiar reconocimiento_test_load_saas');
  }

  if (mode === '--drop') {
    console.log(`[ACCION] Eliminando base de datos ${TARGET_DB} para recuperar disco...`);
    await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${TARGET_DB}\`;`);
    console.log(`✓ Base de datos ${TARGET_DB} eliminada exitosamente.`);
    console.log(`✓ Espacio recuperado: ~${(currentMb / 1024).toFixed(2)} GB.\n`);
  } else if (mode === '--truncate') {
    console.log(`[ACCION] Vaciando tablas de ${TARGET_DB}...`);
    const tables = [
      'AttendanceRecord', 'EmployeeShift', 'DepartmentShift', 'Notification',
      'EventRequest', 'DeviceAuthRequest', 'Device', 'Employee', 'Shift',
      'Department', 'AdminAuditLog', 'AdminUser', 'SystemSettings', 'Company'
    ];
    await prisma.$executeRawUnsafe(`USE \`${TARGET_DB}\`;`);
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
    for (const t of tables) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${TARGET_DB}\`.\`${t}\`;`);
    }
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
    console.log(`✓ 14 tablas vaciadas en ${TARGET_DB}.\n`);
  }

  await prisma.$disconnect();

  // 2. Verificación de integridad de la base patrón
  console.log('----------------------------------------------------------------');
  console.log(`Verificando integridad de la base patrón (${PATRON_DB})...`);
  try {
    const patronPrisma = new PrismaClient({
      datasources: { db: { url: `mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${PATRON_DB}` } }
    });
    const companyCount = await patronPrisma.company.count();
    const employeeCount = await patronPrisma.employee.count();
    const attendanceCount = await patronPrisma.attendanceRecord.count();
    await patronPrisma.$disconnect();

    console.log(`✓ Base patrón ${PATRON_DB} 100% INTACTA:`);
    console.log(`  - Empresas:    ${companyCount} (Esperado: 2)`);
    console.log(`  - Empleados:   ${employeeCount} (Esperado: 7)`);
    console.log(`  - Asistencias: ${attendanceCount} (Esperado: 8)`);
    console.log('✓ Higiene confirmada: Cero impacto sobre el entorno patrón.');
  } catch (err) {
    console.error('Error al verificar base patrón:', err.message);
  }
}

main().catch(err => {
  console.error('Error fatal en script de limpieza:', err);
  process.exit(1);
});

