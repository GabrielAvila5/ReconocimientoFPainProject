const express = require('express');
const router = express.Router();
const prisma = require('../../utils/prisma');
const requireJwt = require('../../middlewares/requireJwt'); // Asumiendo que existe, para proteger endpoints admin

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
    const { name, startTime, endTime, tolerance, isActive } = req.body;
    
    if (!name || !startTime || !endTime) {
      return res.status(400).json({ error: 'Nombre, hora de inicio y fin son obligatorios' });
    }

    const newShift = await prisma.shift.create({
      data: {
        name,
        startTime,
        endTime,
        tolerance: tolerance !== undefined ? tolerance : null,
        isActive: isActive !== undefined ? isActive : true,
      }
    });
    
    res.status(201).json(newShift);
  } catch (error) {
    console.error('Error creating shift:', error);
    res.status(500).json({ error: 'Error interno del servidor al crear turno' });
  }
});

// Actualizar turno
router.put('/:id', requireJwt, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, startTime, endTime, tolerance, isActive } = req.body;

    const updatedShift = await prisma.shift.update({
      where: { id: parseInt(id) },
      data: {
        name,
        startTime,
        endTime,
        tolerance,
        isActive
      }
    });

    res.json(updatedShift);
  } catch (error) {
    console.error('Error updating shift:', error);
    res.status(500).json({ error: 'Error interno del servidor al actualizar turno' });
  }
});

// Eliminar turno
router.delete('/:id', requireJwt, async (req, res) => {
  try {
    const { id } = req.params;
    const shiftId = parseInt(id);

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
