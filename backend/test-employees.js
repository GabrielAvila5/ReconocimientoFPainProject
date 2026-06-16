const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.employee.findMany();
  console.log(employees);
}

main().catch(console.error).finally(() => prisma.$disconnect());
