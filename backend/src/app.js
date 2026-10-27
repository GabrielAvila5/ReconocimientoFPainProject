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

app.set('trust proxy', 1);

const getAllowedOrigins = () => {
  const envOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : [];
  
  const defaults = [
    frontendUrl,
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:4000',
    'http://localhost:3000',
    'http://localhost'
  ];
  return Array.from(new Set([...envOrigins, ...defaults]));
};

app.use(cors({ 
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = getAllowedOrigins();
    if (allowed.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS_NOT_ALLOWED: Origen no autorizado (${origin})`));
  },
  credentials: true 
}));
app.use(cookieParser());
app.use(express.json());

// Protección CSRF para mutaciones basadas en cookie de sesión
const { csrfProtection } = require('./middlewares/csrfProtection');
app.use(csrfProtection);

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
const companiesRouter = require('./modules/companies/companies.router');
app.use('/api/v1/companies', companiesRouter);

// Manejo de errores de CORS y seguridad
app.use((err, req, res, next) => {
  if (err && err.message && err.message.startsWith('CORS_NOT_ALLOWED')) {
    return res.status(403).json({ error: 'CORS_NOT_ALLOWED', message: err.message });
  }
  next(err);
});

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

// Función para emitir notificaciones aisladas por empresa
const emitNotification = (notificationData) => {
  if (notificationData?.companyId) {
    io.to(`company_${notificationData.companyId}`).emit('new_notification', notificationData);
  }
};

// Función para emitir evento de caché y descriptores invalidados por empresa
const emitCacheRefresh = (companyId) => {
  if (companyId) {
    io.to(`company_${companyId}`).emit('cache_updated');
    io.to(`company_${companyId}`).emit('descriptors_invalidated', { companyId, timestamp: new Date().toISOString() });
  }
};

// Desconexión forzada de todos los sockets de una empresa suspendida
const disconnectCompanySockets = (companyId, reason = 'COMPANY_SUSPENDED') => {
  if (!companyId) return;
  const room = `company_${companyId}`;
  io.to(room).emit('forced_disconnect', { reason });
  io.in(room).disconnectSockets(true);
};

module.exports = { app, server, io, emitNotification, emitCacheRefresh, disconnectCompanySockets };
