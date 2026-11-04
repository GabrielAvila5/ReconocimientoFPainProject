const prisma = require('../../utils/prisma');
const { getTenantContext } = require('../../middlewares/tenantContext');

/**
 * Resuelve el companyId activo para notificaciones con aislamiento estricto:
 * - Para administradores de empresa regulares (role !== 'SUPER_ADMIN'):
 *   Su companyId proviene inmutablemente de req.user.companyId (del token JWT).
 * - Para Super Admin:
 *   Respeta x-tenant-id si se envió explícitamente, o el contexto de inquilino activo.
 */
function resolveCompanyId(req) {
  if (req.user && req.user.role !== 'SUPER_ADMIN') {
    return req.user.companyId || null;
  }

  const headerTenant = req.headers['x-tenant-id'] || req.headers['x-company-id'];
  if (headerTenant) {
    return Array.isArray(headerTenant) ? headerTenant[0] : headerTenant;
  }

  const ctx = getTenantContext();
  if (ctx && ctx.companyId) {
    return ctx.companyId;
  }

  if (req.user && req.user.companyId) {
    return req.user.companyId;
  }

  return 'default-company-pain';
}

// GET / - Listar notificaciones paginadas estrictamente aisladas por empresa
const getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { isRead, type } = req.query;

    const skip = (page - 1) * limit;
    const companyId = resolveCompanyId(req);
    
    let where = {};
    if (companyId) {
      where.companyId = companyId;
    }
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

// GET /unread-count - Obtener cantidad de no leídas de la empresa
const getUnreadCount = async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    let where = { isRead: false };
    if (companyId) {
      where.companyId = companyId;
    }

    const count = await prisma.notification.count({
      where
    });
    res.json({ count });
  } catch (error) {
    console.error('Error in getUnreadCount:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /:id/read - Marcar como leída (validando propiedad de empresa)
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = resolveCompanyId(req);

    const existing = await prisma.notification.findUnique({
      where: { id }
    });
    if (!existing || (companyId && existing.companyId !== companyId && req.user?.role !== 'SUPER_ADMIN')) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

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

// PUT /read-all - Marcar todas como leídas en la empresa
const markAllAsRead = async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    let where = { isRead: false };
    if (companyId) {
      where.companyId = companyId;
    }

    await prisma.notification.updateMany({
      where,
      data: { isRead: true }
    });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error in markAllAsRead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /:id - Eliminar una notificación (validando propiedad de empresa)
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = resolveCompanyId(req);

    const existing = await prisma.notification.findUnique({
      where: { id }
    });
    if (!existing || (companyId && existing.companyId !== companyId && req.user?.role !== 'SUPER_ADMIN')) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    await prisma.notification.delete({
      where: { id }
    });
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Error in deleteNotification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /read - Eliminar todas las leídas en la empresa
const deleteReadNotifications = async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    let where = { isRead: true };
    if (companyId) {
      where.companyId = companyId;
    }

    await prisma.notification.deleteMany({
      where
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
    const companyId = resolveCompanyId(req);
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
    ].map(n => ({ ...n, companyId: companyId || 'default-company-pain' }));

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
