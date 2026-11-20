/**
 * shiftUtils.js
 * Utilidades centralizadas para interpretación de horarios y días laborales.
 * Estándar ISO 8601: 1 = Lunes, 2 = Martes, 3 = Miércoles, 4 = Jueves, 5 = Viernes, 6 = Sábado, 7 = Domingo.
 */

const { getTzParts, getStartOfDay } = require('./timeUtils');

const DEFAULT_TZ = 'America/Mexico_City';

/**
 * Obtiene el día de la semana ISO (1 = Lunes ... 7 = Domingo) para una fecha y timezone dados.
 * @param {Date|string} date 
 * @param {string} timeZone 
 * @returns {number} 1..7
 */
function getIsoDayOfWeek(date = new Date(), timeZone = DEFAULT_TZ) {
  const parts = getTzParts(date, timeZone);
  // Fecha UTC a medianoche para evitar desfases locales
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const jsDay = d.getUTCDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Valida la estructura del objeto scheduleByDay.
 * Espera claves "1" a "7".
 * @param {object|string} schedule 
 * @returns {{ valid: boolean, error?: string }}
 */
function validateScheduleByDay(schedule) {
  if (!schedule) return { valid: true };
  let parsed = schedule;
  if (typeof schedule === 'string') {
    try {
      parsed = JSON.parse(schedule);
    } catch (e) {
      return { valid: false, error: 'El formato de scheduleByDay no es un JSON válido.' };
    }
  }

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  for (let day = 1; day <= 7; day++) {
    const key = String(day);
    const dayConfig = parsed[key];
    if (!dayConfig) continue;

    if (typeof dayConfig !== 'object') {
      return { valid: false, error: `La configuración para el día ${day} debe ser un objeto.` };
    }

    if (dayConfig.enabled === true) {
      if (!dayConfig.startTime || !timeRegex.test(dayConfig.startTime)) {
        return { valid: false, error: `Día ${day}: startTime es obligatorio y debe tener formato HH:mm (00:00 - 23:59).` };
      }
      if (!dayConfig.endTime || !timeRegex.test(dayConfig.endTime)) {
        return { valid: false, error: `Día ${day}: endTime es obligatorio y debe tener formato HH:mm (00:00 - 23:59).` };
      }
      if (dayConfig.tolerance !== undefined && dayConfig.tolerance !== null) {
        if (!Number.isInteger(dayConfig.tolerance) || dayConfig.tolerance < 0) {
          return { valid: false, error: `Día ${day}: tolerance debe ser un número entero mayor o igual a 0.` };
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Obtiene la configuración de turno aplicable para una fecha específica.
 * Resuelve horario, descansos y tolerancia según scheduleByDay o valores globales por defecto.
 * 
 * @param {object|null} shift Objeto Shift de la base de datos
 * @param {Date|string} targetDate Fecha a evaluar
 * @param {string} timeZone Timezone de la empresa
 * @param {object} [fallbackSettings] Ajustes globales si no hay turno asignado
 * @returns {object} { isWorkDay, startTime, endTime, tolerance, breakStartTime, breakEndTime, isoDay, isNightShift }
 */
function getShiftForDate(shift, targetDate = new Date(), timeZone = DEFAULT_TZ, fallbackSettings = null) {
  const isoDay = getIsoDayOfWeek(targetDate, timeZone);

  // Si no hay turno asignado, recurrir a los valores globales de SystemSettings o default estándar (Lun-Vie 9-17)
  if (!shift) {
    const defaultStart = fallbackSettings 
      ? `${String(fallbackSettings.workdayStartHour ?? 9).padStart(2, '0')}:${String(fallbackSettings.workdayStartMinute ?? 0).padStart(2, '0')}`
      : '09:00';
    const defaultEnd = fallbackSettings 
      ? `${String(fallbackSettings.workdayEndHour ?? 17).padStart(2, '0')}:${String(fallbackSettings.workdayEndMinute ?? 0).padStart(2, '0')}`
      : '17:00';
    const defaultTolerance = fallbackSettings?.latenessToleranceMin ?? 15;

    // Por defecto Lunes a Viernes (1-5) es laboral; Sábado (6) y Domingo (7) descanso
    const isWorkDay = isoDay >= 1 && isoDay <= 5;

    return {
      isWorkDay,
      startTime: isWorkDay ? defaultStart : null,
      endTime: isWorkDay ? defaultEnd : null,
      tolerance: defaultTolerance,
      breakStartTime: fallbackSettings?.breakStartTime || null,
      breakEndTime: fallbackSettings?.breakEndTime || null,
      isoDay,
      isNightShift: false,
      isDefault: true
    };
  }

  let schedule = shift.scheduleByDay;
  if (typeof schedule === 'string') {
    try {
      schedule = JSON.parse(schedule);
    } catch (e) {
      schedule = null;
    }
  }

  const dayRule = schedule?.[String(isoDay)];

  if (dayRule) {
    // Si existe regla explícita en scheduleByDay para este día
    if (dayRule.enabled === false) {
      return {
        isWorkDay: false,
        startTime: null,
        endTime: null,
        tolerance: dayRule.tolerance ?? shift.tolerance ?? 15,
        breakStartTime: null,
        breakEndTime: null,
        isoDay,
        isNightShift: false
      };
    }

    const startTime = dayRule.startTime || shift.startTime || '09:00';
    const endTime = dayRule.endTime || shift.endTime || '18:00';
    const tolerance = dayRule.tolerance !== undefined && dayRule.tolerance !== null ? dayRule.tolerance : (shift.tolerance ?? 15);
    const breakStartTime = dayRule.breakStartTime ?? shift.breakStartTime ?? null;
    const breakEndTime = dayRule.breakEndTime ?? shift.breakEndTime ?? null;

    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    const isNightShift = (eH * 60 + eM) < (sH * 60 + sM);

    return {
      isWorkDay: true,
      startTime,
      endTime,
      tolerance,
      breakStartTime,
      breakEndTime,
      isoDay,
      isNightShift
    };
  }

  // Comportamiento fallback si el shift no tiene scheduleByDay configurado para ese día:
  // Lunes a Viernes (1 a 5) activos por defecto con el startTime/endTime global del turno.
  // Fin de semana (6 y 7) descanso por defecto.
  const isWorkDay = isoDay >= 1 && isoDay <= 5;
  const startTime = isWorkDay ? (shift.startTime || '09:00') : null;
  const endTime = isWorkDay ? (shift.endTime || '18:00') : null;
  const tolerance = shift.tolerance ?? 15;

  let isNightShift = false;
  if (startTime && endTime) {
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    isNightShift = (eH * 60 + eM) < (sH * 60 + sM);
  }

  return {
    isWorkDay,
    startTime,
    endTime,
    tolerance,
    breakStartTime: isWorkDay ? shift.breakStartTime : null,
    breakEndTime: isWorkDay ? shift.breakEndTime : null,
    isoDay,
    isNightShift
  };
}

/**
 * Determina si una fecha específica es un día festivo oficial para un departamento/empresa.
 * 
 * @param {Array<object>} companyHolidays Lista de festivos de la empresa
 * @param {Date|string} targetDate Fecha a evaluar
 * @param {number|null} departmentId ID del departamento del empleado
 * @param {string} timeZone Timezone de la empresa
 * @returns {object|null} El objeto festivo si aplica, o null si es día regular
 */
function findMatchingHoliday(companyHolidays, targetDate = new Date(), departmentId = null, timeZone = DEFAULT_TZ) {
  if (!companyHolidays || !Array.isArray(companyHolidays) || companyHolidays.length === 0) {
    return null;
  }

  const parts = getTzParts(targetDate, timeZone);
  const targetDateStr = parts.dateStr; // "YYYY-MM-DD"

  for (const holiday of companyHolidays) {
    let holidayDateStr = '';
    if (holiday.date instanceof Date) {
      holidayDateStr = holiday.date.toISOString().slice(0, 10);
    } else if (typeof holiday.date === 'string') {
      holidayDateStr = holiday.date.slice(0, 10);
    }

    if (holidayDateStr === targetDateStr) {
      // Si el festivo tiene departamentos específicos asignados
      if (holiday.departmentIds) {
        let depts = holiday.departmentIds;
        if (typeof depts === 'string') {
          try { depts = JSON.parse(depts); } catch (e) { depts = []; }
        }
        if (Array.isArray(depts) && depts.length > 0) {
          if (!departmentId || !depts.includes(departmentId)) {
            continue; // No aplica a este departamento
          }
        }
      }
      return holiday;
    }
  }

  return null;
}

module.exports = {
  getIsoDayOfWeek,
  validateScheduleByDay,
  getShiftForDate,
  findMatchingHoliday
};
