const express = require('express');
const router = express.Router();
const requireJwt = require('../../middlewares/requireJwt');
const prisma = require('../../utils/prisma');
const { syncFaceCache } = require('../../utils/faceMath');

// GET /api/v1/employees/descriptors - PÚBLICO (sin auth)
router.get('/descriptors', async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      where: {
        isActive: true,
        faceDescriptor: { not: null }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        department: true,
        position: true,
        faceDescriptor: true
      }
    });
    
    // Mapear para devolver nombre completo para conveniencia si se desea,
    // o el frontend usa firstName y lastName.
    const mapped = employees.map(emp => ({
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      department: emp.department,
      position: emp.position,
      faceDescriptor: emp.faceDescriptor
    }));
    
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener descriptores' });
  }
});

// Middleware JWT para el resto de endpoints
router.use(requireJwt);

router.get('/', async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      include: { 
        department: true,
        shifts: {
          include: { shift: true }
        }
      }
    });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener empleados' });
  }
});

// Crear empleado básico sin biometría
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, identifier, email, department, position } = req.body;
    
    const employee = await prisma.employee.create({
      data: {
        firstName,
        lastName,
        identifier,
        email,
        position,
        department: department ? {
          connectOrCreate: {
            where: { name: department },
            create: { name: department }
          }
        } : undefined
      }
    });
    
    res.status(201).json(employee);
  } catch (error) {
    console.error(error);
    if (error.code === 'P2002') {
      const target = error.meta?.target || '';
      if (target.includes('email')) {
        return res.status(400).json({ error: 'El correo electrónico ya está registrado por otro empleado.' });
      }
      if (target.includes('identifier')) {
        return res.status(400).json({ error: 'El identificador (DNI) ya está registrado.' });
      }
      return res.status(400).json({ error: 'Un dato único ya se encuentra registrado (ej. correo o DNI).' });
    }
    res.status(500).json({ error: 'Error al crear empleado', details: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { 
        department: true,
        shifts: {
          include: { shift: true }
        },
        attendances: {
          orderBy: { date: 'desc' },
          take: 1
        },
        eventRequests: {
          where: { status: 'ACTIVE' },
          orderBy: { date: 'desc' },
          take: 5
        }
      }
    });
    if (!employee) return res.status(404).json({ error: 'No encontrado' });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener empleado' });
  }
});

// Editar empleado básico (sin biometría)
router.put('/:id', async (req, res) => {
  try {
    const { firstName, lastName, identifier, email, department, position, isActive } = req.body;
    
    // Preparar data (departamento es opcional)
    let data = {
      firstName,
      lastName,
      identifier,
      email,
      position
    };

    if (isActive !== undefined) {
      data.isActive = isActive;
    }

    if (department) {
      data.department = {
        connectOrCreate: {
          where: { name: department },
          create: { name: department }
        }
      };
    } else {
      data.department = {
        disconnect: true
      };
    }

    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data
    });

    res.json(employee);
  } catch (error) {
    console.error(error);
    if (error.code === 'P2002') {
      const target = error.meta?.target || '';
      if (target.includes('email')) {
        return res.status(400).json({ error: 'El correo electrónico ya está registrado por otro empleado.' });
      }
      if (target.includes('identifier')) {
        return res.status(400).json({ error: 'El identificador (DNI) ya está registrado.' });
      }
      return res.status(400).json({ error: 'Un dato único ya se encuentra registrado (ej. correo o DNI).' });
    }
    res.status(500).json({ error: 'Error al actualizar empleado', details: error.message });
  }
});

router.post('/:id/descriptor', async (req, res) => {
  try {
    const { descriptor } = req.body;
    if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
      return res.status(400).json({ error: 'Descriptor inválido' });
    }
    
    const enrolledAt = new Date();
    await prisma.employee.update({
      where: { id: req.params.id },
      data: {
        faceDescriptor: JSON.stringify(descriptor),
        enrolledAt
      }
    });
    
    await syncFaceCache();
    const { emitCacheRefresh } = require('../../app');
    if (emitCacheRefresh) emitCacheRefresh();
    
    res.json({ success: true, enrolledAt });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error guardando descriptor' });
  }
});

router.delete('/:id/descriptor', async (req, res) => {
  try {
    await prisma.employee.update({
      where: { id: req.params.id },
      data: {
        faceDescriptor: null,
        enrolledAt: null
      }
    });
    
    await syncFaceCache();
    const { emitCacheRefresh } = require('../../app');
    if (emitCacheRefresh) emitCacheRefresh();
    
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error eliminando descriptor' });
  }
});

