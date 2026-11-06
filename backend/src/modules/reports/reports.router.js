const express = require('express');
const router = express.Router();
const requireJwt = require('../../middlewares/requireJwt');
const prisma = require('../../utils/prisma');
const { getTzParts, getStartOfDay, getTzDate, getShiftExpectedEndDate, formatExpectedTime, DEFAULT_TZ } = require('../../utils/timeUtils');

router.use(requireJwt);

// --- Helpers ---
// Determine working days. Since Shift model lacks daysOfWeek, we assume Mon-Fri (1-5).
const isWorkingDay = (dateObj) => {
  const day = typeof dateObj.getUTCDay === 'function' ? dateObj.getUTCDay() : dateObj.getDay();
  return day >= 1 && day <= 5; // Lunes a Viernes
};

const getShiftCascadeForEmployees = async (employeeIds) => {
  const settings = await prisma.systemSettings.findFirst();
  const globalBreakStart = settings?.breakStartTime || '13:00';
  const globalBreakEnd = settings?.breakEndTime || '14:00';
  const globalShift = {
    id: -1,
    name: 'Horario Global',
    startTime: `${(settings?.workdayStartHour ?? 8).toString().padStart(2, '0')}:${(settings?.workdayStartMinute ?? 0).toString().padStart(2, '0')}`,
    endTime: `${(settings?.workdayEndHour ?? 17).toString().padStart(2, '0')}:${(settings?.workdayEndMinute ?? 0).toString().padStart(2, '0')}`,
    tolerance: settings?.latenessToleranceMin ?? 15,
    breakStartTime: globalBreakStart,
    breakEndTime: globalBreakEnd
  };

  const map = {};
  if (employeeIds && employeeIds.length > 0) {
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: {
        shifts: { include: { shift: true } },
        department: { include: { shifts: { include: { shift: true } } } }
      }
    });

    for (const emp of employees) {
      if (emp.shifts && emp.shifts.length > 0) {
        const s = emp.shifts[0].shift;
        map[emp.id] = {
          ...s,
          breakStartTime: s.breakStartTime || globalBreakStart,
          breakEndTime: s.breakEndTime || globalBreakEnd,
          tolerance: (s.tolerance !== undefined && s.tolerance !== null) ? s.tolerance : globalShift.tolerance
        };
      } else if (emp.department && emp.department.shifts && emp.department.shifts.length > 0) {
        const s = emp.department.shifts[0].shift;
        map[emp.id] = {
          ...s,
          breakStartTime: s.breakStartTime || globalBreakStart,
          breakEndTime: s.breakEndTime || globalBreakEnd,
          tolerance: (s.tolerance !== undefined && s.tolerance !== null) ? s.tolerance : globalShift.tolerance
        };
      } else {
        map[emp.id] = globalShift;
      }
    }
  }

  return { map, globalShift };
};

const buildEventMapForDateRange = async (start, end, employeeIds = null, department = null, extraEmployeeIds = []) => {
  const evtWhere = { 
    status: 'ACTIVE',
    date: { lte: end },
    OR: [
      { date: { gte: start } },
      { dateTo: { gte: start } } 
    ]
  };
  
  if (employeeIds && employeeIds.length > 0) {
    evtWhere.employeeId = { in: employeeIds };
  }
  if (department) {
    evtWhere.employee = { department: { name: department } };
  }

  const events = await prisma.eventRequest.findMany({
    where: evtWhere,
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } } },
      registeredBy: { select: { name: true } }
    }
  });

  const allEmpIds = [...new Set([
    ...events.map(e => e.employeeId),
    ...(extraEmployeeIds || [])
  ])];

  const { map: shiftMap, globalShift } = await getShiftCascadeForEmployees(allEmpIds);
  const expandedEvents = [];

  for (const evt of events) {
    const shift = shiftMap[evt.employeeId] || globalShift;
    if (evt.dateTo) {
      let currentDate = new Date(evt.date);
      const limitDate = new Date(evt.dateTo);
      const actualLimit = limitDate > end ? end : limitDate;
      
      while (currentDate <= actualLimit) {
        if (currentDate >= start) {
          if ((evt.type === 'OVERTIME' || isWorkingDay(currentDate)) && shift) {
            expandedEvents.push({ ...evt, dateStr: currentDate.toISOString().split('T')[0] });
          }
        }
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }
    } else {
      if (evt.date >= start && evt.date <= end) {
        expandedEvents.push({ ...evt, dateStr: new Date(evt.date).toISOString().split('T')[0] });
      }
    }
  }

  const eventMap = {};
  for (const evt of expandedEvents) {
    const key = `${evt.employeeId}_${evt.dateStr}`;
    if (!eventMap[key]) eventMap[key] = [];
    eventMap[key].push(evt);
  }

  return { eventMap, expandedEvents, shiftMap, globalShift };
};

