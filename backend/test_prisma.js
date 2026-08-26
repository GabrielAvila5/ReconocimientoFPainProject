const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const events = await prisma.eventRequest.findMany({
      where: { status: 'ACTIVE' },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, identifier: true }
        },
        registeredBy: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log("Success!", events);
  } catch (e) {
    console.error("PRISMA ERROR:", e);
  } finally {
    prisma.$disconnect();
  }
}
test();
