/**
 * CLIENTE PRISMA ADMINISTRATIVO DEDICADO
 * 
 * USO EXCLUSIVO:
 * - Scripts de migración (DDL)
 * - Protocolo deliberado de purga ARCO
 * - Hook de reconciliación post-restauración
 * 
 * ⚠️ REGLA DE ARQUITECTURA INVIOLABLE:
 * Queda terminantemente prohibido importar este cliente dentro de 'src/modules/'
 * o en controladores y rutas de la aplicación de usuario.
 */

const { PrismaClient } = require('@prisma/client');

const globalForPrismaAdmin = global;
const prismaAdmin = globalForPrismaAdmin.prismaAdmin || new PrismaClient({
  datasources: {
    db: {
      url: process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL
    }
  }
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrismaAdmin.prismaAdmin = prismaAdmin;
}

module.exports = prismaAdmin;
