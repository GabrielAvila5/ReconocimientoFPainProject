const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

function runImportRestrictionCheck() {
  console.log('================================================================');
  console.log('>>> VERIFICACIÓN DE RESTRICCIÓN DE IMPORTACIONES (REGLA A2)');
  console.log('================================================================\n');

  const srcDir = path.join(__dirname, '../../src');
  const files = getAllFiles(srcDir);
  console.log(`Analizando ${files.length} archivos en backend/src/ (recursivo: modules, jobs, middlewares, utils, config, etc.)...\n`);

  const violations = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const relativePath = path.relative(path.join(__dirname, '../../'), file).replace(/\\/g, '/');

    // EXCEPCIONES PERMITIDAS:
    // - src/utils/prisma.js: Núcleo del cliente Prisma extendido multi-tenant
    // - src/utils/prismaAdmin.js: Cliente Prisma crudo global (solo para pre-auth)
    const isPrismaUtil = relativePath === 'src/utils/prisma.js';
    const isPrismaAdminUtil = relativePath === 'src/utils/prismaAdmin.js';
    const isAuthHelpersUtil = relativePath === 'src/utils/authHelpers.js';

    // 1. Prohibir importación o instanciación de @prisma/client / new PrismaClient
    // Exceptuando únicamente src/utils/prisma.js y src/utils/prismaAdmin.js
    if (!isPrismaUtil && !isPrismaAdminUtil) {
      if (content.includes('@prisma/client') || content.includes('new PrismaClient')) {
        violations.push({
          file: relativePath,
          rule: 'REGLA_A2_PRISMA_CLIENT',
          error: 'Importación o instanciación no autorizada de @prisma/client o new PrismaClient'
        });
      }
    }

    // 2. Prohibir importación de prismaAdmin en src/modules/, src/middlewares/ o src/jobs/
    // Solo permitido estrictamente en src/utils/authHelpers.js (y la propia definición en prismaAdmin.js)
    if (!isPrismaAdminUtil && !isAuthHelpersUtil) {
      if (content.includes('prismaAdmin') || content.includes('prismaAdmin.js')) {
        violations.push({
          file: relativePath,
          rule: 'REGLA_A2_PRISMA_ADMIN',
          error: 'Importación prohibida de prismaAdmin fuera de authHelpers.js'
        });
      }
    }

    // 3. Prohibir llamadas directas a raw ($queryRaw, $executeRaw, etc.) o acceso a .$base
    // En prisma.js se definen los lanzadores de error de $queryRaw/$executeRaw, por lo que se exceptúa
    if (!isPrismaUtil) {
      if (content.includes('.$base')) {
        violations.push({
          file: relativePath,
          rule: 'REGLA_A2_BASE_ACCESS',
          error: 'Acceso prohibido a prisma.$base en código de aplicación'
        });
      }
      if (
        content.includes('$queryRaw') ||
        content.includes('$queryRawUnsafe') ||
        content.includes('$executeRaw') ||
        content.includes('$executeRawUnsafe')
      ) {
        violations.push({
          file: relativePath,
          rule: 'REGLA_A2_RAW_QUERY',
          error: 'Llamada directa a consulta SQL raw ($queryRaw / $executeRaw) prohibida'
        });
      }
    }
  }

  console.log(`Archivos escaneados: ${files.length}`);
  console.log('Subdirectorios cubiertos:');
  const subdirs = [...new Set(files.map(f => path.dirname(path.relative(srcDir, f)).split(path.sep)[0]))].filter(Boolean);
  subdirs.forEach(sd => console.log(`  - src/${sd}/`));
  console.log('');

  if (violations.length > 0) {
    console.error(`❌ SE DETECTARON ${violations.length} VIOLACIONES DE AISLAMIENTO:`);
    console.table(violations);
    throw new Error(`Se encontraron ${violations.length} violaciones de la Regla A2 en backend/src/.`);
  }

  console.log('✅ REGLA A2 CUMPLIDA AL 100%:');
  console.log('   - 0 instancias de @prisma/client o new PrismaClient fuera de prisma.js y prismaAdmin.js');
  console.log('   - 0 importaciones de prismaAdmin en src/modules/, src/middlewares/ o src/jobs/');
  console.log('   - 0 accesos a .$base');
  console.log('   - 0 llamadas directas a $queryRaw, $queryRawUnsafe, $executeRaw o $executeRawUnsafe');
  console.log('   - prismaAdmin restringido exclusivamente a src/utils/authHelpers.js con justificación estricta de pre-auth');
  console.log('================================================================\n');
}

runImportRestrictionCheck();
