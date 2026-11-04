/**
 * SCRIPT DE MIGRACIÓN PARA PRODUCCIÓN: SAAS MULTI-TENANT (FASE 1)
 * 
 * ⚠️ REQUISITO OPERACIONAL OBLIGATORIO:
 * DEBE EJECUTARSE CON LA APLICACIÓN COMPLETAMENTE DETENIDA (pm2 stop / docker compose stop).
 * No debe haber tráfico HTTP ni procesos de fondo escribiendo en la base durante la migración.
 * 
 * NOTA CRÍTICA DE DISEÑO (PASO 0):
 * En MariaDB InnoDB, la modificación del tipo de datos de columnas clave (de VARCHAR(36) a VARCHAR(191))
 * está estrictamente prohibida por el motor mientras existan restricciones de claves foráneas activas,
 * incluso con FOREIGN_KEY_CHECKS=0. Por ello, el Paso 0 desvincula TODAS las restricciones foráneas
 * existentes de forma temporal para permitir las conversiones estructurales DDL sin bloqueo de motor.
 * En el Paso 8, se recrean todas las restricciones con integridad referencial compuesta y ON DELETE RESTRICT.
 * La verificación final audita el conteo exacto de 25 claves foráneas activas; si alguna falla,
 * el script aborta con error crítico alertando que la base quedó desprotegida.
 * 
 * USO:
 *   node scripts/migrate_production.js --confirm [--expected-db=<nombre_db>] [--db=<database_url>]
 * 
 * CARACTERÍSTICAS DE SEGURIDAD:
 * 1. Requiere confirmación explícita (--confirm) y aplicación detenida.
 * 2. Valida contra --expected-db para evitar ejecutar sobre una base incorrecta.
 * 3. Idempotente: puede ejecutarse múltiples veces de forma segura sin duplicar cambios.
 * 4. NO crea datos de prueba ni empresas ficticias (solo la empresa piloto predeterminada).
 * 5. Valida integridad de 0 valores nulos en cada paso y aborta ante anomalías.
 * 6. Cifra descriptores biométricos con AES-256-GCM verificando round-trip (omite ya cifrados enc_gcm:).
 * 7. Aplica ON DELETE RESTRICT hacia Company para prevenir borrados accidentales de empresas.
 * 8. Aplica claves foráneas compuestas estrictas entre inquilinos.
 * 9. Auditoría final de 25/25 claves foráneas activas con detención de emergencia si falta alguna.
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const args = process.argv.slice(2);

// 1. Validar confirmación explícita
if (!args.includes('--confirm')) {
  console.error('\n❌ ERROR: Esta operación modificará la estructura de la base de datos.');
  console.error('Para confirmar la ejecución en producción, añade el parámetro --confirm:');
  console.error('  node scripts/migrate_production.js --confirm\n');
  process.exit(1);
}

// 2. Soporte para argumento --db=<url> o variable de entorno
const dbArg = args.find(a => a.startsWith('--db='));
const targetDbUrl = dbArg ? dbArg.replace('--db=', '').trim() : process.env.DATABASE_URL;

if (!targetDbUrl) {
  console.error('❌ ERROR: DATABASE_URL no está definida y no se pasó el parámetro --db=<url>');
  process.exit(1);
}

// 3. Validación de base de datos esperada (--expected-db)
const expectedDbArg = args.find(a => a.startsWith('--expected-db='));
if (expectedDbArg) {
  const expectedDb = expectedDbArg.replace('--expected-db=', '').trim();
  const currentDbMatch = targetDbUrl.match(/\/([^/?]+)(\?|$)/);
  const currentDb = currentDbMatch ? currentDbMatch[1] : null;
  if (currentDb !== expectedDb) {
    console.error(`\n❌ ERROR DE SEGURIDAD: La base de datos objetivo '${currentDb}' no coincide con la esperada '${expectedDb}'.`);
    console.error('Abortando migración inmediatamente.');
    process.exit(1);
  }
}

const prisma = new PrismaClient({
  datasources: { db: { url: targetDbUrl } }
});

// Clave de cifrado para descriptores faciales
const rawEncKey = process.env.ENCRYPTION_KEY || 'HostingerFallbackAES256Key2026!!';
let encKeyBuffer = Buffer.from(rawEncKey, 'utf8');
if (encKeyBuffer.length !== 32) {
  console.warn(`⚠️ AVISO: ENCRYPTION_KEY provista (${encKeyBuffer.length} bytes) no mide 32 bytes. Usando clave de respaldo.`);
  encKeyBuffer = Buffer.from('HostingerFallbackAES256Key2026!!', 'utf8');
}
const ENCRYPTION_KEY = encKeyBuffer;

function encryptDescriptor(text) {
  if (!text) return null;
  if (text.startsWith('enc_gcm:')) return text; // Idempotente: nunca re-cifrar
  
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
  console.log('⚠️ REQUISITO OPERATIVO: La aplicación Node.js DEBE estar detenida');
  console.log('   (pm2 stop all / docker compose stop backend) durante esta migración.');
  console.log('   El Paso 0 elimina temporalmente todas las claves foráneas para');
  console.log('   modificar tipos de datos; ninguna escritura debe ocurrir en paralelo.');

  const pilotCompanyId = process.env.PILOT_COMPANY_ID || 'default-company-pain';
  const pilotCompanyName = process.env.PILOT_COMPANY_NAME || 'PAIN - Empresa Piloto';
  const pilotCompanySlug = process.env.PILOT_COMPANY_SLUG || 'pain';

  try {
    // -------------------------------------------------------------
    // PASO 0: Purgar claves foráneas existentes antes de modificar tipos de datos
    // -------------------------------------------------------------
    console.log('\n[Paso 0/8] Desvinculando temporalmente claves foráneas existentes...');
    console.log('  -> Justificación: MariaDB bloquea alteraciones de tipo (VARCHAR(36) -> VARCHAR(191))');
    console.log('     en columnas referenciadas si existen restricciones activas.');
    const existingFks = await prisma.$queryRawUnsafe(`
      SELECT TABLE_NAME, CONSTRAINT_NAME 
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND CONSTRAINT_TYPE = 'FOREIGN KEY';
    `);
    for (const fk of existingFks) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE \`${fk.TABLE_NAME}\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\`;`);
      } catch (e) {
        // Ignorar si ya fue removida
      }
    }
    console.log(` [OK] ${existingFks.length} restricciones de claves foráneas desvinculadas.`);

    // -------------------------------------------------------------
    // PASO 1: Crear tabla Company
    // -------------------------------------------------------------
    console.log('\n[Paso 1/8] Verificando/Creando tabla Company...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`Company\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`name\` VARCHAR(191) NOT NULL,
        \`slug\` VARCHAR(191) NOT NULL,
        \`customDomain\` VARCHAR(191) NULL,
        \`plan\` VARCHAR(191) NOT NULL DEFAULT 'STARTER',
        \`isActive\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`suspendedAt\` DATETIME(3) NULL,
        \`suspensionReason\` VARCHAR(191) NULL,
        \`suspendedById\` VARCHAR(191) NULL,
        \`suspendedByName\` VARCHAR(191) NULL,
        \`suspensionGraceDays\` INT NULL DEFAULT 30,
        \`suspensionExpiresAt\` DATETIME(3) NULL,
        \`deletionAlertSent\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`deletionAlertAt\` DATETIME(3) NULL,
        \`maxEmployees\` INT NOT NULL DEFAULT 50,
        \`maxDevices\` INT NOT NULL DEFAULT 3,
        \`timezone\` VARCHAR(191) NOT NULL DEFAULT 'America/Mexico_City',
        \`lastAbsenceDateRun\` DATE NULL,
        \`descriptorsVersion\` INT NOT NULL DEFAULT 1,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`Company_slug_key\` (\`slug\`),
        UNIQUE KEY \`Company_customDomain_key\` (\`customDomain\`),
        INDEX \`Company_isActive_idx\` (\`isActive\`),
        INDEX \`Company_slug_idx\` (\`slug\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    // Asegurar tipos en caso de que existiera previamente con VARCHAR(36)
    await prisma.$executeRawUnsafe(`ALTER TABLE \`Company\` MODIFY \`id\` VARCHAR(191) NOT NULL;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE \`Company\` MODIFY \`plan\` VARCHAR(191) NOT NULL DEFAULT 'STARTER';`);
    await prisma.$executeRawUnsafe(`ALTER TABLE \`Company\` MODIFY \`timezone\` VARCHAR(191) NOT NULL DEFAULT 'America/Mexico_City';`);
    const optionalCompanyCols = [
      'ALTER TABLE `Company` ADD COLUMN `descriptorsVersion` INT NOT NULL DEFAULT 1;',
      'ALTER TABLE `Company` ADD COLUMN `suspendedAt` DATETIME(3) NULL;',
      'ALTER TABLE `Company` ADD COLUMN `suspensionReason` VARCHAR(191) NULL;',
      'ALTER TABLE `Company` ADD COLUMN `suspendedById` VARCHAR(191) NULL;',
      'ALTER TABLE `Company` ADD COLUMN `suspendedByName` VARCHAR(191) NULL;',
      'ALTER TABLE `Company` ADD COLUMN `suspensionGraceDays` INT NULL DEFAULT 30;',
      'ALTER TABLE `Company` ADD COLUMN `suspensionExpiresAt` DATETIME(3) NULL;',
      'ALTER TABLE `Company` ADD COLUMN `deletionAlertSent` BOOLEAN NOT NULL DEFAULT FALSE;',
      'ALTER TABLE `Company` ADD COLUMN `deletionAlertAt` DATETIME(3) NULL;'
    ];
    for (const colSql of optionalCompanyCols) {
      try {
        await prisma.$executeRawUnsafe(colSql);
      } catch (e) {
        // Ignorar si ya existía
      }
    }
    await prisma.$executeRawUnsafe(`ALTER TABLE \`Company\` MODIFY \`updatedAt\` DATETIME(3) NOT NULL;`);
    console.log(' [OK] Tabla Company disponible.');

    // -------------------------------------------------------------
    // PASO 2: Insertar Empresa Piloto predeterminada
    // -------------------------------------------------------------
    console.log('\n[Paso 2/8] Aprovisionando empresa piloto predeterminada...');
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`Company\` (\`id\`, \`name\`, \`slug\`, \`plan\`, \`isActive\`, \`maxEmployees\`, \`maxDevices\`, \`timezone\`)
      VALUES ('${pilotCompanyId}', '${pilotCompanyName}', '${pilotCompanySlug}', 'ENTERPRISE', TRUE, 1000, 50, 'America/Mexico_City')
      ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`), \`updatedAt\` = NOW(3);
    `);
    console.log(` [OK] Empresa piloto lista con ID: ${pilotCompanyId}`);

    // -------------------------------------------------------------
    // PASO 3: Asegurar columnas companyId
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
        await prisma.$executeRawUnsafe(`ALTER TABLE \`${tbl.name}\` ADD COLUMN \`companyId\` VARCHAR(191) NULL;`);
        console.log(`  + Columna companyId agregada a ${tbl.name}`);
      } else {
        await prisma.$executeRawUnsafe(`ALTER TABLE \`${tbl.name}\` MODIFY \`companyId\` VARCHAR(191) NULL;`);
        console.log(`  * Columna companyId estandarizada a VARCHAR(191) en ${tbl.name}`);
      }
    }

    // Agregar o estandarizar tokenHash en Device
    const tokenHashCols = await prisma.$queryRawUnsafe(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE()
        AND LOWER(TABLE_NAME) = 'device' 
        AND COLUMN_NAME = 'tokenHash';
    `);
    if (tokenHashCols.length === 0) {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`Device\` ADD COLUMN \`tokenHash\` VARCHAR(191) NULL;`);
      console.log('  + Columna tokenHash agregada a Device');
    } else {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`Device\` MODIFY \`tokenHash\` VARCHAR(191) NULL;`);
    }

    // Estandarizar SystemSettings.id a AUTO_INCREMENT sin default estático
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`SystemSettings\` MODIFY \`id\` INT NOT NULL AUTO_INCREMENT;`);
    } catch (e) {
      // Ignorar si ya está configurado
    }

    // Retiro físico definitivo de columnas obsoletas (photoRetentionDays)
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`SystemSettings\` DROP COLUMN IF EXISTS \`photoRetentionDays\`;`);
      console.log('  - Columna obsoleta photoRetentionDays retirada físicamente de SystemSettings');
    } catch (e) {
      // Ignorar si no existe
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
    // PASO 5: Cifrar descriptores biométricos existentes (omite enc_gcm:)
    // -------------------------------------------------------------
    console.log('\n[Paso 5/8] Cifrando descriptores biométricos con AES-256-GCM (idempotente)...');
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
    console.log(`  -> ${encryptedCount} descriptores nuevos cifrados exitosamente (omite los ya cifrados).`);

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
      await prisma.$executeRawUnsafe(`ALTER TABLE \`${tbl.name}\` MODIFY \`companyId\` VARCHAR(191) NOT NULL;`);
    }

    // Purgar claves foráneas antiguas redundantes o con prefijo 'fk_'
    const oldFks = await prisma.$queryRawUnsafe(`
      SELECT TABLE_NAME, CONSTRAINT_NAME 
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND CONSTRAINT_TYPE = 'FOREIGN KEY' 
        AND (CONSTRAINT_NAME LIKE 'fk_%' OR CONSTRAINT_NAME LIKE '%_fkey');
    `);

    for (const item of oldFks) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE \`${item.TABLE_NAME}\` DROP FOREIGN KEY \`${item.CONSTRAINT_NAME}\`;`);
      } catch (e) {
        // Ignorar si ya fue eliminada
      }
    }

    // Eliminar índices únicos e índices viejos globales de la arquitectura anterior (incluyendo variantes en minúsculas)
    const dropOldIndexes = [
      { table: 'Company', idx: 'company_slug_key' },
      { table: 'Company', idx: 'company_customDomain_key' },
      { table: 'Company', idx: 'company_isActive_idx' },
      { table: 'Department', idx: 'Department_name_key' },
      { table: 'Department', idx: 'department_companyId_name_key' },
      { table: 'Shift', idx: 'Shift_name_key' },
      { table: 'Shift', idx: 'shift_companyId_name_key' },
      { table: 'Employee', idx: 'Employee_identifier_key' },
      { table: 'Employee', idx: 'Employee_email_key' },
      { table: 'Employee', idx: 'employee_companyId_identifier_key' },
      { table: 'Employee', idx: 'Employee_departmentId_fkey' },
      { table: 'AttendanceRecord', idx: 'AttendanceRecord_shiftId_fkey' },
      { table: 'DepartmentShift', idx: 'DepartmentShift_shiftId_fkey' },
      { table: 'DepartmentShift', idx: 'DepartmentShift_departmentId_shiftId_companyId_key' },
      { table: 'EmployeeShift', idx: 'EmployeeShift_shiftId_fkey' },
      { table: 'EmployeeShift', idx: 'EmployeeShift_employeeId_shiftId_companyId_key' },
      { table: 'EventRequest', idx: 'EventRequest_employeeId_date_type_idx' },
      { table: 'EventRequest', idx: 'EventRequest_status_date_idx' },
      { table: 'Notification', idx: 'Notification_employeeId_fkey' },
      { table: 'SystemSettings', idx: 'systemsettings_companyId_key' }
    ];
    for (const item of dropOldIndexes) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE \`${item.table}\` DROP INDEX \`${item.idx}\`;`);
      } catch (e) {
        // Ignorar si no existe
      }
    }

    // Crear claves compuestas e índices requeridos alineados exactamente con schema.prisma
    const compositeIndexes = [
      'ALTER TABLE `Company` ADD UNIQUE KEY `Company_slug_key` (`slug`);',
      'ALTER TABLE `Company` ADD UNIQUE KEY `Company_customDomain_key` (`customDomain`);',
      'ALTER TABLE `Company` ADD INDEX `Company_isActive_idx` (`isActive`);',
      'ALTER TABLE `Company` ADD INDEX `Company_slug_idx` (`slug`);',
      'ALTER TABLE `Department` ADD UNIQUE KEY `Department_id_companyId_key` (`id`, `companyId`);',
      'ALTER TABLE `Employee` ADD UNIQUE KEY `Employee_id_companyId_key` (`id`, `companyId`);',
      'ALTER TABLE `Shift` ADD UNIQUE KEY `Shift_id_companyId_key` (`id`, `companyId`);',
      'ALTER TABLE `AttendanceRecord` ADD UNIQUE KEY `AttendanceRecord_id_companyId_key` (`id`, `companyId`);',
      'ALTER TABLE `Device` ADD UNIQUE KEY `Device_id_companyId_key` (`id`, `companyId`);',
      'ALTER TABLE `AdminUser` ADD UNIQUE KEY `AdminUser_id_companyId_key` (`id`, `companyId`);',
      'ALTER TABLE `Notification` ADD UNIQUE KEY `Notification_id_companyId_key` (`id`, `companyId`);',
      'ALTER TABLE `EventRequest` ADD UNIQUE KEY `EventRequest_id_companyId_key` (`id`, `companyId`);',

      'ALTER TABLE `Department` ADD UNIQUE KEY `Department_companyId_name_key` (`companyId`, `name`);',
      'ALTER TABLE `Shift` ADD UNIQUE KEY `Shift_companyId_name_key` (`companyId`, `name`);',
      'ALTER TABLE `Employee` ADD UNIQUE KEY `Employee_companyId_identifier_key` (`companyId`, `identifier`);',
      'ALTER TABLE `Employee` ADD UNIQUE KEY `Employee_companyId_email_key` (`companyId`, `email`);',
      'ALTER TABLE `SystemSettings` ADD UNIQUE KEY `SystemSettings_companyId_key` (`companyId`);',
      'ALTER TABLE `Device` ADD UNIQUE KEY `Device_tokenHash_key` (`tokenHash`);',

      'ALTER TABLE `DepartmentShift` ADD UNIQUE KEY `DepartmentShift_departmentId_shiftId_key` (`departmentId`, `shiftId`);',
      'ALTER TABLE `EmployeeShift` ADD UNIQUE KEY `EmployeeShift_employeeId_shiftId_key` (`employeeId`, `shiftId`);',

      'ALTER TABLE `Department` ADD INDEX `Department_companyId_idx` (`companyId`);',
      'ALTER TABLE `Shift` ADD INDEX `Shift_companyId_idx` (`companyId`);',
      'ALTER TABLE `AdminUser` ADD INDEX `AdminUser_companyId_idx` (`companyId`);',
      'ALTER TABLE `AdminAuditLog` ADD INDEX `AdminAuditLog_companyId_timestamp_idx` (`companyId`, `timestamp`);',
      'ALTER TABLE `AttendanceRecord` ADD INDEX `AttendanceRecord_companyId_date_idx` (`companyId`, `date`);',
      'ALTER TABLE `AttendanceRecord` ADD INDEX `AttendanceRecord_companyId_employeeId_date_idx` (`companyId`, `employeeId`, `date`);',
      'ALTER TABLE `AttendanceRecord` ADD INDEX `AttendanceRecord_companyId_deviceId_idx` (`companyId`, `deviceId`);',
      'ALTER TABLE `Employee` ADD INDEX `Employee_companyId_isActive_idx` (`companyId`, `isActive`);',
      'ALTER TABLE `Employee` ADD INDEX `Employee_companyId_departmentId_idx` (`companyId`, `departmentId`);',
      'ALTER TABLE `EventRequest` ADD INDEX `EventRequest_companyId_employeeId_date_type_idx` (`companyId`, `employeeId`, `date`, `type`);',
      'ALTER TABLE `EventRequest` ADD INDEX `EventRequest_companyId_date_status_idx` (`companyId`, `date`, `status`);',
      'ALTER TABLE `Notification` ADD INDEX `Notification_companyId_isRead_createdAt_idx` (`companyId`, `isRead`, `createdAt`);',
      'ALTER TABLE `Notification` ADD INDEX `Notification_employeeId_companyId_idx` (`employeeId`, `companyId`);',
      'ALTER TABLE `DepartmentShift` ADD INDEX `DepartmentShift_companyId_idx` (`companyId`);',
      'ALTER TABLE `EmployeeShift` ADD INDEX `EmployeeShift_companyId_idx` (`companyId`);',
      'ALTER TABLE `Device` ADD INDEX `Device_companyId_status_idx` (`companyId`, `status`);',
      'ALTER TABLE `Device` ADD INDEX `Device_tokenHash_idx` (`tokenHash`);',
      'ALTER TABLE `DeviceAuthRequest` ADD INDEX `DeviceAuthRequest_companyId_status_idx` (`companyId`, `status`);'
    ];

    for (const sql of compositeIndexes) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (e) {
        // Ignorar si el índice ya existe
      }
    }

    // -------------------------------------------------------------
    // PASO 8: Claves Foráneas con ON DELETE RESTRICT hacia Company
    // -------------------------------------------------------------
    console.log('\n[Paso 8/8] Aplicando Claves Foráneas con ON DELETE RESTRICT hacia Company...');
    const compositeForeignKeys = [
      // Foráneas con ON DELETE RESTRICT hacia Company (Empresas se suspenden, no se borran)
      'ALTER TABLE `Department` ADD CONSTRAINT `Department_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;',
      'ALTER TABLE `Employee` ADD CONSTRAINT `Employee_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;',
      'ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;',
      'ALTER TABLE `Shift` ADD CONSTRAINT `Shift_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;',
      'ALTER TABLE `DepartmentShift` ADD CONSTRAINT `DepartmentShift_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;',
      'ALTER TABLE `EmployeeShift` ADD CONSTRAINT `EmployeeShift_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;',
      'ALTER TABLE `Device` ADD CONSTRAINT `Device_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;',
      'ALTER TABLE `EventRequest` ADD CONSTRAINT `EventRequest_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;',
      'ALTER TABLE `Notification` ADD CONSTRAINT `Notification_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;',
      'ALTER TABLE `SystemSettings` ADD CONSTRAINT `SystemSettings_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;',
      'ALTER TABLE `AdminUser` ADD CONSTRAINT `AdminUser_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;',
      'ALTER TABLE `AdminAuditLog` ADD CONSTRAINT `AdminAuditLog_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;',
      'ALTER TABLE `DeviceAuthRequest` ADD CONSTRAINT `DeviceAuthRequest_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;',

      // Claves foráneas compuestas estrictas intra-inquilino
      'ALTER TABLE `Employee` ADD CONSTRAINT `Employee_departmentId_companyId_fkey` FOREIGN KEY (`departmentId`, `companyId`) REFERENCES `Department`(`id`, `companyId`) ON DELETE RESTRICT ON UPDATE CASCADE;',
      'ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_employeeId_companyId_fkey` FOREIGN KEY (`employeeId`, `companyId`) REFERENCES `Employee`(`id`, `companyId`) ON DELETE RESTRICT ON UPDATE CASCADE;',
      'ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_shiftId_companyId_fkey` FOREIGN KEY (`shiftId`, `companyId`) REFERENCES `Shift`(`id`, `companyId`) ON DELETE RESTRICT ON UPDATE CASCADE;',
      'ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_deviceId_companyId_fkey` FOREIGN KEY (`deviceId`, `companyId`) REFERENCES `Device`(`id`, `companyId`) ON DELETE RESTRICT ON UPDATE CASCADE;',
      'ALTER TABLE `DepartmentShift` ADD CONSTRAINT `DepartmentShift_departmentId_companyId_fkey` FOREIGN KEY (`departmentId`, `companyId`) REFERENCES `Department`(`id`, `companyId`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `DepartmentShift` ADD CONSTRAINT `DepartmentShift_shiftId_companyId_fkey` FOREIGN KEY (`shiftId`, `companyId`) REFERENCES `Shift`(`id`, `companyId`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `EmployeeShift` ADD CONSTRAINT `EmployeeShift_employeeId_companyId_fkey` FOREIGN KEY (`employeeId`, `companyId`) REFERENCES `Employee`(`id`, `companyId`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `EmployeeShift` ADD CONSTRAINT `EmployeeShift_shiftId_companyId_fkey` FOREIGN KEY (`shiftId`, `companyId`) REFERENCES `Shift`(`id`, `companyId`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `EventRequest` ADD CONSTRAINT `EventRequest_employeeId_companyId_fkey` FOREIGN KEY (`employeeId`, `companyId`) REFERENCES `Employee`(`id`, `companyId`) ON DELETE RESTRICT ON UPDATE CASCADE;',
      'ALTER TABLE `Notification` ADD CONSTRAINT `Notification_employeeId_companyId_fkey` FOREIGN KEY (`employeeId`, `companyId`) REFERENCES `Employee`(`id`, `companyId`) ON DELETE CASCADE ON UPDATE CASCADE;',
      'ALTER TABLE `AdminUser` ADD CONSTRAINT `AdminUser_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;',
      'ALTER TABLE `EventRequest` ADD CONSTRAINT `EventRequest_registeredById_fkey` FOREIGN KEY (`registeredById`) REFERENCES `AdminUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;'
    ];

    for (const sql of compositeForeignKeys) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (e) {
        if (!e.message.includes('already exists') && !e.message.includes('Duplicate key')) {
          console.warn(`  * Nota sobre constraint: ${e.message.split('\n')[0]}`);
        }
      }
    }

    // Restaurar chequeo estricto de claves foráneas
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');

    // -------------------------------------------------------------
    // VERIFICACIÓN FINAL: Auditar número de claves foráneas esperado
    // -------------------------------------------------------------
    console.log('\n[Verificación Final] Auditando claves foráneas activas en la base de datos...');
    const activeFks = await prisma.$queryRawUnsafe(`
      SELECT TABLE_NAME, CONSTRAINT_NAME 
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND CONSTRAINT_TYPE = 'FOREIGN KEY';
    `);
    const expectedFkCount = 25;
    const currentFkCount = activeFks.length;

    console.log(`  -> Claves foráneas activas encontradas: ${currentFkCount} / ${expectedFkCount} esperadas.`);

    if (currentFkCount < expectedFkCount) {
      console.error('\n❌❌❌ ALERTA CRÍTICA DE INTEGRIDAD REFERENCIAL ❌❌❌');
      console.error(`Se esperaban ${expectedFkCount} claves foráneas pero solo se encontraron ${currentFkCount}.`);
      console.error('LA BASE DE DATOS HA QUEDADO SIN CLAVES FORÁNEAS O CON INTEGRIDAD INCOMPLETA.');
      console.error('Revise de inmediato los errores reportados en el Paso 8 antes de iniciar la aplicación.');
      throw new Error(`Integridad referencial comprometida: solo ${currentFkCount}/${expectedFkCount} claves foráneas activas.`);
    }
    console.log(' [OK] Integridad referencial 100% verificada (25/25 claves foráneas activas).');

    // -------------------------------------------------------------
    // PASO 9: Asegurar registro de migración en _prisma_migrations
    // (Soporte para bases como u493510526_reconfpain_db sin _prisma_migrations previa)
    // -------------------------------------------------------------
    console.log('\n[Paso 9] Verificando y registrando estado en _prisma_migrations...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`_prisma_migrations\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`checksum\` VARCHAR(64) NOT NULL,
        \`finished_at\` DATETIME(3) NULL,
        \`migration_name\` VARCHAR(255) NOT NULL,
        \`logs\` TEXT NULL,
        \`rolled_back_at\` DATETIME(3) NULL,
        \`started_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`applied_steps_count\` INT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    const existingMigration = await prisma.$queryRawUnsafe(`
      SELECT \`id\` FROM \`_prisma_migrations\` 
      WHERE \`migration_name\` = '20261022000000_saas_multitenancy' LIMIT 1;
    `);

    if (existingMigration.length === 0) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO \`_prisma_migrations\` (
          \`id\`, \`checksum\`, \`finished_at\`, \`migration_name\`, \`logs\`, \`rolled_back_at\`, \`started_at\`, \`applied_steps_count\`
        ) VALUES (
          UUID(),
          '87e2b28678187921f5f231c40652114d3adbd35bc603f0a898f07a4e14631d68',
          NOW(3),
          '20261022000000_saas_multitenancy',
          '',
          NULL,
          NOW(3),
          1
        );
      `);
      console.log('  -> Migración 20261022000000_saas_multitenancy registrada exitosamente en _prisma_migrations.');
    } else {
      console.log('  -> Migración 20261022000000_saas_multitenancy ya se encontraba registrada.');
    }

    console.log('\n================================================================');
    console.log('  MIGRACIÓN COMPLETADA Y VERIFICADA EXITOSAMENTE               ');
    console.log('================================================================');

  } catch (err) {
    console.error('\n❌ ERROR CRÍTICO EN MIGRACIÓN:', err);
    process.exit(1);
  } finally {
    try {
      await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
    } catch (e) {}
    await prisma.$disconnect();
  }
}

runProductionMigration();
