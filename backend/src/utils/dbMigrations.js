const { basePrisma } = require('./prisma');

/**
 * Asegura la existencia de las columnas de facturación y licenciamiento en la tabla Company
 * y calcula nextBillingDate para empresas existentes que lo tengan nulo.
 */
async function ensureCompanyBillingColumns() {
  try {
    const columns = await basePrisma.$queryRawUnsafe(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Company'
    `);
    const columnNames = Array.isArray(columns) ? columns.map(c => c.COLUMN_NAME) : [];

    if (!columnNames.includes('billingCycle')) {
      await basePrisma.$executeRawUnsafe(`
        ALTER TABLE \`Company\` ADD COLUMN \`billingCycle\` VARCHAR(50) NOT NULL DEFAULT 'MENSUAL'
      `);
      console.log('[DB Migration] Added billingCycle column to Company table');
    }

    if (!columnNames.includes('licenseStartDate')) {
      await basePrisma.$executeRawUnsafe(`
        ALTER TABLE \`Company\` ADD COLUMN \`licenseStartDate\` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3)
      `);
      console.log('[DB Migration] Added licenseStartDate column to Company table');
    }

    if (!columnNames.includes('nextBillingDate')) {
      await basePrisma.$executeRawUnsafe(`
        ALTER TABLE \`Company\` ADD COLUMN \`nextBillingDate\` DATETIME(3) NULL
      `);
      console.log('[DB Migration] Added nextBillingDate column to Company table');

      // Calcular fecha inicial de cobro para empresas existentes (1 mes después de su fecha de creación)
      await basePrisma.$executeRawUnsafe(`
        UPDATE \`Company\` 
        SET \`nextBillingDate\` = DATE_ADD(COALESCE(\`createdAt\`, NOW()), INTERVAL 1 MONTH) 
        WHERE \`nextBillingDate\` IS NULL
      `);
    }

    if (!columnNames.includes('isExempt')) {
      await basePrisma.$executeRawUnsafe(`
        ALTER TABLE \`Company\` ADD COLUMN \`isExempt\` TINYINT(1) NOT NULL DEFAULT 0
      `);
      console.log('[DB Migration] Added isExempt column to Company table');
    }

    if (!columnNames.includes('billingEmail')) {
      await basePrisma.$executeRawUnsafe(`
        ALTER TABLE \`Company\` ADD COLUMN \`billingEmail\` VARCHAR(191) NULL
      `);
      console.log('[DB Migration] Added billingEmail column to Company table');
    }

    if (!columnNames.includes('billingPhone')) {
      await basePrisma.$executeRawUnsafe(`
        ALTER TABLE \`Company\` ADD COLUMN \`billingPhone\` VARCHAR(50) NULL
      `);
      console.log('[DB Migration] Added billingPhone column to Company table');
    }

    if (!columnNames.includes('billingContactName')) {
      await basePrisma.$executeRawUnsafe(`
        ALTER TABLE \`Company\` ADD COLUMN \`billingContactName\` VARCHAR(191) NULL
      `);
      console.log('[DB Migration] Added billingContactName column to Company table');
    }

    if (!columnNames.includes('billingNoticeDays')) {
      await basePrisma.$executeRawUnsafe(`
        ALTER TABLE \`Company\` ADD COLUMN \`billingNoticeDays\` INT NOT NULL DEFAULT 15
      `);
      console.log('[DB Migration] Added billingNoticeDays column to Company table');
    }

    if (!columnNames.includes('lastReminderSentAt')) {
      await basePrisma.$executeRawUnsafe(`
        ALTER TABLE \`Company\` ADD COLUMN \`lastReminderSentAt\` DATETIME(3) NULL
      `);
      console.log('[DB Migration] Added lastReminderSentAt column to Company table');
    }

    // Regla de Negocio Crítica: La empresa matriz PAIN es propietaria del sistema y está 100% exenta de pagos
    await basePrisma.$executeRawUnsafe(`
      UPDATE \`Company\` 
      SET \`isExempt\` = 1, \`billingCycle\` = 'EXENTO', \`nextBillingDate\` = NULL 
      WHERE \`id\` = 'default-company-pain' OR \`slug\` = 'pain'
    `);
    console.log('[DB Migration] PAIN Platform Owner set to isExempt = 1, billingCycle = EXENTO');
  } catch (err) {
    console.warn('[DB Migration] Aviso en verificación de columnas Company:', err.message);
  }
}

