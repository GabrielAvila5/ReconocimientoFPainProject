/**
 * statusUtils.js
 * Motor centralizado para evaluación de estados de asistencia diarios e snapshots inmutables.
 */

const prisma = require('./prisma');
const prismaAdmin = require('./prismaAdmin');
const { getTzParts, getStartOfDay } = require('./timeUtils');
const { getShiftForDate, findMatchingHoliday } = require('./shiftUtils');

const DEFAULT_TZ = 'America/Mexico_City';

/**
 * Evalúa el estado de asistencia de un empleado para una fecha determinada.
 */
function evaluateEmployeeDayStatus({
  employee,
  shift,
  attendanceRecord,
  events = [],
  holidays = [],
  date = new Date(),
  timeZone = DEFAULT_TZ,
  settings = null
}) {
  const parts = getTzParts(date, timeZone);
  const startOfDay = getStartOfDay(date, timeZone);
  const targetDateStr = parts.dateStr;

  // 1. Verificar si hay un evento activo aplicable a este empleado y fecha
  const activeEvent = events.find(ev => {
    if (ev.status && ev.status !== 'ACTIVE') return false;
    let evDateStr = '';
    if (ev.date instanceof Date) {
      evDateStr = ev.date.toISOString().slice(0, 10);
    } else if (typeof ev.date === 'string') {
      evDateStr = ev.date.slice(0, 10);
    }
    
    // Si tiene rango (ej. VACATION / DISABILITY con dateTo)
    if (ev.dateTo) {
      let evDateToStr = '';
      if (ev.dateTo instanceof Date) {
        evDateToStr = ev.dateTo.toISOString().slice(0, 10);
      } else if (typeof ev.dateTo === 'string') {
        evDateToStr = ev.dateTo.slice(0, 10);
      }
      return targetDateStr >= evDateStr && targetDateStr <= evDateToStr;
    }

    return evDateStr === targetDateStr;
  });

  if (activeEvent) {
    if (activeEvent.type === 'VACATION') {
      return {
        status: 'VACACIONES',
        isWorkDay: false,
        expectedStartTime: null,
        expectedEndTime: null,
        appliedToleranceMin: null,
        lateMinutes: 0,
        overtimeMinutes: 0,
        earlyExitMinutes: 0,
        shiftId: shift?.id || null,
        shiftName: shift?.name || null,
        attendanceRecordId: attendanceRecord?.id || null,
        notes: activeEvent.reason || 'Vacaciones aprobadas'
      };
    }
    if (activeEvent.type === 'DISABILITY') {
      return {
        status: 'INCAPACIDAD',
        isWorkDay: false,
        expectedStartTime: null,
        expectedEndTime: null,
        appliedToleranceMin: null,
        lateMinutes: 0,
        overtimeMinutes: 0,
        earlyExitMinutes: 0,
        shiftId: shift?.id || null,
        shiftName: shift?.name || null,
        attendanceRecordId: attendanceRecord?.id || null,
        notes: activeEvent.reason || (activeEvent.certificateNumber ? `Incapacidad Folio: ${activeEvent.certificateNumber}` : 'Incapacidad médica')
      };
    }
    if (activeEvent.type === 'JUSTIFIED_ABSENCE') {
      return {
        status: 'PERMISO_JUSTIFICADO',
        isWorkDay: false,
        expectedStartTime: null,
        expectedEndTime: null,
        appliedToleranceMin: null,
        lateMinutes: 0,
        overtimeMinutes: 0,
        earlyExitMinutes: 0,
        shiftId: shift?.id || null,
        shiftName: shift?.name || null,
        attendanceRecordId: attendanceRecord?.id || null,
        notes: activeEvent.reason || 'Permiso con justificación'
      };
    }
    if (activeEvent.type === 'REST_DAY_OVERRIDE') {
      // Cambio especial de día de descanso
      if (!attendanceRecord || !attendanceRecord.entrada) {
        return {
          status: 'DESCANSO',
          isWorkDay: false,
          expectedStartTime: null,
          expectedEndTime: null,
          appliedToleranceMin: null,
          lateMinutes: 0,
          overtimeMinutes: 0,
          earlyExitMinutes: 0,
          shiftId: shift?.id || null,
          shiftName: shift?.name || null,
          attendanceRecordId: null,
          notes: activeEvent.reason || 'Día de descanso por excepción autorizada'
        };
      }
    }
  }

  // 2. Verificar si es Festivo Oficial
  const matchingHoliday = findMatchingHoliday(holidays, date, employee.departmentId, timeZone);
  if (matchingHoliday) {
    if (attendanceRecord && attendanceRecord.entrada) {
      return {
        status: 'FESTIVO_TRABAJADO',
        isWorkDay: false,
        expectedStartTime: null,
        expectedEndTime: null,
        appliedToleranceMin: null,
        lateMinutes: 0,
        overtimeMinutes: attendanceRecord.overtimeMinutes || 0,
        earlyExitMinutes: 0,
        shiftId: shift?.id || null,
        shiftName: shift?.name || null,
        attendanceRecordId: attendanceRecord.id,
        notes: `Festivo trabajado: ${matchingHoliday.name}`
      };
    }
    return {
      status: 'FESTIVO',
      isWorkDay: false,
      expectedStartTime: null,
      expectedEndTime: null,
      appliedToleranceMin: null,
      lateMinutes: 0,
      overtimeMinutes: 0,
      earlyExitMinutes: 0,
      shiftId: shift?.id || null,
      shiftName: shift?.name || null,
      attendanceRecordId: null,
      notes: `Día festivo: ${matchingHoliday.name}`
    };
  }

  // 3. Evaluar horario de turno para esta fecha
  const shiftInfo = getShiftForDate(shift, date, timeZone, settings);

  // Si para este turno y fecha es Día de Descanso
  if (!shiftInfo.isWorkDay) {
    if (attendanceRecord && attendanceRecord.entrada) {
      return {
        status: 'DESCANSO_TRABAJADO',
        isWorkDay: false,
        expectedStartTime: null,
        expectedEndTime: null,
        appliedToleranceMin: null,
        lateMinutes: 0,
        overtimeMinutes: attendanceRecord.overtimeMinutes || 0,
        earlyExitMinutes: 0,
        shiftId: shift?.id || null,
        shiftName: shift?.name || null,
        attendanceRecordId: attendanceRecord.id,
        notes: 'Asistencia registrada en día de descanso'
      };
    }
    return {
      status: 'DESCANSO',
      isWorkDay: false,
      expectedStartTime: null,
      expectedEndTime: null,
      appliedToleranceMin: null,
      lateMinutes: 0,
      overtimeMinutes: 0,
      earlyExitMinutes: 0,
      shiftId: shift?.id || null,
      shiftName: shift?.name || null,
      attendanceRecordId: null,
      notes: 'Día de descanso'
    };
  }

  // 4. Es Día Laboral
  if (attendanceRecord && attendanceRecord.entrada) {
    let status = 'PRESENTE';
    let lateMins = 0;

    if (attendanceRecord.isLate) {
      status = 'RETARDO';
      lateMins = attendanceRecord.lateMinutes || 0;
    }

    return {
      status,
      isWorkDay: true,
      expectedStartTime: shiftInfo.startTime,
      expectedEndTime: shiftInfo.endTime,
      appliedToleranceMin: shiftInfo.tolerance,
      lateMinutes: lateMins,
      overtimeMinutes: attendanceRecord.overtimeMinutes || 0,
      earlyExitMinutes: attendanceRecord.earlyExit ? (attendanceRecord.earlyExitMinutes || 0) : 0,
      shiftId: shift?.id || null,
      shiftName: shift?.name || null,
      attendanceRecordId: attendanceRecord.id,
      notes: status === 'RETARDO' ? `Entrada con ${lateMins} min de retardo` : null
    };
  }

  // Es día laboral y no registró entrada
  return {
    status: 'FALTA',
    isWorkDay: true,
    expectedStartTime: shiftInfo.startTime,
    expectedEndTime: shiftInfo.endTime,
    appliedToleranceMin: shiftInfo.tolerance,
    lateMinutes: 0,
    overtimeMinutes: 0,
    earlyExitMinutes: 0,
    shiftId: shift?.id || null,
    shiftName: shift?.name || null,
    attendanceRecordId: null,
    notes: 'Inasistencia sin justificar'
  };
}

