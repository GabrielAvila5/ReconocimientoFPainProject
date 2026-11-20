const { getIsoDayOfWeek, validateScheduleByDay, getShiftForDate, findMatchingHoliday } = require('../../src/utils/shiftUtils');

console.log('================================================================');
console.log('>>> UNIT TEST: shiftUtils.js (ISO 1-7, ScheduleByDay, Holidays)');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

// 1. Días ISO
// 2026-11-16 = Lunes (1)
// 2026-11-20 = Viernes (5)
// 2026-11-21 = Sábado (6)
// 2026-11-22 = Domingo (7)
assert(getIsoDayOfWeek(new Date('2026-11-16T12:00:00Z')) === 1, '2026-11-16 es Lunes (ISO 1)');
assert(getIsoDayOfWeek(new Date('2026-11-20T12:00:00Z')) === 5, '2026-11-20 es Viernes (ISO 5)');
assert(getIsoDayOfWeek(new Date('2026-11-21T12:00:00Z')) === 6, '2026-11-21 es Sábado (ISO 6)');
assert(getIsoDayOfWeek(new Date('2026-11-22T12:00:00Z')) === 7, '2026-11-22 es Domingo (ISO 7)');

// 2. Validación de scheduleByDay
const validSchedule = {
  "1": { enabled: false }, // Descansa Lunes
  "2": { enabled: true, startTime: "08:00", endTime: "16:00", tolerance: 10 },
  "3": { enabled: true, startTime: "08:00", endTime: "16:00", tolerance: 10 },
  "4": { enabled: true, startTime: "08:00", endTime: "16:00", tolerance: 10 },
  "5": { enabled: true, startTime: "08:00", endTime: "16:00", tolerance: 10 },
  "6": { enabled: true, startTime: "09:00", endTime: "14:00", tolerance: 15 },
  "7": { enabled: true, startTime: "09:00", endTime: "14:00", tolerance: 15 } // Trabaja Domingo
};

assert(validateScheduleByDay(validSchedule).valid === true, 'Horario válido pasa validación');
assert(validateScheduleByDay({ "2": { enabled: true, startTime: "25:00", endTime: "16:00" } }).valid === false, 'Hora inválida (25:00) es rechazada');
assert(validateScheduleByDay({ "2": { enabled: true, startTime: "08:00", endTime: "16:00", tolerance: -5 } }).valid === false, 'Tolerancia negativa es rechazada');

// 3. Resolución de horario con getShiftForDate
const shiftCustom = {
  id: 10,
  name: 'Turno Martes a Domingo',
  startTime: '08:00',
  endTime: '17:00',
  tolerance: 15,
  scheduleByDay: validSchedule
};

// En Lunes (2026-11-16) debe ser Descanso
const mondayShift = getShiftForDate(shiftCustom, new Date('2026-11-16T12:00:00Z'));
assert(mondayShift.isWorkDay === false, 'Lunes es día de descanso para este turno');
assert(mondayShift.startTime === null, 'Lunes no tiene hora de entrada');

// En Domingo (2026-11-22) debe ser Laboral de 09:00 a 14:00
const sundayShift = getShiftForDate(shiftCustom, new Date('2026-11-22T12:00:00Z'));
assert(sundayShift.isWorkDay === true, 'Domingo es día laboral para este turno');
assert(sundayShift.startTime === '09:00', 'Domingo inicia a las 09:00');
assert(sundayShift.endTime === '14:00', 'Domingo finaliza a las 14:00');
assert(sundayShift.tolerance === 15, 'Domingo tiene tolerancia de 15 min');

// Turno nocturno (22:00 a 06:00)
const nightShift = {
  id: 20,
  name: 'Turno Nocturno',
  startTime: '22:00',
  endTime: '06:00',
  tolerance: 10,
  scheduleByDay: {
    "1": { enabled: true, startTime: "22:00", endTime: "06:00", tolerance: 10 }
  }
};
const nightResult = getShiftForDate(nightShift, new Date('2026-11-16T12:00:00Z'));
assert(nightResult.isNightShift === true, 'Detecta correctamente que cruza medianoche (isNightShift: true)');

// 4. Festivos con findMatchingHoliday
const holidays = [
  { id: 'h1', name: 'Navidad', date: '2026-12-25', isMandatory: true, departmentIds: null },
  { id: 'h2', name: 'Aniversario Ventas', date: '2026-11-20', isMandatory: false, departmentIds: [1, 2] }
];

const xmasMatch = findMatchingHoliday(holidays, new Date('2026-12-25T12:00:00Z'));
assert(xmasMatch !== null && xmasMatch.name === 'Navidad', 'Encuentra festivo general para toda la empresa');

const deptMatch = findMatchingHoliday(holidays, new Date('2026-11-20T12:00:00Z'), 1);
assert(deptMatch !== null && deptMatch.name === 'Aniversario Ventas', 'Aplica festivo específico al Depto 1');

const deptNoMatch = findMatchingHoliday(holidays, new Date('2026-11-20T12:00:00Z'), 99);
assert(deptNoMatch === null, 'No aplica festivo específico al Depto 99');

console.log(`\nResultados: ${passed} pasados, ${failed} fallados.`);
if (failed > 0) process.exit(1);
process.exit(0);
