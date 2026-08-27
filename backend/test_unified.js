const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const start = new Date('2026-08-01T00:00:00.000Z');
  const end = new Date('2026-08-31T23:59:59.999Z');

  const attendances = await prisma.attendanceRecord.findMany({
    where: { date: { gte: start, lte: end } },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } } }
    }
  });

  console.log(`Found ${attendances.length} attendances`);
  const gabriel = attendances.filter(a => a.employee.firstName.includes('Gabriel'));
  console.log(`Gabriel's attendances: ${gabriel.length}`);
  if (gabriel.length > 0) {
    console.log('Sample Gabriel attendance:');
    console.dir(gabriel[0], {depth: null});
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
