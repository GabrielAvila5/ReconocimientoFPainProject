/**
 * HELPERS EXPLÍCITOS Y ESTRECHOS PARA OPERACIONES SIN CONTEXTO PREVIO (REGLA A3)
 * 
 * Reemplazan cualquier bypass permisivo o excepción genérica en la extensión de Prisma.
 * Cada helper tiene un único propósito restringido y validado.
 */

const crypto = require('crypto');
const prismaAdmin = require('./prismaAdmin');

/**
 * Busca un administrador por correo exclusivamente para el proceso de login.
 * Solo proyecta los campos indispensables para autenticación y validación de estado de la empresa.
 * 
 * @param {string} email Correo del administrador
 * @returns {Promise<object|null>} Datos de autenticación del usuario
 */
async function findAdminByEmailForLogin(email) {
  if (!email || typeof email !== 'string') {
    throw new Error('findAdminByEmailForLogin: Se requiere un email válido.');
  }

  return prismaAdmin.adminUser.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: {
      id: true,
      email: true,
      password: true,
      role: true,
      name: true,
      companyId: true,
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true
        }
      }
    }
  });
}

/**
 * Busca una solicitud de emparejamiento activa para un dispositivo o cliente IP.
 */
async function findActivePairingRequestForDevice({ deviceId, ipAddress, userAgent }) {
  const now = new Date();
  const where = deviceId
    ? { deviceId, status: 'PENDING', expiresAt: { gt: now } }
    : { ipAddress, userAgent, status: 'PENDING', expiresAt: { gt: now } };

  return prismaAdmin.deviceAuthRequest.findFirst({
    where,
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Invalida solicitudes de emparejamiento pendientes anteriores del mismo dispositivo/IP.
 */
async function expirePendingPairingRequests({ deviceId, ipAddress, userAgent }) {
  const where = deviceId
    ? { deviceId, status: 'PENDING' }
    : { ipAddress, userAgent, status: 'PENDING' };

  const previousPending = await prismaAdmin.deviceAuthRequest.findMany({
    where,
    select: { id: true }
  });

  if (previousPending.length > 0) {
    await prismaAdmin.deviceAuthRequest.updateMany({
      where,
      data: { status: 'EXPIRED' }
    });
  }

  return previousPending;
}

/**
 * Verifica si un código de emparejamiento está en uso activo.
 */
async function isPairingCodeInUse(pairingCode) {
  const now = new Date();
  const count = await prismaAdmin.deviceAuthRequest.count({
    where: {
      pairingCode,
      status: 'PENDING',
      expiresAt: { gt: now }
    }
  });
  return count > 0;
}

/**
 * Crea una solicitud de emparejamiento para un kiosco físico nuevo (previo a tener empresa).
 * Acotado exclusivamente al modelo DeviceAuthRequest y campos de emparejamiento.
 * 
 * @param {object} params Parámetros de la solicitud
 * @returns {Promise<object>} Registro de DeviceAuthRequest creado
 */
async function createPairingRequest({ deviceId, pairingCode, ipAddress, userAgent, expiresAt }) {
  if (!pairingCode || !expiresAt) {
    throw new Error('createPairingRequest: pairingCode y expiresAt son obligatorios.');
  }

  return prismaAdmin.deviceAuthRequest.create({
    data: {
      deviceId: deviceId || null,
      pairingCode,
      ipAddress: ipAddress || 'unknown',
      userAgent: userAgent || 'unknown',
      status: 'PENDING',
      expiresAt,
      companyId: null // Kiosco no vinculado aún a ninguna empresa
    }
  });
}

/**
 * Busca una solicitud de emparejamiento pendiente por su código para verificación en Paso 1.
 * 
 * @param {string} pairingCode Código de 8 caracteres
 * @returns {Promise<object|null>} Solicitud de emparejamiento
 */
async function lookupPairingRequest(pairingCode) {
  if (!pairingCode) return null;
  const now = new Date();

  return prismaAdmin.deviceAuthRequest.findFirst({
    where: {
      pairingCode,
      status: 'PENDING',
      expiresAt: { gt: now }
    },
    select: {
      id: true,
      pairingCode: true,
      ipAddress: true,
      userAgent: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      companyId: true
    }
  });
}

/**
 * Obtiene una solicitud de emparejamiento por su ID para el Paso 2 de aprobación.
 * 
 * @param {string} id UUID de la solicitud
 * @returns {Promise<object|null>} Solicitud de emparejamiento
 */
async function getPairingRequestById(id) {
  if (!id) return null;

  return prismaAdmin.deviceAuthRequest.findUnique({
    where: { id },
    select: {
      id: true,
      pairingCode: true,
      ipAddress: true,
      userAgent: true,
      status: true,
      expiresAt: true,
      companyId: true
    }
  });
}

/**
 * Marca una solicitud de emparejamiento como expirada.
 * 
 * @param {string} id UUID de la solicitud
 */
async function markPairingRequestExpired(id) {
  if (!id) return;

  return prismaAdmin.deviceAuthRequest.update({
    where: { id },
    data: { status: 'EXPIRED' }
  });
}

/**
 * Aprueba una solicitud de emparejamiento y la vincula a una empresa.
 * 
 * @param {object} params id de la solicitud y companyId destino
 */
async function approvePairingRequest({ id, companyId }) {
  if (!id || !companyId) {
    throw new Error('approvePairingRequest: id y companyId son obligatorios.');
  }

  return prismaAdmin.deviceAuthRequest.update({
    where: { id },
    data: {
      status: 'APPROVED',
      companyId
    }
  });
}

/**
 * Rechaza una solicitud de emparejamiento por su ID.
 * 
 * @param {string} id UUID de la solicitud
 */
async function rejectPairingRequest(id) {
  if (!id) return null;
  const existing = await prismaAdmin.deviceAuthRequest.findUnique({
    where: { id }
  });
  if (!existing) return null;

  return prismaAdmin.deviceAuthRequest.update({
    where: { id },
    data: { status: 'REJECTED' }
  });
}

/**
 * Obtiene metadatos de versión y estado de una empresa para el endpoint /descriptors.
 * 
 * @param {string} companyId Identificador de la empresa
 * @returns {Promise<object|null>} Metadatos de la empresa
 */
async function getCompanyForDescriptors(companyId) {
  if (!companyId) return null;

  return prismaAdmin.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      descriptorsVersion: true,
      isActive: true
    }
  });
}

