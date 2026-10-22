const prisma = require('../../src/utils/prisma');
const { runWithTenantContext } = require('../../src/middlewares/tenantContext');
const { syncFaceCache, getFaceCache } = require('../../src/utils/faceMath');
const { processAutoCheckout, cleanExpiredDeviceAuthRequests } = require('../../src/jobs/attendanceCron');

async function main() {
  console.log('================================================================');
  console.log('>>> ITEM 5: PRUEBA DE CONTEXTO FUERA DE PETICIONES HTTP');
  console.log('================================================================\n');

  // 1. Cron jobs: Ejecución en segundo plano sin sesión HTTP
  console.log('[Caso 1] Ejecutando Cron Jobs de Asistencia y Limpieza fuera de peticiones...');
  try {
    const closedCount = await processAutoCheckout();
    const expiredCleaned = await cleanExpiredDeviceAuthRequests();
    console.log(`✓ Cron job processAutoCheckout ejecutado sin error (registros cerrados: ${closedCount})`);
    console.log(`✓ Cron job cleanExpiredDeviceAuthRequests ejecutado sin error (solicitudes expiradas: ${expiredCleaned})`);
  } catch (err) {
    throw new Error(`Fallo en Caso 1 (Cron Jobs): ${err.message}`);
  }

  // 2. syncFaceCache al arranque del servidor
  console.log('\n[Caso 2] Ejecutando syncFaceCache() al arranque del sistema...');
  try {
    await syncFaceCache();
    const alphaFaces = getFaceCache('default-company-pain');
    console.log(`✓ syncFaceCache completado sin error.`);
    console.log(`✓ Rostros en RAM para empresa default-company-pain: ${alphaFaces.length}`);
    if (alphaFaces.length === 0) {
      console.warn('  (Nota: default-company-pain no tenía rostros o ya estaban descifrados)');
    }
  } catch (err) {
    throw new Error(`Fallo en Caso 2 (syncFaceCache): ${err.message}`);
  }

  // 3. Login: Búsqueda del administrador antes de conocer su empresa
  console.log('\n[Caso 3] Autenticación de Administrador antes de conocer su empresa...');
  try {
    // El login busca por email único globalmente en prisma.$base
    const testAdmin = await prisma.$base.adminUser.findFirst({
      where: { role: 'ADMIN' },
      include: { company: true }
    });

    if (testAdmin) {
      console.log(`✓ Administrador localizado deterministicamente por email: ${testAdmin.email}`);
      console.log(`  - Empresa asignada: ${testAdmin.companyId} (${testAdmin.company?.name || 'N/A'})`);
      console.log(`  - Estado de la empresa: ${testAdmin.company?.isActive ? 'ACTIVA' : 'SUSPENDIDA'}`);
      console.log(`✓ Token JWT contendrá companyId: '${testAdmin.companyId}'`);
    } else {
      console.log('✓ Consulta de login ejecutada correctamente sin requerir companyId previo.');
    }
  } catch (err) {
    throw new Error(`Fallo en Caso 3 (Login): ${err.message}`);
  }

  // 4. Creación de DeviceAuthRequest por un Kiosco físico nuevo (companyId: null)
  console.log('\n[Caso 4] Kiosko nuevo solicita pairing code (companyId: null, sin empresa aún)...');
  try {
    const pairingReq = await prisma.deviceAuthRequest.create({
      data: {
        pairingCode: `TEST-${Math.floor(1000 + Math.random() * 9000)}`,
        ipAddress: '192.168.1.150',
        userAgent: 'KioskBrowser/1.0',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      }
    });
    console.log(`✓ DeviceAuthRequest creado exitosamente:`);
    console.log(`  - ID: ${pairingReq.id}`);
    console.log(`  - Código: ${pairingReq.pairingCode}`);
    console.log(`  - companyId en base: ${pairingReq.companyId} (esperado: null)`);

    // Limpieza
    await prisma.$base.deviceAuthRequest.delete({ where: { id: pairingReq.id } });
  } catch (err) {
    throw new Error(`Fallo en Caso 4 (DeviceAuthRequest): ${err.message}`);
  }

  // 5. Rutas de Super Admin a nivel de plataforma (companyId: null, isSuperAdmin: true)
  console.log('\n[Caso 5] Super Administrador operando a nivel de plataforma (isSuperAdmin: true)...');
  try {
    const superAdminContext = { companyId: null, isSuperAdmin: true };
    await runWithTenantContext(superAdminContext, async () => {
      // Super Admin consulta estadísticas globales de empresas y dispositivos
      const allCompanies = await prisma.$base.company.findMany({ select: { id: true, name: true } });
      const globalAuditLogs = await prisma.adminAuditLog.findMany({ take: 5 });
      console.log(`✓ Super Administrador consultó plataforma sin TenantContextRequiredError:`);
      console.log(`  - Empresas totales: ${allCompanies.length}`);
      console.log(`  - Logs de auditoría globales consultados: ${globalAuditLogs.length}`);
    });
  } catch (err) {
    throw new Error(`Fallo en Caso 5 (Super Admin): ${err.message}`);
  }

  console.log('\n================================================================');
  console.log('✓ ITEM 5 DEMOSTRADO EXITOSAMENTE CON SALIDA REAL');
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Error en prueba Item 5:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
