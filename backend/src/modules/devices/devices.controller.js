const crypto = require('crypto');
const prisma = require('../../utils/prisma');

// Helper para obtener la instancia de Socket.io
const getIo = (req) => {
  return req.app.get('io');
};

// Helper para obtener la dirección IP real del cliente
const getClientIp = (req) => {
  let ip = req.headers['x-forwarded-for']?.split(',')[0].trim() 
    || req.ip 
    || req.connection?.remoteAddress 
    || req.socket?.remoteAddress 
    || '127.0.0.1';

  // Quitar mapeo de IPv4 en IPv6 (ej: ::ffff:192.168.1.100 -> 192.168.1.100)
  if (ip.startsWith('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }

  // Normalizar IPv6 localhost (::1 o 1) a 127.0.0.1
  if (ip === '::1' || ip === '1') {
    ip = '127.0.0.1';
  }

  return ip;
};

// Generar un código de emparejamiento legible (ej: KIO-7492)
const generatePairingCode = () => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Evitar 0/O, 1/I para evitar confusiones
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `KIO-${code}`;
};

/**
 * POST /api/v1/devices/auth-request
 * El Kiosko solicita un código de autorización.
 */
const requestDeviceAuth = async (req, res) => {
  try {
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Kiosk Device';
    const { deviceId, forceNew } = req.body || {};

    const now = new Date();

    // 1. Detección de solicitud previa existente y activa para este dispositivo
    const existingCondition = deviceId 
      ? { deviceId, status: 'PENDING', expiresAt: { gt: now } }
      : { ipAddress, userAgent, status: 'PENDING', expiresAt: { gt: now } };

    const existingRequest = await prisma.deviceAuthRequest.findFirst({
      where: existingCondition,
      orderBy: { createdAt: 'desc' }
    });

    // Si ya existe una solicitud vigente y no se forzó una nueva, reutilizarla
    if (existingRequest && !forceNew) {
      return res.status(200).json({
        requestId: existingRequest.id,
        pairingCode: existingRequest.pairingCode,
        expiresAt: existingRequest.expiresAt
      });
    }

    // Si se pidió nueva o hay anteriores de este mismo cliente, marcarlas como EXPIRED
    const io = getIo(req);
    const staleCondition = deviceId 
      ? { deviceId, status: 'PENDING' } 
      : { ipAddress, userAgent, status: 'PENDING' };

    const previousPending = await prisma.deviceAuthRequest.findMany({
      where: staleCondition,
      select: { id: true }
    });

    if (previousPending.length > 0) {
      await prisma.deviceAuthRequest.updateMany({
        where: staleCondition,
        data: { status: 'EXPIRED' }
      });

      if (io) {
        previousPending.forEach(p => {
          io.to('dashboard').emit('device_auth_request_resolved', {
            id: p.id,
            status: 'EXPIRED'
          });
        });
      }
    }

    // 2. Generar código único que no esté en PENDING activo
    let pairingCode;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      pairingCode = generatePairingCode();
      const existing = await prisma.deviceAuthRequest.findFirst({
        where: {
          pairingCode,
          status: 'PENDING',
          expiresAt: { gt: now }
        }
      });
      if (!existing) isUnique = true;
      attempts++;
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    const authRequest = await prisma.deviceAuthRequest.create({
      data: {
        deviceId: deviceId || null,
        pairingCode,
        ipAddress,
        userAgent,
        status: 'PENDING',
        expiresAt
      }
    });

    // Notificar al Dashboard en tiempo real
    if (io) {
      io.to('dashboard').emit('new_device_auth_request', {
        id: authRequest.id,
        pairingCode: authRequest.pairingCode,
        ipAddress: authRequest.ipAddress,
        userAgent: authRequest.userAgent,
        expiresAt: authRequest.expiresAt,
        createdAt: authRequest.createdAt
      });
    }

    return res.status(201).json({
      requestId: authRequest.id,
      pairingCode: authRequest.pairingCode,
      expiresAt: authRequest.expiresAt
    });
  } catch (error) {
    console.error('Error al solicitar autorización de dispositivo:', error);
    return res.status(500).json({ error: 'Error interno al procesar la solicitud de emparejamiento' });
  }
};

/**
 * GET /api/v1/devices/auth-requests/pending
 * Solo Super Administrador: Lista de solicitudes pendientes no expiradas.
 */
const getPendingAuthRequests = async (req, res) => {
  try {
    const now = new Date();

    // Limpieza oportunista de expiradas
    await prisma.deviceAuthRequest.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now }
      },
      data: { status: 'EXPIRED' }
    });

    const pendingRequests = await prisma.deviceAuthRequest.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { gt: now }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(pendingRequests);
  } catch (error) {
    console.error('Error al obtener solicitudes pendientes:', error);
    return res.status(500).json({ error: 'Error al consultar solicitudes pendientes' });
  }
};

