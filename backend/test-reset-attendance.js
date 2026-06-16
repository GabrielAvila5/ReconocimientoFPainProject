const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  console.log("Eliminando registros de asistencia del día de hoy...");
  
  const result = await prisma.attendanceRecord.deleteMany({
    where: {
      date: { gte: startOfDay }
    }
  });

  console.log(`¡Listo! Se eliminaron ${result.count} registros de asistencia.`);
  console.log("Ahora puedes volver a pasar por el kiosko como si fuera tu primera vez hoy.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
