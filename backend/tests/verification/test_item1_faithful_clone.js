const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const DB_PORT = 3307;
const DB_USER = 'root';
const DB_PASS = 'admin123';
const DB_HOST = '127.0.0.1';
const SOURCE_DB = 'reconocimiento_facial_db_pain';
const CLONE_DB = 'reconocimiento_test_clone_fiel';
const CLONE_URL = `mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${CLONE_DB}`;

// Clave de 32 bytes exacta para las pruebas
const TEST_KEY = '12345678901234567890123456789012'; // 32 bytes

async function main() {
  console.log('================================================================');
  console.log('>>> ITEM 1: PRUEBA DE CLON FIEL (mysqldump + restore) Y DOBLE CIFRADO');
  console.log('================================================================\n');

  const adminPrisma = new PrismaClient({
    datasources: { db: { url: `mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/mysql` } }
  });

  // 1. Recrear la base clon
  console.log(`[Paso 1] Recreando base de datos ${CLONE_DB}...`);
  await adminPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${CLONE_DB}\`;`);
  await adminPrisma.$executeRawUnsafe(`CREATE DATABASE \`${CLONE_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await adminPrisma.$disconnect();

  // 2. Volcado fiel con mysqldump y restauración con mysql
  console.log(`[Paso 2] Ejecutando mysqldump de ${SOURCE_DB} y restauración en ${CLONE_DB}...`);
  const dumpCmd = `mysqldump --column-statistics=0 -u ${DB_USER} -p${DB_PASS} -P ${DB_PORT} -h ${DB_HOST} ${SOURCE_DB}`;
  const restoreCmd = `mysql -u ${DB_USER} -p${DB_PASS} -P ${DB_PORT} -h ${DB_HOST} ${CLONE_DB}`;
  execSync(`${dumpCmd} | ${restoreCmd}`, { shell: 'cmd.exe' });
  console.log('✓ mysqldump y restore completados con éxito.');

  // 3. Inspeccionar el clon antes de migrar
  const clonePrisma = new PrismaClient({ datasources: { db: { url: CLONE_URL } } });
  
  const fksBefore = await clonePrisma.$queryRawUnsafe(`
    SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = '${CLONE_DB}' AND REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY TABLE_NAME, CONSTRAINT_NAME;
  `);
  console.log(`\n[Paso 3] Claves foráneas en ${CLONE_DB} ANTES de migrar: ${fksBefore.length}`);
  console.table(fksBefore);
  if (fksBefore.length !== 12) {
    throw new Error(`Se esperaban exactamente 12 FKs originales, pero se encontraron ${fksBefore.length}`);
  }

  const descriptorsBefore = await clonePrisma.$queryRawUnsafe(`
    SELECT id, firstName, lastName, LEFT(faceDescriptor, 15) as prefix, LENGTH(faceDescriptor) as len
    FROM Employee WHERE faceDescriptor IS NOT NULL;
  `);
  console.log(`\nDescriptores en ${CLONE_DB} ANTES de migrar (todos en texto plano JSON):`);
  console.table(descriptorsBefore);
  await clonePrisma.$disconnect();

  // 4. Primera ejecución de migrate_production.js
  console.log('\n[Paso 4] EJECUTANDO PRIMERA MIGRACIÓN (Run 1)...');
  const envWithKey = { ...process.env, ENCRYPTION_KEY: TEST_KEY };
  execSync(
    `node backend/scripts/migrate_production.js --confirm --db="${CLONE_URL}" --expected-db="${CLONE_DB}"`,
    { stdio: 'inherit', env: envWithKey }
  );

  // 5. Segunda ejecución de migrate_production.js (prueba de idempotencia)
  console.log('\n[Paso 5] EJECUTANDO SEGUNDA MIGRACIÓN (Run 2 - Idempotencia)...');
  execSync(
    `node backend/scripts/migrate_production.js --confirm --db="${CLONE_URL}" --expected-db="${CLONE_DB}"`,
    { stdio: 'inherit', env: envWithKey }
  );

  // 6. Verificar descriptores en el clon: descifrar cada uno y comprobar que sea Float32Array(128)
  console.log('\n[Paso 6] DESCIFRANDO TODOS LOS DESCRIPTORES Y VALIDANDO ESTRUCTURA 128 FLOATS...');
  const verifyPrisma = new PrismaClient({ datasources: { db: { url: CLONE_URL } } });
  
  const employeesEncrypted = await verifyPrisma.$queryRawUnsafe(`
    SELECT id, firstName, lastName, faceDescriptor
    FROM Employee WHERE faceDescriptor IS NOT NULL;
  `);

  const keyBuffer = Buffer.from(TEST_KEY, 'utf8');
  function decrypt(enc) {
    const parts = enc.split(':');
    const iv = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const ciphertext = parts[3];
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  const results = [];
  for (const emp of employeesEncrypted) {
    const isEncrypted = emp.faceDescriptor.startsWith('enc_gcm:');
    let validArray = false;
    let arrayLength = 0;
    let sampleFloats = [];
    
    if (isEncrypted) {
      const plainText = decrypt(emp.faceDescriptor);
      const parsed = JSON.parse(plainText);
      if (Array.isArray(parsed) && parsed.length === 128 && parsed.every(n => typeof n === 'number')) {
        validArray = true;
        arrayLength = parsed.length;
        sampleFloats = parsed.slice(0, 3);
      }
    }

    results.push({
      id: emp.id,
      nombre: `${emp.firstName} ${emp.lastName}`.trim(),
      prefijo_cifrado: emp.faceDescriptor.substring(0, 15),
      longitud_cifrado: emp.faceDescriptor.length,
      descifrado_ok: validArray,
      longitud_arreglo: arrayLength,
      muestra_valores: JSON.stringify(sampleFloats)
    });
  }

  console.table(results);
  const totalEmployeesWithFace = results.length;
  const totalValid128 = results.filter(r => r.descifrado_ok).length;
  console.log(`\n✓ Conteo total con biometría: ${totalEmployeesWithFace}`);
  console.log(`✓ Conteo válidos con 128 floats tras doble ejecución: ${totalValid128}/${totalEmployeesWithFace}`);

  // 7. Verificar claves foráneas finales en el clon
  const fksAfter = await verifyPrisma.$queryRawUnsafe(`
    SELECT TABLE_NAME, CONSTRAINT_NAME
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = '${CLONE_DB}' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ORDER BY TABLE_NAME, CONSTRAINT_NAME;
  `);
  console.log(`\n[Paso 7] Claves foráneas activas finales en ${CLONE_DB}: ${fksAfter.length}/25`);
  await verifyPrisma.$disconnect();

  if (totalValid128 !== totalEmployeesWithFace || fksAfter.length !== 25) {
    throw new Error('La validación final falló.');
  }

  console.log('\n================================================================');
  console.log('>>> ITEM 1 VERIFICADO EXITOSAMENTE AL 100%');
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Error en prueba de Item 1:', err);
  process.exit(1);
});