/**
 * POST /api/v1/devices/auth-requests/:id/approve
 * Solo Super Administrador: Aprueba la solicitud y genera el Device definitivo con su token.
 */
const approveDeviceAuth = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const authRequest = await prisma.deviceAuthRequest.findUnique({
      where: { id }
    });

    if (!authRequest) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    if (authRequest.status !== 'PENDING') {
      return res.status(400).json({ error: `La solicitud ya fue ${authRequest.status.toLowerCase()}` });
    }

    if (new Date() > authRequest.expiresAt) {
      await prisma.deviceAuthRequest.update({
        where: { id },
        data: { status: 'EXPIRED' }
      });
      return res.status(400).json({ error: 'La solicitud ha expirado' });
    }

    // Generar token criptográfico único para el Kiosko
    const token = crypto.randomBytes(32).toString('hex');
    const deviceName = name?.trim() || `Kiosko ${authRequest.pairingCode}`;

    // Transacción: Aprobar solicitud y crear Device
    const [_, device] = await prisma.$transaction([
      prisma.deviceAuthRequest.update({
        where: { id },
        data: { status: 'APPROVED' }
      }),
      prisma.device.create({
        data: {
          name: deviceName,
          type: 'KIOSK',
          status: 'ONLINE',
          token,
          ipAddress: authRequest.ipAddress,
          description: authRequest.userAgent,
          lastSeenAt: new Date()
        }
      })
    ]);

    // Emitir eventos Socket.io
    const io = getIo(req);
    if (io) {
      // Notificar a la sala privada del Kiosko
      io.to(`device_auth_${authRequest.id}`).emit('device_auth_approved', {
        token,
        deviceId: device.id,
        name: device.name
      });

      // Notificar al Dashboard que la solicitud fue resuelta
      io.to('dashboard').emit('device_auth_request_resolved', {
        id: authRequest.id,
        status: 'APPROVED'
      });
    }

    return res.json({
      success: true,
      message: 'Dispositivo autorizado exitosamente',
      device: {
        id: device.id,
        name: device.name,
        type: device.type,
        status: device.status,
        ipAddress: device.ipAddress,
        createdAt: device.createdAt
      }
    });
  } catch (error) {
    console.error('Error al aprobar solicitud de dispositivo:', error);
    return res.status(500).json({ error: 'Error al autorizar dispositivo' });
  }
};

/**
 * POST /api/v1/devices/auth-requests/:id/reject
 * Solo Super Administrador: Rechaza la solicitud.
 */
const rejectDeviceAuth = async (req, res) => {
  try {
    const { id } = req.params;

    const authRequest = await prisma.deviceAuthRequest.findUnique({
      where: { id }
    });

    if (!authRequest) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    await prisma.deviceAuthRequest.update({
      where: { id },
      data: { status: 'REJECTED' }
    });

    // Emitir eventos Socket.io
    const io = getIo(req);
    if (io) {
      // Notificar a la sala del Kiosko
      io.to(`device_auth_${authRequest.id}`).emit('device_auth_rejected', {
        message: 'Solicitud rechazada por el administrador'
      });

      // Notificar al Dashboard
      io.to('dashboard').emit('device_auth_request_resolved', {
        id: authRequest.id,
        status: 'REJECTED'
      });
    }

    return res.json({ success: true, message: 'Solicitud rechazada' });
  } catch (error) {
    console.error('Error al rechazar solicitud:', error);
    return res.status(500).json({ error: 'Error al rechazar solicitud' });
  }
};

