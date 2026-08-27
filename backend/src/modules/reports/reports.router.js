const express = require('express');
const router = express.Router();
const requireJwt = require('../../middlewares/requireJwt');
const prisma = require('../../utils/prisma');

router.use(requireJwt);

// --- Helpers ---
// Determine working days. Since Shift model lacks daysOfWeek, we assume Mon-Fri (1-5).
const isWorkingDay = (dateObj) => {
  const day = dateObj.getDay();
  return day >= 1 && day <= 5; // Lunes a Viernes
};

const getShiftCascadeForEmployees = async (employeeIds) => {
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    include: {
      shifts: { include: { shift: true } },
      department: { include: { shifts: { include: { shift: true } } } }
    }
  });

  const settings = await prisma.systemSettings.findFirst();
  const globalShift = {
    id: -1,
    name: 'Horario Global',
    startTime: `${(settings?.workdayStartHour ?? 9).toString().padStart(2, '0')}:${(settings?.workdayStartMinute ?? 0).toString().padStart(2, '0')}`,
    endTime: `${(settings?.workdayEndHour ?? 18).toString().padStart(2, '0')}:${(settings?.workdayEndMinute ?? 0).toString().padStart(2, '0')}`,
    tolerance: settings?.latenessToleranceMin ?? 15
  };

  const map = {};
  for (const emp of employees) {
    if (emp.shifts.length > 0) map[emp.id] = emp.shifts[0].shift;
    else if (emp.department && emp.department.shifts.length > 0) map[emp.id] = emp.department.shifts[0].shift;
    else map[emp.id] = globalShift;
  }
  return map;
};

