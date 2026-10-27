/**
 * SCRIPT DE RECONCILIACIÓN POST-RESTAURACIÓN Y PURGAS ARCO (GATE 4)
 * Consulta un libro mayor inmutable externo (RevokedCompanyPurgeLedger.jsonl)
 * ubicado fuera del árbol de respaldos de la base de datos para re-ejecutar purgas
 * ARCO sobre empresas revocadas que hayan reaparecido al restaurar un respaldo antiguo.
 * 
 * Uso:
 *   node backend/scripts/post_restore_reconcile.js [--dry-run] [--confirm] [--ledger <path>]
 */

const fs = require('fs');
const path = require('path');
const prismaAdmin = require('../src/utils/prismaAdmin');

const DEFAULT_LEDGER_PATH = process.env.PURGE_LEDGER_PATH || 
  path.join(__dirname, '../../ledger/RevokedCompanyPurgeLedger.jsonl');

function appendToPurgeLedger(entry, ledgerPath = DEFAULT_LEDGER_PATH) {
  const dir = path.dirname(ledgerPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const payload = {
    ...entry,
    recordedAt: entry.recordedAt || new Date().toISOString()
  };
  fs.appendFileSync(ledgerPath, JSON.stringify(payload) + '\n', 'utf8');
  return payload;
}

function readPurgeLedger(ledgerPath = DEFAULT_LEDGER_PATH) {
  if (!fs.existsSync(ledgerPath)) {
    return [];
  }
  const content = fs.readFileSync(ledgerPath, 'utf8');
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

async function reconcileRevokedCompanies(options = {}) {
  const args = process.argv.slice(2);
  const isDryRun = options.dryRun !== undefined ? options.dryRun : !args.includes('--confirm');
  const ledgerPath = options.ledgerPath || DEFAULT_LEDGER_PATH;

  console.log('================================================================');
  console.log(`>>> RECONCILIACIÓN DE PURGAS ARCO POST-RESTAURACIÓN ${isDryRun ? '(MODO DRY-RUN)' : '(MODO --CONFIRM REAL)'}`);
  console.log(`Libro Mayor Inmutable: ${ledgerPath}`);
  console.log('================================================================\n');

  const ledgerEntries = readPurgeLedger(ledgerPath);
  console.log(`1. Total de registros en libro mayor externo: ${ledgerEntries.length}`);

  if (ledgerEntries.length === 0) {
    console.log('✓ No hay purgas registradas en el libro mayor. Base de datos consistente.');
    return { found: 0, purged: 0, dryRun: isDryRun };
  }

  const revokedCompanyIds = Array.from(new Set(ledgerEntries.map(e => e.companyId).filter(Boolean)));

  // Buscar cuáles de estas empresas revocadas existen en la base de datos actual
  const existingCompanies = await prismaAdmin.company.findMany({
    where: { id: { in: revokedCompanyIds } },
    select: { id: true, name: true, createdAt: true }
  });

  console.log(`2. Empresas revocadas encontradas en la BD actual (reaparecidas por restore): ${existingCompanies.length}\n`);

  let purgedCount = 0;

  for (const company of existingCompanies) {
    console.log(`----------------------------------------------------------------`);
    console.log(`Empresa detectada para purga ARCO: [${company.id}] "${company.name}"`);
    console.log(`----------------------------------------------------------------`);

    // Contar registros que serán purgados
    const [empCount, attCount, devCount, notifCount, eventCount] = await Promise.all([
      prismaAdmin.employee.count({ where: { companyId: company.id } }),
      prismaAdmin.attendanceRecord.count({ where: { companyId: company.id } }),
      prismaAdmin.device.count({ where: { companyId: company.id } }),
      prismaAdmin.notification.count({ where: { companyId: company.id } }),
      prismaAdmin.eventRequest.count({ where: { companyId: company.id } })
    ]);

    console.log(`  - Empleados y Biometría: ${empCount}`);
    console.log(`  - Registros de Asistencia: ${attCount}`);
    console.log(`  - Dispositivos Kiosco: ${devCount}`);
    console.log(`  - Notificaciones: ${notifCount}`);
    console.log(`  - Eventos: ${eventCount}`);

    if (isDryRun) {
      console.log(`  [DRY-RUN] Se reporta purga requerida sin modificar la base de datos.`);
    } else {
      console.log(`  [EJECUTANDO PURGA ARCO TRANSACCIONAL]...`);
      await prismaAdmin.$transaction(async (tx) => {
        await tx.adminAuditLog.deleteMany({ where: { companyId: company.id } });
        await tx.attendanceRecord.deleteMany({ where: { companyId: company.id } });
        await tx.notification.deleteMany({ where: { companyId: company.id } });
        await tx.eventRequest.deleteMany({ where: { companyId: company.id } });
        await tx.employeeShift.deleteMany({ where: { companyId: company.id } });
        await tx.departmentShift.deleteMany({ where: { companyId: company.id } });
        await tx.employee.deleteMany({ where: { companyId: company.id } });
        await tx.deviceAuthRequest.deleteMany({ where: { companyId: company.id } });
        await tx.device.deleteMany({ where: { companyId: company.id } });
        await tx.department.deleteMany({ where: { companyId: company.id } });
        await tx.shift.deleteMany({ where: { companyId: company.id } });
        await tx.adminUser.deleteMany({ where: { companyId: company.id } });
        await tx.systemSettings.deleteMany({ where: { companyId: company.id } });
        await tx.company.delete({ where: { id: company.id } });
      });
      console.log(`  ✓ Empresa [${company.id}] y todos sus datos purgados definitivamente.`);
      purgedCount++;
    }
  }

  console.log('\n================================================================');
  console.log(`✓ RECONCILIACIÓN COMPLETADA: ${existingCompanies.length} detectadas, ${purgedCount} purgadas.`);
  console.log('================================================================\n');

  return { found: existingCompanies.length, purged: purgedCount, dryRun: isDryRun };
}

if (require.main === module) {
  reconcileRevokedCompanies()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error fatal en reconciliación:', err);
      process.exit(1);
    })
    .finally(() => prismaAdmin.$disconnect());
}

module.exports = {
  reconcileRevokedCompanies,
  appendToPurgeLedger,
  readPurgeLedger,
  DEFAULT_LEDGER_PATH
};

