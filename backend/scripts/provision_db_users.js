/**
 * SCRIPT DE APROVISIONAMIENTO DE USUARIOS DE BASE DE DATOS (REGLA DE SEGURIDAD 2 Y 3)
 * Lee las contraseñas exclusivamente desde variables de entorno.
 * NUNCA almacena credenciales en texto plano.
 * 
 * Uso:
 *   $env:SAAS_TEST_USER_PASSWORD="tu_password_seguro"
 *   node backend/scripts/provision_db_users.js --type test
 */

const mysql = require('mysql2/promise');

const args = process.argv.slice(2);
const isExecute = args.includes('--execute');
const type = args.includes('--app') ? 'app' : 'test';

async function main() {
  console.log('================================================================');
  console.log(`>>> APROVISIONAMIENTO SEGURO DE USUARIOS DE BD (MODO: ${type.toUpperCase()})`);
  console.log('================================================================\n');

  if (type === 'test') {
    const password = process.env.SAAS_TEST_USER_PASSWORD;
    if (!password || password.trim().length < 12) {
      console.error('❌ ERROR: Se requiere la variable de entorno SAAS_TEST_USER_PASSWORD (mínimo 12 caracteres).');
      console.error('Ejemplo en PowerShell: $env:SAAS_TEST_USER_PASSWORD="TuContraseñaSegura2026!"');
      process.exit(1);
    }

    const sqlScript = `
-- 1. Crear usuario de pruebas restringido exclusivamente a bases reconocimiento_test_%
CREATE USER IF NOT EXISTS 'saas_test_user'@'localhost' IDENTIFIED BY '${password}';
CREATE USER IF NOT EXISTS 'saas_test_user'@'127.0.0.1' IDENTIFIED BY '${password}';

-- 2. Conceder privilegios únicamente con guion bajo escapado (sin acceso a base real ni GRANT OPTION)
GRANT ALL PRIVILEGES ON \`reconocimiento\\_test\\_%\`.* TO 'saas_test_user'@'localhost';
GRANT ALL PRIVILEGES ON \`reconocimiento\\_test\\_%\`.* TO 'saas_test_user'@'127.0.0.1';

FLUSH PRIVILEGES;
`;
    console.log('Sentencias SQL generadas para usuario de pruebas:');
    console.log(sqlScript.replace(new RegExp(password, 'g'), '********'));

  } else if (type === 'app') {
    const appPassword = process.env.SAAS_APP_USER_PASSWORD;
    const migPassword = process.env.SAAS_MIGRATION_USER_PASSWORD;
    const dbName = process.env.DB_NAME || 'u493510526_reconfpain_db';

    if (!appPassword || appPassword.trim().length < 16) {
      console.error('❌ ERROR: Se requiere SAAS_APP_USER_PASSWORD (mínimo 16 caracteres para producción).');
      process.exit(1);
    }

    const sqlScript = `
-- 1. Usuario de aplicación de producción (Solo DML: SELECT, INSERT, UPDATE, DELETE)
-- Base de datos objetivo en Hostinger: ${dbName}
CREATE USER IF NOT EXISTS 'saas_app_user'@'localhost' IDENTIFIED BY '${appPassword}';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${dbName}\`.* TO 'saas_app_user'@'localhost';

-- 2. Usuario exclusivo de migraciones (DDL: CREATE, ALTER, DROP, INDEX, REFERENCES)
CREATE USER IF NOT EXISTS 'saas_migrator'@'localhost' IDENTIFIED BY '${migPassword || '********'}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER, REFERENCES ON \`${dbName}\`.* TO 'saas_migrator'@'localhost';

FLUSH PRIVILEGES;
`;
    console.log('Sentencias SQL generadas para entorno de producción:');
    console.log(sqlScript.replace(new RegExp(appPassword, 'g'), '********'));
  }

  console.log('\n✓ Procedimiento completado con éxito (0 credenciales escritas en código).');
}

main().catch(err => {
  console.error('Error en aprovisionamiento:', err.message);
  process.exit(1);
});
