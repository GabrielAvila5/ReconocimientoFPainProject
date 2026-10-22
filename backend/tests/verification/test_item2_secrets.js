const { spawnSync } = require('child_process');
const path = require('path');

const SECRETS_SCRIPT = path.join(__dirname, '../../src/config/secrets.js');

function testScenario(name, envOverrides) {
  console.log(`\n----------------------------------------------------------------`);
  console.log(`>>> PRUEBA: ${name}`);
  console.log(`----------------------------------------------------------------`);
  
  // Clonar env y aplicar overrides
  const testEnv = { ...process.env };
  for (const [k, v] of Object.entries(envOverrides)) {
    if (v === undefined) {
      delete testEnv[k];
    } else {
      testEnv[k] = v;
    }
  }

  const result = spawnSync(process.execPath, [SECRETS_SCRIPT], {
    env: testEnv,
    encoding: 'utf8'
  });

  console.log(`Código de salida: ${result.status} (esperado != 0 para fallas, == 0 para éxito)`);
  if (result.stderr) {
    console.log(`STDERR:\n${result.stderr.trim()}`);
  }
  if (result.stdout) {
    console.log(`STDOUT:\n${result.stdout.trim()}`);
  }

  return result.status;
}

console.log('================================================================');
console.log('  ITEM 2: DEMOSTRACIÓN DE VALIDACIÓN ESTRICTA DE SECRETOS       ');
console.log('================================================================');

// 1. Fallo: ENCRYPTION_KEY falta
const code1 = testScenario('Fallo 1: ENCRYPTION_KEY falta (undefined)', {
  ENCRYPTION_KEY: undefined,
  JWT_SECRET: '12345678901234567890123456789012'
});
if (code1 !== 1) throw new Error('Esperaba fallo con código 1');

// 2. Fallo: ENCRYPTION_KEY no mide 32 bytes (16 bytes)
const code2 = testScenario('Fallo 2: ENCRYPTION_KEY mide 16 bytes (no 32 bytes)', {
  ENCRYPTION_KEY: 'clave_corta_16_b',
  JWT_SECRET: '12345678901234567890123456789012'
});
if (code2 !== 1) throw new Error('Esperaba fallo con código 1');

// 3. Fallo: JWT_SECRET falta
const code3 = testScenario('Fallo 3: JWT_SECRET falta (undefined)', {
  ENCRYPTION_KEY: '12345678901234567890123456789012',
  JWT_SECRET: undefined
});
if (code3 !== 1) throw new Error('Esperaba fallo con código 1');

// 4. Fallo: JWT_SECRET no mide 32 bytes (10 bytes)
const code4 = testScenario('Fallo 4: JWT_SECRET mide 10 bytes (no 32 bytes)', {
  ENCRYPTION_KEY: '12345678901234567890123456789012',
  JWT_SECRET: 'jwt_diez_b'
});
if (code4 !== 1) throw new Error('Esperaba fallo con código 1');

// 5. Éxito: Ambos miden exactamente 32 bytes
const code5 = testScenario('Éxito 5: Ambas variables presentes y miden exactamente 32 bytes', {
  ENCRYPTION_KEY: '12345678901234567890123456789012', // 32 bytes
  JWT_SECRET: 'abcdefghij0123456789abcdefghij01'  // 32 bytes
});
if (code5 !== 0) throw new Error('Esperaba éxito con código 0');

console.log('\n================================================================');
console.log('✓ ITEM 2 DEMOSTRADO EXITOSAMENTE CON SALIDA REAL EN TODOS LOS CASOS');
console.log('================================================================\n');
