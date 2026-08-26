const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getEvents = async (req, res) => {
  try {
    const { status, type, startDate, endDate, employeeId } = req.query;
    
    let whereClause = { status: status || 'ACTIVE' };
    
    if (type) whereClause.type = type;
    if (employeeId) whereClause.employeeId = employeeId;
    
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = new Date(startDate);
      if (endDate) whereClause.date.lte = new Date(endDate);
    }

    const events = await prisma.eventRequest.findMany({
      where: whereClause,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, identifier: true }
        },
        registeredBy: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createEvent = async (req, res) => {
  try {
    const { employeeId, type, date, dateTo, startTime, endTime, minutes, reason } = req.body;

    if (!employeeId || !type || !date || !reason) {
      return res.status(400).json({ error: 'Faltan campos obligatorios.' });
    }

    const newEvent = await prisma.eventRequest.create({
      data: {
        employeeId,
        type,
        date: new Date(date),
        dateTo: dateTo ? new Date(dateTo) : null,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        minutes: minutes ? parseInt(minutes) : null,
        reason,
        registeredById: req.user.id
      },
      include: {
        employee: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    // Auditoría
    await prisma.adminAuditLog.create({
      data: {
        action: 'CREATE_EVENT_REQUEST',
        performedById: req.user.id,
        performedByName: req.user.name || req.user.email || 'Admin',
        targetName: `${newEvent.employee.firstName} ${newEvent.employee.lastName}`,
        targetEmail: type // Guardamos el tipo de evento en este campo por conveniencia
      }
    });

    res.status(201).json(newEvent);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, dateTo, startTime, endTime, minutes, reason } = req.body;

    const existingEvent = await prisma.eventRequest.findUnique({ where: { id } });
    if (!existingEvent) {
      return res.status(404).json({ error: 'Evento no encontrado.' });
    }

    const updatedEvent = await prisma.eventRequest.update({
      where: { id },
      data: {
        date: date ? new Date(date) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        minutes: minutes !== undefined ? parseInt(minutes) : undefined,
        reason
      }
    });

    res.json(updatedEvent);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const existingEvent = await prisma.eventRequest.findUnique({ 
      where: { id },
      include: { employee: true }
    });

    if (!existingEvent) {
      return res.status(404).json({ error: 'Evento no encontrado.' });
    }

    // Soft delete (change status to CANCELLED)
    const cancelledEvent = await prisma.eventRequest.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    // Auditoría
    await prisma.adminAuditLog.create({
      data: {
        action: 'CANCEL_EVENT_REQUEST',
        performedById: req.user.id,
        performedByName: req.user.name || req.user.email || 'Admin',
        targetName: `${existingEvent.employee.firstName} ${existingEvent.employee.lastName}`,
        targetEmail: existingEvent.type
      }
    });

    res.json({ message: 'Evento cancelado exitosamente.', event: cancelledEvent });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent
};
