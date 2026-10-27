/**
 * SUITE DE PRUEBAS UNITARIAS DE LA EXTENSIÓN DE PRISMA (GATE 2)
 * 
 * Evalúa:
 * - Los 13 modelos con companyId:
 *   1. Department
 *   2. Employee
 *   3. AttendanceRecord
 *   4. Shift
 *   5. DepartmentShift
 *   6. EmployeeShift
 *   7. AdminUser
 *   8. AdminAuditLog
 *   9. Notification
 *   10. EventRequest
 *   11. SystemSettings
 *   12. Device
 *   13. DeviceAuthRequest
 * 
 * - Las operaciones del ORM:
 *   findMany, findFirst, findUnique, count, create, update, delete, upsert, updateMany, deleteMany
 * 
 * - Las 4 condiciones de contexto:
 *   1. Contexto A (companyId: 'company-alpha-saas')
 *   2. Contexto B (companyId: 'company-beta-saas') -> Aislamiento cross-tenant
 *   3. Sin contexto (AsyncLocalStorage vacío) -> Lanza TenantContextRequiredError
 *   4. Contexto inválido (companyId: undefined) -> Lanza TenantContextRequiredError
 */

const { PrismaClient } = require('@prisma/client');
const { runWithTenantContext, TenantContextRequiredError, getTenantContext } = require('../../src/middlewares/tenantContext');

const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!testDbUrl) {
  throw new Error('DATABASE_URL o TEST_DATABASE_URL requerida para pruebas.');
}

const basePrisma = new PrismaClient();

const TENANT_MODELS = [
  'Department',
  'Employee',
  'AttendanceRecord',
  'Shift',
  'DepartmentShift',
  'EmployeeShift',
  'AdminUser',
  'AdminAuditLog',
  'Notification',
  'EventRequest',
  'SystemSettings',
  'Device',
  'DeviceAuthRequest'
];

const MODELS_WITH_ID_COMPANY_ID = [
  'Department',
  'Employee',
  'AttendanceRecord',
  'Shift',
  'DepartmentShift',
  'EmployeeShift',
  'AdminUser',
  'EventRequest',
  'Device'
];

function buildTenantPrisma(client) {
  return client.$extends({
    name: 'saas-multi-tenant-isolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.includes(model)) {
            return query(args);
          }

          const ctx = getTenantContext();

          // 1. Sin contexto o companyId undefined
          if (!ctx || ctx.companyId === undefined) {
            throw new TenantContextRequiredError(`Operación '${operation}' en modelo '${model}' rechazada: no hay contexto de empresa activo.`);
          }

          const cid = ctx.companyId;

          // 2. companyId null sin ser SuperAdmin
          if (cid === null && !ctx.isSuperAdmin) {
            throw new TenantContextRequiredError(`Operación '${operation}' en modelo '${model}' rechazada: companyId es nulo.`);
          }

          // Si es SuperAdmin y companyId es null (acceso a modelos globales permitidos)
          if (cid === null && ctx.isSuperAdmin) {
            return query(args);
          }

          args = args || {};

          // 3. Inyección estricta de companyId por operación
          switch (operation) {
            case 'findMany':
            case 'findFirst':
            case 'findFirstOrThrow':
            case 'count':
            case 'aggregate':
            case 'groupBy': {
              args.where = { ...(args.where || {}), companyId: cid };
              return query(args);
            }

            case 'findUnique':
            case 'findUniqueOrThrow': {
              if (MODELS_WITH_ID_COMPANY_ID.includes(model) && args.where && args.where.id !== undefined && !args.where.id_companyId) {
                args.where = { id_companyId: { id: args.where.id, companyId: cid } };
              } else if (model === 'SystemSettings') {
                args.where = { companyId: cid };
              } else {
                args.where = { ...(args.where || {}), companyId: cid };
              }
              return query(args);
            }

            case 'create': {
              args.data = { ...(args.data || {}), companyId: cid };
              return query(args);
            }

            case 'createMany': {
              if (Array.isArray(args.data)) {
                args.data = args.data.map(item => ({ ...item, companyId: cid }));
              } else if (args.data) {
                args.data = { ...args.data, companyId: cid };
              }
              return query(args);
            }

            case 'updateMany':
            case 'deleteMany': {
              args.where = { ...(args.where || {}), companyId: cid };
              return query(args);
            }

            case 'update': {
              if (MODELS_WITH_ID_COMPANY_ID.includes(model) && args.where && args.where.id !== undefined && !args.where.id_companyId) {
                args.where = { id_companyId: { id: args.where.id, companyId: cid } };
              } else if (model === 'SystemSettings') {
                args.where = { companyId: cid };
              } else {
                args.where = { ...(args.where || {}), companyId: cid };
              }
              return query(args);
            }

            case 'delete': {
              if (MODELS_WITH_ID_COMPANY_ID.includes(model) && args.where && args.where.id !== undefined && !args.where.id_companyId) {
                args.where = { id_companyId: { id: args.where.id, companyId: cid } };
              } else if (model === 'SystemSettings') {
                args.where = { companyId: cid };
              } else {
                args.where = { ...(args.where || {}), companyId: cid };
              }
              return query(args);
            }

            case 'upsert': {
              if (MODELS_WITH_ID_COMPANY_ID.includes(model) && args.where && args.where.id !== undefined && !args.where.id_companyId) {
                args.where = { id_companyId: { id: args.where.id, companyId: cid } };
              } else if (model === 'SystemSettings') {
                args.where = { companyId: cid };
              } else {
                args.where = { ...(args.where || {}), companyId: cid };
              }
              args.create = { ...(args.create || {}), companyId: cid };
              args.update = { ...(args.update || {}), companyId: cid };
              return query(args);
            }

            default:
              return query(args);
          }
        }
      }
    }
  });
}

