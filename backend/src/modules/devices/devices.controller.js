const crypto = require('crypto');
const prisma = require('../../utils/prisma');
const {
  findActivePairingRequestForDevice,
  expirePendingPairingRequests,
  isPairingCodeInUse,
  createPairingRequest,
  lookupPairingRequest,
  getPairingRequestById,
  markPairingRequestExpired,
  approvePairingRequest,
  rejectPairingRequest
} = require('../../utils/authHelpers');

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

// Generar un código de emparejamiento criptográficamente seguro (ej: K9X2-7M4P)
// Base32 sin ambigüedades (excluye 0, O, 1, I) -> 32^8 = 1.09 billones de combinaciones
const generatePairingCode = () => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let p1 = '';
  let p2 = '';
  for (let i = 0; i < 4; i++) {
    p1 += chars.charAt(crypto.randomInt(0, chars.length));
    p2 += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return `${p1}-${p2}`;
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
    const existingRequest = await findActivePairingRequestForDevice({ deviceId, ipAddress, userAgent });

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
    const previousPending = await expirePendingPairingRequests({ deviceId, ipAddress, userAgent });

    if (previousPending.length > 0 && io) {
      previousPending.forEach(p => {
        if (p.companyId) {
          io.to(`company_${p.companyId}`).emit('device_auth_request_resolved', {
            id: p.id,
            status: 'EXPIRED'
          });
        }
      });
    }

    // 2. Generar código único que no esté en PENDING activo
    let pairingCode;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      pairingCode = generatePairingCode();
      const inUse = await isPairingCodeInUse(pairingCode);
      if (!inUse) isUnique = true;
      attempts++;
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos (expiración corta para mitigar ataques de fuerza bruta)

    const authRequest = await createPairingRequest({
      deviceId: deviceId || null,
      pairingCode,
      ipAddress,
      userAgent,
      expiresAt
    });

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
  return res.status(404).json({ error: 'Endpoint descontinuado. Utilice el emparejamiento físico por código de 8 caracteres.' });
};

// Tracker de intentos fallidos de aprobación por admin/IP para mitigar fuerza bruta
const failedApprovalAttempts = new Map();
const MAX_FAILED_APPROVALS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

function checkApprovalRateLimit(identifier) {
  const record = failedApprovalAttempts.get(identifier);
  if (!record) return { isLocked: false };
  if (Date.now() > record.resetAt) {
    failedApprovalAttempts.delete(identifier);
    return { isLocked: false };
  }
  if (record.attempts >= MAX_FAILED_APPROVALS) {
    const minutesLeft = Math.ceil((record.resetAt - Date.now()) / 60000);
    return { isLocked: true, minutesLeft };
  }
  return { isLocked: false };
}

function recordFailedApproval(identifier) {
  const now = Date.now();
  const record = failedApprovalAttempts.get(identifier) || { attempts: 0, resetAt: now + LOCKOUT_WINDOW_MS };
  record.attempts++;
  failedApprovalAttempts.set(identifier, record);
}

function clearFailedApproval(identifier) {
  failedApprovalAttempts.delete(identifier);
}

/**
 * POST /api/v1/devices/auth-requests/lookup
 * Paso 1 del emparejamiento: El administrador ingresa el código generado por el kiosco,
 * y visualiza la IP y User-Agent del kiosco antes de autorizar.
 */
