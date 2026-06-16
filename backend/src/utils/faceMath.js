const prisma = require('./prisma');

// Caché en memoria para comparaciones rápidas de vectores faciales
global.cachedUsers = [];

/**
 * Función matemática para comparar dos vectores de 128D usando Distancia Euclidiana.
 * @param {number[]} a - Descriptor A (capturado)
 * @param {number[]} b - Descriptor B (en base de datos)
 * @returns {number} Distancia (menor es más parecido)
 */
function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Sincroniza el caché extrayendo todos los empleados activos
 * y parseando su faceDescriptor de String a Array en RAM.
 */
async function syncFaceCache() {
  try {
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        faceDescriptor: true
      }
    });

    global.cachedUsers = employees.map(emp => {
      let descriptorArray = [];
      try {
        if (emp.faceDescriptor) {
          descriptorArray = JSON.parse(emp.faceDescriptor);
        }
      } catch (e) {
        console.error(`Error parseando descriptor para empleado ${emp.id}`);
      }

      return {
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        descriptor: descriptorArray
      };
    });

    console.log(`[Cache] Rostros sincronizados en RAM: ${global.cachedUsers.length}`);
  } catch (error) {
    console.error('[Cache] Error sincronizando rostros:', error);
  }
}

module.exports = {
  euclideanDistance,
  syncFaceCache
};
