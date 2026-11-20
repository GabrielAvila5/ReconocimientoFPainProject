require('dotenv').config();
const { evaluateEmployeeDayStatus, persistDayStatusSnapshot } = require('../../src/utils/statusUtils');
const prismaAdmin = require('../../src/utils/prismaAdmin');

console.log('================================================================');
console.log('>>> UNIT & INTEGRATION TEST: statusUtils.js');
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

async function runTests() {
  const empMock = { id: 'emp-status-test', departmentId: 1, firstName: 'Juan', lastName: 'Perez' };
  const shiftMock = {
    id: 1,
    name: 'Matutino Lunes a Viernes',
    startTime: '09:00',
    endTime: '18:00',
    tolerance: 15,
    scheduleByDay: {
      "1": { enabled: true, startTime: "09:00", endTime: "18:00", tolerance: 15 },
      "2": { enabled: true, startTime: "09:00", endTime: "18:00", tolerance: 15 },
      "3": { enabled: true, startTime: "09:00", endTime: "18:00", tolerance: 15 },
      "4": { enabled: true, startTime: "09:00", endTime: "18:00", tolerance: 15 },
      "5": { enabled: true, startTime: "09:00", endTime: "18:00", tolerance: 15 },
      "6": { enabled: false }, // Sábado descanso
      "7": { enabled: false }  // Domingo descanso
    }
  };

  // Lunes: 2026-11-16
  const monday = new Date('2026-11-16T12:00:00Z');
  // Sábado: 2026-11-21
  const saturday = new Date('2026-11-21T12:00:00Z');

  // Test 1: Lunes sin checada -> FALTA
  const resFalta = evaluateEmployeeDayStatus({
    employee: empMock,
    shift: shiftMock,
    attendanceRecord: null,
    events: [],
    holidays: [],
    date: monday
  });
  assert(resFalta.status === 'FALTA', 'Día laboral sin checada resulta en FALTA');
  assert(resFalta.isWorkDay === true, 'isWorkDay es true en falta');

  // Test 2: Lunes con checada a tiempo -> PRESENTE
  const resPresente = evaluateEmployeeDayStatus({
    employee: empMock,
    shift: shiftMock,
    attendanceRecord: { id: 'rec-1', entrada: new Date(), isLate: false },
    events: [],
    holidays: [],
    date: monday
  });
  assert(resPresente.status === 'PRESENTE', 'Día laboral con checada a tiempo resulta en PRESENTE');

  // Test 3: Lunes con retardo de 25 min -> RETARDO
  const resRetardo = evaluateEmployeeDayStatus({
    employee: empMock,
    shift: shiftMock,
    attendanceRecord: { id: 'rec-2', entrada: new Date(), isLate: true, lateMinutes: 25 },
    events: [],
    holidays: [],
    date: monday
  });
  assert(resRetardo.status === 'RETARDO', 'Día laboral con retardo resulta en RETARDO');
  assert(resRetardo.lateMinutes === 25, 'Guarda 25 minutos de retardo');

  // Test 4: Sábado sin checada -> DESCANSO (No es falta)
  const resDescanso = evaluateEmployeeDayStatus({
    employee: empMock,
    shift: shiftMock,
    attendanceRecord: null,
    events: [],
    holidays: [],
    date: saturday
  });
  assert(resDescanso.status === 'DESCANSO', 'Sábado sin checada resulta en DESCANSO');
  assert(resDescanso.isWorkDay === false, 'isWorkDay es false en descanso');

  // Test 5: Sábado CON checada -> DESCANSO_TRABAJADO
  const resDescansoTrab = evaluateEmployeeDayStatus({
    employee: empMock,
    shift: shiftMock,
    attendanceRecord: { id: 'rec-3', entrada: new Date() },
    events: [],
    holidays: [],
    date: saturday
  });
  assert(resDescansoTrab.status === 'DESCANSO_TRABAJADO', 'Sábado con checada resulta en DESCANSO_TRABAJADO');

  // Test 6: Festivo sin checada -> FESTIVO
  const holiday = { id: 'h-1', name: 'Día de la Revolución', date: '2026-11-16', isMandatory: true };
  const resFestivo = evaluateEmployeeDayStatus({
    employee: empMock,
    shift: shiftMock,
    attendanceRecord: null,
    events: [],
    holidays: [holiday],
    date: monday
  });
  assert(resFestivo.status === 'FESTIVO', 'Día festivo sin checada resulta en FESTIVO');

  // Test 7: Festivo CON checada -> FESTIVO_TRABAJADO
  const resFestivoTrab = evaluateEmployeeDayStatus({
    employee: empMock,
    shift: shiftMock,
    attendanceRecord: { id: 'rec-4', entrada: new Date(), overtimeMinutes: 120 },
    events: [],
    holidays: [holiday],
    date: monday
  });
  assert(resFestivoTrab.status === 'FESTIVO_TRABAJADO', 'Día festivo con checada resulta en FESTIVO_TRABAJADO');

  // Test 8: Vacaciones activas -> VACACIONES
  const vacationEvent = { type: 'VACATION', date: monday, status: 'ACTIVE', reason: 'Vacaciones de invierno' };
  const resVac = evaluateEmployeeDayStatus({
    employee: empMock,
    shift: shiftMock,
    attendanceRecord: null,
    events: [vacationEvent],
    holidays: [],
    date: monday
  });
  assert(resVac.status === 'VACACIONES', 'Evento de vacaciones resulta en VACACIONES');

  // Test 9: Incapacidad médica -> INCAPACIDAD
  const disabilityEvent = { type: 'DISABILITY', date: monday, status: 'ACTIVE', reason: 'Accidente de trabajo', certificateNumber: 'IMSS-987654' };
  const resDis = evaluateEmployeeDayStatus({
    employee: empMock,
    shift: shiftMock,
    attendanceRecord: null,
    events: [disabilityEvent],
    holidays: [],
    date: monday
  });
  assert(resDis.status === 'INCAPACIDAD', 'Evento de incapacidad médica resulta en INCAPACIDAD');

  // Test 10: Idempotencia en MySQL real con persistDayStatusSnapshot
  console.log('\n[Integración MySQL] Probando persistDayStatusSnapshot e idempotencia...');
  const testCompanyId = 'co-status-idemp-test';
  const testEmpId = 'emp-status-idemp-test';

  try {
    // Setup en BD
    await prismaAdmin.company.upsert({
      where: { id: testCompanyId },
      create: { id: testCompanyId, name: 'Empresa Status Test', slug: 'status-test-slug' },
      update: {}
    });

    await prismaAdmin.employee.upsert({
      where: { companyId_identifier: { companyId: testCompanyId, identifier: 'EMP-ST-1' } },
      create: { id: testEmpId, companyId: testCompanyId, firstName: 'Status', lastName: 'Tester', identifier: 'EMP-ST-1' },
      update: {}
    });

    // Inserción 1
    const snap1 = await persistDayStatusSnapshot(prismaAdmin, {
      companyId: testCompanyId,
      employeeId: testEmpId,
      date: monday,
      statusData: resPresente
    });
    assert(snap1.status === 'PRESENTE', 'Snapshot 1 insertado correctamente con PRESENTE');

    // Inserción 2 (re-evaluación o worker concurrente) -> debe actualizar la misma fila sin lanzar error de clave duplicada
    const snap2 = await persistDayStatusSnapshot(prismaAdmin, {
      companyId: testCompanyId,
      employeeId: testEmpId,
      date: monday,
      statusData: { ...resPresente, notes: 'Actualización idempotente' }
    });
    assert(snap2.id === snap1.id, 'Idempotencia verificada: reutiliza el mismo ID de snapshot');
    assert(snap2.notes === 'Actualización idempotente', 'Actualiza los campos sin duplicar registro');

    const totalRecords = await prismaAdmin.attendanceDayStatus.count({
      where: { companyId: testCompanyId, employeeId: testEmpId }
    });
    assert(totalRecords === 1, 'Total de registros para la fecha es exactamente 1 (sin duplicados)');

  } finally {
    // Cleanup
    await prismaAdmin.attendanceDayStatus.deleteMany({ where: { companyId: testCompanyId } }).catch(() => {});
    await prismaAdmin.employee.deleteMany({ where: { companyId: testCompanyId } }).catch(() => {});
    await prismaAdmin.company.deleteMany({ where: { id: testCompanyId } }).catch(() => {});
  }

  console.log(`\nResultados: ${passed} pasados, ${failed} fallados.`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch(err => {
  console.error('Error en pruebas de statusUtils:', err);
  process.exit(1);
});
