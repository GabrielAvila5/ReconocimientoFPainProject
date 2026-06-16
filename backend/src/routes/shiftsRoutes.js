const express = require('express');
const router = express.Router();
const shiftsController = require('../controllers/shiftsController');

// Rutas base de turnos
router.get('/', shiftsController.getAllShifts);
router.post('/', shiftsController.createShift);
router.put('/:id', shiftsController.updateShift);
router.delete('/:id', shiftsController.deleteShift);

// Asignaciones
// Nota: Dependiendo de cómo prefieras la arquitectura de rutas, 
// estas podrían ir en departmentsRoutes.js / employeesRoutes.js
router.post('/department/:id', shiftsController.assignShiftToDepartment);
router.post('/employee/:id', shiftsController.assignShiftToEmployee);

module.exports = router;
