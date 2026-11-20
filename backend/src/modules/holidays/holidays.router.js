const express = require('express');
const router = express.Router();
const prisma = require('../../utils/prisma');
const requireJwt = require('../../middlewares/requireJwt');
const { getStartOfDay } = require('../../utils/timeUtils');

// Obtener todos los festivos de la empresa
router.get('/', requireJwt, async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const holidays = await prisma.companyHoliday.findMany({
      where: { companyId },
      orderBy: { date: 'asc' }
    });

    res.json(holidays);
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ error: 'Error interno al consultar festivos' });
  }
});

// Crear día festivo
router.post('/', requireJwt, async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const { name, date, isMandatory, departmentIds } = req.body;
    if (!name || !date) {
      return res.status(400).json({ error: 'Nombre y fecha son obligatorios' });
    }

    // Convertir date ("YYYY-MM-DD") a Date UTC midnight
    const holidayDate = getStartOfDay(date);

    const holiday = await prisma.companyHoliday.create({
      data: {
        companyId,
        name,
        date: holidayDate,
        isMandatory: isMandatory !== undefined ? Boolean(isMandatory) : true,
        departmentIds: departmentIds || null
      }
    });

    res.status(201).json(holiday);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un día festivo registrado en esa fecha' });
    }
    console.error('Error creating holiday:', error);
    res.status(500).json({ error: 'Error interno al crear día festivo' });
  }
});

// Actualizar día festivo
router.put('/:id', requireJwt, async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;
    const { name, date, isMandatory, departmentIds } = req.body;

    const existing = await prisma.companyHoliday.findUnique({
      where: { id_companyId: { id, companyId } }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Día festivo no encontrado' });
    }

    const updated = await prisma.companyHoliday.update({
      where: { id_companyId: { id, companyId } },
      data: {
        name: name !== undefined ? name : undefined,
        date: date ? getStartOfDay(date) : undefined,
        isMandatory: isMandatory !== undefined ? Boolean(isMandatory) : undefined,
        departmentIds: departmentIds !== undefined ? departmentIds : undefined
      }
    });

    res.json(updated);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe otro día festivo registrado en esa fecha' });
    }
    console.error('Error updating holiday:', error);
    res.status(500).json({ error: 'Error interno al actualizar día festivo' });
  }
});

// Eliminar día festivo
router.delete('/:id', requireJwt, async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;

    const existing = await prisma.companyHoliday.findUnique({
      where: { id_companyId: { id, companyId } }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Día festivo no encontrado' });
    }

    await prisma.companyHoliday.delete({
      where: { id_companyId: { id, companyId } }
    });

    res.json({ message: 'Día festivo eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting holiday:', error);
    res.status(500).json({ error: 'Error interno al eliminar día festivo' });
  }
});

module.exports = router;