/**
 * POST /api/v1/devices/verify
 * Público (usado por KioskGuard): Verifica que el token exista y esté activo/no bloqueado.
 */
const verifyDeviceToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(401).json({ valid: false, error: 'Token no proporcionado' });
    }

    const device = await prisma.device.findUnique({
      where: { token }
    });

    if (!device) {
      return res.status(401).json({
        valid: false,
        error: 'Dispositivo no autorizado o revocado'
      });
    }

    // 1. Verificar si fue dado de baja
    if (!device.isActive) {
      return res.status(403).json({
        valid: false,
        deactivated: true,
        reason: device.deactivatedReason,
        error: device.deactivatedReason 
          ? `Dispositivo dado de baja: ${device.deactivatedReason}`
          : 'Este dispositivo ha sido dado de baja por el administrador.'
      });
    }

    // 2. Verificar si está bloqueado temporalmente
    if (device.isBlocked) {
      return res.status(403).json({
        valid: false,
        blocked: true,
        reason: device.blockedReason,
        error: device.blockedReason 
          ? `Dispositivo bloqueado temporalmente: ${device.blockedReason}`
          : 'Este dispositivo se encuentra bloqueado temporalmente por el administrador.'
      });
    }

    const ipAddress = getClientIp(req);

    // Actualizar telemetría (lastSeenAt, IP y status ONLINE)
    await prisma.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        status: 'ONLINE',
        ipAddress
      }
    });

    return res.json({
      valid: true,
      device: {
        id: device.id,
        name: device.name,
        type: device.type,
        isBlocked: false,
        isActive: true
      }
    });
  } catch (error) {
    console.error('Error al verificar token de dispositivo:', error);
    return res.status(500).json({ valid: false, error: 'Error al verificar dispositivo' });
  }
};

/**
 * GET /api/v1/devices
 * Solo Super Administrador: Lista de todos los dispositivos registrados con altas, bajas y bloqueos.
 */
const getDevices = async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        ipAddress: true,
        description: true,
        lastSeenAt: true,
        isBlocked: true,
        blockedAt: true,
        blockedReason: true,
        isActive: true,
        deactivatedAt: true,
        deactivatedReason: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return res.json(devices);
  } catch (error) {
    console.error('Error al obtener dispositivos:', error);
    return res.status(500).json({ error: 'Error al obtener dispositivos' });
  }
};

/**
 * PATCH /api/v1/devices/:id/block
 * Solo Super Administrador: Bloquear o desbloquear temporalmente un dispositivo.
 */
const toggleBlockDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const { isBlocked, reason } = req.body || {};

    const existing = await prisma.device.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Dispositivo no encontrado' });
    }

    const willBlock = typeof isBlocked === 'boolean' ? isBlocked : !existing.isBlocked;

    const updated = await prisma.device.update({
      where: { id },
      data: {
        isBlocked: willBlock,
        blockedAt: willBlock ? new Date() : null,
        blockedReason: willBlock ? (reason?.trim() || 'Bloqueado por el administrador') : null
      }
    });

    const io = getIo(req);
    if (io) {
      io.to('dashboard').emit('device_updated', updated);
      io.to(`device_${id}`).emit('device_status_changed', {
        deviceId: id,
        isBlocked: updated.isBlocked,
        blockedAt: updated.blockedAt,
        isActive: updated.isActive,
        reason: updated.blockedReason
      });
      io.emit('device_status_changed', {
        deviceId: id,
        isBlocked: updated.isBlocked,
        blockedAt: updated.blockedAt,
        isActive: updated.isActive,
        reason: updated.blockedReason
      });
    }

    return res.json({
      success: true,
      message: willBlock ? 'Dispositivo bloqueado temporalmente' : 'Dispositivo desbloqueado exitosamente',
      device: updated
    });
  } catch (error) {
    console.error('Error al cambiar bloqueo de dispositivo:', error);
    return res.status(500).json({ error: 'Error al cambiar bloqueo del dispositivo' });
  }
};

