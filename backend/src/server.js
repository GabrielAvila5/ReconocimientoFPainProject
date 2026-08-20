require('dotenv').config();
const { server } = require('./app');
const { syncFaceCache } = require('./utils/faceMath');
const { initAttendanceCron, runCatchUp } = require('./jobs/attendanceCron');

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  await syncFaceCache();
  
  // Inicializar cron jobs y realizar catch-up
  initAttendanceCron();
  await runCatchUp();
  
  server.listen(PORT, () => {
    console.log(`Backend server is running on port ${PORT}`);
  });
}

bootstrap();
