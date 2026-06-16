const { PrismaClient } = require('@prisma/client');

// Prevents exhausting database connections during dev reloads
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

module.exports = prisma;