/**
 * PATCH /api/v1/devices/:id/status-toggle
 * Solo Super Administrador: Dar de baja o reactivar un dispositivo.
 */
const toggleStatusDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, reason } = req.body || {};

    const existing = await prisma.device.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Dispositivo no encontrado' });
    }

    const willBeActive = typeof isActive === 'boolean' ? isActive : !existing.isActive;

    const updated = await prisma.device.update({
      where: { id },
      data: {
        isActive: willBeActive,
        deactivatedAt: willBeActive ? null : new Date(),
        deactivatedReason: willBeActive ? null : (reason?.trim() || 'Dado de baja por el administrador'),
        // Si se reactiva, desbloquearlo por defecto
        ...(willBeActive ? { isBlocked: false, blockedAt: null, blockedReason: null } : {})
      }
    });

    const io = getIo(req);
    if (io) {
      io.to('dashboard').emit('device_updated', updated);
      io.to(`device_${id}`).emit('device_status_changed', {
        deviceId: id,
        isBlocked: updated.isBlocked,
        isActive: updated.isActive,
        deactivatedAt: updated.deactivatedAt,
        reason: updated.deactivatedReason
      });
      io.emit('device_status_changed', {
        deviceId: id,
        isBlocked: updated.isBlocked,
        isActive: updated.isActive,
        deactivatedAt: updated.deactivatedAt,
        reason: updated.deactivatedReason
      });
    }

    return res.json({
      success: true,
      message: willBeActive ? 'Dispositivo reactivado exitosamente' : 'Dispositivo dado de baja exitosamente',
      device: updated
    });
  } catch (error) {
    console.error('Error al cambiar estado de alta/baja:', error);
    return res.status(500).json({ error: 'Error al actualizar el estado del dispositivo' });
  }
};

/**
 * POST /api/v1/devices
 * Solo Super Administrador: Registro manual de Cámara o Torniquete.
 */
const createManualDevice = async (req, res) => {
  try {
    const { name, type, ipAddress, description } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Nombre y tipo son obligatorios' });
    }

    if (type === 'KIOSK') {
      return res.status(400).json({ error: 'Los kioskos deben ser autorizados mediante el flujo de emparejamiento' });
    }

    const device = await prisma.device.create({
      data: {
        name,
        type,
        ipAddress: ipAddress || null,
        description: description || null,
        status: 'ONLINE',
        lastSeenAt: new Date(),
        isActive: true,
        isBlocked: false
      }
    });

    const io = getIo(req);
    if (io) {
      io.to('dashboard').emit('device_created', device);
    }

    return res.status(201).json(device);
  } catch (error) {
    console.error('Error al crear dispositivo manual:', error);
    return res.status(500).json({ error: 'Error al registrar dispositivo' });
  }
};

/**
 * DELETE /api/v1/devices/:id
 * Solo Super Administrador: Eliminar definitivamente un dispositivo.
 */
const deleteDevice = async (req, res) => {
  try {
    const { id } = req.params;

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) {
      return res.status(404).json({ error: 'Dispositivo no encontrado' });
    }

    await prisma.device.delete({ where: { id } });

    const io = getIo(req);
    if (io) {
      io.to('dashboard').emit('device_deleted', { id });
      io.to(`device_${id}`).emit('device_status_changed', {
        deviceId: id,
        deleted: true,
        error: 'Dispositivo revocado y eliminado del sistema'
      });
      io.emit('device_status_changed', {
        deviceId: id,
        deleted: true,
        error: 'Dispositivo revocado y eliminado del sistema'
      });
    }

    return res.json({ success: true, message: 'Dispositivo eliminado y acceso revocado definitivamente' });
  } catch (error) {
    console.error('Error al eliminar dispositivo:', error);
    return res.status(500).json({ error: 'Error al eliminar dispositivo' });
  }
};

module.exports = {
  requestDeviceAuth,
  getPendingAuthRequests,
  approveDeviceAuth,
  rejectDeviceAuth,
  verifyDeviceToken,
  getDevices,
  toggleBlockDevice,
  toggleStatusDevice,
  createManualDevice,
  deleteDevice
};
