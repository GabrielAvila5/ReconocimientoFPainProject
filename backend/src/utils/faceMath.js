const prisma = require('./prisma');
const crypto = require('crypto');
const { runWithTenantContext } = require('../middlewares/tenantContext');
const { ENCRYPTION_KEY } = require('../config/secrets');

// Caché en memoria particionado por empresa: Map<companyId, Array<EmployeeFace>>
global.cachedUsersByCompany = new Map();

/**
 * Descifra el descriptor biométrico si está cifrado con AES-256-GCM.
 */
function decryptFaceDescriptor(encryptedText) {
  if (!encryptedText) return null;
  if (!encryptedText.startsWith('enc_gcm:')) {
    try {
      return JSON.parse(encryptedText);
    } catch {
      return null;
    }
  }

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 4) return null;

    const iv = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const encrypted = parts[3];

    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (err) {
    console.error('Error al descifrar descriptor facial:', err.message);
    return null;
  }
}

/**
 * Función matemática para comparar dos vectores de 128D usando Distancia Euclidiana.
 */
function euclideanDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Sincroniza el caché de rostros en memoria.
 * - Si se pasa un companyId, sincroniza solo esa empresa dentro de su contexto de inquilino.
 * - Si no se pasa companyId (al arrancar la app), itera todas las empresas activas y las carga de forma aislada.
 */
async function syncFaceCache(companyId = null) {
  try {
    if (companyId) {
      await syncCompanyCache(companyId);
    } else {
      // Arranque del sistema: Cargar empresas activas vía basePrisma y sincronizar por inquilino
      const companies = await prisma.$base.company.findMany({
        where: { isActive: true },
        select: { id: true, name: true }
      });

      for (const comp of companies) {
        await syncCompanyCache(comp.id);
      }
    }
  } catch (error) {
    console.error('[FaceCache] Error en sincronización de rostros:', error);
  }
}

async function syncCompanyCache(companyId) {
  await runWithTenantContext({ companyId }, async () => {
    const employees = await prisma.employee.findMany({
      where: { 
        isActive: true,
        faceDescriptor: { not: null }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        faceDescriptor: true
      }
    });

    const parsedList = [];
    for (const emp of employees) {
      const descriptorArray = decryptFaceDescriptor(emp.faceDescriptor);
      if (Array.isArray(descriptorArray) && descriptorArray.length === 128) {
        parsedList.push({
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`.trim(),
          descriptor: descriptorArray
        });
      }
    }

    global.cachedUsersByCompany.set(companyId, parsedList);
    // Compatibilidad para pruebas legacy mono-tenant
    if (companyId === 'default-company-pain') {
      global.cachedUsers = parsedList;
    }

    console.log(`[FaceCache] Empresa ${companyId}: ${parsedList.length} rostros sincronizados en memoria.`);
  });
}

function getFaceCache(companyId) {
  return global.cachedUsersByCompany.get(companyId) || [];
}

module.exports = {
  euclideanDistance,
  syncFaceCache,
  getFaceCache,
  decryptFaceDescriptor
};
