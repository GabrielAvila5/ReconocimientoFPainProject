/**
 * SCRIPT DE PRUEBA DE MIGRACIÓN FASE 1: SAAS MULTI-TENANT
 * Se ejecuta EXCLUSIVAMENTE sobre la copia de prueba: reconocimiento_test_copia_saas
 * Utiliza PrismaClient con $executeRawUnsafe (cero dependencias externas).
 * NO toca la base de datos de producción ni la rama main.
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

// Conexión específica y aislada a la copia de prueba
const testDbUrl = process.env.TEST_DATABASE_URL || 'mysql://root:admin123@127.0.0.1:3307/reconocimiento_test_copia_saas';
const prisma = new PrismaClient({
  datasources: {
    db: { url: testDbUrl }
  }
});

// Clave de cifrado de prueba para AES-256-GCM (32 bytes)
const ENCRYPTION_KEY = crypto.scryptSync('ClaveSuperSeguraSaaSTest2026!', 'salt_biometrico_fase1', 32);

function encryptDescriptor(text) {
  if (!text) return null;
  if (text.startsWith('enc_gcm:')) return text;
  
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

async function runMigrationTest() {
  console.log('================================================================');
  console.log('   INICIO DE PRUEBA DE MIGRACIÓN: SAAS MULTI-TENANT (FASE 1)   ');
  console.log('================================================================');
  console.log(' Conectando a BD de prueba aislada:', testDbUrl.replace(/:[^:]*@/, ':****@'));

  try {
    // -------------------------------------------------------------
    // PASO 1: Crear tabla Company
    // -------------------------------------------------------------
    console.log('\n[Paso 1/7] Creando tabla Company...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS company (
        id VARCHAR(36) NOT NULL,
        name VARCHAR(191) NOT NULL,
        slug VARCHAR(191) NOT NULL,
        customDomain VARCHAR(191) NULL,
        plan VARCHAR(50) NOT NULL DEFAULT 'STARTER',
        isActive BOOLEAN NOT NULL DEFAULT TRUE,
        maxEmployees INT NOT NULL DEFAULT 50,
        maxDevices INT NOT NULL DEFAULT 3,
        timezone VARCHAR(100) NOT NULL DEFAULT 'America/Mexico_City',
        lastAbsenceDateRun DATE NULL,
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY company_slug_key (slug),
        UNIQUE KEY company_customDomain_key (customDomain),
        INDEX company_isActive_idx (isActive)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log(' Tabla Company creada exitosamente.');

    // -------------------------------------------------------------
    // PASO 2: Insertar Empresa Piloto (PAIN)
    // -------------------------------------------------------------
    console.log('\n[Paso 2/7] Insertando empresa piloto predeterminada...');
    const pilotCompanyId = 'default-company-pain';
    await prisma.$executeRawUnsafe(`
      INSERT INTO company (id, name, slug, plan, isActive, maxEmployees, maxDevices, timezone)
      VALUES ('${pilotCompanyId}', 'PAIN - Empresa Piloto', 'pain', 'ENTERPRISE', TRUE, 1000, 50, 'America/Mexico_City')
      ON DUPLICATE KEY UPDATE name = VALUES(name);
    `);
    console.log(` Empresa piloto insertada con ID: ${pilotCompanyId}`);

    // -------------------------------------------------------------
    // PASO 3: Añadir columnas companyId como NULLABLE (Expand)
    // -------------------------------------------------------------
    console.log('\n[Paso 3/7] Añadiendo columnas companyId (compatibilidad hacia atrás)...');
    
    const tablesToAlter = [
      { name: 'department', isNullable: false },
      { name: 'employee', isNullable: false },
      { name: 'attendancerecord', isNullable: false },
      { name: 'shift', isNullable: false },
      { name: 'device', isNullable: false },
      { name: 'eventrequest', isNullable: false },
      { name: 'notification', isNullable: false },
      { name: 'systemsettings', isNullable: false },
      { name: 'adminuser', isNullable: true },
      { name: 'adminauditlog', isNullable: true },
      { name: 'deviceauthrequest', isNullable: true }
    ];

    for (const tbl of tablesToAlter) {
      const cols = await prisma.$queryRawUnsafe(`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = 'reconocimiento_test_copia_saas' 
          AND TABLE_NAME = '${tbl.name}' 
          AND COLUMN_NAME = 'companyId'
      `);

      if (cols.length === 0) {
        await prisma.$executeRawUnsafe(`ALTER TABLE \`${tbl.name}\` ADD COLUMN companyId VARCHAR(36) NULL;`);
        console.log(`  + Columna companyId agregada a ${tbl.name}`);
      } else {
        console.log(`  * Columna companyId ya existía en ${tbl.name}`);
      }
    }

    // Agregar tokenHash a device si no existe
    const tokenHashCols = await prisma.$queryRawUnsafe(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'reconocimiento_test_copia_saas' 
        AND TABLE_NAME = 'device' 
        AND COLUMN_NAME = 'tokenHash'
    `);
    if (tokenHashCols.length === 0) {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`device\` ADD COLUMN tokenHash VARCHAR(64) NULL;`);
      console.log('  + Columna tokenHash añadida a device');
    }

    // -------------------------------------------------------------
    // PASO 4: Poblar masivamente con default-company-pain
    // -------------------------------------------------------------
    console.log('\n[Paso 4/7] Asignando registros existentes a la empresa piloto...');
    for (const tbl of tablesToAlter) {
      const updated = await prisma.$executeRawUnsafe(`
        UPDATE \`${tbl.name}\` SET companyId = '${pilotCompanyId}' WHERE companyId IS NULL;
      `);
      console.log(`  -> ${tbl.name}: ${updated} registros asignados a ${pilotCompanyId}.`);
    }

    // Hashear tokens existentes de dispositivos
    const devices = await prisma.$queryRawUnsafe(`SELECT id, token FROM \`device\` WHERE token IS NOT NULL;`);
    for (const dev of devices) {
      const hash = crypto.createHash('sha256').update(dev.token).digest('hex');
      await prisma.$executeRawUnsafe(`UPDATE \`device\` SET tokenHash = '${hash}' WHERE id = '${dev.id}';`);
    }
    console.log(`  -> Tokens de dispositivos hasheados con SHA-256 (${devices.length} dispositivos).`);

    // -------------------------------------------------------------
    // PASO 5: Cifrar descriptores faciales existentes (AES-256-GCM)
    // -------------------------------------------------------------
    console.log('\n[Paso 5/7] Cifrando descriptores biométricos existentes con AES-256-GCM...');
    const employees = await prisma.$queryRawUnsafe(`
      SELECT id, firstName, lastName, faceDescriptor FROM \`employee\` WHERE faceDescriptor IS NOT NULL;
    `);
    
    let encryptedCount = 0;
    for (const emp of employees) {
      if (emp.faceDescriptor && !emp.faceDescriptor.startsWith('enc_gcm:')) {
        const encrypted = encryptDescriptor(emp.faceDescriptor);
        const decrypted = decryptDescriptor(encrypted);
        if (decrypted !== emp.faceDescriptor) {
          throw new Error(`Fallo de verificación de integridad al cifrar empleado ${emp.id}`);
        }
        await prisma.$executeRawUnsafe(`UPDATE \`employee\` SET faceDescriptor = ? WHERE id = ?;`, encrypted, emp.id);
        encryptedCount++;
      }
    }
    console.log(`  -> ${encryptedCount} descriptores cifrados exitosamente con verificación round-trip.`);

    // -------------------------------------------------------------
    // PASO 6: Verificación de Integridad (Cero nulos)
    // -------------------------------------------------------------
    console.log('\n[Paso 6/7] Verificando que no existan valores nulos en tablas requeridas...');
    for (const tbl of tablesToAlter.filter(t => !t.isNullable)) {
      const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS nullCount FROM \`${tbl.name}\` WHERE companyId IS NULL;`);
      const count = Number(rows[0].nullCount);
      if (count > 0) {
        throw new Error(`ERROR CRÍTICO: Quedaron ${count} registros nulos en ${tbl.name}`);
      }
      console.log(`  [OK] ${tbl.name}: 0 valores nulos.`);
    }

    // -------------------------------------------------------------
    // PASO 7: Restricciones NOT NULL y Constraints Únicas Compuestas
    // -------------------------------------------------------------
    console.log('\n[Paso 7/7] Aplicando NOT NULL y Restricciones Compuestas por Empresa...');
    
    // Convertir a NOT NULL
    for (const tbl of tablesToAlter.filter(t => !t.isNullable)) {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`${tbl.name}\` MODIFY companyId VARCHAR(36) NOT NULL;`);
    }

    // Eliminar índices únicos viejos y crear los nuevos compuestos
    const indexChanges = [
      {
        table: 'department',
        dropIndex: 'Department_name_key',
        newIndexSql: 'ALTER TABLE `department` ADD UNIQUE KEY `department_companyId_name_key` (companyId, name);'
      },
      {
        table: 'shift',
        dropIndex: 'Shift_name_key',
        newIndexSql: 'ALTER TABLE `shift` ADD UNIQUE KEY `shift_companyId_name_key` (companyId, name);'
      },
      {
        table: 'employee',
        dropIndex: 'Employee_identifier_key',
        newIndexSql: 'ALTER TABLE `employee` ADD UNIQUE KEY `employee_companyId_identifier_key` (companyId, identifier);'
      },
      {
        table: 'systemsettings',
        dropIndex: null,
        newIndexSql: 'ALTER TABLE `systemsettings` ADD UNIQUE KEY `systemsettings_companyId_key` (companyId);'
      }
    ];

    for (const idx of indexChanges) {
      if (idx.dropIndex) {
        try {
          await prisma.$executeRawUnsafe(`ALTER TABLE \`${idx.table}\` DROP INDEX \`${idx.dropIndex}\`;`);
          console.log(`  - Índice anterior ${idx.dropIndex} eliminado de ${idx.table}`);
        } catch (e) {
          console.log(`  * Nota sobre ${idx.dropIndex}: ${e.message.split('\n')[0]}`);
        }
      }
      try {
        await prisma.$executeRawUnsafe(idx.newIndexSql);
        console.log(`  + Índice compuesto creado en ${idx.table}`);
      } catch (e) {
        console.log(`  * Índice ya existía en ${idx.table}`);
      }
    }

    // Agregar claves foráneas hacia Company
    console.log('\nAñadiendo claves foráneas hacia la tabla Company...');
    for (const tbl of tablesToAlter) {
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE \`${tbl.name}\`
          ADD CONSTRAINT \`fk_${tbl.name}_company\`
          FOREIGN KEY (\`companyId\`) REFERENCES \`company\` (\`id\`)
          ON DELETE ${tbl.isNullable ? 'SET NULL' : 'CASCADE'}
          ON UPDATE CASCADE;
        `);
        console.log(`  + Foreign key fk_${tbl.name}_company añadida.`);
      } catch (e) {
        console.log(`  * Foreign key en ${tbl.name} ya existe: ${e.message.split('\n')[0]}`);
      }
    }

    // -------------------------------------------------------------
    // VALIDACIÓN FUNCIONAL MULTI-TENANT: Prueba de no-colisión
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log('   PRUEBA DE VALIDACIÓN: COEXISTENCIA MULTI-TENANT REAL        ');
    console.log('================================================================');

    // 1. Crear una segunda empresa (Empresa Beta)
    const betaCompanyId = 'company-beta-test-saas';
    await prisma.$executeRawUnsafe(`
      INSERT INTO company (id, name, slug, plan)
      VALUES ('${betaCompanyId}', 'Empresa Beta Corp', 'beta-corp', 'STARTER')
      ON DUPLICATE KEY UPDATE name = VALUES(name);
    `);
    console.log(' Empresa Beta creada exitosamente.');

    // 2. Obtener un empleado existente de PAIN para duplicar su identifier en Beta
    const painEmployees = await prisma.$queryRawUnsafe(`SELECT identifier FROM \`employee\` WHERE companyId = '${pilotCompanyId}' LIMIT 1;`);
    const duplicateIdentifier = painEmployees[0].identifier;
    console.log(` Identificador tomado para prueba de colisión: "${duplicateIdentifier}"`);

    // 3. Insertar empleado en Empresa Beta con el MISMO identifier
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`employee\` (id, companyId, firstName, lastName, identifier, email, isActive, createdAt, updatedAt)
      VALUES (UUID(), '${betaCompanyId}', 'Empleado', 'Clon Beta', '${duplicateIdentifier}', 'clon.beta@example.com', TRUE, NOW(3), NOW(3));
    `);
    console.log(' [ÉXITO] Empleado con ID idéntico creado en Empresa Beta sin colisión.');

    // 4. Intentar insertar un empleado con el mismo identifier dentro de la MISMA empresa (debe fallar)
    let collisionBlocked = false;
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO \`employee\` (id, companyId, firstName, lastName, identifier, email, isActive, createdAt, updatedAt)
        VALUES (UUID(), '${betaCompanyId}', 'Empleado', 'Colisión Fallida', '${duplicateIdentifier}', 'otro.email@example.com', TRUE, NOW(3), NOW(3));
      `);
    } catch (err) {
      collisionBlocked = true;
      console.log(' [ÉXITO] Restricción única intra-empresa funcionó: bloqueó duplicado dentro de Beta.');
    }

    if (!collisionBlocked) {
      throw new Error('FALLO: Se permitió un identificador duplicado dentro de la misma empresa.');
    }

    // 5. Verificar lectura y descifrado del empleado de Gabriel Avila
    const gabrielRows = await prisma.$queryRawUnsafe(`
      SELECT firstName, lastName, identifier, faceDescriptor, companyId 
      FROM \`employee\` 
      WHERE identifier = '${duplicateIdentifier}' AND companyId = '${pilotCompanyId}';
    `);

    const gabriel = gabrielRows[0];
    console.log(`\n Verificación de datos del empleado piloto:`);
    console.log(`  - Nombre: ${gabriel.firstName} ${gabriel.lastName}`);
    console.log(`  - Empresa asignada: ${gabriel.companyId}`);
    console.log(`  - Descriptor cifrado en BD: ${gabriel.faceDescriptor.substring(0, 45)}...`);
    
    const decryptedDescriptor = decryptDescriptor(gabriel.faceDescriptor);
    const parsedVector = JSON.parse(decryptedDescriptor);
    console.log(`  - Descriptor descifrado correctamente: Array(${parsedVector.length} flotantes)`);

    console.log('\n================================================================');
    console.log('   MIGRACIÓN DE FASE 1 CERTIFICADA CON ÉXITO EN COPIA DE BD     ');
    console.log('================================================================');

  } catch (err) {
    console.error('\n❌ ERROR DURANTE LA MIGRACIÓN:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigrationTest();
