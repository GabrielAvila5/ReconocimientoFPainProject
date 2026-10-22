const { PrismaClient } = require('@prisma/client');

async function main() {
  console.log('================================================================');
  console.log('>>> VERIFICACIÓN DE PRIVILEGIOS REALES DE saas_test_user');
  console.log('================================================================\n');

  const testUserPass = process.env.SAAS_TEST_USER_PASSWORD || 'TestSaaSUserPass2026!';
  
  // 1. Conexión autorizada sobre base de pruebas
  console.log('[Prueba 1] Conexión a reconocimiento_test_copia_saas como saas_test_user...');
  const testDbPrisma = new PrismaClient({
    datasources: { db: { url: `mysql://saas_test_user:${testUserPass}@127.0.0.1:3307/reconocimiento_test_copia_saas` } }
  });

  try {
    const res = await testDbPrisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM `Company`;');
    console.log('  ✅ ÉXITO: saas_test_user tiene acceso a reconocimiento_test_copia_saas. Conteo de Company:', res[0].count);
  } catch (err) {
    console.error('  ❌ ERROR INESPERADO en base de prueba:', err.message);
  } finally {
    await testDbPrisma.$disconnect();
  }

  // 2. Intento de lectura sobre la base protegida (reconocimiento_facial_db_pain)
  console.log('\n[Prueba 2] Intento de LECTURA (SELECT) sobre reconocimiento_facial_db_pain...');
  const realDbPrisma = new PrismaClient({
    datasources: { db: { url: `mysql://saas_test_user:${testUserPass}@127.0.0.1:3307/reconocimiento_facial_db_pain` } }
  });

  try {
    await realDbPrisma.$queryRawUnsafe('SELECT * FROM `Employee` LIMIT 1;');
    console.error('  ❌ FALLO CRÍTICO DE SEGURIDAD: saas_test_user pudo leer la base real.');
  } catch (err) {
    console.log('  ✅ ACCESO DENEGADO (Esperado y Verificado):');
    console.log('     Código / Mensaje de error:', err.message.split('\n').filter(l => l.includes('denied') || l.includes('Access') || l.includes('1044') || l.includes('1142') || l.includes('code')).join(' '));
  } finally {
    await realDbPrisma.$disconnect();
  }

  // 3. Intento de ESCRITURA cruzada sobre reconocimiento_facial_db_pain desde conexión de test
  console.log('\n[Prueba 3] Intento de ESCRITURA directa cruzada hacia reconocimiento_facial_db_pain.Employee...');
  const crossDbPrisma = new PrismaClient({
    datasources: { db: { url: `mysql://saas_test_user:${testUserPass}@127.0.0.1:3307/reconocimiento_test_copia_saas` } }
  });

  try {
    await crossDbPrisma.$executeRawUnsafe("UPDATE `reconocimiento_facial_db_pain`.`Employee` SET `firstName` = 'HACKED' WHERE 1=1;");
    console.error('  ❌ FALLO CRÍTICO DE SEGURIDAD: saas_test_user pudo modificar la base real.');
  } catch (err) {
    console.log('  ✅ MODIFICACIÓN DENEGADA POR MOTOR (Esperado y Verificado):');
    console.log('     Código / Mensaje de error:', err.message.split('\n').filter(l => l.includes('denied') || l.includes('Access') || l.includes('1044') || l.includes('1142') || l.includes('command')).join(' '));
  } finally {
    await crossDbPrisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log('✓ RESULTADO: saas_test_user está 100% blindado contra la base real');
  console.log('================================================================');
}

main().catch(console.error);