/**
 * Guarda o actualiza de manera idempotente un snapshot de estado diario en AttendanceDayStatus.
 */
async function persistDayStatusSnapshot(prismaClient, {
  companyId,
  employeeId,
  date,
  statusData,
  lastModifiedById = null,
  lastModifiedReason = null
}) {
  const startOfDay = getStartOfDay(date);

  return await prismaClient.attendanceDayStatus.upsert({
    where: {
      companyId_employeeId_date: {
        companyId,
        employeeId,
        date: startOfDay
      }
    },
    create: {
      companyId,
      employeeId,
      date: startOfDay,
      status: statusData.status,
      shiftId: statusData.shiftId || null,
      shiftName: statusData.shiftName || null,
      expectedStartTime: statusData.expectedStartTime || null,
      expectedEndTime: statusData.expectedEndTime || null,
      appliedToleranceMin: statusData.appliedToleranceMin || null,
      isWorkDay: statusData.isWorkDay !== undefined ? statusData.isWorkDay : true,
      lateMinutes: statusData.lateMinutes || 0,
      overtimeMinutes: statusData.overtimeMinutes || 0,
      earlyExitMinutes: statusData.earlyExitMinutes || 0,
      notes: statusData.notes || null,
      attendanceRecordId: statusData.attendanceRecordId || null,
      isLocked: true,
      lastModifiedById,
      lastModifiedReason
    },
    update: {
      status: statusData.status,
      shiftId: statusData.shiftId || null,
      shiftName: statusData.shiftName || null,
      expectedStartTime: statusData.expectedStartTime || null,
      expectedEndTime: statusData.expectedEndTime || null,
      appliedToleranceMin: statusData.appliedToleranceMin || null,
      isWorkDay: statusData.isWorkDay !== undefined ? statusData.isWorkDay : true,
      lateMinutes: statusData.lateMinutes || 0,
      overtimeMinutes: statusData.overtimeMinutes || 0,
      earlyExitMinutes: statusData.earlyExitMinutes || 0,
      notes: statusData.notes || null,
      attendanceRecordId: statusData.attendanceRecordId || null,
      lastModifiedById: lastModifiedById || undefined,
      lastModifiedReason: lastModifiedReason || undefined
    }
  });
}

