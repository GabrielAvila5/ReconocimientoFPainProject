const express = require('express');
const router = express.Router();
const requireJwt = require('../../middlewares/requireJwt');
const prisma = require('../../utils/prisma');
const { syncFaceCache } = require('../../utils/faceMath');
const { getCompanyForDescriptors, getDeviceByToken, updateDeviceLastSeen } = require('../../utils/authHelpers');
const { runWithTenantContext } = require('../../middlewares/tenantContext');

// Tracker en memoria para rate limiting de descargas de descriptores (120 req/h)
// y detección de anomalías/spikes (>30 req en 5 minutos)
const descriptorDownloadsTracker = new Map(); // key -> timestamps[]
const descriptorSpikeAlerts = new Map(); // key -> lastAlertTimestamp

// Caché en RAM de payload de descriptores por [companyId, descriptorsVersion]
// Evita consultas redundantes a BD y trabajo criptográfico repetido en el event loop
const descriptorsPayloadCache = new Map(); // key: `${companyId}_v${version}` -> mapped[]

function checkDescriptorRateLimit(clientKey) {
  const now = Date.now();
  let records = descriptorDownloadsTracker.get(clientKey) || [];
  // Purgar timestamps más viejos que 1 hora
  records = records.filter(t => now - t < 3600000);
  
  if (records.length >= 120) {
    return { allowed: false, reason: 'RATE_LIMIT_EXCEEDED' };
  }

  // Verificar spike: más de 30 descargas en 5 minutos
  const fiveMinCount = records.filter(t => now - t < 300000).length;
  let spikeAlert = false;
  if (fiveMinCount >= 30) {
    const lastAlert = descriptorSpikeAlerts.get(clientKey) || 0;
    if (now - lastAlert > 300000) {
      spikeAlert = true;
      descriptorSpikeAlerts.set(clientKey, now);
    }
  }

  records.push(now);
  descriptorDownloadsTracker.set(clientKey, records);
  return { allowed: true, spikeAlert };
}

/**
 * Incrementa atómicamente Company.descriptorsVersion y emite evento WebSocket
 * descriptors_invalidated exclusivamente a la sala de la empresa afectada.
 *
 * @param {string} companyId ID de la empresa
 * @param {object} req Objeto request para acceder al socket engine
 * @returns {Promise<number|null>} Nueva versión de descriptores
 */
async function bumpDescriptorsVersion(companyId, req) {
  if (!companyId) return null;
  try {
    const updated = await runWithTenantContext({ companyId }, () =>
      prisma.company.update({
        where: { id: companyId },
        data: { descriptorsVersion: { increment: 1 } },
        select: { id: true, descriptorsVersion: true }
      })
    );

    // Sincronizar cache facial en memoria del proceso
    syncFaceCache().catch(() => {});

    // Invalidar caché en memoria del payload de descriptores para este inquilino
    for (const key of descriptorsPayloadCache.keys()) {
      if (key.startsWith(`${companyId}_`)) {
        descriptorsPayloadCache.delete(key);
      }
    }

    // Notificar invalidación a kioscos del tenant vía WebSocket
    const io = req?.app?.get('io') || global.io;
    if (io) {
      io.to(`company_${companyId}`).emit('descriptors_invalidated', {
        companyId,
        version: updated.descriptorsVersion,
        timestamp: new Date().toISOString()
      });
    }
    return updated.descriptorsVersion;
  } catch (err) {
    console.error('Error al incrementar descriptorsVersion:', err);
    return null;
  }
}

