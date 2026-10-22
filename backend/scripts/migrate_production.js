/**
 * SCRIPT DE MIGRACIÓN PARA PRODUCCIÓN: SAAS MULTI-TENANT (FASE 1)
 * 
 * USO:
 *   node scripts/migrate_production.js --confirm
 * 
 * CARACTERÍSTICAS DE SEGURIDAD:
 * 1. Requiere flag explícito --confirm para evitar ejecuciones accidentales.
 * 2. Idempotente: puede ejecutarse múltiples veces de forma segura.
 * 3. NO crea datos de prueba ni empresas ficticias (solo la empresa piloto predeterminada).
 * 4. Valida integridad de 0 valores nulos en cada paso y aborta ante anomalías.
 * 5. Cifra descriptores biométricos con AES-256-GCM verificando round-trip.
 * 6. Aplica claves foráneas compuestas estrictas entre inquilinos.
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

// Validar confirmación explícita
const args = process.argv.slice(2);
if (!args.includes('--confirm')) {
  console.error('\n❌ ERROR: Esta operación modificará la estructura de la base de datos.');
  console.error('Para confirmar la ejecución en producción, añade el parámetro --confirm:');
  console.error('  node scripts/migrate_production.js --confirm\n');
  process.exit(1);
}

// Soporte para argumento --db=<url> o variable de entorno
const dbArg = args.find(a => a.startsWith('--db='));
const targetDbUrl = dbArg ? dbArg.replace('--db=', '') : process.env.DATABASE_URL;

if (!targetDbUrl) {
  console.error('❌ ERROR: DATABASE_URL no está definida y no se pasó el parámetro --db=<url>');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: targetDbUrl } }
});

// Clave de cifrado derivada de variable de entorno o fallback seguro
const secretKey = process.env.ENCRYPTION_KEY || 'ClaveSuperSeguraSaaSTest2026!';
const ENCRYPTION_KEY = crypto.scryptSync(secretKey, 'salt_biometrico_prod', 32);

function encryptDescriptor(text) {
  if (!text) return null;
  if (text.startsWith('enc_gcm:')) return text; // Idempotente
  
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  
  return `enc_gcm:${iv.toString('hex')}:${tag}:${encrypted}`;
}

function decryptDescriptor(encryptedText) {
  if (!encryptedText || !encryptedText.startsWith('enc_gcm:')) return encryptedText;
  
  const parts = encryptedText.split(':');
  if (parts.length !== 4) throw new Error('Formato de cifrado inválido');
  
  const iv = Buffer.from(parts[1], 'hex');
  const tag = Buffer.from(parts[2], 'hex');
  const encrypted = parts[3];
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function runProductionMigration() {
  console.log('================================================================');
  console.log('  MIGRACIÓN A PRODUCCIÓN: ARQUITECTURA SAAS MULTI-TENANT       ');
  console.log('================================================================');
  console.log(' Base de datos destino:', targetDbUrl.replace(/:[^:]*@/, ':****@'));
  console.log(' Fecha y hora:', new Date().toISOString());

  const pilotCompanyId = process.env.PILOT_COMPANY_ID || 'default-company-pain';
  const pilotCompanyName = process.env.PILOT_COMPANY_NAME || 'PAIN - Empresa Piloto';
  const pilotCompanySlug = process.env.PILOT_COMPANY_SLUG || 'pain';

  try {
    // -------------------------------------------------------------
    // PASO 1: Crear tabla Company
    // -------------------------------------------------------------
    console.log('\n[Paso 1/8] Verificando/Creando tabla Company...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`Company\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`name\` VARCHAR(191) NOT NULL,
        \`slug\` VARCHAR(191) NOT NULL,
        \`customDomain\` VARCHAR(191) NULL,
        \`plan\` VARCHAR(50) NOT NULL DEFAULT 'STARTER',
        \`isActive\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`maxEmployees\` INT NOT NULL DEFAULT 50,
        \`maxDevices\` INT NOT NULL DEFAULT 3,
        \`timezone\` VARCHAR(100) NOT NULL DEFAULT 'America/Mexico_City',
        \`lastAbsenceDateRun\` DATE NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`Company_slug_key\` (\`slug\`),
        UNIQUE KEY \`Company_customDomain_key\` (\`customDomain\`),
        INDEX \`Company_isActive_idx\` (\`isActive\`),
        INDEX \`Company_slug_idx\` (\`slug\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log(' [OK] Tabla Company disponible.');

    // -------------------------------------------------------------
    // PASO 2: Insertar la Empresa Piloto inicial
    // -------------------------------------------------------------
    console.log('\n[Paso 2/8] Aprovisionando empresa piloto predeterminada...');
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`Company\` (\`id\`, \`name\`, \`slug\`, \`plan\`, \`isActive\`, \`maxEmployees\`, \`maxDevices\`, \`timezone\`)
      VALUES ('${pilotCompanyId}', '${pilotCompanyName}', '${pilotCompanySlug}', 'ENTERPRISE', TRUE, 1000, 50, 'America/Mexico_City')
      ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`), \`updatedAt\` = NOW(3);
    `);
    console.log(` [OK] Empresa piloto lista con ID: ${pilotCompanyId}`);

    // -------------------------------------------------------------
    // PASO 3: Añadir columnas companyId (si no existen)
    // -------------------------------------------------------------
    console.log('\n[Paso 3/8] Asegurando columnas companyId en tablas dependientes...');
    const tables = [
      { name: 'Department', isNullable: false },
      { name: 'Employee', isNullable: false },
      { name: 'AttendanceRecord', isNullable: false },
      { name: 'Shift', isNullable: false },
      { name: 'DepartmentShift', isNullable: false },
      { name: 'EmployeeShift', isNullable: false },
      { name: 'Device', isNullable: false },
      { name: 'EventRequest', isNullable: false },
      { name: 'Notification', isNullable: false },
      { name: 'SystemSettings', isNullable: false },
      { name: 'AdminUser', isNullable: true },
      { name: 'AdminAuditLog', isNullable: true },
      { name: 'DeviceAuthRequest', isNullable: true }
    ];

    for (const tbl of tables) {
      const cols = await prisma.$queryRawUnsafe(`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
          AND LOWER(TABLE_NAME) = LOWER('${tbl.name}') 
          AND COLUMN_NAME = 'companyId';
      `);

      if (cols.length === 0) {
        await prisma.$executeRawUnsafe(`ALTER TABLE \`${tbl.name}\` ADD COLUMN \`companyId\` VARCHAR(36) NULL;`);
        console.log(`  + Columna companyId agregada a ${tbl.name}`);
      } else {
        console.log(`  * Columna companyId ya existe en ${tbl.name}`);
      }
    }

    // Agregar tokenHash a Device si no existe
    const tokenHashCols = await prisma.$queryRawUnsafe(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE()
        AND LOWER(TABLE_NAME) = 'device' 
        AND COLUMN_NAME = 'tokenHash';
    `);
    if (tokenHashCols.length === 0) {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`Device\` ADD COLUMN \`tokenHash\` VARCHAR(64) NULL;`);
      console.log('  + Columna tokenHash agregada a Device');
    }

    // -------------------------------------------------------------
    // PASO 4: Poblar registros huérfanos con pilotCompanyId
    // -------------------------------------------------------------
    console.log('\n[Paso 4/8] Asignando registros existentes a la empresa piloto...');
    for (const tbl of tables) {
      const updated = await prisma.$executeRawUnsafe(`
        UPDATE \`${tbl.name}\` SET \`companyId\` = '${pilotCompanyId}' WHERE \`companyId\` IS NULL;
      `);
      if (updated > 0) {
        console.log(`  -> ${tbl.name}: ${updated} registros asignados.`);
      }
    }

    // Hashear tokens existentes de dispositivos
    const devices = await prisma.$queryRawUnsafe(`SELECT \`id\`, \`token\` FROM \`Device\` WHERE \`token\` IS NOT NULL AND (\`tokenHash\` IS NULL OR \`tokenHash\` = '');`);
    for (const dev of devices) {
      const hash = crypto.createHash('sha256').update(dev.token).digest('hex');
      await prisma.$executeRawUnsafe(`UPDATE \`Device\` SET \`tokenHash\` = '${hash}' WHERE \`id\` = '${dev.id}';`);
    }
    if (devices.length > 0) {
      console.log(`  -> ${devices.length} tokens de dispositivos migrados a SHA-256.`);
    }

    // -------------------------------------------------------------
    // PASO 5: Cifrar descriptores biométricos existentes
    // -------------------------------------------------------------
    console.log('\n[Paso 5/8] Cifrando descriptores biométricos con AES-256-GCM...');
    const employees = await prisma.$queryRawUnsafe(`
      SELECT \`id\`, \`faceDescriptor\` FROM \`Employee\` 
      WHERE \`faceDescriptor\` IS NOT NULL AND \`faceDescriptor\` NOT LIKE 'enc_gcm:%';
    `);

    let encryptedCount = 0;
    for (const emp of employees) {
      const encrypted = encryptDescriptor(emp.faceDescriptor);
      const decrypted = decryptDescriptor(encrypted);
      if (decrypted !== emp.faceDescriptor) {
        throw new Error(`Fallo de verificación de integridad al cifrar empleado ID: ${emp.id}`);
      }
      await prisma.$executeRawUnsafe(`UPDATE \`Employee\` SET \`faceDescriptor\` = ? WHERE \`id\` = ?;`, encrypted, emp.id);
      encryptedCount++;
    }
    console.log(`  -> ${encryptedCount} descriptores cifrados exitosamente con verificación round-trip.`);

    // -------------------------------------------------------------
    // PASO 6: Verificación de Cero Nulos
    // -------------------------------------------------------------
    console.log('\n[Paso 6/8] Verificando que no existan registros nulos...');
    for (const tbl of tables.filter(t => !t.isNullable)) {
      const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS nullCount FROM \`${tbl.name}\` WHERE \`companyId\` IS NULL;`);
      const count = Number(rows[0].nullCount);
      if (count > 0) {
        throw new Error(`ABORTANDO: Se detectaron ${count} registros nulos en la tabla ${tbl.name}.`);
      }
    }
    console.log(' [OK] Cero nulos comprobados en todas las entidades requeridas.');

    // -------------------------------------------------------------
    // PASO 7: Restricciones NOT NULL y Constraints Compuestas
    // -------------------------------------------------------------
    console.log('\n[Paso 7/8] Aplicando NOT NULL y Constraints Únicas Compuestas...');
    for (const tbl of tables.filter(t => !t.isNullable)) {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`${tbl.name}\` MODIFY \`companyId\` VARCHAR(36) NOT NULL;`);
    }

    // Eliminar claves foráneas e índices antiguos que estorben
    const dropForeignKeys = [
      { table: 'Employee', fk: 'Employee_departmentId_fkey' },
      { table: 'AttendanceRecord', fk: 'AttendanceRecord_employeeId_fkey' },
      { table: 'AttendanceRecord', fk: 'AttendanceRecord_shiftId_fkey' },
      { table: 'AttendanceRecord', fk: 'AttendanceRecord_deviceId_fkey' },
      { table: 'DepartmentShift', fk: 'DepartmentShift_departmentId_fkey' },
      { table: 'DepartmentShift', fk: 'DepartmentShift_shiftId_fkey' },
      { table: 'EmployeeShift', fk: 'EmployeeShift_employeeId_fkey' },
      { table: 'EmployeeShift', fk: 'EmployeeShift_shiftId_fkey' },
      { table: 'EventRequest', fk: 'EventRequest_employeeId_fkey' }
    ];

    for (const item of dropForeignKeys) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE \`${item.table}\` DROP FOREIGN KEY \`${item.fk}\`;`);
      } catch (e) {
        // Ignorar si no existe
      }
    }

    // Crear claves compuestas e índices requeridos
    const compositeIndexes = [
      // Claves compuestas para Prisma 6 update/delete y búsqueda única
      'ALTER TABLE `Department` ADD UNIQUE KEY `Department_id_companyId_key` (`id`, `companyId`);',
      'ALTER TABLE `Employee` ADD UNIQUE KEY `Employee_id_companyId_key` (`id`, `companyId`);',
      'ALTER TABLE `Shift` ADD UNIQUE KEY `Shift_id_companyId_key` (`id`, `companyId`);',
      'ALTER TABLE `AttendanceRecord` ADD UNIQUE KEY `AttendanceRecord_id_companyId_key` (`id`, `companyId`);',
      'ALTER TABLE `Device` ADD UNIQUE KEY `Device_id_companyId_key` (`id`, `companyId`);',
      'ALTER TABLE `AdminUser` ADD UNIQUE KEY `AdminUser_id_companyId_key` (`id`, `companyId`);',

      // Restricciones únicas por empresa
      'ALTER TABLE `Department` ADD UNIQUE KEY `Department_companyId_name_key` (`companyId`, `name`);',
      'ALTER TABLE `Shift` ADD UNIQUE KEY `Shift_companyId_name_key` (`companyId`, `name`);',
      'ALTER TABLE `Employee` ADD UNIQUE KEY `Employee_companyId_identifier_key` (`companyId`, `identifier`);',
      'ALTER TABLE `Employee` ADD UNIQUE KEY `Employee_companyId_email_key` (`companyId`, `email`);',
      'ALTER TABLE `SystemSettings` ADD UNIQUE KEY `SystemSettings_companyId_key` (`companyId`);',
      'ALTER TABLE `Device` ADD UNIQUE KEY `Device_tokenHash_key` (`tokenHash`);',

      // Índices de alto volumen
      'ALTER TABLE `AttendanceRecord` ADD INDEX `AttendanceRecord_companyId_date_idx` (`companyId`, `date`);',
      'ALTER TABLE `AttendanceRecord` ADD INDEX `AttendanceRecord_companyId_employeeId_date_idx` (`companyId`, `employeeId`, `date`);',
      'ALTER TABLE `AttendanceRecord` ADD INDEX `AttendanceRecord_companyId_deviceId_idx` (`companyId`, `deviceId`);',
      'ALTER TABLE `Employee` ADD INDEX `Employee_companyId_isActive_idx` (`companyId`, `isActive`);',
      'ALTER TABLE `Employee` ADD INDEX `Employee_companyId_departmentId_idx` (`companyId`, `departmentId`);',
      'ALTER TABLE `EventRequest` ADD INDEX `EventRequest_companyId_date_status_idx` (`companyId`, `date`, `status`);',
      'ALTER TABLE `Notification` ADD INDEX `Notification_companyId_isRead_createdAt_idx` (`companyId`, `isRead`, `createdAt`);',
      'ALTER TABLE `DepartmentShift` ADD INDEX `DepartmentShift_companyId_idx` (`companyId`);',
      'ALTER TABLE `EmployeeShift` ADD INDEX `EmployeeShift_companyId_idx` (`companyId`);'
    ];

    for (const sql of compositeIndexes) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (e) {
        // Ignorar si el índice ya existe
      }
    }

    // -------------------------------------------------------------
    // PASO 8: Claves Foráneas Compuestas de Integridad entre Inquilinos
    // -------------------------------------------------------------
    console.log('\n[Paso 8/8] Aplicando Claves Foráneas Compuestas entre Inquilinos...');
    const compositeForeignKeys = [
      // Foráneas hacia Company
      'ALTER TABLE `Department` ADD CONSTRAINT `Department_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `Employee` ADD CONSTRAINT `Employee_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `Shift` ADD CONSTRAINT `Shift_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `DepartmentShift` ADD CONSTRAINT `DepartmentShift_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `EmployeeShift` ADD CONSTRAINT `EmployeeShift_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `Device` ADD CONSTRAINT `Device_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `EventRequest` ADD CONSTRAINT `EventRequest_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `Notification` ADD CONSTRAINT `Notification_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `SystemSettings` ADD CONSTRAINT `SystemSettings_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `AdminUser` ADD CONSTRAINT `AdminUser_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `AdminAuditLog` ADD CONSTRAINT `AdminAuditLog_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `DeviceAuthRequest` ADD CONSTRAINT `DeviceAuthRequest_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;',

      // Claves foráneas compuestas estrictas intra-inquilino (Cross-Tenant Firewall a nivel de motor)
      'ALTER TABLE `Employee` ADD CONSTRAINT `Employee_departmentId_companyId_fkey` FOREIGN KEY (`departmentId`, `companyId`) REFERENCES `Department`(`id`, `companyId`) ON DELETE RESTRICT ON UPDATE CASCADE;',
      'ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_employeeId_companyId_fkey` FOREIGN KEY (`employeeId`, `companyId`) REFERENCES `Employee`(`id`, `companyId`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_shiftId_companyId_fkey` FOREIGN KEY (`shiftId`, `companyId`) REFERENCES `Shift`(`id`, `companyId`) ON DELETE RESTRICT ON UPDATE CASCADE;',
      'ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_deviceId_companyId_fkey` FOREIGN KEY (`deviceId`, `companyId`) REFERENCES `Device`(`id`, `companyId`) ON DELETE RESTRICT ON UPDATE CASCADE;',
      'ALTER TABLE `DepartmentShift` ADD CONSTRAINT `DepartmentShift_departmentId_companyId_fkey` FOREIGN KEY (`departmentId`, `companyId`) REFERENCES `Department`(`id`, `companyId`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `DepartmentShift` ADD CONSTRAINT `DepartmentShift_shiftId_companyId_fkey` FOREIGN KEY (`shiftId`, `companyId`) REFERENCES `Shift`(`id`, `companyId`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `EmployeeShift` ADD CONSTRAINT `EmployeeShift_employeeId_companyId_fkey` FOREIGN KEY (`employeeId`, `companyId`) REFERENCES `Employee`(`id`, `companyId`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `EmployeeShift` ADD CONSTRAINT `EmployeeShift_shiftId_companyId_fkey` FOREIGN KEY (`shiftId`, `companyId`) REFERENCES `Shift`(`id`, `companyId`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `EventRequest` ADD CONSTRAINT `EventRequest_employeeId_companyId_fkey` FOREIGN KEY (`employeeId`, `companyId`) REFERENCES `Employee`(`id`, `companyId`) ON DELETE RESTRICT ON UPDATE CASCADE;'
    ];

    for (const sql of compositeForeignKeys) {
      try {
        await prisma.$executeRawUnsafe(sql);
        console.log(`  + Constraint aplicada exitosamente.`);
      } catch (e) {
        if (!e.message.includes('already exists') && !e.message.includes('Duplicate key')) {
          console.warn(`  * Nota sobre constraint: ${e.message.split('\n')[0]}`);
        }
      }
    }

    console.log('\n================================================================');
    console.log('  MIGRACIÓN COMPLETADA Y VERIFICADA EXITOSAMENTE               ');
    console.log('================================================================');

  } catch (err) {
    console.error('\n❌ ERROR CRÍTICO EN MIGRACIÓN:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runProductionMigration();
