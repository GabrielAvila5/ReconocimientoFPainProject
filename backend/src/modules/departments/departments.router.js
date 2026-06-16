const express = require('express');
const router = express.Router();
const prisma = require('../../utils/prisma');
const requireJwt = require('../../middlewares/requireJwt');

// GET /api/v1/departments
router.get('/', requireJwt, async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        shifts: {
          include: {
            shift: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    const formatted = departments.map(dept => {
      const departmentShift = dept.shifts[0]; // Asumimos max 1 turno por depto en esta fase
      const shift = departmentShift ? departmentShift.shift : null;

      return {
        id: dept.id,
        name: dept.name,
        useCustom: !!shift,
        shift: shift ? {
          startTime: shift.startTime,
          endTime: shift.endTime,
          tolerance: shift.tolerance,
          breakStartTime: shift.breakStartTime,
          breakEndTime: shift.breakEndTime
        } : null
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Error del servidor al obtener departamentos' });
  }
});

// PUT /api/v1/departments/:id/shift
router.put('/:id/shift', requireJwt, async (req, res) => {
  try {
    const departmentId = parseInt(req.params.id);
    const { useCustom, startTime, endTime, tolerance, breakStartTime, breakEndTime } = req.body;

    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: { shifts: { include: { shift: true } } }
    });

    if (!department) return res.status(404).json({ error: 'Departamento no encontrado' });

    const currentDepShift = department.shifts[0];

    if (!useCustom) {
      // Si no usa personalizado, borramos el vínculo
      if (currentDepShift) {
        await prisma.departmentShift.delete({
          where: { id: currentDepShift.id }
        });
        // Opcional: borrar el turno si nadie más lo usa, pero por ahora lo dejamos
      }
      return res.json({ success: true, message: 'Horario personalizado desactivado' });
    }

    // Si usa personalizado, creamos o actualizamos
    const shiftName = `Turno - ${department.name}`;

    let shiftRecord;
    
    // Primero, buscar si ya existe el turno con ese nombre
    const existingShift = await prisma.shift.findUnique({ where: { name: shiftName } });

    if (existingShift) {
      shiftRecord = await prisma.shift.update({
        where: { id: existingShift.id },
        data: {
          startTime,
          endTime,
          tolerance,
          breakStartTime,
          breakEndTime
        }
      });
    } else {
      shiftRecord = await prisma.shift.create({
        data: {
          name: shiftName,
          startTime,
          endTime,
          tolerance,
          breakStartTime,
          breakEndTime
        }
      });
    }

    // Asegurar el vínculo
    if (!currentDepShift) {
      await prisma.departmentShift.create({
        data: {
          departmentId,
          shiftId: shiftRecord.id
        }
      });
    } else if (currentDepShift.shiftId !== shiftRecord.id) {
      await prisma.departmentShift.update({
        where: { id: currentDepShift.id },
        data: { shiftId: shiftRecord.id }
      });
    }

    res.json({ success: true, shift: shiftRecord });
  } catch (error) {
    console.error('Error updating department shift:', error);
    res.status(500).json({ error: 'Error del servidor al actualizar el turno del departamento' });
  }
});

module.exports = router;
