require('dotenv').config();
const { server } = require('./app');
const { syncFaceCache } = require('./utils/faceMath');

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  await syncFaceCache();
  
  server.listen(PORT, () => {
    console.log(`Backend server is running on port ${PORT}`);
  });
}

bootstrap();
