const express = require('express');
const router = express.Router();
const requireApiKey = require('../../middlewares/requireApiKey');
const requireJwt = require('../../middlewares/requireJwt');
const prisma = require('../../utils/prisma');
const { euclideanDistance, syncFaceCache } = require('../../utils/faceMath');
const { emitNotification } = require('../../app'); // Importar para WebSockets

// Helper para obtener inicio del día
const getStartOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// ============================================
// RUTAS PARA EL KIOSCO (API KEY)
// ============================================

// Validar rostro
router.post('/validate', requireApiKey, async (req, res) => {
  try {
    const { descriptor } = req.body;
    
    if (!descriptor || !Array.isArray(descriptor)) {
      return res.status(400).json({ error: 'Descriptor inválido' });
    }

    let bestMatch = { id: null, name: null, distance: Infinity };

    // Comparar en memoria
    for (const user of global.cachedUsers) {
      if (!user.descriptor || user.descriptor.length === 0) continue;
      
      const distance = euclideanDistance(descriptor, user.descriptor);
      if (distance < bestMatch.distance) {
        bestMatch = { id: user.id, name: user.name, distance };
      }
    }

    // Umbral de validación
    // Obtenemos de SystemSettings
    const settings = await prisma.systemSettings.findFirst();
    const threshold = settings ? 1.0 - settings.faceConfidenceThreshold : 0.45; // Relación inversa

    if (bestMatch.distance <= threshold) {
      // Retornar empleado, pero NO registrar asistencia aún
      const employeeInfo = await prisma.employee.findUnique({
        where: { id: bestMatch.id },
        select: { id: true, firstName: true, lastName: true, identifier: true }
      });

      return res.json({ 
        match: true, 
        user: bestMatch.name, 
        employee: employeeInfo,
        distance: bestMatch.distance
      });
    }

    return res.json({ match: false, distance: bestMatch.distance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Obtener contexto de asistencia del empleado
router.get('/context/:employeeId', requireApiKey, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const startOfDay = getStartOfDay();

    // 1. Obtener registro de hoy
    const todayRecord = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        date: { gte: startOfDay }
      }
    });

    // 2. Obtener empleado con sus turnos y departamento
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        shifts: { include: { shift: true } },
        department: {
          include: { shifts: { include: { shift: true } } }
        }
      }
    });

    if (!employee) return res.status(404).json({ error: 'Empleado no encontrado' });

    // 3. Resolver turnos disponibles (Cascada)
    let availableShifts = [];
    if (employee.shifts.length > 0) {
      availableShifts = employee.shifts.map(es => es.shift);
    } else if (employee.department && employee.department.shifts.length > 0) {
      availableShifts = employee.department.shifts.map(ds => ds.shift);
    } else {
      // Fallback global
      const settings = await prisma.systemSettings.findFirst();
      availableShifts = [{
        id: -1, // Turno virtual
        name: 'Horario Global',
        startTime: `${(settings?.workdayStartHour ?? 9).toString().padStart(2, '0')}:${(settings?.workdayStartMinute ?? 0).toString().padStart(2, '0')}`,
        endTime: `${(settings?.workdayEndHour ?? 18).toString().padStart(2, '0')}:${(settings?.workdayEndMinute ?? 0).toString().padStart(2, '0')}`,
        tolerance: settings?.latenessToleranceMin ?? 15
      }];
    }

    // 4. Armar contexto
    res.json({
      hasEntrada: !!(todayRecord && todayRecord.entrada),
      hasReceso: !!(todayRecord && todayRecord.recesoInicio && !todayRecord.recesoFin),
      hasSalida: !!(todayRecord && todayRecord.salida),
      availableShifts,
      currentShiftId: todayRecord ? todayRecord.shiftId : null
    });

  } catch (error) {
    console.error('Error fetching context:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Registrar acción de asistencia
router.post('/register', requireApiKey, async (req, res) => {
  try {
    const { employeeId, action, shiftId, reason, overtime } = req.body;
    
    if (!employeeId || !action) {
      return res.status(400).json({ error: 'employeeId y action son obligatorios' });
    }

    const startOfDay = getStartOfDay();
    let record = await prisma.attendanceRecord.findFirst({
      where: { employeeId, date: { gte: startOfDay } }
    });

    const now = new Date();
    const settings = await prisma.systemSettings.findFirst();

    if (action === 'entrada') {
      if (record && record.entrada) return res.status(400).json({ error: 'Ya tiene entrada registrada' });

      // Calcular isLate
      let isLate = false;
      let lateMinutes = null;
      let resolvedShiftId = null;

      // Buscar el turno a comparar
      let targetShift = null;
      if (shiftId && shiftId !== -1) {
        targetShift = await prisma.shift.findUnique({ where: { id: shiftId } });
        resolvedShiftId = shiftId;
      } else {
        // Horario global
        targetShift = {
          startTime: `${(settings?.workdayStartHour ?? 9).toString().padStart(2, '0')}:${(settings?.workdayStartMinute ?? 0).toString().padStart(2, '0')}`,
          tolerance: settings?.latenessToleranceMin ?? 15
        };
      }

      if (targetShift) {
        const [hour, minute] = targetShift.startTime.split(':').map(Number);
        const expectedTime = new Date();
        expectedTime.setHours(hour, minute, 0, 0);

        const tolerance = targetShift.tolerance !== null ? targetShift.tolerance : settings.latenessToleranceMin;
        const diffMs = now.getTime() - expectedTime.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins > tolerance) {
          isLate = true;
          lateMinutes = diffMins;
        }
      }

      if (!record) {
        record = await prisma.attendanceRecord.create({
          data: {
            employeeId,
            date: now,
            entrada: now,
            shiftId: resolvedShiftId,
            isLate,
            lateMinutes
          }
        });
      } else {
        record = await prisma.attendanceRecord.update({
          where: { id: record.id },
          data: { entrada: now, shiftId: resolvedShiftId, isLate, lateMinutes }
        });
      }

    } else if (action === 'salida') {
      if (!record) return res.status(400).json({ error: 'No hay registro de entrada' });
      record = await prisma.attendanceRecord.update({
        where: { id: record.id },
        data: { salida: now }
      });
    } else if (action === 'recesoInicio') {
      if (!record) return res.status(400).json({ error: 'No hay registro de entrada' });
      record = await prisma.attendanceRecord.update({
        where: { id: record.id },
        data: { recesoInicio: now }
      });
    } else if (action === 'recesoFin') {
      if (!record) return res.status(400).json({ error: 'No hay registro de entrada' });
      record = await prisma.attendanceRecord.update({
        where: { id: record.id },
        data: { recesoFin: now }
      });
    } else if (action === 'salidaAnticipada') {
      if (!record) return res.status(400).json({ error: 'No hay registro de entrada' });
      record = await prisma.attendanceRecord.update({
        where: { id: record.id },
        data: { salida: now, earlyExit: true, earlyExitReason: reason || 'Sin motivo' }
      });

      const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
      const msg = `${employee.firstName} ${employee.lastName} registró salida anticipada. Motivo: ${reason}`;
      
      await prisma.notification.create({
        data: {
          title: 'Salida Anticipada',
          message: msg,
          type: 'WARNING',
          category: 'attendance',
          entityId: employeeId
        }
      });

      emitNotification({
        title: 'Salida Anticipada',
        message: msg,
        type: 'WARNING',
        category: 'attendance',
        entityId: employeeId
      });

    } else if (action === 'horasExtra') {
      if (!record) return res.status(400).json({ error: 'No hay registro de entrada' });
      record = await prisma.attendanceRecord.update({
        where: { id: record.id },
        data: { overtimeMinutes: overtime || 0 }
      });

      const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
      const msg = `${employee.firstName} ${employee.lastName} registró ${overtime} minutos extra.`;
      
      await prisma.notification.create({
        data: {
          title: 'Horas Extra Registradas',
          message: msg,
          type: 'INFO',
          category: 'attendance',
          entityId: employeeId
        }
      });

      emitNotification({
        title: 'Horas Extra Registradas',
        message: msg,
        type: 'INFO',
        category: 'attendance',
        entityId: employeeId
      });

    } else {
      return res.status(400).json({ error: 'Acción inválida' });
    }

    res.json(record);
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Refrescar caché en memoria manualmente
router.post('/refresh-cache', requireApiKey, async (req, res) => {
  await syncFaceCache();
  const { emitCacheRefresh } = require('../../app');
  if (emitCacheRefresh) emitCacheRefresh();
  res.json({ message: 'Caché refrescado exitosamente', count: global.cachedUsers.length });
});

// ============================================
// RUTAS PARA EL DASHBOARD (JWT)
// ============================================

router.get('/', requireJwt, async (req, res) => {
  try {
    const { date } = req.query;
    
    let whereClause = {};
    if (date) {
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      
      whereClause = {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        }
      };
    }

    const records = await prisma.attendanceRecord.findMany({
      where: whereClause,
      include: { 
        employee: {
          include: { department: true }
        },
        shift: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(records);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener registros' });
  }
});

module.exports = router;
