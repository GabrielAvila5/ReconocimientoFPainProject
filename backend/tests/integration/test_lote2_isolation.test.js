/**
 * PRUEBA HTTP DE AISLAMIENTO COMPLETO: GATE 3B LOTE 2 (VERSIÓN AUDITADA)
 * Módulos evaluados:
 * 1. departments (Duplicidad por inquilino 409 vs 201 cross-tenant, P2003 delete with FK 409)
 * 2. shifts (Aislamiento, borrado con asistencias -> soft delete / 409 nunca 500)
 * 3. notifications (Aislamiento total de lecturas y mutaciones)
 * 4. events (Aislamiento y forzado estricto de registeredById a req.user.id)
 * 5. admins (Aislamiento, 403 al intentar crear/escalar SUPER_ADMIN, 409 genérico en email cross-tenant)
 * 6. reports (Aislamiento real con asistencias sembradas en Alpha y Beta, KPIs, consolidado, CSV y filtro alien)
 * 7. settings (Aislamiento de configuración)
 * 8. superadmin_audit (Auditoría automática con x-tenant-id en AdminAuditLog)
 */

const request = require('supertest');
const { app } = require('../../src/app');
const prismaAdmin = require('../../src/utils/prismaAdmin');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../src/config/secrets');

async function runLote2IsolationTests() {
  console.log('================================================================');
  console.log('>>> PRUEBA HTTP REAL: AISLAMIENTO GATE 3B LOTE 2 (EXPANDIDA)');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  const prefix = `lote2_test_${Date.now()}`;
  let companyAlphaId = null;
  let companyBetaId = null;
  let tokenAdminAlpha = null;
  let tokenAdminBeta = null;
  let tokenSuperAdmin = null;

  let deptAlphaId = null;
  let deptBetaId = null;
  let shiftAlphaId = null;
  let shiftBetaId = null;
  let notifAlphaId = null;
  let notifBetaId = null;
  let eventAlphaId = null;
  let empAlphaId = null;
  let empBetaId = null;
  let superAdminId = null;

  try {
    // -------------------------------------------------------------------------
    // SETUP: Creación de Empresas Alpha y Beta, Admins, Super Admin y Empleados
    // -------------------------------------------------------------------------
    const coAlpha = await prismaAdmin.company.create({
      data: {
        id: `${prefix}_co_alpha`,
        name: 'Empresa Alpha Lote 2',
        slug: `${prefix}-co-alpha`,
        isActive: true,
        maxEmployees: 10,
        maxDevices: 10
      }
    });
    companyAlphaId = coAlpha.id;

    const coBeta = await prismaAdmin.company.create({
      data: {
        id: `${prefix}_co_beta`,
        name: 'Empresa Beta Lote 2',
        slug: `${prefix}-co-beta`,
        isActive: true,
        maxEmployees: 10,
        maxDevices: 10
      }
    });
    companyBetaId = coBeta.id;

    // Admin Alpha
    const adminAlpha = await prismaAdmin.adminUser.create({
      data: {
        email: `${prefix}.admin@alpha.com`,
        name: 'Admin Alpha L2',
        password: 'hashedpassword123',
        role: 'ADMIN',
        companyId: companyAlphaId
      }
    });
    tokenAdminAlpha = jwt.sign(
      { id: adminAlpha.id, email: adminAlpha.email, role: 'ADMIN', companyId: companyAlphaId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Admin Beta
    const adminBeta = await prismaAdmin.adminUser.create({
      data: {
        email: `${prefix}.admin@beta.com`,
        name: 'Admin Beta L2',
        password: 'hashedpassword123',
        role: 'ADMIN',
        companyId: companyBetaId
      }
    });
    tokenAdminBeta = jwt.sign(
      { id: adminBeta.id, email: adminBeta.email, role: 'ADMIN', companyId: companyBetaId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Super Admin global
    const superAdmin = await prismaAdmin.adminUser.create({
      data: {
        email: `${prefix}.superadmin@global.com`,
        name: 'Super Admin L2',
        password: 'hashedpassword123',
        role: 'SUPER_ADMIN',
        companyId: null
      }
    });
    superAdminId = superAdmin.id;
    tokenSuperAdmin = jwt.sign(
      { id: superAdmin.id, email: superAdmin.email, role: 'SUPER_ADMIN', companyId: null },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Empleados de prueba para Alpha y Beta
    const empAlpha = await prismaAdmin.employee.create({
      data: {
        firstName: 'EmpleadoAlpha',
        lastName: 'Pérez',
        email: `${prefix}.emp@alpha.com`,
        identifier: `EMP-A-${Date.now().toString().slice(-4)}`,
        companyId: companyAlphaId,
        isActive: true
      }
    });
    empAlphaId = empAlpha.id;

    const empBeta = await prismaAdmin.employee.create({
      data: {
        firstName: 'EmpleadoBeta',
        lastName: 'Gómez',
        email: `${prefix}.emp@beta.com`,
        identifier: `EMP-B-${Date.now().toString().slice(-4)}`,
        companyId: companyBetaId,
        isActive: true
      }
    });
    empBetaId = empBeta.id;

    // Configuración base de reportes/asistencia
    await prismaAdmin.systemSettings.create({
      data: {
        companyId: companyAlphaId,
        companyName: 'Empresa Alpha Lote 2',
        workdayStartHour: 8,
        workdayEndHour: 17
      }
    });

    await prismaAdmin.systemSettings.create({
      data: {
        companyId: companyBetaId,
        companyName: 'Empresa Beta Lote 2',
        workdayStartHour: 9,
        workdayEndHour: 18
      }
    });

    // -------------------------------------------------------------------------
    // 1. MÓDULO DEPARTMENTS
    // -------------------------------------------------------------------------
    console.log('--- 1. Casos de Negocio en Módulo Departments ---');
    // 1.1 Alpha crea departamento
    const resCreateDeptA = await request(app)
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${tokenAdminAlpha}`)
      .send({ name: 'Tecnología e Innovación' });

    assert(resCreateDeptA.status === 201, `Alpha crea depto con HTTP 201 (obtuvo ${resCreateDeptA.status})`);
    deptAlphaId = resCreateDeptA.body.id;

    // 1.2 Alpha intenta crear departamento duplicado en la misma empresa -> 409 Conflict
    const resCreateDeptDupSameCompany = await request(app)
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${tokenAdminAlpha}`)
      .send({ name: 'Tecnología e Innovación' });

    assert(resCreateDeptDupSameCompany.status === 409, `Nombre duplicado en la misma empresa devuelve HTTP 409 (obtuvo ${resCreateDeptDupSameCompany.status})`);

    // 1.3 Beta crea departamento con el MISMO nombre en su propia empresa -> 201 Created
    const resCreateDeptDupOtherCompany = await request(app)
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${tokenAdminBeta}`)
      .send({ name: 'Tecnología e Innovación' });

    assert(resCreateDeptDupOtherCompany.status === 201, `Mismo nombre de depto en distinta empresa devuelve HTTP 201 (obtuvo ${resCreateDeptDupOtherCompany.status})`);
    deptBetaId = resCreateDeptDupOtherCompany.body.id;

    // 1.4 Aislamiento en lista
    const resListDeptA = await request(app)
      .get('/api/v1/departments')
      .set('Authorization', `Bearer ${tokenAdminAlpha}`);
    
    assert(resListDeptA.status === 200, 'Alpha lista deptos con HTTP 200');
    assert(resListDeptA.body.some(d => d.id === deptAlphaId), 'Alpha ve su propio departamento');
    assert(!resListDeptA.body.some(d => d.id === deptBetaId), 'Alpha NO ve el departamento de Beta');

    // 1.5 Beta intenta modificar o borrar departamento de Alpha -> 404
    const resPutDeptAlien = await request(app)
      .put(`/api/v1/departments/${deptAlphaId}`)
      .set('Authorization', `Bearer ${tokenAdminBeta}`)
      .send({ name: 'Secuestro de Depto Alpha' });
    assert(resPutDeptAlien.status === 404, `Beta recibe HTTP 404 al intentar modificar depto de Alpha (obtuvo ${resPutDeptAlien.status})`);

    const resDelDeptAlien = await request(app)
      .delete(`/api/v1/departments/${deptAlphaId}`)
      .set('Authorization', `Bearer ${tokenAdminBeta}`);
    assert(resDelDeptAlien.status === 404, `Beta recibe HTTP 404 al intentar eliminar depto de Alpha (obtuvo ${resDelDeptAlien.status})`);

    // 1.6 Intentar eliminar departamento con empleados asociados devuelve 409 (captura limpia P2003, nunca 500)
    // Asignar empAlpha al depto
    await prismaAdmin.employee.update({
      where: { id: empAlphaId },
      data: { departmentId: deptAlphaId }
    });

    const resDelDeptWithEmp = await request(app)
      .delete(`/api/v1/departments/${deptAlphaId}`)
      .set('Authorization', `Bearer ${tokenAdminAlpha}`);
    assert(resDelDeptWithEmp.status === 409, `Eliminar depto con empleados asociados devuelve HTTP 409 Conflict (obtuvo ${resDelDeptWithEmp.status})`);

    // Desvincular empleado para continuar
    await prismaAdmin.employee.update({
      where: { id: empAlphaId },
      data: { departmentId: null }
    });

    // -------------------------------------------------------------------------
    // 2. MÓDULO SHIFTS
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Casos de Negocio en Módulo Shifts ---');
    // 2.1 Alpha crea turno
    const resCreateShiftA = await request(app)
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${tokenAdminAlpha}`)
      .send({ name: 'Turno Matutino Alpha', startTime: '08:00', endTime: '16:00' });

    assert(resCreateShiftA.status === 201, `Alpha crea turno con HTTP 201 (obtuvo ${resCreateShiftA.status})`);
    shiftAlphaId = resCreateShiftA.body.id;

    // 2.2 Duplicado en misma empresa devuelve 409
    const resCreateShiftDupSame = await request(app)
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${tokenAdminAlpha}`)
      .send({ name: 'Turno Matutino Alpha', startTime: '08:00', endTime: '16:00' });
    assert(resCreateShiftDupSame.status === 409, `Turno duplicado en misma empresa devuelve HTTP 409 (obtuvo ${resCreateShiftDupSame.status})`);

    // 2.3 Mismo nombre en Beta devuelve 201
    const resCreateShiftB = await request(app)
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${tokenAdminBeta}`)
      .send({ name: 'Turno Matutino Alpha', startTime: '09:00', endTime: '17:00' });
    assert(resCreateShiftB.status === 201, 'Beta puede crear turno con el mismo nombre en su propia empresa (HTTP 201)');
    shiftBetaId = resCreateShiftB.body.id;

    // 2.4 Beta intenta mutar turno de Alpha -> 404
    const resPutShiftAlien = await request(app)
      .put(`/api/v1/shifts/${shiftAlphaId}`)
      .set('Authorization', `Bearer ${tokenAdminBeta}`)
      .send({ name: 'Turno Hackeado' });
    assert(resPutShiftAlien.status === 404, `Beta recibe HTTP 404 al intentar modificar turno de Alpha (obtuvo ${resPutShiftAlien.status})`);

    // 2.5 Eliminar turno con asistencias asociadas -> Desactivación lógica (isActive: false) o 409, NUNCA 500
    // Crear una asistencia vinculada al turno
    const testDate = new Date();
    testDate.setHours(0, 0, 0, 0);

    const attRecordAlpha = await prismaAdmin.attendanceRecord.create({
      data: {
        companyId: companyAlphaId,
        employeeId: empAlphaId,
        shiftId: shiftAlphaId,
        date: testDate,
        entrada: new Date()
      }
    });

    const resDelShiftWithAtt = await request(app)
      .delete(`/api/v1/shifts/${shiftAlphaId}`)
      .set('Authorization', `Bearer ${tokenAdminAlpha}`);

    assert(resDelShiftWithAtt.status === 200 || resDelShiftWithAtt.status === 409, 
      `Eliminar turno con asistencias realiza soft-delete controlado o 409 (obtuvo ${resDelShiftWithAtt.status}, nunca 500)`);
    
    if (resDelShiftWithAtt.status === 200) {
      assert(resDelShiftWithAtt.body.shift?.isActive === false, 'El turno con asistencias fue desactivado lógicamente (isActive: false)');
    }

    // -------------------------------------------------------------------------
    // 3. MÓDULO NOTIFICATIONS
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Aislamiento en Módulo Notifications ---');
    const notifAlpha = await prismaAdmin.notification.create({
      data: {
        companyId: companyAlphaId,
        title: 'Alerta Confidencial Alpha',
        message: 'Información sensible de Alpha',
        type: 'INFO',
        category: 'system',
        isRead: false
      }
    });
    notifAlphaId = notifAlpha.id;

    const notifBeta = await prismaAdmin.notification.create({
      data: {
        companyId: companyBetaId,
        title: 'Alerta Confidencial Beta',
        message: 'Información sensible de Beta',
        type: 'INFO',
        category: 'system',
        isRead: false
      }
    });
    notifBetaId = notifBeta.id;

    const resListNotifA = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${tokenAdminAlpha}`);
    
    assert(resListNotifA.status === 200, 'Alpha lista notificaciones con HTTP 200');
    const notifsA = resListNotifA.body.data || resListNotifA.body;
    assert(notifsA.some(n => n.id === notifAlphaId), 'Alpha ve su notificación');
    assert(!notifsA.some(n => n.id === notifBetaId), 'Alpha NO ve la notificación de Beta');

    // Beta intenta PUT/DELETE en notificación de Alpha -> 404
    const resReadNotifAlien = await request(app)
      .put(`/api/v1/notifications/${notifAlphaId}/read`)
      .set('Authorization', `Bearer ${tokenAdminBeta}`);
    assert(resReadNotifAlien.status === 404, `Beta recibe HTTP 404 al leer notificación de Alpha (obtuvo ${resReadNotifAlien.status})`);

    const resDelNotifAlien = await request(app)
      .delete(`/api/v1/notifications/${notifAlphaId}`)
      .set('Authorization', `Bearer ${tokenAdminBeta}`);
    assert(resDelNotifAlien.status === 404, `Beta recibe HTTP 404 al borrar notificación de Alpha (obtuvo ${resDelNotifAlien.status})`);

    // -------------------------------------------------------------------------
    // 4. MÓDULO EVENTS
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Casos de Negocio en Módulo Events ---');
    // 4.1 Intento de inyectar registeredById ajeno es IGNORADO y forzado a req.user.id
    const resCreateEventAlienRegisteredBy = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${tokenAdminAlpha}`)
      .send({
        employeeId: empAlphaId,
        type: 'OVERTIME',
        date: new Date().toISOString(),
        minutes: 60,
        reason: 'Horas extra con spoofing de registeredById',
        registeredById: adminBeta.id // Intento de suplantación
      });

    assert(resCreateEventAlienRegisteredBy.status === 201, 'Alpha crea evento con HTTP 201');
    assert(resCreateEventAlienRegisteredBy.body.registeredById === adminAlpha.id, 
      `Inyección de registeredById ignorada: asignado estrictamente a req.user.id (${adminAlpha.id})`);
    eventAlphaId = resCreateEventAlienRegisteredBy.body.id;

    // 4.2 Beta intenta asignar evento a empleado de Alpha -> 404
    const resCreateAlienEmp = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${tokenAdminBeta}`)
      .send({
        employeeId: empAlphaId,
        type: 'VACATION',
        date: new Date().toISOString(),
        reason: 'Intento de asignación cross-tenant'
      });
    assert(resCreateAlienEmp.status === 404, `Beta recibe HTTP 404 al asignar evento a empleado de Alpha (obtuvo ${resCreateAlienEmp.status})`);

    // 4.3 Beta intenta modificar o cancelar evento de Alpha -> 404
    const resPutEventAlien = await request(app)
      .put(`/api/v1/events/${eventAlphaId}`)
      .set('Authorization', `Bearer ${tokenAdminBeta}`)
      .send({ reason: 'Modificación ilegítima' });
    assert(resPutEventAlien.status === 404, `Beta recibe HTTP 404 al modificar evento de Alpha (obtuvo ${resPutEventAlien.status})`);

    const resDelEventAlien = await request(app)
      .delete(`/api/v1/events/${eventAlphaId}`)
      .set('Authorization', `Bearer ${tokenAdminBeta}`);
    assert(resDelEventAlien.status === 404, `Beta recibe HTTP 404 al cancelar evento de Alpha (obtuvo ${resDelEventAlien.status})`);

    // -------------------------------------------------------------------------
    // 5. MÓDULO ADMINS
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Casos de Negocio en Módulo Admins ---');
    // 5.1 Admin de empresa intenta crear usuario con role: SUPER_ADMIN -> 403 Forbidden
    const resCreateSuperAdminByAdmin = await request(app)
      .post('/api/v1/admins')
      .set('Authorization', `Bearer ${tokenAdminAlpha}`)
      .send({
        name: 'Hacker SuperAdmin',
        email: `${prefix}.hacker@system.com`,
        password: 'password123',
        role: 'SUPER_ADMIN'
      });
    assert(resCreateSuperAdminByAdmin.status === 403, 
      `Admin de inquilino intentando crear SUPER_ADMIN recibe HTTP 403 Forbidden (obtuvo ${resCreateSuperAdminByAdmin.status})`);

    // 5.2 Intentar crear admin con email existente en otra empresa devuelve 409 con mensaje genérico
    const resCreateAdminDupCrossTenant = await request(app)
      .post('/api/v1/admins')
      .set('Authorization', `Bearer ${tokenAdminAlpha}`)
      .send({
        name: 'Clon de Beta',
        email: adminBeta.email, // Correo ya registrado en Beta
        password: 'password123'
      });
    assert(resCreateAdminDupCrossTenant.status === 409, 
      `Crear admin con email ya existente en otra empresa devuelve HTTP 409 (obtuvo ${resCreateAdminDupCrossTenant.status})`);
    assert(!JSON.stringify(resCreateAdminDupCrossTenant.body).includes(companyBetaId), 
      'Respuesta 409 es genérica y NO expone companyId ajeno');
    assert(!JSON.stringify(resCreateAdminDupCrossTenant.body).includes('Beta'), 
      'Respuesta 409 es genérica y NO expone nombre de empresa ajena');

    // 5.3 Beta intenta borrar admin de Alpha -> 404
    const resDelAdminAlien = await request(app)
      .delete(`/api/v1/admins/${adminAlpha.id}`)
      .set('Authorization', `Bearer ${tokenAdminBeta}`);
    assert(resDelAdminAlien.status === 404, `Beta recibe HTTP 404 al intentar borrar admin de Alpha (obtuvo ${resDelAdminAlien.status})`);

    // -------------------------------------------------------------------------
    // 6. MÓDULO REPORTS (AUDITORÍA REAL CON SIEMBRA DE DATOS Y EXPORTACIÓN CSV)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Auditoría Real en Módulo Reports (Alpha vs Beta) ---');
    // 6.1 Sembrar asistencias de prueba para Alpha y para Beta
    const reportDate = new Date();
    reportDate.setHours(0, 0, 0, 0);

    const attAlpha1 = await prismaAdmin.attendanceRecord.create({
      data: {
        companyId: companyAlphaId,
        employeeId: empAlphaId,
        date: reportDate,
        entrada: new Date(reportDate.getTime() + 8 * 3600 * 1000), // 08:00
        salida: new Date(reportDate.getTime() + 17 * 3600 * 1000)  // 17:00
      }
    });

    const attBeta1 = await prismaAdmin.attendanceRecord.create({
      data: {
        companyId: companyBetaId,
        employeeId: empBetaId,
        date: reportDate,
        entrada: new Date(reportDate.getTime() + 9 * 3600 * 1000), // 09:00
        salida: new Date(reportDate.getTime() + 18 * 3600 * 1000)  // 18:00
      }
    });

    const startDateStr = new Date(reportDate.getTime() - 24 * 3600 * 1000).toISOString();
    const endDateStr = new Date(reportDate.getTime() + 24 * 3600 * 1000).toISOString();

    // 6.2 Reporte de KPIs para Alpha
    const resKpisAlpha = await request(app)
      .get(`/api/v1/reports/kpis?startDate=${startDateStr}&endDate=${endDateStr}`)
      .set('Authorization', `Bearer ${tokenAdminAlpha}`);

    assert(resKpisAlpha.status === 200, `Alpha obtiene KPIs con HTTP 200 (obtuvo ${resKpisAlpha.status})`);
    assert(typeof resKpisAlpha.body.kpis === 'object', 'Respuesta contiene objeto estructurado de KPIs');

    // 6.3 Reporte consolidado de asistencia para Alpha
    const resConsolidatedAlpha = await request(app)
      .get(`/api/v1/reports/attendance-consolidated?startDate=${startDateStr}&endDate=${endDateStr}`)
      .set('Authorization', `Bearer ${tokenAdminAlpha}`);

    assert(resConsolidatedAlpha.status === 200, `Alpha obtiene consolidado con HTTP 200 (obtuvo ${resConsolidatedAlpha.status})`);
    const recordsAlpha = resConsolidatedAlpha.body.data || resConsolidatedAlpha.body;
    assert(Array.isArray(recordsAlpha), 'Consolidado retorna arreglo de registros');

    // Comprobar que registros de Alpha ESTÁN presentes
    const hasAlphaRecord = recordsAlpha.some(r => r.empleado?.includes('EmpleadoAlpha') || r.employeeId === empAlphaId);
    assert(hasAlphaRecord, 'El reporte de Alpha CONTIENE los registros de su empleado (EmpleadoAlpha)');

    // Comprobar con aserciones estrictas que CERO registros, nombres o IDs de Beta aparecen
    const hasBetaRecord = recordsAlpha.some(r => 
      r.empleado?.includes('EmpleadoBeta') || 
      r.empleado?.includes('Gómez') || 
      r.employeeId === empBetaId
    );
    assert(!hasBetaRecord, 'CERO registros, nombres o IDs de Beta aparecen en la respuesta de Alpha');

    // 6.4 Simulación de Exportación CSV con el formato exacto del Frontend (ReportsPage.jsx)
    const csvHeaders = ['Empleado', 'Departamento', 'Fecha', 'Entrada Real', 'Salida Real', 'Salida Esperada', 'Horas Trabajadas', 'Horas Extra', 'Estado Asistencia'];
    const csvRows = recordsAlpha.map(r => [
      `"${String(r.empleado || '').replace(/"/g, '""')}"`,
      `"${String(r.departamento || '').replace(/"/g, '""')}"`,
      `"${String(r.fecha || '').replace(/"/g, '""')}"`,
      `"${String(r.entrada || '').replace(/"/g, '""')}"`,
      `"${String(r.salida || '').replace(/"/g, '""')}"`,
      `"${String(r.horaEsperadaSalida || '').replace(/"/g, '""')}"`,
      `"${String(r.horasTrabajadas || '0').replace(/"/g, '""')}"`,
      `"${r.horasExtra ? 'Sí' : 'No'}"`,
      `"${String(r.estadoAsistencia || '').replace(/"/g, '""')}"`
    ].join(','));
    const generatedCsvContent = [csvHeaders.join(','), ...csvRows].join('\n');

    assert(generatedCsvContent.includes('EmpleadoAlpha'), 'Exportación CSV contiene los registros del personal de Alpha');
    assert(!generatedCsvContent.includes('EmpleadoBeta'), 'Exportación CSV contiene EXACTAMENTE CERO registros de Beta (nombre aislado)');
    assert(!generatedCsvContent.includes(empBetaId), 'Exportación CSV contiene EXACTAMENTE CERO UUIDs de empleados de Beta');
    assert(!generatedCsvContent.includes(companyBetaId), 'Exportación CSV contiene EXACTAMENTE CERO companyId de Beta');

    // 6.5 Filtro malicioso por employeeId ajeno devuelve lista vacía sin filtrar datos ajenos
    const resFilterAlienEmp = await request(app)
      .get(`/api/v1/reports/attendance-consolidated?startDate=${startDateStr}&endDate=${endDateStr}&employeeId=${empBetaId}`)
      .set('Authorization', `Bearer ${tokenAdminAlpha}`);

    assert(resFilterAlienEmp.status === 200, 'Consulta con employeeId ajeno responde con HTTP 200');
    const recordsAlienFilter = resFilterAlienEmp.body.data || resFilterAlienEmp.body;
    assert(Array.isArray(recordsAlienFilter) && recordsAlienFilter.length === 0, 
      'Consulta con employeeId de Beta devuelve lista VACÍA (0 registros), sin fuga de datos');

    // -------------------------------------------------------------------------
    // 7. MÓDULO SETTINGS
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Aislamiento en Módulo Settings ---');
    const resUpdateSettingsA = await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${tokenAdminAlpha}`)
      .send({
        companyName: 'Alpha Exclusiva Config',
        latenessToleranceMin: 22,
        faceConfidenceThreshold: 0.90
      });

    assert(resUpdateSettingsA.status === 200, 'Alpha actualiza su configuración con HTTP 200');

    const resGetSettingsB = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${tokenAdminBeta}`);
    
    assert(resGetSettingsB.status === 200, 'Beta consulta configuración con HTTP 200');
    assert(resGetSettingsB.body.companyName !== 'Alpha Exclusiva Config', 'Configuración de Beta está completamente aislada de la de Alpha');

    // -------------------------------------------------------------------------
    // 8. AUDITORÍA DEL SUPER ADMIN CON X-TENANT-ID
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Auditoría del Super Admin con x-tenant-id ---');
    // Super Admin ejecuta una acción sobre Alpha enviando x-tenant-id
    const resSuperAdminAction = await request(app)
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .set('x-tenant-id', companyAlphaId)
      .send({ name: 'Departamento Creado por SuperAdmin' });

    assert(resSuperAdminAction.status === 201, `Super Admin opera sobre inquilino con x-tenant-id con HTTP 201 (obtuvo ${resSuperAdminAction.status})`);

    // Esperar brevemente a que el evento finish de Express complete la escritura en BD
    await new Promise(r => setTimeout(r, 200));

    // Verificar en AdminAuditLog que existe el registro con performedById: superAdminId y companyId: companyAlphaId
    const auditLogs = await prismaAdmin.adminAuditLog.findMany({
      where: {
        companyId: companyAlphaId,
        performedById: superAdminId
      }
    });

    assert(auditLogs.length > 0, 'Se registró automáticamente una entrada en AdminAuditLog para el Super Admin');
    const logEntry = auditLogs[0];
    assert(logEntry.performedById === superAdminId, `Log registra performedById correcto (${superAdminId})`);
    assert(logEntry.companyId === companyAlphaId, `Log registra companyId afectado correcto (${companyAlphaId})`);

  } finally {
    // -------------------------------------------------------------------------
    // TEARDOWN: Limpieza determinista
    // -------------------------------------------------------------------------
    console.log('\n--- Limpieza determinista de datos de prueba ---');
    const coIds = [companyAlphaId, companyBetaId].filter(Boolean);
    if (coIds.length > 0) {
      await prismaAdmin.attendanceRecord.deleteMany({ where: { companyId: { in: coIds } } });
      await prismaAdmin.eventRequest.deleteMany({ where: { companyId: { in: coIds } } });
      await prismaAdmin.notification.deleteMany({ where: { companyId: { in: coIds } } });
      await prismaAdmin.adminAuditLog.deleteMany({ where: { companyId: { in: coIds } } });
      await prismaAdmin.employeeShift.deleteMany({ where: { companyId: { in: coIds } } });
      await prismaAdmin.departmentShift.deleteMany({ where: { companyId: { in: coIds } } });
      await prismaAdmin.employee.deleteMany({ where: { companyId: { in: coIds } } });
      await prismaAdmin.department.deleteMany({ where: { companyId: { in: coIds } } });
      await prismaAdmin.shift.deleteMany({ where: { companyId: { in: coIds } } });
      await prismaAdmin.systemSettings.deleteMany({ where: { companyId: { in: coIds } } });
      await prismaAdmin.adminUser.deleteMany({ where: { companyId: { in: coIds } } });
      await prismaAdmin.company.deleteMany({ where: { id: { in: coIds } } });
    }
    if (superAdminId) {
      await prismaAdmin.adminAuditLog.deleteMany({ where: { performedById: superAdminId } });
      await prismaAdmin.adminUser.deleteMany({ where: { id: superAdminId } });
    }
    console.log('Teardown completado exitosamente.');
  }

  console.log(`\nResultado final: ${passed} pasadas, ${failed} fallidas\n`);
  if (failed > 0) {
    throw new Error(`Fallaron ${failed} aserciones en test_lote2_isolation.`);
  }
}

if (require.main === module) {
  runLote2IsolationTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error fatal en prueba de Lote 2:', err);
      process.exit(1);
    });
}

module.exports = { runLote2IsolationTests };
