const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Buscando empleados sin departamento (Huérfanos)...');

  const orphans = await prisma.employee.findMany({
    where: {
      departmentId: null,
      isActive: true
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      identifier: true,
      email: true
    }
  });

  if (orphans.length === 0) {
    console.log('\n✅ No se encontraron empleados huérfanos activos.');
  } else {
    console.log(`\n⚠️ Se encontraron ${orphans.length} empleados activos sin departamento asignado:\n`);
    orphans.forEach((emp, index) => {
      console.log(`${index + 1}. Nombre: ${emp.firstName} ${emp.lastName}`);
      console.log(`   ID: ${emp.id}`);
      console.log(`   Identificador: ${emp.identifier}`);
      console.log(`   Email: ${emp.email || 'N/A'}`);
      console.log(`   Estado: PENDIENTE DE ASIGNACIÓN\n`);
    });
    console.log('Recomendación: Navegue a la pantalla de Empleados en la UI, ubique a estos empleados marcados como "Pendiente" y asígneles un departamento.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
