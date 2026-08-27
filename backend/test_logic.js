const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Try calling the logic directly
  const start = new Date('2026-08-19T00:00:00.000Z');
  const end = new Date('2026-08-26T23:59:59.999Z');

  const attendances = await prisma.attendanceRecord.findMany({
    where: { date: { gte: start, lte: end } },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } } }
    }
  });

  const eventRequests = await prisma.eventRequest.findMany({
    where: { date: { gte: start, lte: end }, status: 'APPROVED' },
    include: { employee: { select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } } } }
  });

  console.log(`attendances: ${attendances.length}`);
  console.log(`eventRequests: ${eventRequests.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
