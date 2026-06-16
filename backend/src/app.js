const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');

// Importar rutas
const authRouter = require('./modules/auth/auth.router');
const employeesRouter = require('./modules/employees/employees.router');
const attendanceRouter = require('./modules/attendance/attendance.router');
const reportsRouter = require('./modules/reports/reports.router');
const notificationRouter = require('./modules/notifications/notification.router');

const app = express();
const server = http.createServer(app);

// Seguridad básica de Express
app.disable('x-powered-by');
app.use(helmet());

const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_API_URL || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? '*' : frontendUrl,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Unir al room "dashboard" por defecto o basado en algún evento
  socket.join('dashboard');

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.use(cors({ 
  origin: process.env.NODE_ENV === 'production' ? '*' : frontendUrl 
}));
app.use(express.json());

// Montar rutas
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/employees', employeesRouter);
app.use('/api/v1/attendance', attendanceRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/notifications', notificationRouter);
const settingsRouter = require('./modules/settings/settings.router');
app.use('/api/v1/settings', settingsRouter);
const shiftsRouter = require('./modules/shifts/shifts.router');
app.use('/api/v1/shifts', shiftsRouter);
const departmentsRouter = require('./modules/departments/departments.router');
app.use('/api/v1/departments', departmentsRouter);

// Manejo de errores 404 para la API
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta de API no encontrada' });
});

// Servir frontend en producción
const path = require('path');
if (process.env.NODE_ENV === 'production') {
  const frontendDistPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDistPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  // Manejo de errores 404 general para desarrollo
  app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });
}

// Función para emitir notificaciones
const emitNotification = (notificationData) => {
  io.to('dashboard').emit('new_notification', notificationData);
};

// Función para emitir evento de caché
const emitCacheRefresh = () => {
  io.to('dashboard').emit('cache_updated');
};

module.exports = { app, server, emitNotification, emitCacheRefresh };