// Registra un empleado con su vector facial (legacy / opcional)
router.post('/register-face', async (req, res) => {
  try {
    const { firstName, lastName, identifier, descriptors, email, department, position } = req.body;

    if (!descriptors || !Array.isArray(descriptors) || descriptors.length === 0) {
      return res.status(400).json({ error: 'Descriptores inválidos' });
    }

    // Calcular promedio del array de descriptores (number[][])
    const numDescriptors = descriptors.length;
    const avgDescriptor = new Array(128).fill(0);
    
    for (let i = 0; i < numDescriptors; i++) {
      for (let j = 0; j < 128; j++) {
        avgDescriptor[j] += descriptors[i][j];
      }
    }
    for (let j = 0; j < 128; j++) {
      avgDescriptor[j] /= numDescriptors;
    }

    const employee = await prisma.employee.create({
      data: {
        firstName,
        lastName,
        identifier,
        email,
        position,
        faceDescriptor: JSON.stringify(avgDescriptor),
        enrolledAt: new Date(),
        department: department ? {
          connectOrCreate: {
            where: { name: department },
            create: { name: department }
          }
        } : undefined
      }
    });

    res.json({ message: 'Empleado registrado exitosamente', employee });
  } catch (error) {
    console.error(error);
    if (error.code === 'P2002') {
      const target = error.meta?.target || '';
      if (target.includes('email')) {
        return res.status(400).json({ error: 'El correo electrónico ya está registrado por otro empleado.' });
      }
      if (target.includes('identifier')) {
        return res.status(400).json({ error: 'El identificador (DNI) ya está registrado.' });
      }
      return res.status(400).json({ error: 'Un dato único ya se encuentra registrado (ej. correo o DNI).' });
    }
    res.status(500).json({ error: 'Error registrando empleado' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    // Eliminar registros asociados primero para evitar errores de llave foránea
    await prisma.attendanceRecord.deleteMany({
      where: { employeeId: req.params.id }
    });
    
    await prisma.notification.deleteMany({
      where: { entityId: req.params.id }
    });

    await prisma.employeeShift.deleteMany({
      where: { employeeId: req.params.id }
    });

    await prisma.employee.delete({
      where: { id: req.params.id }
    });
    
    res.json({ success: true, message: 'Empleado eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando empleado:', error);
    res.status(500).json({ error: 'Error al eliminar empleado. Es posible que tenga otros registros asociados.' });
  }
});

// PUT /api/v1/employees/:id/shift
router.put('/:id/shift', async (req, res) => {
  try {
    const employeeId = req.params.id;
    const { useCustom, startTime, endTime, tolerance, breakStartTime, breakEndTime } = req.body;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { shifts: { include: { shift: true } } }
    });

    if (!employee) return res.status(404).json({ error: 'Empleado no encontrado' });

    const currentEmpShift = employee.shifts[0];

    if (!useCustom) {
      // Si no usa personalizado, borramos el vínculo
      if (currentEmpShift) {
        await prisma.employeeShift.delete({
          where: { id: currentEmpShift.id }
        });
      }
      
      // Auditoría
      await prisma.adminAuditLog.create({
        data: {
          action: 'REMOVE_EMPLOYEE_SHIFT',
          performedById: req.user.id,
          performedByName: req.user.name || req.user.email || 'Admin',
          targetName: `${employee.firstName} ${employee.lastName}`,
          targetEmail: employee.identifier
        }
      });
      
      return res.json({ success: true, message: 'Horario personalizado desactivado' });
    }

    // Si usa personalizado, creamos o actualizamos
    const shiftName = `Turno - ${employee.identifier}`;

    let shiftRecord;
    
    // Primero, buscar si ya existe el turno con ese nombre
    const existingShift = await prisma.shift.findUnique({ where: { name: shiftName } });

    if (existingShift) {
      shiftRecord = await prisma.shift.update({
        where: { id: existingShift.id },
        data: { startTime, endTime, tolerance, breakStartTime, breakEndTime }
      });
    } else {
      shiftRecord = await prisma.shift.create({
        data: { name: shiftName, startTime, endTime, tolerance, breakStartTime, breakEndTime }
      });
    }

    // Asegurar el vínculo
    if (!currentEmpShift) {
      await prisma.employeeShift.create({
        data: { employeeId, shiftId: shiftRecord.id }
      });
    } else if (currentEmpShift.shiftId !== shiftRecord.id) {
      await prisma.employeeShift.update({
        where: { id: currentEmpShift.id },
        data: { shiftId: shiftRecord.id }
      });
    }

    // Auditoría
    await prisma.adminAuditLog.create({
      data: {
        action: 'ASSIGN_EMPLOYEE_SHIFT',
        performedById: req.user.id,
        performedByName: req.user.name || req.user.email || 'Admin',
        targetName: `${employee.firstName} ${employee.lastName}`,
        targetEmail: employee.identifier
      }
    });

    res.json({ success: true, shift: shiftRecord });
  } catch (error) {
    console.error('Error updating employee shift:', error);
    res.status(500).json({ error: 'Error del servidor al actualizar el turno del empleado' });
  }
});

module.exports = router;
