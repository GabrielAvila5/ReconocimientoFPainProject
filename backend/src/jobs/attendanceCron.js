const cron = require('node-cron');
const prisma = require('../utils/prisma');
const { getStartOfDay, getShiftExpectedEndDate, DEFAULT_TZ } = require('../utils/timeUtils');

// Función principal para procesar el auto-cierre de asistencia
const processAutoCheckout = async (employeeId = null) => {
  const scopeMsg = employeeId ? `para empleado ${employeeId}` : 'global';
  console.log(`[CRON] Iniciando verificación de auto-cierre de asistencia (${scopeMsg})...`);
  
  try {
    const settings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    if (!settings) {
      console.error('[CRON] No se encontraron configuraciones del sistema.');
      return 0;
    }

    const tz = settings.timezone || DEFAULT_TZ;
    const now = new Date();
    const currentStartOfDay = getStartOfDay(now, tz);

    const whereClause = { salida: null };
    if (employeeId) {
      whereClause.employeeId = employeeId;
    }

    // Buscar todos los registros sin salida (abiertos)
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
      // 1. Determinar el turno aplicable (Cascada: registro -> empleado -> departamento -> global)
      let activeShift = null;

      if (record.shift) {
        activeShift = record.shift;
      } else if (record.employee?.shifts && record.employee.shifts.length > 0) {
        activeShift = record.employee.shifts[0].shift;
      } else if (record.employee?.department?.shifts && record.employee.department.shifts.length > 0) {
        activeShift = record.employee.department.shifts[0].shift;
      }

      // 2. Determinar horario de inicio y fin
      let startTime, endTime;
      if (activeShift && activeShift.endTime) {
        startTime = activeShift.startTime || '08:00';
        endTime = activeShift.endTime;
      } else {
        startTime = `${String(settings.workdayStartHour ?? 8).padStart(2, '0')}:${String(settings.workdayStartMinute ?? 0).padStart(2, '0')}`;
        endTime = `${String(settings.workdayEndHour ?? 17).padStart(2, '0')}:${String(settings.workdayEndMinute ?? 0).padStart(2, '0')}`;
      }

      // 3. Calcular fecha/hora de salida esperada exacta en timezone configurado
      const recordDate = record.date || record.entrada;
      let expectedEnd = getShiftExpectedEndDate(recordDate, startTime, endTime, tz);

      // 4. Verificar si hay un evento OVERTIME activo para extender la hora de salida
      const recordStartOfDay = getStartOfDay(recordDate, tz);
      const overtimeEvent = await prisma.eventRequest.findFirst({
        where: {
          employeeId: record.employeeId,
          date: recordStartOfDay,
          type: 'OVERTIME',
          status: 'ACTIVE'
        },
        orderBy: { createdAt: 'desc' }
      });

      if (overtimeEvent && overtimeEvent.endTime) {
        expectedEnd = new Date(overtimeEvent.endTime);
      }

      // 5. Determinar si debe cerrarse:
      // a) Si el registro es de un día anterior (record.date < currentStartOfDay), se cierra de inmediato
      // b) Si es de hoy, se añade colchón de 4 horas para dar margen de horas extra / salida demorada
      const isPastDay = new Date(record.date).getTime() < currentStartOfDay.getTime();
      const bufferMs = 4 * 60 * 60 * 1000; // 4 horas
      const bufferExpired = now.getTime() > (expectedEnd.getTime() + bufferMs);

      if (isPastDay || bufferExpired) {
        await prisma.attendanceRecord.update({
          where: { id: record.id },
          data: {
            salida: expectedEnd, // Asignar la hora oficial de salida esperada en timezone correcto
            isAutoClosed: true,
            earlyExitReason: 'Cierre automático por sistema'
          }
        });

        const empName = record.employee ? `${record.employee.firstName} ${record.employee.lastName}` : record.employeeId;
        console.log(`[CRON] Auto-cierre aplicado para empleado ${empName}. Salida asignada: ${expectedEnd.toISOString()} (${isPastDay ? 'Día anterior' : 'Colchón expirado'})`);
        closedCount++;
      }
    }

    console.log(`[CRON] Verificación terminada. Se cerraron ${closedCount} registros automáticamente.`);
    return closedCount;

  } catch (error) {
    console.error('[CRON] Error al procesar auto-cierre:', error);
    return 0;
  }
};

const processAbsences = async () => {
  console.log('[CRON] Iniciando verificación de inasistencias...');
  try {
    const settings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    const tz = settings?.timezone || DEFAULT_TZ;
    const now = new Date();
    const startOfDay = getStartOfDay(now, tz);

    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true }
    });

    let absenceCount = 0;
    for (const emp of employees) {
      const record = await prisma.attendanceRecord.findFirst({
        where: { employeeId: emp.id, date: startOfDay }
      });

      if (!record) {
        absenceCount++;
        const msg = `${emp.firstName} ${emp.lastName} no registró asistencia el día de hoy.`;
        
        await prisma.notification.create({
          data: {
            title: 'Falta por Inasistencia',
            message: msg,
            type: 'WARNING',
            category: 'attendance',
            entityId: emp.id
          }
        });
      }
    }
    console.log(`[CRON] Verificación terminada. Se registraron ${absenceCount} inasistencias.`);
  } catch (error) {
    console.error('[CRON] Error al procesar inasistencias:', error);
  }
};

// Función para marcar como EXPIRED las solicitudes de dispositivo pendientes vencidas
const cleanExpiredDeviceAuthRequests = async () => {
  try {
    const res = await prisma.deviceAuthRequest.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() }
      },
      data: {
        status: 'EXPIRED'
      }
    });
    if (res.count > 0) {
      console.log(`[CRON] Se marcaron ${res.count} solicitudes de emparejamiento de dispositivo como EXPIRED.`);
    }
  } catch (error) {
    console.error('[CRON] Error al limpiar solicitudes expiradas:', error);
  }
};

// Función para inicializar los Cron Jobs
const initAttendanceCron = () => {
  // Ejecutar verificación de auto-cierre cada 15 minutos
  cron.schedule('*/15 * * * *', async () => {
    await processAutoCheckout();
  });

  // Ejecutar verificación de inasistencias a las 23:59 todos los días (hora de México)
  cron.schedule('59 23 * * *', async () => {
    await processAutoCheckout();
    await processAbsences();
  }, {
    scheduled: true,
    timezone: "America/Mexico_City"
  });

  // Limpieza de solicitudes expiradas cada 10 minutos
  cron.schedule('*/10 * * * *', async () => {
    await cleanExpiredDeviceAuthRequests();
  });

  console.log('[CRON] Tareas periódicas de auto-cierre (cada 15m), inasistencias (23:59) y limpieza programadas.');
};

// Función de "catch-up" para correr al arrancar el servidor
const runCatchUp = async () => {
  console.log('[CATCH-UP] Ejecutando catch-up de asistencia y limpieza al arranque...');
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
