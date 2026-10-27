/**
 * SCRIPT TRANSACCIONAL DE ROTACIÓN DE CLAVE DE CIFRADO BIOMÉTRICO (GATE 4)
 * Re-cifra atómicamente todos los faceDescriptor (AES-256-GCM) de OLD_KEY a NEW_KEY
 * en bloques transaccionales controlados sin downtime.
 * 
 * Uso CLI:
 *   OLD_ENCRYPTION_KEY="..." NEW_ENCRYPTION_KEY="..." node backend/scripts/rotate_encryption_key.js [--dry-run]
 */

const crypto = require('crypto');
const prismaAdmin = require('../src/utils/prismaAdmin');

function parseKey(rawKey, keyName = 'KEY') {
  if (!rawKey) {
    throw new Error(`La clave ${keyName} es obligatoria.`);
  }
  let buf;
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    buf = Buffer.from(rawKey, 'hex');
  } else if (/^[A-Za-z0-9+/]{43}=$/.test(rawKey) || /^[A-Za-z0-9+/]{44}$/.test(rawKey)) {
    buf = Buffer.from(rawKey, 'base64');
  } else {
    buf = Buffer.from(rawKey, 'utf8');
  }
  if (buf.length !== 32) {
    throw new Error(`La clave ${keyName} debe tener exactamente 32 bytes (tiene ${buf.length}).`);
  }
  return buf;
}

function decryptWithKey(encryptedText, keyBuffer) {
  if (!encryptedText) return null;
  if (!encryptedText.startsWith('enc_gcm:')) {
    // Si no tiene prefijo enc_gcm:, devolver texto directo (legado)
    return encryptedText;
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 4) {
    throw new Error('Formato enc_gcm inválido.');
  }

  const iv = Buffer.from(parts[1], 'hex');
  const tag = Buffer.from(parts[2], 'hex');
  const ciphertext = parts[3];

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encryptWithKey(plainText, keyBuffer) {
  if (!plainText) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `enc_gcm:${iv.toString('hex')}:${tag}:${encrypted}`;
}

async function rotateEncryptionKeys(options = {}) {
  const isDryRun = options.dryRun || process.argv.includes('--dry-run');
  const oldKey = options.oldKey ? parseKey(options.oldKey, 'OLD_ENCRYPTION_KEY') : parseKey(process.env.OLD_ENCRYPTION_KEY, 'OLD_ENCRYPTION_KEY');
  const newKey = options.newKey ? parseKey(options.newKey, 'NEW_ENCRYPTION_KEY') : parseKey(process.env.NEW_ENCRYPTION_KEY, 'NEW_ENCRYPTION_KEY');
  const batchSize = options.batchSize || 100;
  const targetEmployeeId = options.employeeId || null;

  console.log('================================================================');
  console.log(`>>> INICIANDO ROTACIÓN CRIPTOGRÁFICA DE CLAVE ${isDryRun ? '(MODO DRY-RUN)' : '(MODO REAL)'}`);
  console.log('================================================================\n');

  const whereClause = {
    faceDescriptor: { not: null }
  };
  if (targetEmployeeId) {
    whereClause.id = targetEmployeeId;
  }

  const employees = await prismaAdmin.employee.findMany({
    where: whereClause,
    select: { id: true, companyId: true, identifier: true, faceDescriptor: true }
  });

  console.log(`1. Total de descriptores encontrados para rotación: ${employees.length}`);

  let rotatedCount = 0;
  const batches = [];
  for (let i = 0; i < employees.length; i += batchSize) {
    batches.push(employees.slice(i, i + batchSize));
  }

  for (let bIndex = 0; bIndex < batches.length; bIndex++) {
    const batch = batches[bIndex];
    console.log(`\nProcesando lote ${bIndex + 1}/${batches.length} (${batch.length} registros)...`);

    const updates = [];
    for (const emp of batch) {
      try {
        const plain = decryptWithKey(emp.faceDescriptor, oldKey);
        const reEncrypted = encryptWithKey(plain, newKey);

        // Verificación de integridad cruzada antes de persistir
        const verifyPlain = decryptWithKey(reEncrypted, newKey);
        if (verifyPlain !== plain) {
          throw new Error(`Fallo de verificación para empleado ${emp.id}: el descifrado no coincide.`);
        }

        updates.push({
          id: emp.id,
          companyId: emp.companyId,
          faceDescriptor: reEncrypted
        });
      } catch (err) {
        console.error(`❌ Error al re-cifrar empleado ID ${emp.id}:`, err.message);
        throw err;
      }
    }

    if (!isDryRun) {
      // Aplicación en transacción atómica por lote
      await prismaAdmin.$transaction(
        updates.map(u => prismaAdmin.employee.update({
          where: { id_companyId: { id: u.id, companyId: u.companyId } },
          data: { faceDescriptor: u.faceDescriptor }
        }))
      );
      console.log(`  ✓ Lote ${bIndex + 1} persistido exitosamente en BD.`);
    } else {
      console.log(`  ✓ [DRY-RUN] Lote ${bIndex + 1} verificado sin persistir en BD.`);
    }

    rotatedCount += updates.length;
  }

  console.log('\n================================================================');
  console.log(`✓ ROTACIÓN FINALIZADA: ${rotatedCount} descriptores procesados exitosamente.`);
  console.log('================================================================\n');

  return { total: employees.length, rotated: rotatedCount, dryRun: isDryRun };
}

if (require.main === module) {
  rotateEncryptionKeys()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error fatal en rotación:', err.message);
      process.exit(1);
    })
    .finally(() => prismaAdmin.$disconnect());
}

module.exports = {
  rotateEncryptionKeys,
  encryptWithKey,
  decryptWithKey,
  parseKey
};