const lookupAuthRequestByCode = async (req, res) => {
  const adminId = req.user?.id || getClientIp(req);

  try {
    const { pairingCode } = req.body || {};
    if (!pairingCode || typeof pairingCode !== 'string') {
      return res.status(400).json({ error: 'El código de emparejamiento es obligatorio.' });
    }

    const rateLimitCheck = checkApprovalRateLimit(adminId);
    if (rateLimitCheck.isLocked) {
      return res.status(429).json({
        error: `Demasiados intentos fallidos. Acceso bloqueado temporalmente por ${rateLimitCheck.minutesLeft} minutos.`
      });
    }

    const cleanCode = pairingCode.toUpperCase().trim();
    const authRequest = await lookupPairingRequest(cleanCode);

    if (!authRequest) {
      recordFailedApproval(adminId);
      return res.status(404).json({ error: 'Código de emparejamiento inválido, expirado o ya procesado.' });
    }

    // Validación Cross-Tenant en el Paso 1: Si ya estaba asignada a otra empresa
    if (authRequest.companyId && req.user?.companyId && authRequest.companyId !== req.user.companyId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(404).json({ error: 'Código de emparejamiento inválido, expirado o ya procesado.' });
    }

    // Retorna datos de auditoría para verificación visual previa del admin
    return res.status(200).json({
      requestId: authRequest.id,
      pairingCode: authRequest.pairingCode,
      ipAddress: authRequest.ipAddress,
      userAgent: authRequest.userAgent,
      expiresAt: authRequest.expiresAt,
      createdAt: authRequest.createdAt
    });
  } catch (error) {
    console.error('Error en lookupAuthRequestByCode:', error);
    return res.status(500).json({ error: 'Error al consultar código de emparejamiento' });
  }
};

/**
 * POST /api/v1/devices/auth-requests/:id/approve
 * Paso 2 del emparejamiento: Aprueba la solicitud y genera el Device definitivo con su tokenHash.
 */
