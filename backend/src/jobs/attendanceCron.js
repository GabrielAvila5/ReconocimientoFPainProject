const cron = require('node-cron');
const prisma = require('../utils/prisma');
const { cleanExpiredPairingRequests } = require('../utils/authHelpers');
const { runWithTenantContext } = require('../middlewares/tenantContext');
const { getStartOfDay, getShiftExpectedEndDate, DEFAULT_TZ } = require('../utils/timeUtils');

/**
 * Procesa el auto-cierre de asistencia para un inquilino específico
 */
const processAutoCheckoutForCompany = async (company, employeeId = null) => {
  return runWithTenantContext({ companyId: company.id }, async () => {
    try {
      const settings = await prisma.systemSettings.findFirst({
        where: { companyId: company.id }
      });

      const tz = settings?.timezone || company.timezone || DEFAULT_TZ;
      const now = new Date();
      const currentStartOfDay = getStartOfDay(now, tz);

      const whereClause = { salida: null, companyId: company.id };
      if (employeeId) {
        whereClause.employeeId = employeeId;
        whereClause.date = { lt: currentStartOfDay };
      }

      const openRecords = await prisma.attendanceRecord.findMany({
        where: whereClause,
        include: {
          employee: {
            include: {
              shifts: { include: { shift: true } },
              department: {
                include: { shifts: { include: { shift: true } } }
              }
            }
          },
          shift: true
        }
      });

      let closedCount = 0;

      for (const record of openRecords) {
        let activeShift = null;

        if (record.shift) {
          activeShift = record.shift;
        } else if (record.employee?.shifts && record.employee.shifts.length > 0) {
          activeShift = record.employee.shifts[0].shift;
        } else if (record.employee?.department?.shifts && record.employee.department.shifts.length > 0) {
          activeShift = record.employee.department.shifts[0].shift;
        }

        let startTime, endTime;
        if (activeShift && activeShift.endTime) {
          startTime = activeShift.startTime || '08:00';
          endTime = activeShift.endTime;
        } else {
          startTime = `${String(settings?.workdayStartHour ?? 8).padStart(2, '0')}:${String(settings?.workdayStartMinute ?? 0).padStart(2, '0')}`;
          endTime = `${String(settings?.workdayEndHour ?? 17).padStart(2, '0')}:${String(settings?.workdayEndMinute ?? 0).padStart(2, '0')}`;
        }

        const recordDate = record.date || record.entrada;
        let expectedEnd = getShiftExpectedEndDate(recordDate, startTime, endTime, tz);

        const recordStartOfDay = getStartOfDay(recordDate, tz);
        const overtimeEvent = await prisma.eventRequest.findFirst({
          where: {
            employeeId: record.employeeId,
            date: recordStartOfDay,
            type: 'OVERTIME',
            status: 'ACTIVE',
            companyId: company.id
          },
          orderBy: { createdAt: 'desc' }
        });

        if (overtimeEvent && overtimeEvent.endTime) {
          expectedEnd = new Date(overtimeEvent.endTime);
        }

        const isPastDay = new Date(record.date).getTime() < currentStartOfDay.getTime();
        const bufferMs = 4 * 60 * 60 * 1000;
        const bufferExpired = now.getTime() > (expectedEnd.getTime() + bufferMs);

        if (isPastDay || bufferExpired) {
          await prisma.attendanceRecord.update({
            where: { id: record.id },
            data: {
              salida: expectedEnd,
              isAutoClosed: true,
              earlyExitReason: 'Cierre automático por sistema'
            }
          });
          closedCount++;
        }
      }

      return closedCount;
    } catch (error) {
      console.error(`[CRON] Error en auto-cierre para empresa ${company.id}:`, error.message);
      return 0;
    }
  });
};

/**
 * Función principal para procesar auto-cierre: itera todas las empresas activas
 */
const processAutoCheckout = async (employeeId = null, targetCompanyId = null) => {
  if (!employeeId) {
    console.log('[CRON] Iniciando auto-cierre de asistencia (global)...');
  }

  try {
    if (targetCompanyId) {
      const comp = await prisma.company.findUnique({ where: { id: targetCompanyId } });
      if (comp) return await processAutoCheckoutForCompany(comp, employeeId);
      return 0;
    }

    const companies = await prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, timezone: true }
    });

    let totalClosed = 0;
    for (const comp of companies) {
      const count = await processAutoCheckoutForCompany(comp, employeeId);
      totalClosed += count;
    }

    console.log(`[CRON] Auto-cierre finalizado en ${companies.length} empresas. Registros cerrados: ${totalClosed}`);
    return totalClosed;
  } catch (err) {
    console.error('[CRON] Error al iterar empresas para auto-cierre:', err.message);
    return 0;
  }
};

