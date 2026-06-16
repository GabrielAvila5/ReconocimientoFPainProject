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
      include: { department: true }
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
      include: { department: true }
    });
    if (!employee) return res.status(404).json({ error: 'No encontrado' });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener empleado' });
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

module.exports = router;
