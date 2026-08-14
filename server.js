const fs = require('fs');

process.on('uncaughtException', (err) => {
  fs.appendFileSync('hostinger-error.log', `[UNCAUGHT] ${err.stack || err}\n`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, p) => {
  fs.appendFileSync('hostinger-error.log', `[UNHANDLED REJECTION] ${reason}\n`);
});

try {
  fs.appendFileSync('hostinger-error.log', `[START] Iniciando servidor en Hostinger... ${new Date().toISOString()}\n`);
  require('./backend/src/server.js');
} catch (error) {
  fs.appendFileSync('hostinger-error.log', `[CATCH] ${error.stack || error.toString()}\n`);
  console.error("CRITICAL STARTUP ERROR:", error);
}
