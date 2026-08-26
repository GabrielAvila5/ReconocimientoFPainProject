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

// POST /api/v1/departments
router.post('/', requireJwt, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const department = await prisma.department.create({
      data: { name }
    });

    // Auditoría
    await prisma.adminAuditLog.create({
      data: {
        action: 'CREATE_DEPARTMENT',
        performedById: req.user.id,
        performedByName: req.user.name || req.user.email || 'Admin',
        targetName: department.name,
        targetEmail: 'N/A'
      }
    });

    res.status(201).json(department);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un departamento con ese nombre' });
    }
    console.error('Error creating department:', error);
    res.status(500).json({ error: 'Error del servidor al crear departamento' });
  }
});

// DELETE /api/v1/departments/:id
router.delete('/:id', requireJwt, async (req, res) => {
  try {
    const departmentId = parseInt(req.params.id);

    // Verificar si hay empleados
    const employeesCount = await prisma.employee.count({
      where: { departmentId }
    });

    if (employeesCount > 0) {
      return res.status(400).json({ error: 'No se puede eliminar el departamento porque tiene empleados asignados.' });
    }

    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) return res.status(404).json({ error: 'Departamento no encontrado' });

    await prisma.department.delete({ where: { id: departmentId } });

    // Auditoría
    await prisma.adminAuditLog.create({
      data: {
        action: 'DELETE_DEPARTMENT',
        performedById: req.user.id,
        performedByName: req.user.name || req.user.email || 'Admin',
        targetName: department.name,
        targetEmail: 'N/A'
      }
    });

    res.json({ success: true, message: 'Departamento eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ error: 'Error del servidor al eliminar departamento' });
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

    // Auditoría
    await prisma.adminAuditLog.create({
      data: {
        action: useCustom ? 'ASSIGN_DEPARTMENT_SHIFT' : 'REMOVE_DEPARTMENT_SHIFT',
        performedById: req.user.id,
        performedByName: req.user.name || req.user.email || 'Admin',
        targetName: department.name,
        targetEmail: 'N/A'
      }
    });

    res.json({ success: true, shift: shiftRecord });
  } catch (error) {
    console.error('Error updating department shift:', error);
    res.status(500).json({ error: 'Error del servidor al actualizar el turno del departamento' });
  }
});

module.exports = router;