/**
 * Asegura la existencia de las columnas enriquecidas en la tabla Employee
 * (phone, hireDate, birthDate, contractType, emergencyContactName, emergencyContactPhone, customTolerance)
 */
async function ensureEmployeeEnrichedColumns() {
  try {
    const columns = await basePrisma.$queryRawUnsafe(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Employee'
    `);
    const columnNames = Array.isArray(columns) ? columns.map(c => c.COLUMN_NAME) : [];

    if (!columnNames.includes('phone')) {
      await basePrisma.$executeRawUnsafe(`
        ALTER TABLE \`Employee\` ADD COLUMN \`phone\` VARCHAR(50) NULL
      `);
      console.log('[DB Migration] Added phone column to Employee table');
    }

    if (!columnNames.includes('hireDate')) {
      await basePrisma.$executeRawUnsafe(`
        ALTER TABLE \`Employee\` ADD COLUMN \`hireDate\` DATETIME(3) NULL
      `);
      console.log('[DB Migration] Added hireDate column to Employee table');
    }

    if (!columnNames.includes('birthDate')) {
      await basePrisma.$executeRawUnsafe(`
        ALTER TABLE \`Employee\` ADD COLUMN \`birthDate\` DATETIME(3) NULL
      `);
      console.log('[DB Migration] Added birthDate column to Employee table');
    }

    if (!columnNames.includes('contractType')) {
      await basePrisma.$executeRawUnsafe(`
        ALTER TABLE \`Employee\` ADD COLUMN \`contractType\` VARCHAR(50) NULL DEFAULT 'TIEMPO_COMPLETO'
      `);
      console.log('[DB Migration] Added contractType column to Employee table');
    }

    if (!columnNames.includes('emergencyContactName')) {
      await basePrisma.$executeRawUnsafe(`
        ALTER TABLE \`Employee\` ADD COLUMN \`emergencyContactName\` VARCHAR(191) NULL
      `);
      console.log('[DB Migration] Added emergencyContactName column to Employee table');
    }

    if (!columnNames.includes('emergencyContactPhone')) {
      await basePrisma.$executeRawUnsafe(`
        ALTER TABLE \`Employee\` ADD COLUMN \`emergencyContactPhone\` VARCHAR(50) NULL
      `);
      console.log('[DB Migration] Added emergencyContactPhone column to Employee table');
    }

    if (!columnNames.includes('customTolerance')) {
      await basePrisma.$executeRawUnsafe(`
        ALTER TABLE \`Employee\` ADD COLUMN \`customTolerance\` INT NULL
      `);
      console.log('[DB Migration] Added customTolerance column to Employee table');
    }
  } catch (err) {
    console.warn('[DB Migration] Aviso en verificación de columnas Employee:', err.message);
  }
}

/**
 * Calcula la próxima fecha de cobro de licencia a partir de una fecha base y un ciclo.
 * @param {Date|string} fromDate - Fecha base
 * @param {string} cycle - 'MENSUAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'
 * @returns {Date}
 */
function calculateNextBillingDate(fromDate = new Date(), cycle = 'MENSUAL') {
  const d = new Date(fromDate || Date.now());
  if (isNaN(d.getTime())) {
    d.setTime(Date.now());
  }

  const normalizedCycle = (cycle || 'MENSUAL').toUpperCase();
  switch (normalizedCycle) {
    case 'TRIMESTRAL':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'SEMESTRAL':
      d.setMonth(d.getMonth() + 6);
      break;
    case 'ANUAL':
      d.setFullYear(d.getFullYear() + 1);
      break;
    case 'MENSUAL':
    default:
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d;
}

module.exports = {
  ensureCompanyBillingColumns,
  ensureEmployeeEnrichedColumns,
  calculateNextBillingDate
};