/**
 * Consulta y evalúa en lote el estado de asistencia de empleados en un rango de fechas.
 * Cero consultas N+1: resuelve todo con 6 queries agrupadas y reutiliza snapshots congelados.
 */
async function getCompanyAttendanceRangeStatus({
  companyId,
  startDate,
  endDate,
  departmentId = null,
  employeeId = null,
  prismaClient = prisma
}) {
  const company = await prismaClient.company.findUnique({
    where: { id: companyId },
    select: { id: true, timezone: true }
  });
  const tz = company?.timezone || DEFAULT_TZ;

  const startUtc = getStartOfDay(startDate, tz);
  const endUtc = getStartOfDay(endDate, tz);

  // 1. Obtener empleados aplicables
  const empWhere = { companyId, isActive: true };
  if (departmentId) empWhere.departmentId = parseInt(departmentId, 10);
  if (employeeId) empWhere.id = employeeId;

  const employees = await prismaClient.employee.findMany({
    where: empWhere,
    include: {
      shifts: { include: { shift: true } },
      department: {
        include: {
          shifts: { include: { shift: true } }
        }
      }
    }
  });

  if (employees.length === 0) {
    return [];
  }

  const empIds = employees.map(e => e.id);

  // 2. Cargar datos en bloque dentro del rango
  const [
    existingSnapshots,
    attendanceRecords,
    events,
    holidays,
    settings
  ] = await Promise.all([
    prismaClient.attendanceDayStatus.findMany({
      where: {
        companyId,
        employeeId: { in: empIds },
        date: { gte: startUtc, lte: endUtc }
      }
    }),
    prismaClient.attendanceRecord.findMany({
      where: {
        companyId,
        employeeId: { in: empIds },
        date: { gte: startUtc, lte: endUtc }
      }
    }),
    prismaClient.eventRequest.findMany({
      where: {
        companyId,
        employeeId: { in: empIds },
        status: 'ACTIVE',
        OR: [
          { date: { gte: startUtc, lte: endUtc } },
          { dateTo: { gte: startUtc } }
        ]
      }
    }),
    prismaClient.companyHoliday.findMany({
      where: {
        companyId,
        date: { gte: startUtc, lte: endUtc }
      }
    }),
    prismaClient.systemSettings.findFirst({
      where: { companyId }
    })
  ]);

  // Indexar datos para búsqueda O(1)
  const snapshotMap = new Map();
  existingSnapshots.forEach(s => {
    const key = `${s.employeeId}_${s.date.toISOString().slice(0, 10)}`;
    snapshotMap.set(key, s);
  });

  const attendanceMap = new Map();
  attendanceRecords.forEach(a => {
    const key = `${a.employeeId}_${a.date.toISOString().slice(0, 10)}`;
    attendanceMap.set(key, a);
  });

  const employeeEventsMap = new Map();
  events.forEach(ev => {
    const list = employeeEventsMap.get(ev.employeeId) || [];
    list.push(ev);
    employeeEventsMap.set(ev.employeeId, list);
  });

  // Generar lista de fechas en el rango
  const dates = [];
  let curr = new Date(startUtc);
  while (curr <= endUtc) {
    dates.push(new Date(curr));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  const results = [];

  for (const emp of employees) {
    // Determinar turno asignado al empleado
    const assignedShift = emp.shifts?.[0]?.shift || emp.department?.shifts?.[0]?.shift || null;
    const empEvents = employeeEventsMap.get(emp.id) || [];

    for (const d of dates) {
      const dateKey = `${emp.id}_${d.toISOString().slice(0, 10)}`;
      const savedSnapshot = snapshotMap.get(dateKey);

      if (savedSnapshot && savedSnapshot.isLocked) {
        // Usar snapshot inmutable persistido
        results.push({
          companyId,
          employeeId: emp.id,
          employee: {
            id: emp.id,
            firstName: emp.firstName,
            lastName: emp.lastName,
            identifier: emp.identifier,
            departmentId: emp.departmentId,
            departmentName: emp.department?.name || 'Sin departamento'
          },
          date: d,
          dateStr: d.toISOString().slice(0, 10),
          status: savedSnapshot.status,
          shiftId: savedSnapshot.shiftId,
          shiftName: savedSnapshot.shiftName,
          expectedStartTime: savedSnapshot.expectedStartTime,
          expectedEndTime: savedSnapshot.expectedEndTime,
          appliedToleranceMin: savedSnapshot.appliedToleranceMin,
          isWorkDay: savedSnapshot.isWorkDay,
          lateMinutes: savedSnapshot.lateMinutes,
          overtimeMinutes: savedSnapshot.overtimeMinutes,
          earlyExitMinutes: savedSnapshot.earlyExitMinutes,
          notes: savedSnapshot.notes,
          attendanceRecordId: savedSnapshot.attendanceRecordId,
          isLocked: true
        });
      } else {
        // Evaluar dinámicamente
        const att = attendanceMap.get(dateKey) || null;
        const evaluated = evaluateEmployeeDayStatus({
          employee: emp,
          shift: assignedShift,
          attendanceRecord: att,
          events: empEvents,
          holidays,
          date: d,
          timeZone: tz,
          settings
        });

        results.push({
          companyId,
          employeeId: emp.id,
          employee: {
            id: emp.id,
            firstName: emp.firstName,
            lastName: emp.lastName,
            identifier: emp.identifier,
            departmentId: emp.departmentId,
            departmentName: emp.department?.name || 'Sin departamento'
          },
          date: d,
          dateStr: d.toISOString().slice(0, 10),
          status: evaluated.status,
          shiftId: evaluated.shiftId,
          shiftName: evaluated.shiftName,
          expectedStartTime: evaluated.expectedStartTime,
          expectedEndTime: evaluated.expectedEndTime,
          appliedToleranceMin: evaluated.appliedToleranceMin,
          isWorkDay: evaluated.isWorkDay,
          lateMinutes: evaluated.lateMinutes,
          overtimeMinutes: evaluated.overtimeMinutes,
          earlyExitMinutes: evaluated.earlyExitMinutes,
          notes: evaluated.notes,
          attendanceRecordId: evaluated.attendanceRecordId,
          isLocked: false
        });
      }
    }
  }

  return results;
}

module.exports = {
  evaluateEmployeeDayStatus,
  persistDayStatusSnapshot,
  getCompanyAttendanceRangeStatus
};
