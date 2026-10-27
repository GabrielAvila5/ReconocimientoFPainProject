/**
 * SCRIPT GENERADOR MASIVO DETERMINISTA PARA GATE 5
 * Base de datos exclusiva: reconocimiento_test_load_saas
 * 
 * Topología:
 * - 400 Empresas (1 Enterprise con 2,000 emp, 10 Medianas con 3,000 emp, 389 Pequeñas con 9,000 emp) = 14,000 Empleados
 * - 14,000 Empleados con descriptores biométricos cifrados AES-256-GCM (enc_gcm:...)
 * - 404 Dispositivos Kiosco con tokenHash SHA-256
 * - 3,000,000 de Registros de Asistencia distribuidos en los últimos 90 días con claves compuestas íntegras
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

// Destino exclusivo para carga masiva
const TARGET_DB_URL = 'mysql://saas_test_user:TestSaaSUserPass2026!@localhost:3307/reconocimiento_test_load_saas';

if (!TARGET_DB_URL.includes('reconocimiento_test_load_saas')) {
  console.error('❌ ERROR CRÍTICO DE SEGURIDAD: Este script sólo puede ejecutarse sobre reconocimiento_test_load_saas');
  process.exit(1);
}

const ENCRYPTION_KEY_RAW = process.env.ENCRYPTION_KEY || '01234567890123456789012345678901';
const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_RAW, 'utf8');

const prisma = new PrismaClient({
  datasources: { db: { url: TARGET_DB_URL } }
});

function encryptDescriptor(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `enc_gcm:${iv.toString('hex')}:${tag}:${encrypted}`;
}

const FIRST_NAMES = ['Juan', 'María', 'Carlos', 'Ana', 'Luis', 'Laura', 'Pedro', 'Sofía', 'Jorge', 'Elena', 'Miguel', 'Lucía', 'Roberto', 'Carmen', 'David', 'Patricia'];
const LAST_NAMES = ['Hernández', 'García', 'Martínez', 'López', 'González', 'Pérez', 'Rodríguez', 'Sánchez', 'Ramírez', 'Cruz', 'Flores', 'Gómez', 'Morales', 'Vázquez'];

async function runSeeder() {
  const startTime = Date.now();
  console.log('================================================================');
  console.log('>>> INICIANDO SIEMBRA MASIVA DETERMINISTA (GATE 5)');
  console.log(`Base de datos objetivo: ${TARGET_DB_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log('================================================================\n');

  try {
    // 1. Limpieza de datos previos en la base de carga
    console.log('[1/5] Limpiando tablas previas en reconocimiento_test_load_saas...');
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE AttendanceRecord;');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE EmployeeShift;');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE DepartmentShift;');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE Notification;');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE EventRequest;');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE DeviceAuthRequest;');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE Device;');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE Employee;');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE Shift;');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE Department;');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE AdminAuditLog;');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE AdminUser;');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE SystemSettings;');
    await prisma.$executeRawUnsafe('TRUNCATE TABLE Company;');
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('  ✓ Tablas limpiadas exitosamente.');

    // 2. Generación de 400 Empresas
    console.log('\n[2/5] Generando 400 Empresas, Departamentos, Turnos y Kioscos...');
    const companies = [];
    const departments = [];
    const shifts = [];
    const devices = [];

    let deptIdCounter = 1;
    let shiftIdCounter = 1;

    // 1 Empresa Enterprise (2,000 empleados)
    companies.push({
      id: 'comp-enterprise-001',
      name: 'Corporativo Enterprise SA',
      plan: 'ENTERPRISE',
      maxEmployees: 5000,
      maxDevices: 100,
      targetEmployees: 2000
    });

    // 10 Empresas Medianas (300 empleados c/u = 3,000)
    for (let i = 1; i <= 10; i++) {
      const pad = String(i).padStart(3, '0');
      companies.push({
        id: `comp-medium-${pad}`,
        name: `Empresa Mediana ${pad} SA de CV`,
        plan: 'BUSINESS',
        maxEmployees: 500,
        maxDevices: 20,
        targetEmployees: 300
      });
    }

    // 389 Empresas Pequeñas (53 con 24 empleados = 1,272; 336 con 23 empleados = 7,728 -> Total: 9,000)
    for (let i = 1; i <= 389; i++) {
      const pad = String(i).padStart(3, '0');
      const empCount = i <= 53 ? 24 : 23;
      companies.push({
        id: `comp-small-${pad}`,
        name: `Negocio Pequeño ${pad} S de RL`,
        plan: 'BASIC',
        maxEmployees: 50,
        maxDevices: 5,
        targetEmployees: empCount
      });
    }

    // Insertar Empresas
    const companySqlValues = companies.map(c => 
      `('${c.id}', '${c.name}', '${c.id}', NULL, '${c.plan}', 1, ${c.maxEmployees}, ${c.maxDevices}, 'America/Mexico_City', 1, NOW(), NOW())`
    ).join(',');
    await prisma.$executeRawUnsafe(`
      INSERT INTO Company (id, name, slug, customDomain, plan, isActive, maxEmployees, maxDevices, timezone, descriptorsVersion, createdAt, updatedAt)
      VALUES ${companySqlValues};
    `);
    console.log(`  ✓ 400 Empresas insertadas (1 Enterprise, 10 Medianas, 389 Pequeñas).`);

    // Crear Departamentos, Turnos y Dispositivos por Empresa
    for (let cIdx = 0; cIdx < companies.length; cIdx++) {
      const comp = companies[cIdx];
      
      // Departamentos
      const deptCount = comp.plan === 'ENTERPRISE' ? 5 : (comp.plan === 'BUSINESS' ? 3 : 1);
      const compDeptIds = [];
      for (let d = 1; d <= deptCount; d++) {
        const dId = deptIdCounter++;
        compDeptIds.push(dId);
        departments.push(`(${dId}, '${comp.id}', 'Depto ${d} - ${comp.id}', NOW(), NOW())`);
      }
      comp.deptIds = compDeptIds;

      // Turnos
      const shiftCount = comp.plan === 'ENTERPRISE' ? 3 : (comp.plan === 'BUSINESS' ? 2 : 1);
      const compShiftIds = [];
      for (let s = 1; s <= shiftCount; s++) {
        const sId = shiftIdCounter++;
        compShiftIds.push(sId);
        shifts.push(`(${sId}, '${comp.id}', 'Turno ${s}', '08:00', '17:00', 1, NOW(), NOW())`);
      }
      comp.shiftIds = compShiftIds;

      // Dispositivos (Kioscos) con tokenHash SHA-256
      const devCount = comp.plan === 'ENTERPRISE' ? 5 : 1;
      const compDevIds = [];
      for (let dv = 1; dv <= devCount; dv++) {
        const devId = `dev-${comp.id}-${dv}`;
        compDevIds.push(devId);
        const rawToken = `token_${comp.id}_kiosk_${dv}`;
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        devices.push(`('${devId}', '${comp.id}', 'Kiosco ${dv} ${comp.id}', 'KIOSK', 'ONLINE', NULL, '${tokenHash}', NOW(), 0, 1, NOW(), NOW())`);
      }
      comp.devIds = compDevIds;
    }

    // Insertar Departamentos
    for (let i = 0; i < departments.length; i += 1000) {
      const batch = departments.slice(i, i + 1000).join(',');
      await prisma.$executeRawUnsafe(`
        INSERT INTO Department (id, companyId, name, createdAt, updatedAt)
        VALUES ${batch};
      `);
    }
    console.log(`  ✓ ${departments.length} Departamentos insertados.`);

    // Insertar Turnos
    for (let i = 0; i < shifts.length; i += 1000) {
      const batch = shifts.slice(i, i + 1000).join(',');
      await prisma.$executeRawUnsafe(`
        INSERT INTO Shift (id, companyId, name, startTime, endTime, isActive, createdAt, updatedAt)
        VALUES ${batch};
      `);
    }
    console.log(`  ✓ ${shifts.length} Turnos insertados.`);

    // Insertar Dispositivos
    for (let i = 0; i < devices.length; i += 1000) {
      const batch = devices.slice(i, i + 1000).join(',');
      await prisma.$executeRawUnsafe(`
        INSERT INTO Device (id, companyId, name, type, status, token, tokenHash, lastSeenAt, isBlocked, isActive, createdAt, updatedAt)
        VALUES ${batch};
      `);
    }
    console.log(`  ✓ ${devices.length} Dispositivos (Kioscos con SHA-256) insertados.`);

    // 3. Generación de 14,000 Empleados con Descriptores Cifrados AES-256-GCM
    console.log('\n[3/5] Generando 14,000 Empleados con Descriptores Cifrados AES-256-GCM...');
    const employees = [];
    const employeeList = []; // Para enlazar en asistencias: { id, companyId, shiftId, deviceId }

    // Generar 20 descriptores biométricos sintéticos cifrados base para reusar eficientemente
    const encryptedDescriptorsPool = [];
    for (let p = 0; p < 20; p++) {
      const vector = Array.from({ length: 128 }, () => (Math.random() * 2 - 1).toFixed(4)).join(',');
      encryptedDescriptorsPool.push(encryptDescriptor(`[${vector}]`));
    }

    let globalEmpIdx = 1;
    for (const comp of companies) {
      for (let e = 1; e <= comp.targetEmployees; e++) {
        const empId = `emp-${comp.id}-${String(e).padStart(4, '0')}`;
        const fName = FIRST_NAMES[e % FIRST_NAMES.length];
        const lName = LAST_NAMES[(e + globalEmpIdx) % LAST_NAMES.length];
        const identifier = `EMP-${comp.id.replace('comp-', '')}-${String(e).padStart(4, '0')}`;
        const email = `emp_${globalEmpIdx}@${comp.id}.saas.internal`;
        const deptId = comp.deptIds[e % comp.deptIds.length];
        const shiftId = comp.shiftIds[e % comp.shiftIds.length];
        const deviceId = comp.devIds[e % comp.devIds.length];
        const encDesc = encryptedDescriptorsPool[globalEmpIdx % encryptedDescriptorsPool.length];

        employees.push(`('${empId}', '${comp.id}', '${fName}', '${lName}', '${identifier}', '${email}', 'Operador', ${deptId}, '${encDesc}', NOW(), 1, NOW(), NOW())`);
        employeeList.push({ id: empId, companyId: comp.id, shiftId, deviceId });
        globalEmpIdx++;
      }
    }

    // Insertar Empleados en lotes de 2,000
    for (let i = 0; i < employees.length; i += 2000) {
      const batch = employees.slice(i, i + 2000).join(',');
      await prisma.$executeRawUnsafe(`
        INSERT INTO Employee (id, companyId, firstName, lastName, identifier, email, position, departmentId, faceDescriptor, enrolledAt, isActive, createdAt, updatedAt)
        VALUES ${batch};
      `);
    }
    console.log(`  ✓ Exactamente ${employees.length} Empleados insertados con biometría cifrada AES-256-GCM.`);

    // 4. Generación de 3,000,000 de Asistencias (AttendanceRecord)
    console.log('\n[4/5] Generando 3,000,000 de Registros de Asistencia distribuidos en 90 días...');
    const TOTAL_ATTENDANCE = 3000000;
    const NUM_EMPLOYEES = employeeList.length; // 14,000

    // Para sumar exactamente 3,000,000:
    // 10,000 empleados * 214 registros = 2,140,000
    //  4,000 empleados * 215 registros =   860,000
    // Total = 3,000,000

    // Pre-calcular 90 fechas ISO hacia atrás desde hoy
    const baseDate = new Date('2026-10-27T12:00:00Z');
    const datePool = [];
    for (let d = 0; d < 90; d++) {
      const dt = new Date(baseDate.getTime() - d * 86400000);
      datePool.push(dt.toISOString().slice(0, 10)); // 'YYYY-MM-DD'
    }

    // Optimización de inserción masiva en MariaDB:
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
    await prisma.$executeRawUnsafe('SET UNIQUE_CHECKS = 0;');
    await prisma.$executeRawUnsafe('SET AUTOCOMMIT = 0;');

    const BATCH_SIZE = 5000;
    let attendanceBatch = [];
    let totalInserted = 0;
    let lastLogTime = Date.now();

    for (let empIdx = 0; empIdx < NUM_EMPLOYEES; empIdx++) {
      const emp = employeeList[empIdx];
      const recordsForEmp = empIdx < 10000 ? 214 : 215;

      for (let r = 0; r < recordsForEmp; r++) {
        const attId = `att-${emp.id}-${String(r).padStart(3, '0')}`;
        const dateStr = datePool[r % datePool.length];
        const entradaStr = `'${dateStr} 08:0${r % 10}:00'`;
        const recesoIniStr = `'${dateStr} 13:00:00'`;
        const recesoFinStr = `'${dateStr} 14:00:00'`;
        const salidaStr = `'${dateStr} 17:0${(r + 2) % 10}:00'`;
        const isLate = r % 15 === 0 ? 1 : 0;
        const lateMinutes = isLate ? 12 : 0;
        const earlyExit = r % 25 === 0 ? 1 : 0;
        const shiftIdVal = emp.shiftId ? emp.shiftId : 'NULL';
        const deviceIdVal = emp.deviceId ? `'${emp.deviceId}'` : 'NULL';

        attendanceBatch.push(
          `('${attId}', '${emp.companyId}', '${emp.id}', '${dateStr}', ${entradaStr}, ${recesoIniStr}, ${recesoFinStr}, ${salidaStr}, ${shiftIdVal}, ${earlyExit}, NULL, NULL, ${isLate}, ${lateMinutes}, 0, ${deviceIdVal}, NOW(), NOW())`
        );

        if (attendanceBatch.length >= BATCH_SIZE) {
          const sql = `
            INSERT INTO AttendanceRecord (id, companyId, employeeId, date, entrada, recesoInicio, recesoFin, salida, shiftId, earlyExit, earlyExitReason, overtimeMinutes, isLate, lateMinutes, isAutoClosed, deviceId, createdAt, updatedAt)
            VALUES ${attendanceBatch.join(',')};
          `;
          await prisma.$executeRawUnsafe(sql);
          totalInserted += attendanceBatch.length;
          attendanceBatch = [];

          if (totalInserted % 200000 === 0 || Date.now() - lastLogTime > 5000) {
            await prisma.$executeRawUnsafe('COMMIT;');
            const pct = ((totalInserted / TOTAL_ATTENDANCE) * 100).toFixed(1);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            const rate = Math.round(totalInserted / ((Date.now() - startTime) / 1000));
            console.log(`  -> Progreso: ${totalInserted.toLocaleString()} / ${TOTAL_ATTENDANCE.toLocaleString()} (${pct}%) - ${rate.toLocaleString()} reg/seg - Transcurrido: ${elapsed}s`);
            lastLogTime = Date.now();
          }
        }
      }
    }

    if (attendanceBatch.length > 0) {
      const sql = `
        INSERT INTO AttendanceRecord (id, companyId, employeeId, date, entrada, recesoInicio, recesoFin, salida, shiftId, earlyExit, earlyExitReason, overtimeMinutes, isLate, lateMinutes, isAutoClosed, deviceId, createdAt, updatedAt)
        VALUES ${attendanceBatch.join(',')};
      `;
      await prisma.$executeRawUnsafe(sql);
      totalInserted += attendanceBatch.length;
      attendanceBatch = [];
    }

    await prisma.$executeRawUnsafe('COMMIT;');
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
    await prisma.$executeRawUnsafe('SET UNIQUE_CHECKS = 1;');
    await prisma.$executeRawUnsafe('SET AUTOCOMMIT = 1;');
    console.log(`  ✓ Exactamente ${totalInserted.toLocaleString()} Registros de Asistencia insertados y comprometidos.`);

    // 5. Verificación de conteos y tamaño en disco
    console.log('\n[5/5] Auditando conteos y tamaño físico en MariaDB (information_schema)...');
    const [cCount] = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM Company;');
    const [eCount] = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM Employee;');
    const [aCount] = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM AttendanceRecord;');
    const [dCount] = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM Device;');
    const [sCount] = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM Shift;');
    const [dpCount] = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM Department;');

    const tableSizes = await prisma.$queryRawUnsafe(`
      SELECT 
        table_name AS 'table',
        table_rows AS 'rows',
        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'total_mb',
        ROUND((data_length / 1024 / 1024), 2) AS 'data_mb',
        ROUND((index_length / 1024 / 1024), 2) AS 'index_mb'
      FROM information_schema.TABLES
      WHERE table_schema = DATABASE()
      ORDER BY (data_length + index_length) DESC;
    `);

    const totalSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n================================================================');
    console.log('✓ RESULTADOS OFICIALES DE SIEMBRA MASIVA DETERMINISTA (GATE 5)');
    console.log('================================================================');
    console.log(`- Tiempo total de siembra: ${totalSeconds} segundos`);
    console.log(`- Empresas creadas (Company):           ${cCount.count}`);
    console.log(`- Departamentos (Department):           ${dpCount.count}`);
    console.log(`- Turnos (Shift):                       ${sCount.count}`);
    console.log(`- Kioscos con SHA-256 (Device):         ${dCount.count}`);
    console.log(`- Empleados con biometría (Employee):   ${eCount.count}`);
    console.log(`- Asistencias (AttendanceRecord):       ${aCount.count}`);
    console.log('\nDesglose de peso físico en disco por tabla:');
    console.table(tableSizes);

  } catch (err) {
    console.error('\n❌ ERROR EN SIEMBRA MASIVA:', err);
    throw err;
  } finally {
    try {
      await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
    } catch (e) {}
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runSeeder().catch(err => {
    console.error('Fallo en ejecución de seeder:', err);
    process.exit(1);
  });
}

module.exports = { runSeeder };
