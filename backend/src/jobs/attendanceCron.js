const cron = require('node-cron');
const prisma = require('../utils/prisma');

// Función principal para procesar el auto-cierre de asistencia
const processAutoCheckout = async () => {
  console.log('[CRON] Iniciando verificación de auto-cierre de asistencia...');
  
  try {
    const settings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    if (!settings) {
      console.error('[CRON] No se encontraron configuraciones del sistema.');
      return;
    }

    // Buscar todos los registros sin salida (abiertos)
    const openRecords = await prisma.attendanceRecord.findMany({
      where: { salida: null },
      include: {
        employee: {
          include: {
            shifts: { include: { shift: true } },
            department: {
              include: { shifts: { include: { shift: true } } }
            }
          }
        },
        shift: true // Por si el registro ya tiene el shift guardado explícitamente
      }
    });

    const now = new Date();
    let closedCount = 0;

    for (const record of openRecords) {
      // 1. Determinar el turno aplicable (Cascada)
      let activeShift = null;

      if (record.shift) {
        activeShift = record.shift;
      } else if (record.employee.shifts && record.employee.shifts.length > 0) {
        activeShift = record.employee.shifts[0].shift; // Simplificación: tomar el primero
      } else if (record.employee.department && record.employee.department.shifts && record.employee.department.shifts.length > 0) {
        activeShift = record.employee.department.shifts[0].shift;
      }

      // 2. Determinar la hora de salida esperada
      let endHour, endMinute;
      
      if (activeShift && activeShift.endTime) {
        const parts = activeShift.endTime.split(':');
        endHour = parseInt(parts[0], 10);
        endMinute = parseInt(parts[1], 10);
      } else {
        endHour = settings.workdayEndHour;
        endMinute = settings.workdayEndMinute;
      }

      // 3. Calcular el objeto Date de la hora de salida correspondiente al día del registro
      const baseDate = new Date(record.entrada || record.date);
      let expectedEnd = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), endHour, endMinute, 0, 0);

      // 4. Manejo de turnos nocturnos (si la hora de fin es menor a la hora de inicio, el turno cruza la medianoche)
      let startHour = settings.workdayStartHour;
      if (activeShift && activeShift.startTime) {
        startHour = parseInt(activeShift.startTime.split(':')[0], 10);
      }
      
      if (endHour < startHour) {
        // Cruza la medianoche, la salida esperada es al día siguiente de la entrada
        expectedEnd.setDate(expectedEnd.getDate() + 1);
      }

      // 5. Comparar si ya pasó el tiempo de salida esperado
      // Agregamos un colchón de 4 horas después del fin de turno para darles chance a marcar horas extras o salida tardía.
      // Si ya pasó ese colchón y no checaron salida, entonces el sistema asume que se les olvidó y los cierra a su hora oficial.
      const bufferMs = 4 * 60 * 60 * 1000; // 4 horas
      
      if (now > new Date(expectedEnd.getTime() + bufferMs)) {
        // Ya pasó el tiempo máximo, debemos cerrarlo automáticamente
        
        await prisma.attendanceRecord.update({
          where: { id: record.id },
          data: {
            salida: expectedEnd, // Le asignamos la hora oficial de salida esperada
            isAutoClosed: true,
            earlyExitReason: 'Cierre automático por sistema'
          }
        });

        console.log(`[CRON] Auto-cierre aplicado para empleado ${record.employee.firstName} ${record.employee.lastName}. Salida asignada: ${expectedEnd.toISOString()}`);
        closedCount++;
      }
    }

    console.log(`[CRON] Verificación terminada. Se cerraron ${closedCount} registros automáticamente.`);

  } catch (error) {
    console.error('[CRON] Error al procesar auto-cierre:', error);
  }
};

// Función para inicializar el Cron Job
const initAttendanceCron = () => {
  // Ejecutar todos los días a las 23:59 con timezone de México
  cron.schedule('59 23 * * *', processAutoCheckout, {
    scheduled: true,
    timezone: "America/Mexico_City"
  });
  console.log('[CRON] Tarea de auto-cierre programada (23:59 America/Mexico_City).');
};

// Función de "catch-up" para correr al arrancar el servidor
const runCatchUp = async () => {
  console.log('[CATCH-UP] Ejecutando catch-up de asistencia al arranque...');
  await processAutoCheckout();
};

module.exports = {
  initAttendanceCron,
  runCatchUp,
  processAutoCheckout
};
