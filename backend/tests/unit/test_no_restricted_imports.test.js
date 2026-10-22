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

  const modulesDir = path.join(__dirname, '../../src/modules');
  const files = getAllFiles(modulesDir);
  console.log(`Analizando ${files.length} archivos en src/modules/...`);

  const violations = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const relativePath = path.relative(path.join(__dirname, '../../'), file);

    // 1. Prohibir importación de prismaAdmin en src/modules
    if (content.includes('prismaAdmin') || content.includes('prismaAdmin.js')) {
      violations.push({ file: relativePath, error: 'Importación prohibida de prismaAdmin en módulo de aplicación' });
    }

    // 2. Prohibir acceso a $base en runtime
    if (content.includes('.$base')) {
      violations.push({ file: relativePath, error: 'Uso prohibido de prisma.$base en módulo de aplicación' });
    }

    // 3. Prohibir llamadas directas a raw en módulos
    if (content.includes('$queryRaw') || content.includes('$executeRaw')) {
      violations.push({ file: relativePath, error: 'Llamada directa a consulta raw en módulo de aplicación' });
    }
  }

  if (violations.length > 0) {
    console.error('❌ SE DETECTARON VIOLACIONES DE AISLAMIENTO:');
    console.table(violations);
    throw new Error(`Se encontraron ${violations.length} violaciones de importación restringida en src/modules.`);
  }

  console.log('✅ REGLA A2 CUMPLIDA: 0 importaciones de prismaAdmin, 0 accesos a $base y 0 llamadas raw en src/modules/');
  console.log('================================================================\n');
}

runImportRestrictionCheck();