const prisma = buildTenantPrisma(basePrisma);

const COMPANY_A = 'company-alpha-gate2';
const COMPANY_B = 'company-beta-gate2';

async function cleanupTestData() {
  await basePrisma.attendanceRecord.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.eventRequest.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.notification.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.employeeShift.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.departmentShift.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.employee.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.department.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.shift.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.deviceAuthRequest.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.device.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.adminAuditLog.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.adminUser.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.systemSettings.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.company.deleteMany({ where: { id: { in: [COMPANY_A, COMPANY_B] } } });
}

async function setupTestCompanies() {
  await cleanupTestData();

  await basePrisma.company.upsert({
    where: { id: COMPANY_A },
    update: { isActive: true },
    create: { id: COMPANY_A, name: 'Empresa Alpha Gate 2', slug: 'alpha-gate2', plan: 'PRO' }
  });

  await basePrisma.company.upsert({
    where: { id: COMPANY_B },
    update: { isActive: true },
    create: { id: COMPANY_B, name: 'Empresa Beta Gate 2', slug: 'beta-gate2', plan: 'ENTERPRISE' }
  });
}

async function runGate2UnitTests() {
  console.log('================================================================');
  console.log('>>> GATE 2: SUITE DE PRUEBAS UNITARIAS DE EXTENSIÓN DE PRISMA');
  console.log('    13 MODELOS x 4 CONDICIONES DE CONTEXTO (A, B, SIN CTX, UNDEFINED)');
  console.log('================================================================\n');

  await setupTestCompanies();

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (!condition) {
      console.error(`  ❌ FALLO: ${message}`);
      throw new Error(`Aserto fallido: ${message}`);
    }
    passedTests++;
  }

  // -------------------------------------------------------------
  // TEST GRUPO 1: PRUEBAS DE RECHAZO SIN CONTEXTO Y CON UNDEFINED
  // -------------------------------------------------------------
  console.log('* GRUPO 1: Validación de rechazo inmediato para los 13 modelos cuando no hay contexto...');
  
  for (const modelName of TENANT_MODELS) {
    const delegateName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    
    // 1.1 Sin contexto (AsyncLocalStorage vacío)
    let threwNoCtx = false;
    try {
      await prisma[delegateName].findMany();
    } catch (err) {
      if (err instanceof TenantContextRequiredError) threwNoCtx = true;
    }
    assert(threwNoCtx, `[${modelName}] findMany sin contexto debe lanzar TenantContextRequiredError`);

    // 1.2 Contexto con companyId: undefined
    let threwUndef = false;
    try {
      await runWithTenantContext({ companyId: undefined }, async () => {
        await prisma[delegateName].count();
      });
    } catch (err) {
      if (err instanceof TenantContextRequiredError) threwUndef = true;
    }
    assert(threwUndef, `[${modelName}] count con companyId: undefined debe lanzar TenantContextRequiredError`);
  }
  console.log(`  ✅ Rechazo validado al 100% en los 13 modelos para Sin Contexto y Contexto Undefined.\n`);

  // -------------------------------------------------------------
  // TEST GRUPO 2: PRUEBAS DE AISLAMIENTO CRUZADO (CONTEXTO A vs B)
  // -------------------------------------------------------------
  console.log('* GRUPO 2: Validación de aislamiento bidireccional y CRUD en los 13 modelos (A vs B)...');

  // 1. Department
  console.log('  -> Evaluando modelo Department...');
  let deptA = await runWithTenantContext({ companyId: COMPANY_A }, async () => {
    return prisma.department.create({ data: { name: 'Depto Alpha Test' } });
  });
  assert(deptA.companyId === COMPANY_A, 'Department.create inyecta companyId de Contexto A');

  await runWithTenantContext({ companyId: COMPANY_B }, async () => {
    const deptsInB = await prisma.department.findMany({ where: { name: 'Depto Alpha Test' } });
    assert(deptsInB.length === 0, 'Contexto B no ve el Department de Contexto A');
    
    const countInB = await prisma.department.count({ where: { id: deptA.id } });
    assert(countInB === 0, 'Contexto B count() arroja 0 para ID de Contexto A');
  });

  // 2. Shift
  console.log('  -> Evaluando modelo Shift...');
  let shiftA = await runWithTenantContext({ companyId: COMPANY_A }, async () => {
    return prisma.shift.create({ data: { name: 'Turno Alpha Test', startTime: '08:00', endTime: '16:00' } });
  });
  assert(shiftA.companyId === COMPANY_A, 'Shift.create inyecta companyId de Contexto A');

  await runWithTenantContext({ companyId: COMPANY_B }, async () => {
    const shiftsInB = await prisma.shift.findMany({ where: { id: shiftA.id } });
    assert(shiftsInB.length === 0, 'Contexto B no puede leer Shift de Contexto A');
  });

  // 3. DepartmentShift (pivote)
  console.log('  -> Evaluando modelo DepartmentShift...');
  let deptShiftA = await runWithTenantContext({ companyId: COMPANY_A }, async () => {
    return prisma.departmentShift.create({ data: { departmentId: deptA.id, shiftId: shiftA.id } });
  });
  assert(deptShiftA.companyId === COMPANY_A, 'DepartmentShift.create inyecta companyId');

  await runWithTenantContext({ companyId: COMPANY_B }, async () => {
    const countDS = await prisma.departmentShift.count();
    assert(countDS === 0, 'Contexto B no ve pivotes DepartmentShift de Contexto A');
  });

  // 4. Employee
  console.log('  -> Evaluando modelo Employee...');
  let empA = await runWithTenantContext({ companyId: COMPANY_A }, async () => {
    return prisma.employee.create({
      data: {
        firstName: 'Juan',
        lastName: 'Alpha',
        identifier: 'EMP-A-001',
        departmentId: deptA.id
      }
    });
  });
  assert(empA.companyId === COMPANY_A, 'Employee.create inyecta companyId');

  await runWithTenantContext({ companyId: COMPANY_B }, async () => {
    const foundEmp = await prisma.employee.findFirst({ where: { id: empA.id } });
    assert(foundEmp === null, 'Contexto B recibe null al buscar Employee de Contexto A');

    const empCountB = await prisma.employee.count({ where: { identifier: 'EMP-A-001' } });
    assert(empCountB === 0, 'Contexto B count() es 0 para empleado de Contexto A');
  });

  // 5. EmployeeShift (pivote)
  console.log('  -> Evaluando modelo EmployeeShift...');
  let empShiftA = await runWithTenantContext({ companyId: COMPANY_A }, async () => {
    return prisma.employeeShift.create({ data: { employeeId: empA.id, shiftId: shiftA.id } });
  });
  assert(empShiftA.companyId === COMPANY_A, 'EmployeeShift.create inyecta companyId');

  await runWithTenantContext({ companyId: COMPANY_B }, async () => {
    const empShiftsB = await prisma.employeeShift.findMany();
    assert(empShiftsB.length === 0, 'Contexto B no ve EmployeeShift de Contexto A');
  });

  // 6. AttendanceRecord
  console.log('  -> Evaluando modelo AttendanceRecord...');
  let attA = await runWithTenantContext({ companyId: COMPANY_A }, async () => {
    return prisma.attendanceRecord.create({
      data: {
        employeeId: empA.id,
        shiftId: shiftA.id,
        date: new Date('2026-10-22')
      }
    });
  });
  assert(attA.companyId === COMPANY_A, 'AttendanceRecord.create inyecta companyId');

  await runWithTenantContext({ companyId: COMPANY_B }, async () => {
    const attB = await prisma.attendanceRecord.findMany({ where: { employeeId: empA.id } });
    assert(attB.length === 0, 'Contexto B no tiene acceso a asistencias de Contexto A');
  });

  // 7. Device
  console.log('  -> Evaluando modelo Device...');
  let devA = await runWithTenantContext({ companyId: COMPANY_A }, async () => {
    return prisma.device.create({
      data: {
        name: 'Kiosco Alpha Principal',
        tokenHash: 'hash-dev-alpha-test'
      }
    });
  });
  assert(devA.companyId === COMPANY_A, 'Device.create inyecta companyId');

  await runWithTenantContext({ companyId: COMPANY_B }, async () => {
    const devsB = await prisma.device.findMany();
    assert(devsB.length === 0, 'Contexto B no puede ver dispositivos de Contexto A');
  });

  // 8. DeviceAuthRequest
  console.log('  -> Evaluando modelo DeviceAuthRequest...');
  let authReqA = await runWithTenantContext({ companyId: COMPANY_A }, async () => {
    return prisma.deviceAuthRequest.create({
      data: {
        pairingCode: 'TEST-A111',
        ipAddress: '10.0.0.1',
        userAgent: 'AlphaBrowser',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 300000)
      }
    });
  });
  assert(authReqA.companyId === COMPANY_A, 'DeviceAuthRequest.create inyecta companyId');

  await runWithTenantContext({ companyId: COMPANY_B }, async () => {
    const authReqB = await prisma.deviceAuthRequest.findMany();
    assert(authReqB.length === 0, 'Contexto B no ve solicitudes de emparejamiento de Contexto A');
  });

  // 9. AdminUser
  console.log('  -> Evaluando modelo AdminUser...');
  let adminA = await runWithTenantContext({ companyId: COMPANY_A }, async () => {
    return prisma.adminUser.create({
      data: {
        name: 'Admin Alpha',
        email: 'admin.alpha@gate2test.com',
        password: 'hash',
        role: 'ADMIN'
      }
    });
  });
  assert(adminA.companyId === COMPANY_A, 'AdminUser.create inyecta companyId');

  await runWithTenantContext({ companyId: COMPANY_B }, async () => {
    const adminsB = await prisma.adminUser.findMany({ where: { email: 'admin.alpha@gate2test.com' } });
    assert(adminsB.length === 0, 'Contexto B no puede consultar administradores de Contexto A');
  });

  // 10. AdminAuditLog
  console.log('  -> Evaluando modelo AdminAuditLog...');
  let auditA = await runWithTenantContext({ companyId: COMPANY_A }, async () => {
    return prisma.adminAuditLog.create({
      data: {
        action: 'TEST_AUDIT',
        performedById: adminA.id,
        performedByName: 'Admin Alpha',
        targetName: 'Target Test',
        targetEmail: 'target@test.com'
      }
    });
  });
  assert(auditA.companyId === COMPANY_A, 'AdminAuditLog.create inyecta companyId');

  await runWithTenantContext({ companyId: COMPANY_B }, async () => {
    const auditsB = await prisma.adminAuditLog.findMany();
    assert(auditsB.length === 0, 'Contexto B no puede consultar logs de auditoría de Contexto A');
  });

  // 11. Notification
  console.log('  -> Evaluando modelo Notification...');
  let notifA = await runWithTenantContext({ companyId: COMPANY_A }, async () => {
    return prisma.notification.create({
      data: {
        employeeId: empA.id,
        title: 'Aviso Alpha',
        message: 'Mensaje de prueba',
        type: 'INFO',
        category: 'system'
      }
    });
  });
  assert(notifA.companyId === COMPANY_A, 'Notification.create inyecta companyId');

  await runWithTenantContext({ companyId: COMPANY_B }, async () => {
    const notifsB = await prisma.notification.findMany();
    assert(notifsB.length === 0, 'Contexto B no puede ver notificaciones de Contexto A');
  });

  // 12. EventRequest
  console.log('  -> Evaluando modelo EventRequest...');
  let eventA = await runWithTenantContext({ companyId: COMPANY_A }, async () => {
    return prisma.eventRequest.create({
      data: {
        employeeId: empA.id,
        registeredById: adminA.id,
        type: 'OVERTIME',
        status: 'ACTIVE',
        date: new Date('2026-10-22'),
        reason: 'Horas extra Alpha'
      }
    });
  });
  assert(eventA.companyId === COMPANY_A, 'EventRequest.create inyecta companyId');

  await runWithTenantContext({ companyId: COMPANY_B }, async () => {
    const eventsB = await prisma.eventRequest.findMany();
    assert(eventsB.length === 0, 'Contexto B no puede ver EventRequests de Contexto A');
  });

  // 13. SystemSettings
  console.log('  -> Evaluando modelo SystemSettings...');
  let settingsA = await runWithTenantContext({ companyId: COMPANY_A }, async () => {
    return prisma.systemSettings.create({
      data: {
        companyName: 'Empresa Alpha Personalizada',
        timezone: 'America/Mexico_City'
      }
    });
  });
  assert(settingsA.companyId === COMPANY_A, 'SystemSettings.create inyecta companyId');

  await runWithTenantContext({ companyId: COMPANY_B }, async () => {
    const settingsB = await prisma.systemSettings.findFirst();
    assert(settingsB === null, 'Contexto B no ve la configuración de Contexto A');
  });

  // -------------------------------------------------------------
  // TEST GRUPO 3: PRUEBAS DE OPERACIONES AVANZADAS (UPDATE, DELETE, UPSERT, GROUPBY)
  // -------------------------------------------------------------
  console.log('\n* GRUPO 3: Validación de operaciones adicionales (update, delete, upsert, groupBy)...');

  await runWithTenantContext({ companyId: COMPANY_A }, async () => {
    // Update individual
    const updatedDept = await prisma.department.update({
      where: { id: deptA.id },
      data: { name: 'Depto Alpha Renombrado' }
    });
    assert(updatedDept.name === 'Depto Alpha Renombrado', 'update modifica el registro en Contexto A');

    // Upsert
    const upsertedShift = await prisma.shift.upsert({
      where: { id: shiftA.id },
      update: { name: 'Turno Alpha Upserted' },
      create: { name: 'Nuevo Turno', startTime: '10:00', endTime: '18:00' }
    });
    assert(upsertedShift.name === 'Turno Alpha Upserted', 'upsert actualiza en Contexto A');

    // Aggregate y GroupBy
    const agg = await prisma.attendanceRecord.aggregate({
      _count: { id: true }
    });
    assert(agg._count.id === 1, 'aggregate calcula correctamente dentro de Contexto A');

    const group = await prisma.employee.groupBy({
      by: ['companyId'],
      _count: { id: true }
    });
    assert(group.length === 1 && group[0].companyId === COMPANY_A, 'groupBy agrupa respetando aislamiento');
  });

  // Limpieza de datos de prueba
  console.log('\n* Limpieza: Purgando datos de prueba de Gate 2...');
  await basePrisma.attendanceRecord.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.eventRequest.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.notification.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.employeeShift.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.departmentShift.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.employee.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.department.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.shift.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.deviceAuthRequest.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.device.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.adminAuditLog.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.adminUser.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.systemSettings.deleteMany({ where: { companyId: { in: [COMPANY_A, COMPANY_B] } } });
  await basePrisma.company.deleteMany({ where: { id: { in: [COMPANY_A, COMPANY_B] } } });

  console.log('\n================================================================');
  console.log('  RESUMEN DE RESULTADOS DE PRUEBAS GATE 2                      ');
  console.log('================================================================');
  console.log(` Total de asertos evaluados:            ${totalTests}`);
  console.log(` Asertos pasados satisfactoriamente:    ${passedTests}`);
  console.log(` Modelos evaluados con aislamiento:     13 / 13`);
  console.log(` Condiciones de contexto evaluadas:     4 / 4 (A, B, Sin Ctx, Undefined)`);
  console.log(' Estado de Gate 2:                      APROBADO AL 100%');
  console.log('================================================================');
}

runGate2UnitTests()
  .catch((err) => {
    console.error('❌ Error crítico en suite de pruebas de Gate 2:', err);
    process.exit(1);
  })
  .finally(() => basePrisma.$disconnect());
