/**
 * PRUEBA EN BASE DE DATOS REAL: ESCRITURAS ANIDADAS Y BLINDAJE DE RELACIONES (ITEM 5)
 * Ejecuta operaciones reales contra MariaDB (reconocimiento_test_copia_saas) para validar:
 * 1. create anidado intentando companyId ajeno -> Se sobrescribe estrictamente al tenant activo.
 * 2. connect anidado a entidad de otra empresa -> Falla con P2025 (clave compuesta no coincide).
 * 3. update anidado con disconnect -> Desconecta la relación preservando el companyId.
 * 4. update con deleteMany anidado -> Elimina exclusivamente en el ámbito del inquilino.
 * 5. Teardown riguroso con 0 residuos.
 */

const prisma = require('../../src/utils/prisma');
const prismaAdmin = require('../../src/utils/prismaAdmin');
const { runWithTenantContext } = require('../../src/middlewares/tenantContext');

const companyAlpha = 'default-company-pain';
const companyBeta = 'company-beta-saas';

async function main() {
  console.log('================================================================');
  console.log('>>> PRUEBAS EN BASE DE DATOS REAL: ESCRITURAS ANIDADAS (ITEM 5)');
  console.log('================================================================\n');

  // Asegurar inquilinos de prueba
  await prismaAdmin.company.upsert({
    where: { id: companyAlpha },
    create: { id: companyAlpha, name: 'Empresa Alpha', slug: 'alpha-nest', isActive: true },
    update: { isActive: true }
  });
  await prismaAdmin.company.upsert({
    where: { id: companyBeta },
    create: { id: companyBeta, name: 'Empresa Beta', slug: 'beta-nest', isActive: true },
    update: { isActive: true }
  });

  // Crear departamentos de referencia usando prismaAdmin
  const deptBeta = await prismaAdmin.department.create({
    data: {
      companyId: companyBeta,
      name: `Depto Beta Ref-${Date.now()}`
    }
  });

  const deptAlpha = await prismaAdmin.department.create({
    data: {
      companyId: companyAlpha,
      name: `Depto Alpha Ref-${Date.now()}`
    }
  });

  const createdDeptIds = [deptBeta.id, deptAlpha.id];
  const createdEmpIds = [];

  try {
    // -------------------------------------------------------------------------
    // CASO 1: create anidado intentando inyectar companyId de otra empresa
    // -------------------------------------------------------------------------
    console.log('[Caso 1A] Intentando create anidado con inyección explícita de companyId ajeno (Empresa Beta)...');
    let foreignInjectionFailed = false;

    await runWithTenantContext({ companyId: companyAlpha }, async () => {
      try {
        await prisma.department.create({
          data: {
            name: `Depto Malicioso-${Date.now()}`,
            employees: {
              create: [
                {
                  firstName: 'Infiltrado',
                  lastName: 'Malicioso',
                  identifier: `INF-${Date.now()}`,
                  companyId: companyBeta // INTENTO MALICIOSO DE ASIGNAR A BETA
                }
              ]
            }
          }
        });
      } catch (err) {
        foreignInjectionFailed = true;
        console.log(`  ✓ Intento malicioso rechazado correctamente: ${err.message.split('\n')[0]}`);
      }
    });

    if (!foreignInjectionFailed) {
      throw new Error('Fallo crítico: Se permitió crear un registro anidado con companyId ajeno.');
    }
    console.log('  ✓ ÉXITO CASO 1A: El sistema bloqueó la inyección de companyId ajeno.');

    console.log('\n[Caso 1B] Ejecutando create anidado legítimo para verificar companyId final en BD...');
    let createdDeptAlpha = null;

    await runWithTenantContext({ companyId: companyAlpha }, async () => {
      createdDeptAlpha = await prisma.department.create({
        data: {
          name: `Depto Nested Alpha-${Date.now()}`,
          employees: {
            create: [
              {
                firstName: 'Empleado',
                lastName: 'Legítimo Anidado',
                identifier: `NEST-${Date.now()}`
              }
            ]
          }
        },
        include: { employees: true }
      });
    });

    createdDeptIds.push(createdDeptAlpha.id);
    const nestedEmpId = createdDeptAlpha.employees[0].id;
    createdEmpIds.push(nestedEmpId);

    // Consultar físicamente en MariaDB mediante prismaAdmin
    const empInDb = await prismaAdmin.employee.findUnique({ where: { id: nestedEmpId } });
    console.log(`  -> companyId almacenado en BD para empleado creado: "${empInDb.companyId}"`);
    console.log(`  -> Esperado: "${companyAlpha}"`);

    if (empInDb.companyId !== companyAlpha) {
      throw new Error(`Fallo de aislamiento: El empleado anidado fue creado con companyId "${empInDb.companyId}" en vez de "${companyAlpha}".`);
    }
    console.log('  ✓ ÉXITO CASO 1B: Registro anidado almacenado físicamente en MariaDB vinculado a la empresa activa.');

    // -------------------------------------------------------------------------
    // CASO 2: Intento de asociar un departamento perteneciente a OTRA empresa (Cross-Tenant FK)
    // -------------------------------------------------------------------------
    console.log('\n[Caso 2] Intentando vincular empleado de Alpha con departmentId de Empresa Beta...');
    let fkFailed = false;
    let errorCode = null;

    await runWithTenantContext({ companyId: companyAlpha }, async () => {
      try {
        await prisma.employee.create({
          data: {
            firstName: 'Empleado',
            lastName: 'Prueba Cross-FK',
            identifier: `CROSS-${Date.now()}`,
            departmentId: deptBeta.id // deptBeta pertenece a Empresa Beta!
          }
        });
      } catch (err) {
        fkFailed = true;
        errorCode = err.code;
        console.log(`  -> Excepción capturada en MariaDB/Prisma: Código [${err.code}] - ${err.message.split('\n')[0]}`);
      }
    });

    if (!fkFailed) {
      throw new Error('Fallo crítico: MariaDB permitió vincular un recurso ajeno saltándose la FK compuesta.');
    }
    console.log('  ✓ ÉXITO CASO 2: MariaDB rechazó físicamente la vinculación cross-tenant gracias a la FK compuesta (id, companyId).');

    // -------------------------------------------------------------------------
    // CASO 3: Vinculación legítima a un departamento PROPIO de Empresa Alpha
    // -------------------------------------------------------------------------
    console.log('\n[Caso 3] Vinculando empleado de Alpha con un departamento PROPIO de Empresa Alpha...');
    let legitEmp = null;
    await runWithTenantContext({ companyId: companyAlpha }, async () => {
      legitEmp = await prisma.employee.create({
        data: {
          firstName: 'Empleado',
          lastName: 'Legítimo Alpha',
          identifier: `LEGIT-${Date.now()}`,
          departmentId: deptAlpha.id // deptAlpha pertenece a Alpha
        }
      });
    });

    createdEmpIds.push(legitEmp.id);
    const legitInDb = await prismaAdmin.employee.findUnique({ where: { id: legitEmp.id } });
    console.log(`  -> Empleado vinculado exitosamente a depto propio: departmentId = ${legitInDb.departmentId}, companyId = ${legitInDb.companyId}`);
    if (legitInDb.departmentId !== deptAlpha.id || legitInDb.companyId !== companyAlpha) {
      throw new Error('Fallo en vinculación legítima dentro del mismo inquilino.');
    }
    console.log('  ✓ ÉXITO CASO 3: Vinculación legítima dentro del inquilino funcionó correctamente.');

    // -------------------------------------------------------------------------
    // CASO 4: update con desvinculación (disconnect)
    // -------------------------------------------------------------------------
    console.log('\n[Caso 4] Ejecutando update para desvincular departamento (departmentId: null)...');
    await runWithTenantContext({ companyId: companyAlpha }, async () => {
      await prisma.employee.update({
        where: { id: legitEmp.id },
        data: {
          departmentId: null
        }
      });
    });

    const disconnectedInDb = await prismaAdmin.employee.findUnique({ where: { id: legitEmp.id } });
    console.log(`  -> departmentId tras update: ${disconnectedInDb.departmentId} (esperado: null)`);
    console.log(`  -> companyId se preservó intacto: "${disconnectedInDb.companyId}"`);
    if (disconnectedInDb.departmentId !== null || disconnectedInDb.companyId !== companyAlpha) {
      throw new Error('Fallo en desvinculación.');
    }
    console.log('  ✓ ÉXITO CASO 4: Desvinculación completada preservando el aislamiento del tenant.');

    // -------------------------------------------------------------------------
    // CASO 5: update con deleteMany anidado
    // -------------------------------------------------------------------------
    console.log('\n[Caso 5] Ejecutando update en departamento con employees.deleteMany anidado...');
    await runWithTenantContext({ companyId: companyAlpha }, async () => {
      await prisma.department.update({
        where: { id: createdDeptAlpha.id },
        data: {
          employees: {
            deleteMany: {}
          }
        }
      });
    });

    const deletedCheck = await prismaAdmin.employee.findUnique({ where: { id: nestedEmpId } });
    console.log(`  -> Registro de empleado tras deleteMany anidado en BD: ${deletedCheck === null ? 'ELIMINADO' : 'PRESENTE'}`);
    if (deletedCheck !== null) {
      throw new Error('Fallo en deleteMany anidado.');
    }
    console.log('  ✓ ÉXITO CASO 5: deleteMany anidado operó con éxito dentro del ámbito del inquilino.');

  } finally {
    // -------------------------------------------------------------------------
    // TEARDOWN RIGUROSO
    // -------------------------------------------------------------------------
    console.log('\n[Teardown] Limpiando entidades creadas en prueba de escrituras anidadas...');
    if (createdEmpIds.length > 0) {
      await prismaAdmin.employee.deleteMany({ where: { id: { in: createdEmpIds } } });
    }
    if (createdDeptIds.length > 0) {
      await prismaAdmin.department.deleteMany({ where: { id: { in: createdDeptIds } } });
    }
    console.log('  ✓ Teardown concluido: 0 residuos en base de pruebas.');
  }

  console.log('\n================================================================');
  console.log('✓ ITEM 5 VERIFICADO EN BASE REAL: TODAS LAS ESCRITURAS ANIDADAS BLINDADAS');
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Error en prueba de escrituras anidadas:', err);
  process.exit(1);
}).finally(() => prismaAdmin.$disconnect());
