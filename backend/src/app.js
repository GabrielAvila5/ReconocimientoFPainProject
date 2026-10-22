const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

// Importar rutas
const authRouter = require('./modules/auth/auth.router');
const employeesRouter = require('./modules/employees/employees.router');
const attendanceRouter = require('./modules/attendance/attendance.router');
const reportsRouter = require('./modules/reports/reports.router');
const notificationRouter = require('./modules/notifications/notification.router');

const app = express();
const server = http.createServer(app);

// Seguridad básica de Express
app.set('trust proxy', 1); // Confiar en el proxy de Hostinger para X-Forwarded-For
app.disable('x-powered-by');
app.use(helmet());

const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_API_URL || 'http://localhost:5173';

require('./config/secrets');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config/secrets');

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? true : [frontendUrl, 'http://localhost:8080', 'http://localhost'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

app.set('io', io);

// Middleware de autenticación y aislamiento multi-tenant en Socket.io
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    socket.isAnonymous = true;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    socket.companyId = decoded.companyId || null;
    return next();
  } catch (err) {
    return next(new Error('AUTHENTICATION_ERROR: Token inválido para Socket.io'));
  }
});

io.on('connection', (socket) => {
  // Unir exclusivamente a salas de su propia empresa
  if (socket.companyId) {
    socket.join(`company_${socket.companyId}`);
    socket.join(`dashboard_${socket.companyId}`);
  } else if (socket.user?.role === 'SUPER_ADMIN') {
    socket.join('dashboard_global');
  }

  // Unirse a sala de autorización de kiosko por UUID (flujo de emparejamiento)
  socket.on('join_device_auth', (requestId) => {
    if (requestId) {
      const room = `device_auth_${requestId}`;
      socket.join(room);
    }
  });

  // Unirse a sala de control directo del dispositivo
  socket.on('join_device', (deviceId) => {
    if (deviceId) {
      const room = `device_${deviceId}`;
      socket.join(room);
    }
  });

  socket.on('disconnect', () => {});
});

app.use(cors({ 
  origin: process.env.NODE_ENV === 'production' ? true : [frontendUrl, 'http://localhost:8080', 'http://localhost'],
  credentials: true 
}));
app.use(cookieParser());
app.use(express.json());

// Middleware de Contexto de Inquilino Multi-Tenant (AsyncLocalStorage)
const { tenantContextMiddleware } = require('./middlewares/tenantContext');
app.use(tenantContextMiddleware);

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
const adminsRouter = require('./modules/admins/admins.router');
app.use('/api/v1/admins', adminsRouter);
const eventsRouter = require('./modules/events/events.router');
app.use('/api/v1/events', eventsRouter);
const devicesRouter = require('./modules/devices/devices.router');
app.use('/api/v1/devices', devicesRouter);

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