// ============================================
// ENDPOINT: /api/v1/reports/kpis
// ============================================
router.get('/kpis', async (req, res) => {
  try {
    const settings = await prisma.systemSettings.findFirst();
    const tz = settings?.timezone || DEFAULT_TZ;
    let { startDate, endDate, department, employeeId } = req.query;
    
    if (!startDate || !endDate) {
      const now = new Date();
      const firstDay = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
      startDate = firstDay.toISOString();
      endDate = now.toISOString();
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Validar máximo 366 días (1 año)
    if ((end - start) / (1000 * 60 * 60 * 24) > 366) {
      return res.status(400).json({ error: 'El rango de fechas no puede superar 1 año (366 días)' });
    }

    const attWhere = { date: { gte: start, lte: end } };
    if (employeeId && employeeId !== 'ALL' && employeeId !== 'Todos los colaboradores') {
      attWhere.employeeId = employeeId;
    }
    if (department && department !== 'Todos los departamentos') {
      attWhere.employee = { department: { name: department } };
    }

    const attendances = await prisma.attendanceRecord.findMany({
      where: attWhere,
      select: {
        id: true,
        date: true,
        isLate: true,
        lateMinutes: true,
        entrada: true,
        salida: true,
        recesoInicio: true,
        recesoFin: true,
        overtimeMinutes: true,
        employeeId: true,
        shift: {
          select: { startTime: true, endTime: true, tolerance: true }
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } }
          }
        }
      }
    });

    const attEmpIds = attendances.map(a => a.employeeId);
    const { eventMap, expandedEvents, shiftMap, globalShift } = await buildEventMapForDateRange(
      start, 
      end, 
      (employeeId && employeeId !== 'ALL' && employeeId !== 'Todos los colaboradores') ? [employeeId] : null, 
      (department && department !== 'Todos los departamentos') ? department : null, 
      attEmpIds
    );

    // Calcular KPIs
    let aTiempo = 0;
    let tardanzasInjustificadas = 0;
    let ausenciasInjustificadas = 0; 
    let faltasJustificadas = 0;
    let tardanzasJustificadas = 0;
    let vacaciones = 0;
    let horasExtraMinutos = 0;

    let totalHorasTrabajadas = 0;
    let countHorasTrabajadas = 0;

    // Break KPIs
    let totalDescansos = 0;
    let totalDescansoMinutos = 0;
    let countDescansosCompletos = 0;
    let retornosTardios = 0;
    let sinRetorno = 0;
    let noTomado = 0;
    let aTiempoDescanso = 0;

    const trendMap = {}; 
    const peakHoursMap = {};

    const tardanzasList = [];
    const ausenciasList = [];
    const horasExtraList = [];

    for (const evt of expandedEvents) {
      if (evt.type === 'OVERTIME' && evt.minutes) {
        horasExtraMinutos += evt.minutes;
        horasExtraList.push({
          id: evt.id,
          employeeId: evt.employeeId,
          empleado: `${evt.employee?.firstName || ''} ${evt.employee?.lastName || ''}`.trim() || 'Empleado',
          departamento: evt.employee?.department?.name || 'General',
          fecha: evt.dateStr,
          minutos: evt.minutes,
          horas: +(evt.minutes / 60).toFixed(1),
          motivo: evt.reason || 'Horas extras autorizadas',
          aprobadoPor: evt.registeredBy?.name || 'Admin'
        });
      }
    }

    const attendanceMap = {}; 

    for (const att of attendances) {
      const dateStr = new Date(att.date).toISOString().split('T')[0];
      const key = `${att.employeeId}_${dateStr}`;
      attendanceMap[key] = true;

      const dayEvents = eventMap[key] || [];
      const hasVacation = dayEvents.some(e => e.type === 'VACATION');
      const hasJustifiedAbsence = dayEvents.some(e => e.type === 'JUSTIFIED_ABSENCE');
      const hasLateArrival = dayEvents.some(e => e.type === 'LATE_ARRIVAL');

      if (!trendMap[dateStr]) trendMap[dateStr] = { aTiempo: 0, tardanzas: 0, ausencias: 0, justificados: 0 };

      if (hasVacation) {
        vacaciones++;
        trendMap[dateStr].justificados++;
      } else if (hasJustifiedAbsence) {
        faltasJustificadas++;
        trendMap[dateStr].justificados++;
      } else if (att.isLate) {
        let minsLate = att.lateMinutes;
        const shift = att.shift || shiftMap[att.employeeId] || globalShift;
        if (!minsLate && att.entrada && shift && shift.startTime) {
          const [sh, sm] = shift.startTime.split(':').map(Number);
          const entParts = getTzParts(new Date(att.entrada), tz);
          const diff = (entParts.hour * 60 + entParts.minute) - (sh * 60 + sm);
          if (diff > 0) minsLate = diff;
        }

        if (hasLateArrival) {
          tardanzasJustificadas++;
          trendMap[dateStr].justificados++;
          aTiempo++; 
          tardanzasList.push({
            id: att.id,
            employeeId: att.employeeId,
            empleado: `${att.employee?.firstName || ''} ${att.employee?.lastName || ''}`.trim() || 'Empleado',
            departamento: att.employee?.department?.name || 'General',
            fecha: dateStr,
            entrada: att.entrada ? new Date(att.entrada).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: tz }) : 'N/A',
            minutosTarde: minsLate || 0,
            tipo: 'Tardanza Justificada',
            motivo: dayEvents.find(e => e.type === 'LATE_ARRIVAL')?.reason || 'Permiso aprobado'
          });
        } else {
          tardanzasInjustificadas++;
          trendMap[dateStr].tardanzas++;
          tardanzasList.push({
            id: att.id,
            employeeId: att.employeeId,
            empleado: `${att.employee?.firstName || ''} ${att.employee?.lastName || ''}`.trim() || 'Empleado',
            departamento: att.employee?.department?.name || 'General',
            fecha: dateStr,
            entrada: att.entrada ? new Date(att.entrada).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: tz }) : 'N/A',
            minutosTarde: minsLate || 0,
            tipo: 'Tardanza Injustificada',
            motivo: 'Llegada fuera de horario'
          });
        }
      } else {
        aTiempo++;
        trendMap[dateStr].aTiempo++;
      }

      // Horas extra registradas directamente en la asistencia
      if (att.overtimeMinutes && att.overtimeMinutes > 0) {
        const alreadyInList = horasExtraList.some(h => h.employeeId === att.employeeId && h.fecha === dateStr);
        if (!alreadyInList) {
          horasExtraMinutos += att.overtimeMinutes;
          horasExtraList.push({
            id: `att-ot-${att.id}`,
            employeeId: att.employeeId,
            empleado: `${att.employee?.firstName || ''} ${att.employee?.lastName || ''}`.trim() || 'Empleado',
            departamento: att.employee?.department?.name || 'General',
            fecha: dateStr,
            minutos: att.overtimeMinutes,
            horas: +(att.overtimeMinutes / 60).toFixed(1),
            motivo: 'Horas extra en jornada',
            aprobadoPor: 'Sistema'
          });
        }
      }

      if (att.entrada) {
        const ent = new Date(att.entrada);
        const parts = getTzParts(ent, tz);
        const m = parts.minute;
        const roundedMin = m < 15 ? '00' : m < 30 ? '15' : m < 45 ? '30' : '45';
        const timeKey = `${String(parts.hour).padStart(2, '0')}:${roundedMin}`;
        peakHoursMap[timeKey] = (peakHoursMap[timeKey] || 0) + 1;
      }

      let finalSalida = att.salida;
      if (!finalSalida && att.entrada) {
        const dayEvents = eventMap[`${att.employeeId}_${dateStr}`] || [];
        const overtimeEvent = dayEvents.find(e => e.type === 'OVERTIME');
        if (overtimeEvent && shiftMap && shiftMap[att.employeeId]) {
          const shift = shiftMap[att.employeeId];
          const expectedEnd = getShiftExpectedEndDate(att.date || att.entrada, shift.startTime, shift.endTime, tz);
          const autoExitDate = new Date(expectedEnd.getTime() + overtimeEvent.minutes * 60 * 1000);
          finalSalida = autoExitDate.toISOString();
        }
      }

      if (att.entrada && finalSalida) {
        const diff = (new Date(finalSalida) - new Date(att.entrada)) / (1000 * 60 * 60);
        totalHorasTrabajadas += diff;
        countHorasTrabajadas++;
      }

      // Break KPIs calculation
      if (!hasVacation && !hasJustifiedAbsence) {
        const shift = shiftMap[att.employeeId] || globalShift;
        const breakStart = shift.breakStartTime || globalShift.breakStartTime || '13:00';
        const breakEnd = shift.breakEndTime || globalShift.breakEndTime || '14:00';
        const [startH, startM] = breakStart.split(':').map(Number);
        const [endH, endM] = breakEnd.split(':').map(Number);
        const expectedDurationMins = (endH * 60 + endM) - (startH * 60 + startM);

        if (att.recesoInicio && att.recesoFin) {
          totalDescansos++;
          const durationMins = (new Date(att.recesoFin) - new Date(att.recesoInicio)) / (1000 * 60);
          totalDescansoMinutos += durationMins;
          countDescansosCompletos++;

          const tolerance = shift.tolerance ?? 15;
          if (durationMins > expectedDurationMins + tolerance) {
            retornosTardios++;
          } else {
            aTiempoDescanso++;
          }
        } else if (att.recesoInicio && !att.recesoFin) {
          sinRetorno++;
        } else if (att.entrada && !att.recesoInicio) {
          // Check if break time has passed today, or if exit recorded
          let isNoTomado = false;
          if (att.salida) {
            isNoTomado = true;
          } else {
            const now = new Date();
            const nowParts = getTzParts(now, tz);
            const nowLocalMins = nowParts.totalMinutes;
            const nowLocalDateStr = nowParts.dateStr;
            
            if (dateStr < nowLocalDateStr) {
              isNoTomado = true; // Past day
            } else if (dateStr === nowLocalDateStr) {
              if (nowLocalMins > (endH * 60 + endM)) {
                isNoTomado = true; // Today, but time passed
              }
            }
          }
          if (isNoTomado) {
            noTomado++;
          }
        }
      }
    }

    // Detectar Ausencias (Días hábiles sin asistencia ni justificación)
    const empWhere = { isActive: true };
    if (employeeId && employeeId !== 'ALL' && employeeId !== 'Todos los colaboradores') {
      empWhere.id = employeeId;
    }
    if (department && department !== 'Todos los departamentos') {
      empWhere.department = { name: department };
    }
    const activeEmployees = await prisma.employee.findMany({ 
      where: empWhere, 
      select: { 
        id: true,
        firstName: true,
        lastName: true,
        department: { select: { name: true } }
      } 
    });
    const empIds = activeEmployees.map(e => e.id);
    const { map: empShiftMap } = await getShiftCascadeForEmployees(empIds);

    let currentDate = new Date(start);
    const endAbsenceDate = new Date(end) > new Date() ? new Date() : new Date(end); 
    
    while (currentDate <= endAbsenceDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (!trendMap[dateStr]) trendMap[dateStr] = { aTiempo: 0, tardanzas: 0, ausencias: 0, justificados: 0 };

      if (isWorkingDay(currentDate)) {
        for (const emp of activeEmployees) {
          if (empShiftMap[emp.id]) {
            const key = `${emp.id}_${dateStr}`;
            if (!attendanceMap[key]) {
              const dayEvents = eventMap[key] || [];
              const isVacation = dayEvents.some(e => e.type === 'VACATION');
              const isJustified = dayEvents.some(e => e.type === 'JUSTIFIED_ABSENCE');
              
              if (isVacation) {
                vacaciones++;
                trendMap[dateStr].justificados++;
                ausenciasList.push({
                  id: `abs-${emp.id}-${dateStr}`,
                  employeeId: emp.id,
                  empleado: `${emp.firstName} ${emp.lastName}`,
                  departamento: emp.department?.name || 'General',
                  fecha: dateStr,
                  tipo: 'Vacaciones',
                  motivo: dayEvents.find(e => e.type === 'VACATION')?.reason || 'Vacaciones'
                });
              } else if (isJustified) {
                faltasJustificadas++;
                trendMap[dateStr].justificados++;
                ausenciasList.push({
                  id: `abs-${emp.id}-${dateStr}`,
                  employeeId: emp.id,
                  empleado: `${emp.firstName} ${emp.lastName}`,
                  departamento: emp.department?.name || 'General',
                  fecha: dateStr,
                  tipo: 'Falta Justificada',
                  motivo: dayEvents.find(e => e.type === 'JUSTIFIED_ABSENCE')?.reason || 'Permiso aprobado'
                });
              } else {
                ausenciasInjustificadas++;
                trendMap[dateStr].ausencias++;
                ausenciasList.push({
                  id: `abs-${emp.id}-${dateStr}`,
                  employeeId: emp.id,
                  empleado: `${emp.firstName} ${emp.lastName}`,
                  departamento: emp.department?.name || 'General',
                  fecha: dateStr,
                  tipo: 'Ausencia Injustificada',
                  motivo: 'Sin registro ni justificación'
                });
              }
            }
          }
        }
      }
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    tardanzasList.sort((a, b) => b.fecha.localeCompare(a.fecha));
    ausenciasList.sort((a, b) => b.fecha.localeCompare(a.fecha));
    horasExtraList.sort((a, b) => b.fecha.localeCompare(a.fecha));

    const totalAttendance = aTiempo + tardanzasInjustificadas + tardanzasJustificadas;
    const puntualidadPct = totalAttendance > 0 ? Math.round(((aTiempo + tardanzasJustificadas) / totalAttendance) * 100) : 0;
    const horasPromedio = countHorasTrabajadas > 0 ? (totalHorasTrabajadas / countHorasTrabajadas).toFixed(1) : 0;

    const trend = Object.keys(trendMap).sort().map(date => ({
      date,
      aTiempo: trendMap[date].aTiempo,
      tardanzas: trendMap[date].tardanzas,
      ausencias: trendMap[date].ausencias,
      justificados: trendMap[date].justificados
    }));

    const peakHours = Object.keys(peakHoursMap).sort().map(time => ({
      time,
      accesos: peakHoursMap[time]
    }));

    const promedioDescansoMinutos = countDescansosCompletos > 0 ? (totalDescansoMinutos / countDescansosCompletos).toFixed(1) : 0;

    res.json({
      kpis: {
        puntualidadPct,
        totalTardanzasInjustificadas: tardanzasInjustificadas,
        totalAusenciasInjustificadas: ausenciasInjustificadas,
        horasExtraAprobadas: +(horasExtraMinutos / 60).toFixed(1),
        horasPromedio: +horasPromedio
      },
      breakKpis: {
        totalDescansos,
        promedioDescansoMinutos: +promedioDescansoMinutos,
        retornosTardios,
        sinRetorno,
        noTomado,
        aTiempo: aTiempoDescanso
      },
      distribution: [
        { name: "A tiempo", value: aTiempo, color: "#10b981" },
        { name: "Tardanzas Injustificadas", value: tardanzasInjustificadas, color: "#eab308" },
        { name: "Ausencias Injustificadas", value: ausenciasInjustificadas, color: "#ef4444" },
        { name: "Faltas Justificadas", value: faltasJustificadas, color: "#10b981" },
        { name: "Vacaciones", value: vacaciones, color: "#3b82f6" },
        { name: "Tardanzas Justificadas", value: tardanzasJustificadas, color: "#f97316" }
      ],
      trend,
      peakHours,
      lists: {
        tardanzas: tardanzasList,
        ausencias: ausenciasList,
        horasExtra: horasExtraList
      }
    });

  } catch (error) {
    console.error('Error in /kpis:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ============================================
// ENDPOINT: /api/v1/reports/attendance-consolidated
// ============================================
router.get('/attendance-consolidated', async (req, res) => {
  try {
    const { startDate, endDate, department, employeeId, eventType, page = 1, limit = 20 } = req.query;
    
    const settings = await prisma.systemSettings.findFirst();
    const tz = settings?.timezone || DEFAULT_TZ;

    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate y endDate son requeridos' });

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if ((end - start) / (1000 * 60 * 60 * 24) > 366) {
      return res.status(400).json({ error: 'El rango de fechas no puede superar 1 año (366 días)' });
    }

    const attWhere = { date: { gte: start, lte: end } };
    if (employeeId && employeeId !== 'ALL' && employeeId !== 'Todos los colaboradores') {
      attWhere.employeeId = employeeId;
    }
    if (department && department !== 'Todos los departamentos') {
      attWhere.employee = { department: { name: department } };
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const maxDbFetch = Math.min(parsedPage * parsedLimit + 200, 2000);

    const attendances = await prisma.attendanceRecord.findMany({
      where: attWhere,
      take: maxDbFetch,
      orderBy: { date: 'desc' },
      select: {
        id: true,
        companyId: true,
        employeeId: true,
        date: true,
        entrada: true,
        salida: true,
        recesoInicio: true,
        recesoFin: true,
        isLate: true,
        earlyExit: true,
        shift: {
          select: { id: true, startTime: true, endTime: true, tolerance: true, breakStartTime: true, breakEndTime: true }
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } }
          }
        }
      }
    });

    const attEmpIds = attendances.map(a => a.employeeId);
    const { eventMap, shiftMap, expandedEvents, globalShift } = await buildEventMapForDateRange(
      start, 
      end, 
      (employeeId && employeeId !== 'ALL' && employeeId !== 'Todos los colaboradores') ? [employeeId] : null, 
      (department && department !== 'Todos los departamentos') ? department : null, 
      attEmpIds
    );

    const unifiedList = [];
    const attendanceMap = {};

    for (const att of attendances) {
      const dateStr = new Date(att.date).toISOString().split('T')[0];
      const key = `${att.employeeId}_${dateStr}`;
      attendanceMap[key] = true;

      const dayEvents = eventMap[key] || [];
      
      let estadoAsistencia = att.isLate ? 'Tardanza' : 'A tiempo';
      if (dayEvents.some(e => e.type === 'VACATION')) estadoAsistencia = 'Vacaciones';
      else if (dayEvents.some(e => e.type === 'JUSTIFIED_ABSENCE')) estadoAsistencia = 'Falta Justificada';
      else if (dayEvents.some(e => e.type === 'LATE_ARRIVAL')) estadoAsistencia = 'Tardanza Justificada';
      else if (dayEvents.some(e => e.type === 'EARLY_EXIT')) estadoAsistencia = 'Salida Anticipada Justificada';

      // We will calculate horasTrabajadas after determining the final exit time

      // Calcular hora esperada de salida y horas extra
      const shift = att.shift || shiftMap[att.employeeId] || globalShift;
      let horaEsperadaSalida = 'N/A';
      let expectedExitDate = null;
      let lateDepartureWithoutOvertime = false;
      
      if (shift && shift.endTime) {
        horaEsperadaSalida = shift.endTime; // ej: "18:00"
        const startTime = shift.startTime || '08:00';
        expectedExitDate = getShiftExpectedEndDate(att.date || att.entrada, startTime, shift.endTime, tz);
        
        // Determinar si salió tarde comparando timestamps con tolerancia de 5 minutos
        if (att.salida && expectedExitDate) {
          const salidaTime = new Date(att.salida).getTime();
          const gracePeriodMs = 5 * 60 * 1000;
          if (salidaTime > (expectedExitDate.getTime() + gracePeriodMs)) {
            lateDepartureWithoutOvertime = !dayEvents.some(e => e.type === 'OVERTIME');
          }
        }
      }

      const overtimeEventsDay = dayEvents.filter(e => e.type === 'OVERTIME');
      const horasExtra = overtimeEventsDay.length > 0;
      const overtimeMinutes = overtimeEventsDay.reduce((sum, e) => sum + (e.minutes || 0), 0);

      // Auto-fill salida if overtime is approved and user didn't clock out
      let finalSalida = att.salida;
      let isAutoExit = false;

      if (!finalSalida && att.entrada && expectedExitDate && horasExtra) {
        const autoExitDate = new Date(expectedExitDate.getTime() + overtimeMinutes * 60 * 1000);
        finalSalida = autoExitDate.toISOString();
        isAutoExit = true;
      }

      const horasTrabajadas = att.entrada && finalSalida 
        ? ((new Date(finalSalida) - new Date(att.entrada)) / (1000 * 60 * 60)).toFixed(1) 
        : null;

      unifiedList.push({
        id: att.id,
        employeeId: att.employeeId,
        empleado: `${att.employee.firstName} ${att.employee.lastName}`,
        departamento: att.employee.department?.name || 'N/A',
        fecha: dateStr,
        entrada: att.entrada ? new Date(att.entrada).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: tz }) : 'N/A',
        salida: finalSalida ? new Date(finalSalida).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: tz }) + (isAutoExit ? ' (Auto)' : '') : 'N/A',
        horaEsperadaSalida: formatExpectedTime(horaEsperadaSalida),
        horasTrabajadas,
        estadoAsistencia,
        horasExtra,
        overtimeMinutes,
        lateDepartureWithoutOvertime,
        eventos: dayEvents.map(e => ({
          type: e.type,
          minutes: e.minutes,
          approvedBy: e.registeredBy?.name || 'Admin'
        })),
        _timestamp: new Date(att.date).getTime()
      });
    }

    for (const evt of expandedEvents) {
      const key = `${evt.employeeId}_${evt.dateStr}`;
      if (!attendanceMap[key]) {
        attendanceMap[key] = true; 
        
        let estadoAsistencia = 'Ausencia';
        const dayEvents = eventMap[key] || [];
        if (dayEvents.some(e => e.type === 'VACATION')) estadoAsistencia = 'Vacaciones';
        else if (dayEvents.some(e => e.type === 'JUSTIFIED_ABSENCE')) estadoAsistencia = 'Falta Justificada';

        const overtimeEventsVirt = dayEvents.filter(e => e.type === 'OVERTIME');
        let simulatedEntrada = 'N/A';
        let simulatedSalida = 'N/A';
        let simulatedHorasTrabajadas = null;
        let horasExtra = false;
        let overtimeMinutes = 0;
        let isAuto = false;

        if (overtimeEventsVirt.length > 0 && shiftMap[evt.employeeId]) {
          horasExtra = true;
          overtimeMinutes = overtimeEventsVirt.reduce((sum, e) => sum + (e.minutes || 0), 0);
          const shift = shiftMap[evt.employeeId];
          const [startH, startM] = shift.startTime.split(':').map(Number);
          const [y, m, d] = evt.dateStr.split('-').map(Number);
          
          const ent = getTzDate(y, m, d, startH, startM, 0, tz);
          const expectedEnd = getShiftExpectedEndDate(evt.dateStr, shift.startTime, shift.endTime, tz);
          const sal = new Date(expectedEnd.getTime() + overtimeMinutes * 60 * 1000);

          simulatedEntrada = ent.toISOString();
          simulatedSalida = sal.toISOString();
          simulatedHorasTrabajadas = ((sal - ent) / (1000 * 60 * 60)).toFixed(1);
          isAuto = true;
          
          if (estadoAsistencia === 'Ausencia') {
             estadoAsistencia = 'A tiempo'; // Asume que vino a tiempo si se le autocompleta por horas extra
          }
        }

        unifiedList.push({
          id: `virtual-evt-${evt.id}-${evt.dateStr}`,
          employeeId: evt.employeeId,
          empleado: `${evt.employee.firstName} ${evt.employee.lastName}`,
          departamento: evt.employee.department?.name || 'N/A',
          fecha: evt.dateStr,
          entrada: simulatedEntrada !== 'N/A' ? new Date(simulatedEntrada).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: tz }) + ' (Auto)' : 'N/A',
          salida: simulatedSalida !== 'N/A' ? new Date(simulatedSalida).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: tz }) + ' (Auto)' : 'N/A',
          horaEsperadaSalida: formatExpectedTime(shiftMap[evt.employeeId] ? shiftMap[evt.employeeId].endTime : 'N/A'),
          horasTrabajadas: simulatedHorasTrabajadas,
          estadoAsistencia,
          horasExtra,
          overtimeMinutes,
          lateDepartureWithoutOvertime: false,
          eventos: dayEvents.map(e => ({
            type: e.type,
            minutes: e.minutes,
            approvedBy: e.registeredBy?.name || 'Admin'
          })),
          _timestamp: new Date(evt.dateStr).getTime()
        });
      }
    }

    // Incluir ausencias injustificadas para colaboradores activos en días hábiles
    const activeEmps = await prisma.employee.findMany({
      where: (employeeId && employeeId !== 'ALL' && employeeId !== 'Todos los colaboradores') 
        ? { id: employeeId, isActive: true } 
        : { isActive: true, ...(department && department !== 'Todos los departamentos' ? { department: { name: department } } : {}) },
      select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } }
    });
    const { map: activeShiftMap } = await getShiftCascadeForEmployees(activeEmps.map(e => e.id));

    let curDate = new Date(start);
    const endAbsence = new Date(end) > new Date() ? new Date() : new Date(end);

    while (curDate <= endAbsence) {
      const dStr = curDate.toISOString().split('T')[0];
      if (isWorkingDay(curDate)) {
        for (const emp of activeEmps) {
          if (activeShiftMap[emp.id]) {
            const k = `${emp.id}_${dStr}`;
            if (!attendanceMap[k]) {
              attendanceMap[k] = true;
              unifiedList.push({
                id: `unjustified-abs-${emp.id}-${dStr}`,
                employeeId: emp.id,
                empleado: `${emp.firstName} ${emp.lastName}`,
                departamento: emp.department?.name || 'General',
                fecha: dStr,
                entrada: 'N/A',
                salida: 'N/A',
                horaEsperadaSalida: formatExpectedTime(activeShiftMap[emp.id]?.endTime || 'N/A'),
                horasTrabajadas: '0',
                estadoAsistencia: 'Ausencia',
                horasExtra: false,
                overtimeMinutes: 0,
                lateDepartureWithoutOvertime: false,
                eventos: [],
                _timestamp: new Date(dStr).getTime()
              });
            }
          }
        }
      }
      curDate.setUTCDate(curDate.getUTCDate() + 1);
    }

    let finalData = unifiedList;
    if (eventType && eventType !== 'Todos') {
      finalData = unifiedList.filter(row => row.eventos.some(e => e.type === eventType));
    }

    finalData.sort((a, b) => b._timestamp - a._timestamp);
    
    const pageNum = parsedPage;
    const limitNum = parsedLimit;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedData = finalData.slice(startIndex, startIndex + limitNum);

    res.json({
      data: paginatedData.map(({ _timestamp, ...rest }) => rest), 
      meta: {
        total: finalData.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(finalData.length / limitNum)
      }
    });

  } catch (error) {
    console.error('Error in /attendance-consolidated:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ============================================
// ENDPOINT: /api/v1/reports/breaks-consolidated
// ============================================
router.get('/breaks-consolidated', async (req, res) => {
  try {
    const { startDate, endDate, department, employeeId, status, page = 1, limit = 20 } = req.query;
    
    const settings = await prisma.systemSettings.findFirst();
    const tz = settings?.timezone || DEFAULT_TZ;

    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate y endDate son requeridos' });

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if ((end - start) / (1000 * 60 * 60 * 24) > 366) {
      return res.status(400).json({ error: 'El rango de fechas no puede superar 1 año (366 días)' });
    }

    const attWhere = { date: { gte: start, lte: end } };
    if (employeeId && employeeId !== 'ALL' && employeeId !== 'Todos los colaboradores') {
      attWhere.employeeId = employeeId;
    }
    if (department && department !== 'Todos los departamentos') {
      attWhere.employee = { department: { name: department } };
    }

    const attendances = await prisma.attendanceRecord.findMany({
      where: attWhere,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } } }
      }
    });

    const attEmpIds = attendances.map(a => a.employeeId);
    const { eventMap, shiftMap, globalShift } = await buildEventMapForDateRange(
      start, 
      end, 
      (employeeId && employeeId !== 'ALL' && employeeId !== 'Todos los colaboradores') ? [employeeId] : null, 
      (department && department !== 'Todos los departamentos') ? department : null, 
      attEmpIds
    );

    const unifiedList = [];

    for (const att of attendances) {
      const dateStr = new Date(att.date).toISOString().split('T')[0];
      const key = `${att.employeeId}_${dateStr}`;
      const dayEvents = eventMap[key] || [];
      const shift = shiftMap[att.employeeId] || globalShift;

      let estadoDescanso = 'Pendiente';
      let expectedDurationMins = 'N/A';
      let durationMins = 'N/A';
      let startTime = 'N/A';
      let endTime = 'N/A';

      // Always extract real recorded break times if present
      if (att.recesoInicio) {
        startTime = new Date(att.recesoInicio).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: tz });
      }
      if (att.recesoFin) {
        endTime = new Date(att.recesoFin).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: tz });
      }
      if (att.recesoInicio && att.recesoFin) {
        durationMins = Math.round((new Date(att.recesoFin) - new Date(att.recesoInicio)) / (1000 * 60));
      }

      // Expected duration from shift or global settings
      const breakStart = shift.breakStartTime || globalShift.breakStartTime || '13:00';
      const breakEnd = shift.breakEndTime || globalShift.breakEndTime || '14:00';
      if (breakStart && breakEnd) {
        const [startH, startM] = breakStart.split(':').map(Number);
        const [endH, endM] = breakEnd.split(':').map(Number);
        expectedDurationMins = (endH * 60 + endM) - (startH * 60 + startM);
      }

      if (dayEvents.some(e => e.type === 'VACATION')) {
        estadoDescanso = 'Vacaciones';
      } else if (dayEvents.some(e => e.type === 'JUSTIFIED_ABSENCE')) {
        estadoDescanso = 'Falta Justificada';
      } else if (att.recesoInicio && att.recesoFin) {
        const tolerance = shift.tolerance ?? 15;
        if (expectedDurationMins !== 'N/A' && durationMins > expectedDurationMins + tolerance) {
          estadoDescanso = 'Regreso Tardío';
        } else {
          estadoDescanso = 'A tiempo';
        }
      } else if (att.recesoInicio && !att.recesoFin) {
        estadoDescanso = 'Sin Retorno';
      } else if (att.entrada && !att.recesoInicio) {
        let isNoTomado = false;
        if (att.salida) {
          isNoTomado = true;
        } else if (breakEnd) {
          const [endH, endM] = breakEnd.split(':').map(Number);
          const now = new Date();
          const nowParts = getTzParts(now, tz);
          const nowLocalMins = nowParts.totalMinutes;
          const nowLocalDateStr = nowParts.dateStr;
          
          if (dateStr < nowLocalDateStr) {
            isNoTomado = true; 
          } else if (dateStr === nowLocalDateStr) {
            if (nowLocalMins > (endH * 60 + endM)) {
              isNoTomado = true; 
            }
          }
        }
        estadoDescanso = isNoTomado ? 'No tomado' : 'Pendiente';
      } else {
        estadoDescanso = 'Pendiente';
      }

      unifiedList.push({
        id: att.id,
        employeeId: att.employeeId,
        empleado: `${att.employee.firstName} ${att.employee.lastName}`,
        departamento: att.employee.department?.name || 'N/A',
        fecha: dateStr,
        inicioDescanso: startTime,
        finDescanso: endTime,
        duracionReal: durationMins,
        duracionEsperada: expectedDurationMins,
        estado: estadoDescanso,
        _timestamp: new Date(att.date).getTime()
      });
    }

    let finalData = unifiedList;
    if (status && status !== 'Todos los estados') {
      finalData = unifiedList.filter(row => row.estado === status);
    }

    finalData.sort((a, b) => b._timestamp - a._timestamp);
    
    const pageNum = parsedPage;
    const limitNum = parsedLimit;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedData = finalData.slice(startIndex, startIndex + limitNum);

    res.json({
      data: paginatedData.map(({ _timestamp, ...rest }) => rest), 
      meta: {
        total: finalData.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(finalData.length / limitNum)
      }
    });

  } catch (error) {
    console.error('Error in /breaks-consolidated:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// --- Reportes Consolidado de Dispositivos ---
router.get('/devices-consolidated', async (req, res) => {
  try {
    const settings = await prisma.systemSettings.findFirst();
    const tz = settings?.timezone || DEFAULT_TZ;
    let { startDate, endDate, deviceId } = req.query;

    if (!startDate || !endDate) {
      const now = new Date();
      const firstDay = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
      startDate = firstDay.toISOString();
      endDate = now.toISOString();
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // 1. Obtener todos los dispositivos registrados en el sistema
    const whereDevices = {};
    if (deviceId) {
      whereDevices.id = deviceId;
    }
    const devices = await prisma.device.findMany({
      where: whereDevices,
      orderBy: { createdAt: 'asc' }
    });

    const deviceMap = new Map();
    devices.forEach(d => {
      deviceMap.set(d.id, d);
    });

    // 2. Obtener registros de asistencia en el rango de fechas
    const whereAtt = {
      date: { gte: start, lte: end }
    };
    if (deviceId) {
      whereAtt.deviceId = deviceId;
    }

    const attendances = await prisma.attendanceRecord.findMany({
      where: whereAtt,
      select: {
        id: true,
        date: true,
        deviceId: true,
        entrada: true,
        recesoInicio: true,
        recesoFin: true,
        salida: true
      },
      orderBy: { date: 'asc' }
    });

    // 3. Contabilizar lecturas por dispositivo y por día
    const deviceReadsTotal = {};
    const dailyDeviceReads = {};
    const dailyDeviceMap = {};

    devices.forEach(d => {
      deviceReadsTotal[d.id] = 0;
    });

    let totalGlobalLecturas = 0;

    attendances.forEach(att => {
      let devId = att.deviceId;
      // Fallback si no tiene deviceId asignado: si hay un solo dispositivo, asignarlo
      if (!devId && devices.length > 0) {
        devId = devices[0].id;
      }

      let readsCount = 0;
      if (att.entrada) readsCount++;
      if (att.recesoInicio) readsCount++;
      if (att.recesoFin) readsCount++;
      if (att.salida) readsCount++;
      if (readsCount === 0) readsCount = 1;

      totalGlobalLecturas += readsCount;

      if (devId) {
        deviceReadsTotal[devId] = (deviceReadsTotal[devId] || 0) + readsCount;
      }

      const dateStr = new Date(att.date).toISOString().split('T')[0];
      const devName = devId && deviceMap.has(devId) ? deviceMap.get(devId).name : 'Dispositivo Desconocido';

      if (!dailyDeviceReads[dateStr]) {
        dailyDeviceReads[dateStr] = {
          date: dateStr,
          timestamp: new Date(att.date).getTime()
        };
      }
      dailyDeviceReads[dateStr][devName] = (dailyDeviceReads[dateStr][devName] || 0) + readsCount;

      const groupKey = `${devId || 'unknown'}_${dateStr}`;
      dailyDeviceMap[groupKey] = (dailyDeviceMap[groupKey] || 0) + readsCount;
    });

    // Trend data
    const trendData = Object.values(dailyDeviceReads).sort((a, b) => a.timestamp - b.timestamp);
    trendData.forEach(dayItem => {
      devices.forEach(d => {
        if (dayItem[d.name] === undefined) {
          dayItem[d.name] = 0;
        }
      });
    });

    if (trendData.length === 0 && devices.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const emptyPoint = { date: todayStr, timestamp: Date.now() };
      devices.forEach(d => { emptyPoint[d.name] = 0; });
      trendData.push(emptyPoint);
    }

    // Bar Data: Total de lecturas por dispositivo
    const barData = devices.map(d => ({
      name: d.name,
      lecturas: deviceReadsTotal[d.id] || 0
    }));

    // Encontrar el nodo más activo
    let topNode = 'Sin actividad';
    let maxReads = -1;
    devices.forEach(d => {
      const reads = deviceReadsTotal[d.id] || 0;
      if (reads > maxReads) {
        maxReads = reads;
        topNode = d.name;
      }
    });
    if (maxReads <= 0 && devices.length > 0) {
      topNode = devices[0].name;
    }

    const onlineCount = devices.filter(d => d.status === 'ONLINE').length;

    // Table Data
    const tableData = [];
    const processedDevices = new Set();

    Object.keys(dailyDeviceMap).forEach(key => {
      const [dId, dDate] = key.split('_');
      const dev = deviceMap.get(dId);
      const devName = dev ? dev.name : 'Desconocido';
      const ubicacion = dev?.description ? (dev.description.length > 30 ? (dev.ipAddress || 'Kiosko') : dev.description) : (dev?.ipAddress || 'Estación Principal');
      const estado = dev?.status === 'ONLINE' ? 'En Línea' : dev?.status === 'UNSTABLE' ? 'Inestable' : 'Desconectado';
      const uptime = dev?.status === 'ONLINE' ? '99.9%' : dev?.status === 'UNSTABLE' ? '85.0%' : '0%';

      if (dev) processedDevices.add(dev.id);

      tableData.push({
        id: `row-${key}`,
        dispositivo: devName,
        ubicacion,
        fecha: dDate,
        lecturas: dailyDeviceMap[key],
        uptime,
        estado
      });
    });

    devices.forEach(d => {
      if (!processedDevices.has(d.id)) {
        tableData.push({
          id: `row-${d.id}-empty`,
          dispositivo: d.name,
          ubicacion: d.description ? (d.description.length > 30 ? (d.ipAddress || 'Kiosko') : d.description) : (d.ipAddress || 'Estación Principal'),
          fecha: getTzParts(new Date(), tz).dateStr,
          lecturas: 0,
          uptime: d.status === 'ONLINE' ? '99.9%' : d.status === 'UNSTABLE' ? '85.0%' : '0%',
          estado: d.status === 'ONLINE' ? 'En Línea' : d.status === 'UNSTABLE' ? 'Inestable' : 'Desconectado'
        });
      }
    });

    tableData.sort((a, b) => {
      if (b.fecha !== a.fecha) return b.fecha.localeCompare(a.fecha);
      return b.lecturas - a.lecturas;
    });

    res.json({
      kpis: {
        totalLecturas: totalGlobalLecturas,
        enLinea: onlineCount,
        totalDispositivos: devices.length,
        topNode
      },
      barData,
      trendData,
      deviceNames: devices.map(d => d.name),
      tableData
    });
  } catch (error) {
    console.error('Error in /devices-consolidated:', error);
    res.status(500).json({ error: 'Error del servidor al obtener datos de dispositivos' });
  }
});

// ============================================
// ENDPOINT: /api/v1/reports/events-consolidated
// ============================================
router.get('/events-consolidated', async (req, res) => {
  try {
    const { startDate, endDate, department, employeeId, type, status, limit } = req.query;

    let start, end;
    if (startDate && endDate) {
      const sStr = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;
      const eStr = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
      start = new Date(sStr);
      end = new Date(eStr);
    } else {
      const now = new Date();
      start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
      end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
    }

    if ((end - start) / (1000 * 60 * 60 * 24) > 366) {
      return res.status(400).json({ error: 'El rango de fechas no puede superar 1 año (366 días)' });
    }

    const whereClause = {
      OR: [
        {
          dateTo: null,
          date: { gte: start, lte: end }
        },
        {
          dateTo: { not: null, gte: start },
          date: { lte: end }
        }
      ]
    };

    if (req.user?.companyId) {
      whereClause.companyId = req.user.companyId;
    }

    if (status && status !== 'ALL' && status !== 'Todos los estados') {
      whereClause.status = status;
    }
    if (type && type !== 'ALL' && type !== 'Todos los tipos') {
      whereClause.type = type;
    }
    if (employeeId && employeeId !== 'ALL' && employeeId !== 'Todos los colaboradores') {
      whereClause.employeeId = employeeId;
    }
    if (department && department !== 'Todos los departamentos') {
      whereClause.employee = { department: { name: department } };
    }

    const events = await prisma.eventRequest.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            identifier: true,
            department: { select: { id: true, name: true } }
          }
        },
        registeredBy: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { date: 'desc' },
      take: limit ? parseInt(limit, 10) : 500
    });

    let totalEvents = events.length;
    let vacationCount = 0;
    let vacationDaysTotal = 0;
    let overtimeCount = 0;
    let overtimeHoursTotal = 0;
    let justifiedCount = 0;
    let earlyExitCount = 0;
    let lateArrivalCount = 0;
    let activeEventsCount = 0;
    let cancelledEventsCount = 0;

    const deptMap = {};
    const typeMap = {
      VACATION: 0,
      OVERTIME: 0,
      JUSTIFIED_ABSENCE: 0,
      EARLY_EXIT: 0,
      LATE_ARRIVAL: 0
    };

    const formattedList = events.map(evt => {
      if (evt.status === 'ACTIVE') activeEventsCount++;
      if (evt.status === 'CANCELLED') cancelledEventsCount++;

      const deptName = evt.employee?.department?.name || 'Sin departamento';
      deptMap[deptName] = (deptMap[deptName] || 0) + 1;
      if (typeMap[evt.type] !== undefined) typeMap[evt.type]++;

      let durationLabel = '1 día';
      let daysCount = 1;
      if (evt.dateTo) {
        const d1 = new Date(evt.date);
        const d2 = new Date(evt.dateTo);
        daysCount = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
        durationLabel = `${daysCount} días`;
      }

      if (evt.type === 'VACATION') {
        vacationCount++;
        if (evt.status === 'ACTIVE') vacationDaysTotal += daysCount;
      } else if (evt.type === 'OVERTIME') {
        overtimeCount++;
        const hrs = (evt.minutes || 0) / 60;
        if (evt.status === 'ACTIVE') overtimeHoursTotal += hrs;
        durationLabel = `${hrs.toFixed(1).replace('.0', '')} hrs extra`;
      } else if (evt.type === 'JUSTIFIED_ABSENCE') {
        justifiedCount++;
      } else if (evt.type === 'EARLY_EXIT') {
        earlyExitCount++;
      } else if (evt.type === 'LATE_ARRIVAL') {
        lateArrivalCount++;
      }

      const dateStr = typeof evt.date === 'string' ? evt.date.split('T')[0] : new Date(evt.date).toISOString().split('T')[0];
      const dateToStr = evt.dateTo ? (typeof evt.dateTo === 'string' ? evt.dateTo.split('T')[0] : new Date(evt.dateTo).toISOString().split('T')[0]) : null;

      return {
        id: evt.id,
        empleado: `${evt.employee?.firstName || ''} ${evt.employee?.lastName || ''}`.trim(),
        identificador: evt.employee?.identifier || 'N/A',
        departamento: deptName,
        tipo: evt.type,
        fecha: dateStr,
        fechaFin: dateToStr,
        rangoTexto: dateToStr && dateToStr !== dateStr ? `${dateStr} al ${dateToStr}` : dateStr,
        duracion: durationLabel,
        motivo: evt.reason || 'Sin motivo especificado',
        aprobadoPor: evt.registeredBy?.name || 'Administrador',
        estado: evt.status,
        batchId: evt.batchId,
        esGrupal: !!evt.batchId
      };
    });

    const distribution = [
      { name: 'Vacaciones', value: typeMap.VACATION, color: '#8b5cf6' },
      { name: 'Horas Extra', value: typeMap.OVERTIME, color: '#3b82f6' },
      { name: 'Faltas Justificadas', value: typeMap.JUSTIFIED_ABSENCE, color: '#10b981' },
      { name: 'Salidas Anticipadas', value: typeMap.EARLY_EXIT, color: '#eab308' },
      { name: 'Llegadas Tardías', value: typeMap.LATE_ARRIVAL, color: '#f97316' }
    ].filter(d => d.value > 0);

    const deptBreakdown = Object.keys(deptMap).map(name => ({
      name,
      total: deptMap[name]
    })).sort((a, b) => b.total - a.total);

    res.json({
      kpis: {
        totalEvents,
        vacationCount,
        vacationDaysTotal,
        overtimeCount,
        overtimeHoursTotal: +overtimeHoursTotal.toFixed(1),
        justifiedCount,
        earlyExitCount,
        lateArrivalCount,
        activeEventsCount,
        cancelledEventsCount
      },
      distribution,
      deptBreakdown,
      events: formattedList
    });
  } catch (error) {
    console.error('Error in /events-consolidated:', error);
    res.status(500).json({ error: 'Error del servidor al obtener datos de eventos' });
  }
});

module.exports = router;