/**
 * Procesa inasistencias iterando las empresas activas con garantía de idempotencia (lastAbsenceDateRun).
 */
const processAbsences = async (targetCompanyId = null) => {
  console.log('[CRON] Iniciando verificación de inasistencias...');
  try {
    const whereClause = { isActive: true };
    if (targetCompanyId) {
      whereClause.id = targetCompanyId;
    }

    const companies = await prisma.company.findMany({
      where: whereClause,
      select: { id: true, timezone: true, lastAbsenceDateRun: true }
    });

    let totalAbsences = 0;
    for (const comp of companies) {
      const absencesInComp = await runWithTenantContext({ companyId: comp.id }, async () => {
        const settings = await prisma.systemSettings.findFirst({ where: { companyId: comp.id } });
        const tz = settings?.timezone || comp.timezone || DEFAULT_TZ;
        const now = new Date();
        const startOfDay = getStartOfDay(now, tz);

        // 1. Verificación de Idempotencia: Si ya corrió hoy en la fecha de la empresa, omitir
        if (comp.lastAbsenceDateRun) {
          const lastRunStr = new Date(comp.lastAbsenceDateRun).toISOString().split('T')[0];
          const todayStr = startOfDay.toISOString().split('T')[0];
          if (lastRunStr === todayStr) {
            console.log(`[CRON] Inasistencias ya procesadas hoy (${todayStr}) para empresa ${comp.id}. Omitiendo.`);
            return 0;
          }
        }

        const employees = await prisma.employee.findMany({
          where: { isActive: true, companyId: comp.id },
          select: { id: true, firstName: true, lastName: true }
        });

        let compAbsences = 0;
        for (const emp of employees) {
          const record = await prisma.attendanceRecord.findFirst({
            where: { employeeId: emp.id, date: startOfDay, companyId: comp.id }
          });

          if (!record) {
            compAbsences++;
            await prisma.notification.create({
              data: {
                title: 'Falta por Inasistencia',
                message: `${emp.firstName} ${emp.lastName} no registró asistencia el día de hoy.`,
                type: 'WARNING',
                category: 'attendance',
                entityId: emp.id,
                companyId: comp.id
              }
            });
          }
        }

        // 2. Registrar fecha de ejecución para idempotencia
        await prisma.company.update({
          where: { id: comp.id },
          data: { lastAbsenceDateRun: startOfDay }
        });

        return compAbsences;
      });

      totalAbsences += absencesInComp;
    }

    console.log(`[CRON] Verificación de inasistencias finalizada. Total registradas: ${totalAbsences}`);
    return totalAbsences;
  } catch (error) {
    console.error('[CRON] Error al procesar inasistencias:', error);
    return 0;
  }
};

/**
 * Limpieza de solicitudes de emparejamiento expiradas (usa helper pre-auth)
 */
const cleanExpiredDeviceAuthRequests = async () => {
  try {
    const res = await cleanExpiredPairingRequests();
    if (res.count > 0) {
      console.log(`[CRON] Se marcaron ${res.count} solicitudes de emparejamiento como EXPIRED.`);
    }
    return res.count;
  } catch (error) {
    console.error('[CRON] Error al limpiar solicitudes expiradas:', error);
    return 0;
  }
};

const initAttendanceCron = () => {
  cron.schedule('*/15 * * * *', async () => {
    await processAutoCheckout();
  });

  cron.schedule('59 23 * * *', async () => {
    await processAutoCheckout();
    await processAbsences();
  }, {
    scheduled: true,
    timezone: "America/Mexico_City"
  });

  cron.schedule('*/10 * * * *', async () => {
    await cleanExpiredDeviceAuthRequests();
  });

  console.log('[CRON] Tareas multi-tenant inicializadas.');
};

const runCatchUp = async () => {
  console.log('[CATCH-UP] Ejecutando catch-up multi-tenant al arranque...');
  await processAutoCheckout();
  await cleanExpiredDeviceAuthRequests();
};

module.exports = {
  initAttendanceCron,
  runCatchUp,
  processAutoCheckout,
  processAbsences,
  cleanExpiredDeviceAuthRequests
};