/**
 * Obtiene un dispositivo por su token criptográfico para autenticación de kioscos.
 * Calcula el hash SHA-256 del token plano recibido y busca exclusivamente por tokenHash.
 * 
 * @param {string} rawToken Token recibido en cabecera x-device-token
 * @returns {Promise<object|null>} Dispositivo
 */
async function getDeviceByToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return null;

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  return prismaAdmin.device.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      companyId: true,
      name: true,
      type: true,
      isActive: true,
      isBlocked: true,
      deactivatedReason: true,
      blockedReason: true
    }
  });
}

/**
 * Actualiza atómicamente la marca de tiempo de última actividad (lastSeenAt) de un dispositivo.
 *
 * @param {string} deviceId ID del dispositivo
 * @returns {Promise<void>}
 */
async function updateDeviceLastSeen(deviceId) {
  if (!deviceId) return;
  try {
    await prismaAdmin.device.update({
      where: { id: deviceId },
      data: { lastSeenAt: new Date() }
    });
  } catch (err) {
    // Silencioso para no degradar el flujo de la petición
  }
}

/**
 * Limpia solicitudes de emparejamiento de kioscos expiradas.
 * 
 * @returns {Promise<{count: number}>}
 */
async function cleanExpiredPairingRequests() {
  return prismaAdmin.deviceAuthRequest.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() }
    },
    data: {
      status: 'EXPIRED'
    }
  });
}

module.exports = {
  findAdminByEmailForLogin,
  findActivePairingRequestForDevice,
  expirePendingPairingRequests,
  isPairingCodeInUse,
  createPairingRequest,
  lookupPairingRequest,
  getPairingRequestById,
  markPairingRequestExpired,
  approvePairingRequest,
  rejectPairingRequest,
  getCompanyForDescriptors,
  getDeviceByToken,
  updateDeviceLastSeen,
  cleanExpiredPairingRequests
};
