const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const emp = await prisma.employee.findFirst({
    where: { firstName: { contains: 'Gabriel' } },
    include: { attendances: true, department: true }
  });
  console.dir(emp, {depth: null});
}
main().finally(() => prisma.$disconnect());
