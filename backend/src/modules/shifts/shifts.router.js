const express = require('express');
const router = express.Router();
const prisma = require('../../utils/prisma');
const requireJwt = require('../../middlewares/requireJwt');
const { validateScheduleByDay } = require('../../utils/shiftUtils');

// Obtener todos los turnos
router.get('/', requireJwt, async (req, res) => {
  try {
    const shifts = await prisma.shift.findMany({
      include: {
        departments: {
          include: { department: true }
        },
        employees: {
          include: { employee: true }
        }
      }
    });
    res.json(shifts);
  } catch (error) {
    console.error('Error fetching shifts:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener turnos' });
  }
});

// Crear turno
router.post('/', requireJwt, async (req, res) => {
  try {
    const { name, startTime, endTime, tolerance, isActive, scheduleByDay, breakStartTime, breakEndTime } = req.body;
    
    if (!name || !startTime || !endTime) {
      return res.status(400).json({ error: 'Nombre, hora de inicio y fin son obligatorios' });
    }

    if (scheduleByDay) {
      const val = validateScheduleByDay(scheduleByDay);
      if (!val.valid) {
        return res.status(400).json({ error: val.error });
      }
    }

    const newShift = await prisma.shift.create({
      data: {
        name,
        startTime,
        endTime,
        tolerance: tolerance !== undefined && tolerance !== null && tolerance !== '' ? parseInt(tolerance, 10) : null,
        breakStartTime: breakStartTime || null,
        breakEndTime: breakEndTime || null,
        scheduleByDay: scheduleByDay ? (typeof scheduleByDay === 'string' ? JSON.parse(scheduleByDay) : scheduleByDay) : null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      }
    });
    
    res.status(201).json(newShift);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un turno con ese nombre en su empresa' });
    }
    console.error('Error creating shift:', error);
    res.status(500).json({ error: 'Error interno del servidor al crear turno' });
  }
});

// Actualizar turno
router.put('/:id', requireJwt, async (req, res) => {
  try {
    const { id } = req.params;
    const shiftId = parseInt(id);
    const { name, startTime, endTime, tolerance, isActive, scheduleByDay, breakStartTime, breakEndTime } = req.body;

    const existingShift = await prisma.shift.findUnique({
      where: { id: shiftId }
    });
    if (!existingShift) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    if (scheduleByDay) {
      const val = validateScheduleByDay(scheduleByDay);
      if (!val.valid) {
        return res.status(400).json({ error: val.error });
      }
    }

    const updatedShift = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        name,
        startTime,
        endTime,
        tolerance: tolerance !== undefined && tolerance !== null && tolerance !== '' ? parseInt(tolerance, 10) : null,
        breakStartTime: breakStartTime !== undefined ? (breakStartTime || null) : undefined,
        breakEndTime: breakEndTime !== undefined ? (breakEndTime || null) : undefined,
        scheduleByDay: scheduleByDay !== undefined ? (typeof scheduleByDay === 'string' ? JSON.parse(scheduleByDay) : scheduleByDay) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined
      }
    });

    res.json(updatedShift);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un turno con ese nombre en su empresa' });
    }
    console.error('Error updating shift:', error);
    res.status(500).json({ error: 'Error interno del servidor al actualizar turno' });
  }
});

// Eliminar turno
router.delete('/:id', requireJwt, async (req, res) => {
  try {
    const { id } = req.params;
    const shiftId = parseInt(id);

    const shift = await prisma.shift.findUnique({
      where: { id: shiftId }
    });
    if (!shift) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    const attendances = await prisma.attendanceRecord.count({
      where: { shiftId }
    });

    if (attendances > 0) {
      const deactivatedShift = await prisma.shift.update({
        where: { id: shiftId },
        data: { isActive: false }
      });
      return res.json({ message: 'El turno tiene registros de asistencia, se ha desactivado en lugar de eliminarse.', shift: deactivatedShift });
    }

    await prisma.shift.delete({
      where: { id: shiftId }
    });

    res.json({ message: 'Turno eliminado correctamente' });
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(409).json({ 
        error: 'No se puede eliminar el turno porque está asignado a empleados, departamentos o tiene asistencias asociadas. Desactive el turno (isActive: false) en su lugar.' 
      });
    }
    console.error('Error deleting shift:', error);
    res.status(500).json({ error: 'Error interno del servidor al eliminar turno' });
  }
});

// Asignar turno a departamento
router.post('/department/:id', requireJwt, async (req, res) => {
  try {
    const { id: departmentId } = req.params;
    const { shiftId } = req.body;

    if (!shiftId) {
      return res.status(400).json({ error: 'shiftId es obligatorio' });
    }

    const assignment = await prisma.departmentShift.create({
      data: {
        departmentId: parseInt(departmentId),
        shiftId: parseInt(shiftId)
      }
    });

    res.status(201).json(assignment);
  } catch (error) {
    console.error('Error assigning shift to department:', error);
    res.status(500).json({ error: 'Error interno del servidor al asignar turno al área' });
  }
});

// Asignar turno a empleado
router.post('/employee/:id', requireJwt, async (req, res) => {
  try {
    const { id: employeeId } = req.params;
    const { shiftId } = req.body;

    if (!shiftId) {
      return res.status(400).json({ error: 'shiftId es obligatorio' });
    }

    const assignment = await prisma.employeeShift.create({
      data: {
        employeeId: employeeId,
        shiftId: parseInt(shiftId)
      }
    });

    res.status(201).json(assignment);
  } catch (error) {
    console.error('Error assigning shift to employee:', error);
    res.status(500).json({ error: 'Error interno del servidor al asignar turno al empleado' });
  }
});

module.exports = router;
