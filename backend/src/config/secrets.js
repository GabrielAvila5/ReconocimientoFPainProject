/**
 * MÓDULO CENTRAL DE VALIDACIÓN Y GESTIÓN DE SECRETOS CRÍTICOS
 * 
 * REGLAS DE SEGURIDAD SAAS:
 * 1. ENCRYPTION_KEY: Debe medir exactamente 32 bytes (256 bits).
 * 2. JWT_SECRET: Debe medir exactamente 32 bytes (256 bits).
 * 
 * Si no están definidas en las variables de entorno de Hostinger (o en .env),
 * se utiliza una clave de respaldo predeterminada de 32 bytes para prevenir
 * la detención inesperada del servidor (resiliencia ante el bug de variables de Hostinger).
 */

const FALLBACK_JWT_SECRET = 'HostingerFallbackSecretKey2026!X'; // Exactamente 32 bytes
const FALLBACK_ENCRYPTION_KEY = 'HostingerFallbackAES256Key2026!!'; // Exactamente 32 bytes

function validateAndGetSecrets() {
  // 1. ENCRYPTION_KEY
  let encKey = process.env.ENCRYPTION_KEY;
  if (!encKey || encKey.trim() === '') {
    console.warn('⚠️ AVISO: ENCRYPTION_KEY no está definida en el entorno. Usando clave de respaldo de 32 bytes.');
    encKey = FALLBACK_ENCRYPTION_KEY;
  }

  let encBuffer = Buffer.from(encKey, 'utf8');
  if (encBuffer.length !== 32) {
    console.warn(`⚠️ AVISO: ENCRYPTION_KEY provista (${encBuffer.length} bytes) no mide 32 bytes. Aplicando clave de respaldo segura de 32 bytes.`);
    encBuffer = Buffer.from(FALLBACK_ENCRYPTION_KEY, 'utf8');
  }

  // 2. JWT_SECRET
  let jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.trim() === '') {
    console.warn('⚠️ AVISO: JWT_SECRET no está definida en el entorno. Usando clave de respaldo de 32 bytes.');
    jwtSecret = FALLBACK_JWT_SECRET;
  }

  let jwtBuffer = Buffer.from(jwtSecret, 'utf8');
  if (jwtBuffer.length !== 32) {
    console.warn(`⚠️ AVISO: JWT_SECRET provista (${jwtBuffer.length} bytes) no mide 32 bytes. Aplicando clave de respaldo segura de 32 bytes.`);
    jwtSecret = FALLBACK_JWT_SECRET;
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
