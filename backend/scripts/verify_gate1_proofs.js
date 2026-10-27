/**
 * SCRIPT DE DEMOSTRACIÓN Y PRUEBAS REALES: GATE 1 (FASE 1)
 * Ejecuta y documenta con salida en vivo cada uno de los puntos requeridos.
 */

const { PrismaClient } = require('@prisma/client');

const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!testDbUrl) {
  throw new Error('DATABASE_URL o TEST_DATABASE_URL requerida para ejecutar pruebas.');
}
const prisma = new PrismaClient({
  datasources: { db: { url: testDbUrl } }
});

async function runProofs() {
  console.log('================================================================');
  console.log('  EJECUTANDO PRUEBAS DE CERTIFICACIÓN FORMAL PARA GATE 1        ');
  console.log('================================================================');

  try {
    // -----------------------------------------------------------------
    // PUNTO 1: SHOW CREATE TABLE DE LAS 8 TABLAS PRINCIPALES
    // -----------------------------------------------------------------
    console.log('\n>>> [PUNTO 1] SHOW CREATE TABLE de las 8 tablas requeridas:\n');
    const tables = [
      'Employee', 'AttendanceRecord', 'Shift', 'Department',
      'DepartmentShift', 'EmployeeShift', 'EventRequest', 'Device'
    ];

    for (const tbl of tables) {
      const res = await prisma.$queryRawUnsafe(`SHOW CREATE TABLE \`${tbl}\`;`);
      const createSql = res[0]['Create Table'];
      console.log(`----------------------------------------------------------------`);
      console.log(`TABLA: ${tbl}`);
      console.log(`----------------------------------------------------------------`);
      console.log(createSql);
      console.log('\n');
    }

    // -----------------------------------------------------------------
    // PUNTO 2: PRUEBA DE RECHAZO DE INTEGRIDAD (ERROR 1452)
    // -----------------------------------------------------------------
    console.log('\n================================================================');
    console.log('>>> [PUNTO 2] PRUEBA DE RECHAZO: ERROR 1452 DE MARIADB');
    console.log('================================================================\n');

    const alphaCompanyId = 'default-company-pain';
    const betaCompanyId = 'company-beta-test-saas';

    // Asegurar que Empresa Beta existe
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`Company\` (\`id\`, \`name\`, \`slug\`, \`plan\`)
      VALUES ('${betaCompanyId}', 'Empresa Beta Corp', 'beta-corp', 'STARTER')
      ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`);
    `);

    // 1. Crear Departamento en Empresa Beta
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`Department\` (\`id\`, \`companyId\`, \`name\`, \`updatedAt\`)
      VALUES (999, '${betaCompanyId}', 'Depto Exclusivo Beta', NOW(3))
      ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`);
    `);
    console.log(' [SETUP] Depto ID 999 creado en Empresa Beta.');

    // 2. Obtener un empleado de Empresa Alpha (PAIN)
    const alphaEmployees = await prisma.$queryRawUnsafe(`
      SELECT \`id\`, \`identifier\` FROM \`Employee\` WHERE \`companyId\` = '${alphaCompanyId}' LIMIT 1;
    `);
    const alphaEmpId = alphaEmployees[0].id;
    console.log(` [SETUP] Empleado ID '${alphaEmpId}' pertenece a Empresa Alpha.`);

    // 3. INTENTO 1: Asignar Depto de Beta (999) al Empleado de Alpha
    console.log('\n* Test 2.1: Intentando asignar Departamento de Beta a Empleado de Alpha...');
    let test1Passed = false;
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE \`Employee\` 
        SET \`departmentId\` = 999 
        WHERE \`id\` = '${alphaEmpId}' AND \`companyId\` = '${alphaCompanyId}';
      `);
    } catch (err) {
      test1Passed = true;
      console.log(' [ÉXITO RECHAZADO POR MARIADB]:');
      console.log(' Código de error:', err.meta?.code || err.code);
      console.log(' Mensaje:', err.meta?.message || err.message.split('\n')[0]);
    }
    if (!test1Passed) throw new Error('FALLO: MariaDB permitió asignar un departamento ajeno a otra empresa.');

    // 4. INTENTO 2: Intentar registrar checada en AttendanceRecord mezclando Alpha y Beta
    console.log('\n* Test 2.2: Intentando registrar checada mezclando Employee de Alpha con companyId de Beta...');
    let test2Passed = false;
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO \`AttendanceRecord\` 
          (\`id\`, \`companyId\`, \`employeeId\`, \`date\`, \`updatedAt\`)
        VALUES 
          (UUID(), '${betaCompanyId}', '${alphaEmpId}', CURDATE(), NOW(3));
      `);
    } catch (err) {
      test2Passed = true;
      console.log(' [ÉXITO RECHAZADO POR MARIADB]:');
      console.log(' Código de error:', err.meta?.code || err.code);
      console.log(' Mensaje:', err.meta?.message || err.message.split('\n')[0]);
    }
    if (!test2Passed) throw new Error('FALLO: MariaDB permitió registrar asistencia con empleado de otra empresa.');

    // -----------------------------------------------------------------
    // PUNTO 3: PRUEBA DE COMPORTAMIENTO ONDELETE RESTRICT
    // -----------------------------------------------------------------
    console.log('\n================================================================');
    console.log('>>> [PUNTO 3] COMPORTAMIENTO DE ONDELETE RESTRICT AL BORRAR DEPTO');
    console.log('================================================================\n');

    // 1. Crear un depto temporal en Alpha
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`Department\` (\`id\`, \`companyId\`, \`name\`, \`updatedAt\`)
      VALUES (888, '${alphaCompanyId}', 'Depto Temporal Restrict', NOW(3))
      ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`);
    `);
    // Asignar el empleado a este depto
    await prisma.$executeRawUnsafe(`
      UPDATE \`Employee\` SET \`departmentId\` = 888 WHERE \`id\` = '${alphaEmpId}';
    `);
    console.log(' [SETUP] Depto 888 creado en Alpha y asignado a empleado.');

    // 2. Intentar borrar el departamento mientras tiene empleado asignado
    console.log('\n* Test 3.1: Intentando borrar Depto 888 con empleado asignado (debe ser bloqueado por RESTRICT)...');
    let deleteBlocked = false;
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM \`Department\` WHERE \`id\` = 888;`);
    } catch (err) {
      deleteBlocked = true;
      console.log(' [ÉXITO BLOQUEADO POR RESTRICT]:');
      console.log(' Mensaje:', err.meta?.message || err.message.split('\n')[0]);
    }
    if (!deleteBlocked) throw new Error('FALLO: Se permitió borrar un departamento que tenía empleados asignados.');

    // 3. Desasignar al empleado y luego borrar exitosamente
    console.log('\n* Test 3.2: Desasignando empleado (departmentId = NULL) y reintentando borrado...');
    await prisma.$executeRawUnsafe(`UPDATE \`Employee\` SET \`departmentId\` = NULL WHERE \`id\` = '${alphaEmpId}';`);
    const deletedDept = await prisma.$executeRawUnsafe(`DELETE FROM \`Department\` WHERE \`id\` = 888;`);
    console.log(` [ÉXITO]: Depto 888 borrado limpiamente (${deletedDept} filas eliminadas).`);

    // -----------------------------------------------------------------
    // PUNTO 8: COMPORTAMIENTO DE PRISMA EN UPDATE CON CLAVES COMPUESTAS
    // -----------------------------------------------------------------
    console.log('\n================================================================');
    console.log('>>> [PUNTO 8] DEMOSTRACIÓN DE PRISMA CLIENT CON CLAVE COMPUESTA');
    console.log('================================================================\n');

    // Demostrar cómo prisma.employee.update usa la clave compuesta id_companyId
    const updatedEmployee = await prisma.employee.update({
      where: {
        id_companyId: {
          id: alphaEmpId,
          companyId: alphaCompanyId
        }
      },
      data: {
        position: 'Demostración Gate 1 Certificada'
      },
      select: {
        id: true,
        firstName: true,
        companyId: true,
        position: true
      }
    });
    console.log(' [ÉXITO]: prisma.employee.update ejecutado con clave compuesta id_companyId:');
    console.log(updatedEmployee);

    console.log('\n================================================================');
    console.log('  TODAS LAS PRUEBAS DE GATE 1 EJECUTADAS Y CERTIFICADAS         ');
    console.log('================================================================');

  } catch (err) {
    console.error('\n❌ ERROR EN PRUEBAS:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runProofs();