// ============================================
// ENDPOINT: /api/v1/reports/kpis
// ============================================
router.get('/kpis', async (req, res) => {
  try {
    let { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      const now = new Date();
      const firstDay = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
      startDate = firstDay.toISOString();
      endDate = now.toISOString();
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Validar máximo 90 días
    if ((end - start) / (1000 * 60 * 60 * 24) > 90) {
      return res.status(400).json({ error: 'El rango de fechas no puede superar los 90 días' });
    }

    const attendances = await prisma.attendanceRecord.findMany({
      where: { date: { gte: start, lte: end } },
      select: { date: true, isLate: true, entrada: true, salida: true, employeeId: true }
    });

    const events = await prisma.eventRequest.findMany({
      where: { 
        status: 'ACTIVE',
        OR: [
          { date: { gte: start, lte: end } },
          { dateTo: { gte: start } } 
        ]
      },
      select: { type: true, minutes: true, date: true, dateTo: true, employeeId: true }
    });

    // Expandir eventos
    const expandedEvents = [];
    const shiftMap = await getShiftCascadeForEmployees([...new Set(events.map(e => e.employeeId))]);

    for (const evt of events) {
      if (evt.dateTo) {
        let currentDate = new Date(evt.date);
        const limitDate = new Date(evt.dateTo);
        const actualLimit = limitDate > end ? end : limitDate;
        
        while (currentDate <= actualLimit) {
          if (currentDate >= start) {
            if (isWorkingDay(currentDate) && shiftMap[evt.employeeId]) {
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

    const trendMap = {}; 
    const peakHoursMap = {};
    const eventMap = {};

    for (const evt of expandedEvents) {
      const key = `${evt.employeeId}_${evt.dateStr}`;
      if (!eventMap[key]) eventMap[key] = [];
      eventMap[key].push(evt);
      
      if (evt.type === 'OVERTIME' && evt.minutes) {
        horasExtraMinutos += evt.minutes;
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
        if (hasLateArrival) {
          tardanzasJustificadas++;
          trendMap[dateStr].justificados++;
          aTiempo++; 
        } else {
          tardanzasInjustificadas++;
          trendMap[dateStr].tardanzas++;
        }
      } else {
        aTiempo++;
        trendMap[dateStr].aTiempo++;
      }

      if (att.entrada) {
        const ent = new Date(att.entrada);
        const m = ent.getMinutes();
        const roundedMin = m < 15 ? '00' : m < 30 ? '15' : m < 45 ? '30' : '45';
        const timeKey = `${ent.getHours().toString().padStart(2, '0')}:${roundedMin}`;
        peakHoursMap[timeKey] = (peakHoursMap[timeKey] || 0) + 1;
      }

      let finalSalida = att.salida;
      if (!finalSalida && att.entrada) {
        const dayEvents = eventMap[`${att.employeeId}_${dateStr}`] || [];
        const overtimeEvent = dayEvents.find(e => e.type === 'OVERTIME');
        if (overtimeEvent && shiftMap && shiftMap[att.employeeId]) {
          const shift = shiftMap[att.employeeId];
          const [expectedH, expectedM] = shift.endTime.split(':').map(Number);
          const entradaDate = new Date(att.entrada);
          entradaDate.setUTCHours(expectedH, expectedM + overtimeEvent.minutes, 0, 0);
          finalSalida = entradaDate.toISOString();
        }
      }

      if (att.entrada && finalSalida) {
        const diff = (new Date(finalSalida) - new Date(att.entrada)) / (1000 * 60 * 60);
        totalHorasTrabajadas += diff;
        countHorasTrabajadas++;
      }
    }

    // Detectar Ausencias (Días hábiles sin asistencia ni justificación)
    const activeEmployees = await prisma.employee.findMany({ where: { isActive: true }, select: { id: true } });
    const empIds = activeEmployees.map(e => e.id);
    const empShiftMap = await getShiftCascadeForEmployees(empIds);

    let currentDate = new Date(start);
    const endAbsenceDate = new Date(end) > new Date() ? new Date() : new Date(end); 
    
    while (currentDate <= endAbsenceDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (!trendMap[dateStr]) trendMap[dateStr] = { aTiempo: 0, tardanzas: 0, ausencias: 0, justificados: 0 };

      if (isWorkingDay(currentDate)) {
        for (const empId of empIds) {
          if (empShiftMap[empId]) {
            const key = `${empId}_${dateStr}`;
            if (!attendanceMap[key]) {
              const dayEvents = eventMap[key] || [];
              const isJustified = dayEvents.some(e => e.type === 'VACATION' || e.type === 'JUSTIFIED_ABSENCE');
              
              if (isJustified) {
                if (dayEvents.some(e => e.type === 'VACATION')) vacaciones++;
                else faltasJustificadas++;
                trendMap[dateStr].justificados++;
              } else {
                ausenciasInjustificadas++;
                trendMap[dateStr].ausencias++;
              }
            }
          }
        }
      }
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

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

    res.json({
      kpis: {
        puntualidadPct,
        totalTardanzasInjustificadas: tardanzasInjustificadas,
        totalAusenciasInjustificadas: ausenciasInjustificadas,
        horasExtraAprobadas: +(horasExtraMinutos / 60).toFixed(1),
        horasPromedio: +horasPromedio
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
      peakHours
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
    
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate y endDate son requeridos' });

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if ((end - start) / (1000 * 60 * 60 * 24) > 90) {
      return res.status(400).json({ error: 'El rango de fechas no puede superar los 90 días' });
    }

    const attWhere = { date: { gte: start, lte: end } };
    if (employeeId) attWhere.employeeId = employeeId;
    if (department) attWhere.employee = { department: { name: department } };

    const attendances = await prisma.attendanceRecord.findMany({
      where: attWhere,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } } }
      }
    });

    const evtWhere = { 
      status: 'ACTIVE',
      OR: [
        { date: { gte: start, lte: end } },
        { dateTo: { gte: start } }
      ]
    };
    if (employeeId) evtWhere.employeeId = employeeId;
    if (department) evtWhere.employee = { department: { name: department } };

    const events = await prisma.eventRequest.findMany({
      where: evtWhere,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } } },
        registeredBy: { select: { name: true } }
      }
    });

    const expandedEvents = [];
    const shiftMap = await getShiftCascadeForEmployees([...new Set(events.map(e => e.employeeId))]);

    for (const evt of events) {
      if (evt.dateTo) {
        let currentDate = new Date(evt.date);
        const limitDate = new Date(evt.dateTo);
        const actualLimit = limitDate > end ? end : limitDate;
        
        while (currentDate <= actualLimit) {
          if (currentDate >= start) {
            if (isWorkingDay(currentDate) && shiftMap[evt.employeeId]) {
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
      const shift = shiftMap[att.employeeId];
      let horaEsperadaSalida = 'N/A';
      let lateDepartureWithoutOvertime = false;
      
      if (shift) {
        horaEsperadaSalida = shift.endTime; // ej: "18:00"
        
        // Determinar si salió tarde
        if (att.salida) {
          const salidaObj = new Date(att.salida);
          const [expectedH, expectedM] = shift.endTime.split(':').map(Number);
          
          // Crear un Date de la salida esperada basado en la fecha de att.salida
          const expectedDate = new Date(att.salida);
          expectedDate.setUTCHours(expectedH, expectedM, 0, 0); // Assuming DB times are in UTC, wait...
          // Actually, att.salida is an ISO string, but the shift is local time.
          // In a real app we'd use timezone, but here we can just compare hours/mins of local time:
          const salidaLocalMins = salidaObj.getHours() * 60 + salidaObj.getMinutes();
          const expectedLocalMins = expectedH * 60 + expectedM;
          
          // Si salió después de su hora esperada (con un margen de gracia de 5 mins, por ejemplo)
          if (salidaLocalMins > expectedLocalMins + 5) {
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

      if (!finalSalida && att.entrada && shift && horasExtra) {
        const entradaDate = new Date(att.entrada);
        const [expectedH, expectedM] = shift.endTime.split(':').map(Number);
        entradaDate.setUTCHours(expectedH, expectedM + overtimeMinutes, 0, 0); 
        finalSalida = entradaDate.toISOString();
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
        entrada: att.entrada ? new Date(att.entrada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : 'N/A',
        salida: finalSalida ? new Date(finalSalida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + (isAutoExit ? ' (Auto)' : '') : 'N/A',
        horaEsperadaSalida,
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
          const [endH, endM] = shift.endTime.split(':').map(Number);
          
          const ent = new Date(evt.dateStr);
          ent.setUTCHours(startH, startM, 0, 0);
          
          const sal = new Date(evt.dateStr);
          sal.setUTCHours(endH, endM + overtimeMinutes, 0, 0);

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
          entrada: simulatedEntrada !== 'N/A' ? new Date(simulatedEntrada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' (Auto)' : 'N/A',
          salida: simulatedSalida !== 'N/A' ? new Date(simulatedSalida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' (Auto)' : 'N/A',
          horaEsperadaSalida: shiftMap[evt.employeeId] ? shiftMap[evt.employeeId].endTime : 'N/A',
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

    let finalData = unifiedList;
    if (eventType && eventType !== 'Todos') {
      finalData = unifiedList.filter(row => row.eventos.some(e => e.type === eventType));
    }

    finalData.sort((a, b) => b._timestamp - a._timestamp);
    
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
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

module.exports = router;