const approveDeviceAuth = async (req, res) => {
  const adminId = req.user?.id || getClientIp(req);

  try {
    const { id } = req.params;
    const { name, pairingCode, companyId: requestedCompanyId } = req.body || {};

    // 1. Verificación de límite de intentos (anti-fuerza bruta)
    const rateLimitCheck = checkApprovalRateLimit(adminId);
    if (rateLimitCheck.isLocked) {
      return res.status(429).json({
        error: `Demasiados intentos fallidos de aprobación. Acceso bloqueado temporalmente por ${rateLimitCheck.minutesLeft} minutos.`
      });
    }

    const authRequest = await getPairingRequestById(id);

    if (!authRequest) {
      recordFailedApproval(adminId);
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    // Determinar la empresa a la que pertenecerá el dispositivo
    let targetCompanyId = req.user?.companyId;
    if (req.user?.role === 'SUPER_ADMIN') {
      targetCompanyId = requestedCompanyId || authRequest.companyId || 'default-company-pain';
    }

    if (!targetCompanyId) {
      return res.status(400).json({ error: 'Se requiere una empresa asignada para el dispositivo.' });
    }

    // Validación Cross-Tenant Estricta: Un admin no puede ver ni aprobar solicitudes de otra empresa (404 indistinguible)
    if (authRequest.companyId && authRequest.companyId !== targetCompanyId && req.user?.role !== 'SUPER_ADMIN') {
      recordFailedApproval(adminId);
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    if (authRequest.status !== 'PENDING') {
      recordFailedApproval(adminId);
      return res.status(400).json({ error: `La solicitud ya fue ${authRequest.status.toLowerCase()}` });
    }

    if (new Date() > authRequest.expiresAt) {
      recordFailedApproval(adminId);
      await markPairingRequestExpired(id);
      return res.status(400).json({ error: 'La solicitud ha expirado' });
    }

    // Validación de conocimiento del código físico: Obligatorio para vincular
    if (!pairingCode || pairingCode.toUpperCase().trim() !== authRequest.pairingCode) {
      recordFailedApproval(adminId);
      return res.status(400).json({ error: 'Se requiere el código de emparejamiento físico para confirmar la vinculación.' });
    }

    // Validar límite del plan (maxDevices)
    const company = await prisma.company.findUnique({
      where: { id: targetCompanyId },
      select: { maxDevices: true, isActive: true }
    });

    const currentDevicesCount = await prisma.device.count({
      where: { companyId: targetCompanyId, isActive: true }
    });

    const limit = company?.maxDevices ?? 3;
    if (currentDevicesCount >= limit) {
      return res.status(403).json({
        error: 'PLAN_LIMIT_EXCEEDED',
        message: `Límite del plan alcanzado (${limit} dispositivos permitidos). Actualice su suscripción.`
      });
    }

    // Generar token criptográfico único para el Kiosko y su hash SHA-256
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const deviceName = name?.trim() || `Kiosko ${authRequest.pairingCode}`;

    // Transacción: Aprobar solicitud y crear Device vinculado a la empresa
    await approvePairingRequest({ id, companyId: targetCompanyId });
    const device = await prisma.device.create({
      data: {
        companyId: targetCompanyId,
        name: deviceName,
        type: 'KIOSK',
        status: 'ONLINE',
        token: null, // Anulado: Solo tokenHash SHA-256
        tokenHash, // Hash seguro para validación
        ipAddress: authRequest.ipAddress,
        description: authRequest.userAgent,
        lastSeenAt: new Date()
      }
    });

    // Limpiar intentos fallidos al tener éxito
    clearFailedApproval(adminId);

    // Emitir eventos Socket.io
    const io = getIo(req);
    if (io) {
      // Notificar a la sala privada del Kiosko
      io.to(`device_auth_${authRequest.id}`).emit('device_auth_approved', {
        token,
        deviceId: device.id,
        name: device.name,
        companyId: device.companyId
      });

      // Notificar EXCLUSIVAMENTE a la sala de la empresa en el Dashboard
      io.to(`company_${device.companyId}`).emit('device_auth_request_resolved', {
        id: authRequest.id,
        status: 'APPROVED',
        companyId: device.companyId
      });
    }

    return res.json({
      success: true,
      message: 'Dispositivo autorizado exitosamente',
      device: {
        id: device.id,
        name: device.name,
        companyId: device.companyId,
        type: device.type,
        status: device.status,
        createdAt: device.createdAt
      },
      kioskInfo: {
        ipAddress: authRequest.ipAddress,
        userAgent: authRequest.userAgent,
        pairingCode: authRequest.pairingCode
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

    const updated = await rejectPairingRequest(id);
    if (!updated) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    // Emitir eventos Socket.io
    const io = getIo(req);
    if (io) {
      // Notificar a la sala del Kiosko
      io.to(`device_auth_${authRequest.id}`).emit('device_auth_rejected', {
        message: 'Solicitud rechazada por el administrador'
      });

      // Notificar al Dashboard del inquilino
      if (authRequest.companyId) {
        io.to(`company_${authRequest.companyId}`).emit('device_auth_request_resolved', {
          id: authRequest.id,
          status: 'REJECTED'
        });
      }
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

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const enriched = devices.map(d => {
      const isInactive30Days = d.lastSeenAt ? new Date(d.lastSeenAt) < thirtyDaysAgo : (new Date(d.createdAt) < thirtyDaysAgo);
      return {
        ...d,
        isInactive30Days,
        inactivityAlert: isInactive30Days && d.isActive ? 'Dispositivo sin actividad por más de 30 días.' : null
      };
    });

    return res.json(enriched);
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
      const companyRoom = `company_${updated.companyId || req.user?.companyId}`;
      io.to(companyRoom).emit('device_updated', updated);
      io.to(`device_${id}`).emit('device_status_changed', {
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
      const companyRoom = `company_${updated.companyId || req.user?.companyId}`;
      io.to(companyRoom).emit('device_updated', updated);
      io.to(`device_${id}`).emit('device_status_changed', {
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

    const companyId = req.user?.companyId;
    if (companyId) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { maxDevices: true }
      });
      const currentDevicesCount = await prisma.device.count({
        where: { companyId, isActive: true }
      });
      const limit = company?.maxDevices ?? 3;
      if (currentDevicesCount >= limit) {
        return res.status(403).json({
          error: 'PLAN_LIMIT_EXCEEDED',
          message: `Límite del plan alcanzado (${limit} dispositivos permitidos). Actualice su suscripción.`
        });
      }
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
      const companyRoom = `company_${companyId || 'default-company-pain'}`;
      io.to(companyRoom).emit('device_created', device);
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
      const companyRoom = `company_${device.companyId || req.user?.companyId || 'default-company-pain'}`;
      io.to(companyRoom).emit('device_deleted', { id });
      io.to(`device_${id}`).emit('device_status_changed', {
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
  lookupAuthRequestByCode,
  approveDeviceAuth,
  rejectDeviceAuth,
  verifyDeviceToken,
  getDevices,
  toggleBlockDevice,
  toggleStatusDevice,
  createManualDevice,
  deleteDevice
};
