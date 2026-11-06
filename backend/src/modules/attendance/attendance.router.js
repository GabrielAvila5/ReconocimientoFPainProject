const express = require('express');
const router = express.Router();
const requireApiKey = require('../../middlewares/requireApiKey');
const requireJwt = require('../../middlewares/requireJwt');
const prisma = require('../../utils/prisma');
const { euclideanDistance, syncFaceCache } = require('../../utils/faceMath');
const { getStartOfDay, getTzParts, DEFAULT_TZ } = require('../../utils/timeUtils');
const { processAutoCheckout } = require('../../jobs/attendanceCron');

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
    const cachedUsers = Array.isArray(global.cachedUsers) ? global.cachedUsers : [];
    for (const user of cachedUsers) {
      if (!user.descriptor || user.descriptor.length === 0) continue;
      
      const distance = euclideanDistance(descriptor, user.descriptor);
      if (distance < bestMatch.distance) {
        bestMatch = { id: user.id, name: user.name, distance };
      }
    }

    // Umbral de validación
    let threshold = 0.45;
    try {
      const settings = await prisma.systemSettings.findFirst();
      if (settings && typeof settings.faceConfidenceThreshold === 'number') {
        threshold = 1.0 - settings.faceConfidenceThreshold;
      }
    } catch (e) {
      // Usar umbral estándar si no hay contexto de tenant
    }

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
    const deviceToken = req.headers['x-device-token'] || req.query.deviceToken;
    const { getDeviceByToken } = require('../../utils/authHelpers');
    const { runWithTenantContext } = require('../../middlewares/tenantContext');

    let device = req.device;
    if (!device && deviceToken) {
      device = await getDeviceByToken(deviceToken);
    }

    if (!device) {
      return res.status(401).json({ error: 'DEVICE_UNAUTHORIZED', message: 'Token de dispositivo no proporcionado o inválido.' });
    }
    if (!device.isActive) {
      return res.status(403).json({ error: 'DEVICE_DEACTIVATED', message: 'Dispositivo dado de baja.' });
    }
    if (device.isBlocked) {
      return res.status(403).json({ error: 'DEVICE_BLOCKED', message: 'Dispositivo bloqueado temporalmente.' });
    }

    const companyId = device.companyId;

    return await runWithTenantContext({ companyId, deviceId: device.id }, async () => {
      const targetEmp = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, companyId: true }
      });

      if (!targetEmp) return res.status(404).json({ error: 'Empleado no encontrado' });

      // Self-Healing: cerrar automáticamente registros previos olvidados del empleado
      await processAutoCheckout(employeeId, companyId);

      const settings = await prisma.systemSettings.findFirst();
      const tz = settings?.timezone || DEFAULT_TZ;
      const startOfDay = getStartOfDay(new Date(), tz);

      // 1. Obtener registro de hoy
      const todayRecord = await prisma.attendanceRecord.findFirst({
        where: {
          employeeId,
          date: startOfDay
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
        availableShifts = [{
          id: -1,
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
        hasHorasExtra: !!(todayRecord && todayRecord.overtimeMinutes > 0),
        salidaTime: todayRecord ? todayRecord.salida : null,
        overtimeMinutes: todayRecord ? todayRecord.overtimeMinutes : 0,
        availableShifts,
        currentShiftId: todayRecord ? todayRecord.shiftId : null
      });
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

    const { getDeviceByToken } = require('../../utils/authHelpers');
    const { runWithTenantContext } = require('../../middlewares/tenantContext');

    const deviceToken = req.headers['x-device-token'] || req.body?.deviceToken;
    let device = req.device;

    if (!device && deviceToken) {
      device = await getDeviceByToken(deviceToken);
    }

    if (!device) {
      return res.status(401).json({ error: 'DEVICE_UNAUTHORIZED', message: 'Se requiere token de dispositivo válido para checadas.' });
    }

    if (!device.isActive) {
      return res.status(403).json({
        error: device.deactivatedReason 
          ? `Dispositivo dado de baja: ${device.deactivatedReason}` 
          : 'Este dispositivo checador ha sido dado de baja.'
      });
    }
    if (device.isBlocked) {
      return res.status(403).json({
        error: device.blockedReason 
          ? `Dispositivo bloqueado temporalmente: ${device.blockedReason}` 
          : 'Este dispositivo checador se encuentra bloqueado temporalmente por administración.'
      });
    }

    const companyId = device.companyId;
    const deviceId = device.id;

    return await runWithTenantContext({ companyId, deviceId }, async () => {
      // Validar pertenencia del empleado a la empresa del dispositivo
      const targetEmployee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, companyId: true, firstName: true, lastName: true, identifier: true }
      });

      if (!targetEmployee) {
        return res.status(404).json({
          error: 'Empleado no encontrado'
        });
      }

      const now = new Date();
      await prisma.device.update({ 
        where: { id: deviceId }, 
        data: { lastSeenAt: now, status: 'ONLINE' } 
      }).catch(() => {});

      const settings = await prisma.systemSettings.findFirst();
      const tz = settings?.timezone || DEFAULT_TZ;

      // Self-Healing
      if (action === 'entrada') {
        await processAutoCheckout(employeeId, companyId);
      }

      const startOfDay = getStartOfDay(now, tz);
      let record = await prisma.attendanceRecord.findFirst({
        where: { employeeId, date: startOfDay }
      });

      if (action === 'entrada') {
        if (record && record.entrada) return res.status(400).json({ error: 'Ya tiene entrada registrada' });

        let isLate = false;
        let lateMinutes = null;
        let resolvedShiftId = null;

        let targetShift = null;
        if (shiftId && shiftId !== -1) {
          targetShift = await prisma.shift.findUnique({ where: { id: shiftId } });
          resolvedShiftId = shiftId;
        } else {
          targetShift = {
            startTime: `${(settings?.workdayStartHour ?? 9).toString().padStart(2, '0')}:${(settings?.workdayStartMinute ?? 0).toString().padStart(2, '0')}`,
            endTime: `${(settings?.workdayEndHour ?? 17).toString().padStart(2, '0')}:${(settings?.workdayEndMinute ?? 0).toString().padStart(2, '0')}`,
            tolerance: settings?.latenessToleranceMin ?? 15
          };
        }

        if (targetShift) {
          const nowParts = getTzParts(now, tz);
          const nowTotalMins = nowParts.totalMinutes;

          const [shiftHour, shiftMinute] = targetShift.startTime.split(':').map(Number);
          let expectedTotalMins = shiftHour * 60 + shiftMinute;

          const lateEvent = await prisma.eventRequest.findFirst({
            where: { employeeId, date: startOfDay, type: 'LATE_ARRIVAL', status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' }
          });

          if (lateEvent && lateEvent.startTime) {
            const evParts = getTzParts(new Date(lateEvent.startTime), tz);
            expectedTotalMins = evParts.totalMinutes;
          }

          const tolerance = targetShift.tolerance !== null ? targetShift.tolerance : (settings?.latenessToleranceMin ?? 15);
          const diffMins = nowTotalMins - expectedTotalMins;

          if (diffMins > tolerance) {
            isLate = true;
            lateMinutes = diffMins;
          }
        }

        if (!record) {
          record = await prisma.attendanceRecord.create({
            data: {
              companyId,
              employeeId,
              date: startOfDay,
              entrada: now,
              shiftId: resolvedShiftId,
              isLate,
              lateMinutes,
              deviceId
            }
          });
        } else {
          record = await prisma.attendanceRecord.update({
            where: { id: record.id },
            data: {
              entrada: now,
              shiftId: resolvedShiftId,
              isLate,
              lateMinutes,
              deviceId
            }
          });
        }

        if (isLate && lateMinutes > 0) {
          const msg = `${targetEmployee.firstName} ${targetEmployee.lastName} registró su entrada con ${lateMinutes} minuto${lateMinutes > 1 ? 's' : ''} de tardanza.`;
          
          await prisma.notification.create({
            data: {
              companyId,
              title: 'Llegada Tardía',
              message: msg,
              type: 'WARNING',
              category: 'attendance',
              entityId: employeeId
            }
          });

          const appModule = require('../../app');
          if (appModule.emitNotification) {
            appModule.emitNotification({
              title: 'Llegada Tardía',
              message: msg,
              type: 'WARNING',
              category: 'attendance',
              entityId: employeeId,
              companyId
            });
          }
        }

      } else if (action === 'salida') {
        if (!record) return res.status(400).json({ error: 'No hay registro de entrada' });
        record = await prisma.attendanceRecord.update({
          where: { id: record.id },
          data: { salida: now, deviceId }
        });
      } else if (action === 'recesoInicio') {
        if (!record) return res.status(400).json({ error: 'No hay registro de entrada' });
        record = await prisma.attendanceRecord.update({
          where: { id: record.id },
          data: { recesoInicio: now, deviceId }
        });
      } else if (action === 'recesoFin') {
        if (!record) return res.status(400).json({ error: 'No hay registro de entrada' });
        record = await prisma.attendanceRecord.update({
          where: { id: record.id },
          data: { recesoFin: now, deviceId }
        });
      } else {
        return res.status(400).json({ error: 'Acción inválida' });
      }

      res.json(record);
    });

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
    const { date, startDate, endDate } = req.query;
    
    let whereClause = {};
    let eventWhereClause = { status: 'ACTIVE' };

    let sDate = startDate || date;
    let eDate = endDate || date;

    if (sDate && eDate) {
      const startOfDay = new Date(`${sDate}T00:00:00.000Z`);
      const endOfDay = new Date(`${eDate}T23:59:59.999Z`);
      
      whereClause = {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        }
      };

      eventWhereClause.OR = [
        {
          date: { lte: endOfDay },
          dateTo: { gte: startOfDay }
        },
        {
          date: { gte: startOfDay, lte: endOfDay }
        }
      ];
    } else if (sDate) {
      const startOfDay = new Date(`${sDate}T00:00:00.000Z`);
      const endOfDay = new Date(`${sDate}T23:59:59.999Z`);
      whereClause = {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        }
      };
      eventWhereClause.date = startOfDay;
    }

    const records = await prisma.attendanceRecord.findMany({
      where: whereClause,
      include: { 
        employee: {
          include: { department: true }
        },
        shift: true
      },
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    const events = await prisma.eventRequest.findMany({
      where: eventWhereClause,
      include: {
        employee: {
          include: { department: true }
        }
      }
    });

    res.json({ records, events });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener registros' });
  }
});

module.exports = router;