// GET /api/v1/employees/descriptors
router.get('/descriptors', async (req, res) => {
  try {
    let companyId = null;
    let device = req.device;
    const deviceToken = req.headers['x-device-token'];

    // Autenticación estricta: Se requiere x-device-token válido o sesión administrativa
    if (deviceToken) {
      device = await getDeviceByToken(deviceToken);
      if (!device) {
        return res.status(401).json({
          error: 'DEVICE_UNAUTHORIZED',
          message: 'Token de dispositivo no válido.'
        });
      }
      if (!device.isActive) {
        return res.status(403).json({
          error: 'DEVICE_DEACTIVATED',
          message: device.deactivatedReason || 'Dispositivo dado de baja.'
        });
      }
      if (device.isBlocked) {
        return res.status(403).json({
          error: 'DEVICE_BLOCKED',
          message: device.blockedReason || 'Dispositivo bloqueado temporalmente.'
        });
      }
      companyId = device.companyId;
      updateDeviceLastSeen(device.id);
    } else if (req.user) {
      if (req.user.role === 'SUPER_ADMIN') {
        companyId = req.headers['x-tenant-id'] || req.query.companyId || 'default-company-pain';
      } else {
        companyId = req.user.companyId;
      }
    } else {
      return res.status(401).json({
        error: 'DEVICE_UNAUTHORIZED',
        message: 'Se requiere cabecera x-device-token o sesión administrativa activa para descargar descriptores.'
      });
    }

    if (!companyId) {
      return res.status(400).json({ error: 'TENANT_REQUIRED', message: 'Contexto de empresa no identificado.' });
    }

    // 1. Consultar estado y versión actual de la empresa
    const company = await getCompanyForDescriptors(companyId);

    if (!company) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    if (!company.isActive) {
      return res.status(403).json({ error: 'COMPANY_SUSPENDED', message: 'Empresa suspendida' });
    }

    // 2. Control de Rate Limiting y Detección de Spikes
    const clientKey = device ? `dev_${device.id}` : `comp_${companyId}_${req.ip}`;
    const rateCheck = checkDescriptorRateLimit(clientKey);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: 'TOO_MANY_REQUESTS',
        message: 'Límite de descargas de descriptores excedido (máximo 120 por hora).'
      });
    }

    if (rateCheck.spikeAlert) {
      await runWithTenantContext({ companyId }, () =>
        prisma.adminAuditLog.create({
          data: {
            companyId,
            action: 'SECURITY_ALERT_DESCRIPTOR_SPIKE',
            performedById: device?.id || req.user?.id || 'system',
            performedByName: device?.name || req.user?.name || 'Kiosco',
            targetName: 'Descriptors API',
            targetEmail: 'system@security.alert'
          }
        })
      ).catch(e => console.error('Error logging spike alert:', e));
    }

    const currentVersion = company.descriptorsVersion || 1;
    const etag = `W/"desc-v${currentVersion}-${companyId}"`;

    // 3. Validación de ETag / If-None-Match (304 Not Modified)
    const clientEtag = req.headers['if-none-match'];
    if (clientEtag && clientEtag === etag) {
      res.setHeader('ETag', etag);
      res.setHeader('X-Descriptors-Version', currentVersion);
      return res.status(304).end();
    }

    // 4. Si no coincide el ETag, verificar caché en RAM por [companyId, descriptorsVersion]
    const cacheKey = `${companyId}_v${currentVersion}`;
    let mapped = descriptorsPayloadCache.get(cacheKey);

    if (!mapped) {
      const employees = await runWithTenantContext({ companyId }, () => prisma.employee.findMany({
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
      }));
      
      mapped = employees.map(emp => ({
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`.trim(),
        department: emp.department,
        position: emp.position,
        faceDescriptor: emp.faceDescriptor
      }));

      descriptorsPayloadCache.set(cacheKey, mapped);
    }
    
    res.setHeader('ETag', etag);
    res.setHeader('X-Descriptors-Version', currentVersion);
    res.json(mapped);
  } catch (error) {
    console.error('Error en /descriptors:', error);
    res.status(500).json({ error: 'Error al obtener descriptores' });
  }
});

// Middleware JWT para el resto de endpoints
router.use(requireJwt);

router.get('/', async (req, res) => {
  try {
    const [employees, admins] = await Promise.all([
      prisma.employee.findMany({
        include: { 
          department: true,
          shifts: {
            include: { shift: true }
          }
        }
      }),
      prisma.adminUser.findMany({
        select: { id: true, email: true, name: true, role: true }
      })
    ]);

    const adminByEmail = new Map();
    admins.forEach(a => {
      if (a.email) adminByEmail.set(a.email.trim().toLowerCase(), a);
    });

    const enrichedEmployees = employees.map(emp => {
      const empEmail = (emp.email || '').trim().toLowerCase();
      let matchedAdmin = adminByEmail.get(empEmail);

      // Si no coincide exactamente por email, verificar si es el Super Admin por prefijo o nombre (ej. gabrielmorag vs gabrielmorag07)
      if (!matchedAdmin) {
        matchedAdmin = admins.find(a => {
          if (a.role === 'SUPER_ADMIN') {
            const adminEmailPrefix = (a.email || '').split('@')[0].toLowerCase();
            const empEmailPrefix = (emp.email || '').split('@')[0].toLowerCase();
            if (adminEmailPrefix && empEmailPrefix && (adminEmailPrefix.includes(empEmailPrefix) || empEmailPrefix.includes(adminEmailPrefix))) {
              return true;
            }
            const empFullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
            const adminFullName = (a.name || '').toLowerCase();
            if (empFullName.includes('gabriel') && empFullName.includes('avila')) {
              return true;
            }
          }
          return false;
        });
      }

      return {
        ...emp,
        adminRole: matchedAdmin ? matchedAdmin.role : null
      };
    });

    res.json(enrichedEmployees);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener empleados' });
  }
});

// Crear empleado básico sin biometría
router.post('/', async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'TENANT_REQUIRED', message: 'Se requiere contexto de empresa.' });
    }

    const { firstName, lastName, identifier, email, departmentId, position } = req.body;
    
    if (!departmentId) {
      return res.status(400).json({ error: 'El departamento es obligatorio.' });
    }

    // 1. Validar límite de plan (maxEmployees)
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { maxEmployees: true, isActive: true }
    });

    const currentEmployeesCount = await prisma.employee.count({
      where: { companyId }
    });

    const limit = company?.maxEmployees ?? 50;
    if (currentEmployeesCount >= limit) {
      return res.status(403).json({
        error: 'PLAN_LIMIT_EXCEEDED',
        message: `Límite del plan alcanzado (${limit} empleados permitidos). Actualice su suscripción.`
      });
    }

    // 2. Validar que el departamento exista y pertenezca a la empresa
    const parsedDeptId = parseInt(departmentId, 10);
    const department = await prisma.department.findUnique({
      where: { id_companyId: { id: parsedDeptId, companyId } }
    });

    if (!department) {
      return res.status(400).json({
        error: 'DEPARTMENT_NOT_FOUND',
        message: 'El departamento especificado no existe o no pertenece a su empresa.'
      });
    }

    const employee = await prisma.employee.create({
      data: {
        companyId,
        firstName,
        lastName,
        identifier,
        email: email || null,
        position: position || null,
        departmentId: parsedDeptId,
        ...(req.body.faceDescriptor ? { faceDescriptor: req.body.faceDescriptor } : {})
      }
    });

    if (req.body.faceDescriptor) {
      await bumpDescriptorsVersion(companyId, req);
    }
    
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
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'DEPARTMENT_INVALID', message: 'El departamento especificado no es válido para su empresa.' });
    }
    res.status(500).json({ error: 'Error al crear empleado', details: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { 
        department: { include: { shifts: { include: { shift: true } } } },
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
    if (!employee) return res.status(404).json({ error: 'Empleado no encontrado' });

    let adminRole = null;
    if (employee.email) {
      const admin = await prisma.adminUser.findUnique({
        where: { email: employee.email }
      });
      if (admin) {
        adminRole = admin.role;
      } else {
        const superAdmin = await prisma.adminUser.findFirst({
          where: { role: 'SUPER_ADMIN' }
        });
        if (superAdmin) {
          const empPrefix = employee.email.split('@')[0].toLowerCase();
          const superPrefix = superAdmin.email.split('@')[0].toLowerCase();
          const empFullName = `${employee.firstName || ''} ${employee.lastName || ''}`.toLowerCase();
          if (empPrefix.includes('gabrielmorag') || superPrefix.includes('gabrielmorag') || (empFullName.includes('gabriel') && empFullName.includes('avila'))) {
            adminRole = 'SUPER_ADMIN';
          }
        }
      }
    }

    res.json({ ...employee, adminRole });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener empleado' });
  }
});

// Editar empleado básico (sin biometría)
router.put('/:id', async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const { firstName, lastName, identifier, email, departmentId, position, isActive } = req.body;
    
    if (!departmentId) {
      return res.status(400).json({ error: 'El departamento es obligatorio.' });
    }

    const parsedDeptId = parseInt(departmentId, 10);
    if (companyId) {
      const department = await prisma.department.findUnique({
        where: { id_companyId: { id: parsedDeptId, companyId } }
      });
      if (!department) {
        return res.status(400).json({
          error: 'DEPARTMENT_NOT_FOUND',
          message: 'El departamento especificado no existe o no pertenece a su empresa.'
        });
      }
    }

    let data = {
      firstName,
      lastName,
      identifier,
      email: email || null,
      position: position || null,
      departmentId: parsedDeptId
    };

    if (req.body.faceDescriptor !== undefined) {
      data.faceDescriptor = req.body.faceDescriptor;
    }

    if (isActive !== undefined) {
      data.isActive = isActive;
    }

    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data
    });

    if (isActive !== undefined || req.body.faceDescriptor !== undefined) {
      await bumpDescriptorsVersion(companyId || employee.companyId, req);
    }

    res.json(employee);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }
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
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'DEPARTMENT_INVALID', message: 'El departamento especificado no es válido para su empresa.' });
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
    const updatedEmp = await prisma.employee.update({
      where: { id: req.params.id },
      data: {
        faceDescriptor: JSON.stringify(descriptor),
        enrolledAt
      }
    });
    
    await bumpDescriptorsVersion(req.user?.companyId || updatedEmp.companyId, req);
    
    res.json({ success: true, enrolledAt });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error guardando descriptor' });
  }
});

router.delete('/:id/descriptor', async (req, res) => {
  try {
    const updatedEmp = await prisma.employee.update({
      where: { id: req.params.id },
      data: {
        faceDescriptor: null,
        enrolledAt: null
      }
    });
    
    await bumpDescriptorsVersion(req.user?.companyId || updatedEmp.companyId, req);
    
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error eliminando descriptor' });
  }
});

// Registra un empleado con su vector facial (legacy / opcional)
router.post('/register-face', async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'TENANT_REQUIRED', message: 'Se requiere contexto de empresa.' });
    }

    const { firstName, lastName, identifier, descriptors, email, department, position } = req.body;

    if (!descriptors || !Array.isArray(descriptors) || descriptors.length === 0) {
      return res.status(400).json({ error: 'Descriptores inválidos' });
    }

    // Validar límite del plan
    const comp = await prisma.company.findUnique({
      where: { id: companyId },
      select: { maxEmployees: true }
    });
    const currentCount = await prisma.employee.count({ where: { companyId } });
    const limit = comp?.maxEmployees ?? 50;
    if (currentCount >= limit) {
      return res.status(403).json({
        error: 'PLAN_LIMIT_EXCEEDED',
        message: `Límite del plan alcanzado (${limit} empleados permitidos). Actualice su suscripción.`
      });
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

    let departmentId = null;
    if (department) {
      const dept = await prisma.department.upsert({
        where: { companyId_name: { companyId, name: department } },
        create: { companyId, name: department },
        update: {}
      });
      departmentId = dept.id;
    }

    const employee = await prisma.employee.create({
      data: {
        companyId,
        firstName,
        lastName,
        identifier,
        email: email || null,
        position: position || null,
        faceDescriptor: JSON.stringify(avgDescriptor),
        enrolledAt: new Date(),
        departmentId
      }
    });

    await bumpDescriptorsVersion(companyId, req);

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
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }

    // Proteger al Super Administrador contra borrado accidental por parte de otros administradores
    if (employee.email && req.user?.role !== 'SUPER_ADMIN') {
      const admin = await prisma.adminUser.findUnique({
        where: { email: employee.email }
      });
      if (admin && admin.role === 'SUPER_ADMIN') {
        return res.status(403).json({ 
          error: 'No se puede eliminar el perfil de personal del Super Administrador del sistema.' 
        });
      }
    }

    // Eliminar registros asociados primero para evitar errores de llave foránea
    await prisma.eventRequest.deleteMany({
      where: { employeeId: req.params.id }
    });

    await prisma.attendanceRecord.deleteMany({
      where: { employeeId: req.params.id }
    });
    
    await prisma.notification.deleteMany({
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
    
    await bumpDescriptorsVersion(employee.companyId, req);

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
