const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');

async function main() {
  const count = await prisma.adminUser.count();
  console.log('Admins count:', count);
  
  if (count === 0) {
    console.log('Creating default admin...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('japain20267', salt);
    await prisma.adminUser.create({
      data: {
        name: 'Admin',
        email: 'admin@pain.com',
        password: hashedPassword,
        role: 'SUPER_ADMIN'
      }
    });
    console.log('Created default admin: admin@pain.com / japain20267');
  } else {
    const users = await prisma.adminUser.findMany();
    console.log(users);
  }
}
main().finally(() => prisma.$disconnect());
