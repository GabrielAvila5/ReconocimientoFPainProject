const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET / - Listar notificaciones paginadas
const getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { isRead, type } = req.query;

    const skip = (page - 1) * limit;
    
    let where = {};
    if (isRead !== undefined) {
      where.isRead = isRead === 'true';
    }
    if (type) {
      where.type = type;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.notification.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      data: notifications,
      total,
      page,
      totalPages
    });
  } catch (error) {
    console.error('Error in getNotifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /unread-count - Obtener cantidad de no leídas
const getUnreadCount = async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { isRead: false }
    });
    res.json({ count });
  } catch (error) {
    console.error('Error in getUnreadCount:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /:id/read - Marcar como leída
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });
    res.json(notification);
  } catch (error) {
    console.error('Error in markAsRead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /read-all - Marcar todas como leídas
const markAllAsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true }
    });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error in markAllAsRead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /:id - Eliminar una
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.notification.delete({
      where: { id }
    });
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Error in deleteNotification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /read - Eliminar todas las leídas
const deleteReadNotifications = async (req, res) => {
  try {
    await prisma.notification.deleteMany({
      where: { isRead: true }
    });
    res.json({ success: true, message: 'Read notifications deleted' });
  } catch (error) {
    console.error('Error in deleteReadNotifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /seed - Solo desarrollo
const seedNotifications = async (req, res) => {
  try {
    const sampleNotifications = [
      { title: 'Sistema Iniciado', message: 'Todos los servicios están corriendo correctamente.', type: 'SUCCESS', category: 'system' },
      { title: 'Dispositivo Offline', message: 'El Kiosko Principal ha perdido conexión.', type: 'ERROR', category: 'device', entityId: 'kiosk-01' },
      { title: 'Llegada Tarde', message: 'Juan Pérez registró su entrada con 15 minutos de retraso.', type: 'WARNING', category: 'attendance', entityId: 'emp-123' },
      { title: 'Rostro Desconocido', message: 'Se detectó un rostro no registrado en la cámara principal.', type: 'ERROR', category: 'security' },
      { title: 'Actualización Disponible', message: 'Hay una nueva versión del sistema disponible para instalar.', type: 'INFO', category: 'system' },
      { title: 'Reporte Semanal', message: 'El reporte de asistencia semanal ha sido generado.', type: 'SUCCESS', category: 'system' },
      { title: 'Batería Baja', message: 'El Kiosko Secundario tiene 15% de batería.', type: 'WARNING', category: 'device', entityId: 'kiosk-02' },
      { title: 'Acceso Denegado', message: 'Intento de acceso fuera de horario permitido.', type: 'ERROR', category: 'security' },
      { title: 'Sincronización Completa', message: 'Base de datos de rostros sincronizada con éxito.', type: 'INFO', category: 'device' },
      { title: 'Ausencia', message: 'María García no ha registrado su entrada el día de hoy.', type: 'WARNING', category: 'attendance', entityId: 'emp-456' }
    ];

    await prisma.notification.createMany({
      data: sampleNotifications
    });

    res.json({ success: true, message: '10 sample notifications inserted' });
  } catch (error) {
    console.error('Error in seedNotifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteReadNotifications,
  seedNotifications
};
