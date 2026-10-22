/**
 * MÓDULO CENTRAL DE VALIDACIÓN Y GESTIÓN DE SECRETOS CRÍTICOS
 * 
 * REGLAS DE SEGURIDAD SAAS:
 * 1. ENCRYPTION_KEY: Obligatoria, sin valores por defecto. Debe medir exactamente 32 bytes (256 bits).
 * 2. JWT_SECRET: Obligatoria, sin valores por defecto. Debe medir exactamente 32 bytes (256 bits).
 * 
 * Si alguna variable falta o su longitud en bytes es diferente de 32, el proceso
 * se detiene inmediatamente (process.exit(1)) emitiendo un error fatal en stderr.
 */

function validateAndGetSecrets() {
  // 1. ENCRYPTION_KEY
  const encKey = process.env.ENCRYPTION_KEY;
  if (!encKey || encKey.trim() === '') {
    console.error('❌ ERROR FATAL DE SEGURIDAD: La variable de entorno ENCRYPTION_KEY no está definida.');
    console.error('   Se requiere una clave de 32 bytes para el cifrado AES-256-GCM de datos biométricos.');
    process.exit(1);
  }

  const encBuffer = Buffer.from(encKey, 'utf8');
  if (encBuffer.length !== 32) {
    console.error(`❌ ERROR FATAL DE SEGURIDAD: ENCRYPTION_KEY no mide 32 bytes (longitud actual: ${encBuffer.length} bytes).`);
    console.error('   AES-256-GCM exige una clave de exactamente 32 bytes (256 bits).');
    process.exit(1);
  }

  // 2. JWT_SECRET
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.trim() === '') {
    console.error('❌ ERROR FATAL DE SEGURIDAD: La variable de entorno JWT_SECRET no está definida.');
    console.error('   Se requiere una clave segura de 32 bytes para la firma HMAC-SHA256 de tokens de sesión.');
    process.exit(1);
  }

  const jwtBuffer = Buffer.from(jwtSecret, 'utf8');
  if (jwtBuffer.length !== 32) {
    console.error(`❌ ERROR FATAL DE SEGURIDAD: JWT_SECRET no mide 32 bytes (longitud actual: ${jwtBuffer.length} bytes).`);
    console.error('   HMAC-SHA256 exige una clave de exactamente 32 bytes (256 bits).');
    process.exit(1);
  }

  return {
    ENCRYPTION_KEY: encBuffer,
    JWT_SECRET: jwtSecret
  };
}

// Ejecutar validación al importar
const secrets = validateAndGetSecrets();

module.exports = {
  validateAndGetSecrets,
  ENCRYPTION_KEY: secrets.ENCRYPTION_KEY,
  JWT_SECRET: secrets.JWT_SECRET
};
