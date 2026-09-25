/**
 * Centralized Time and Timezone utilities for PAIN Facial Attendance System
 * Guarantees consistent timezone conversion between MySQL @db.Date, Kiosk and Reports
 * regardless of host OS timezone (Local Windows, Hostinger Linux UTC, etc.)
 */

const DEFAULT_TZ = 'America/Mexico_City';

/**
 * Returns date and time breakdown formatted in the specified timezone
 */
function getTzParts(date = new Date(), timeZone = DEFAULT_TZ) {
  const d = date instanceof Date ? date : new Date(date);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(d);
  const getPart = type => parts.find(p => p.type === type)?.value;
  
  const hourRaw = parseInt(getPart('hour') || '0', 10);
  const hour = hourRaw === 24 ? 0 : hourRaw;
  const minute = parseInt(getPart('minute') || '0', 10);
  const second = parseInt(getPart('second') || '0', 10);
  const year = parseInt(getPart('year') || '1970', 10);
  const month = parseInt(getPart('month') || '1', 10);
  const day = parseInt(getPart('day') || '1', 10);

  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${year}-${pad(month)}-${pad(day)}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateStr,
    totalMinutes: hour * 60 + minute
  };
}

/**
 * Returns Date object at UTC midnight representing the local calendar day in timeZone
 * (Matches Prisma/MySQL @db.Date behavior perfectly)
 */
function getStartOfDay(date = new Date(), timeZone = DEFAULT_TZ) {
  const { year, month, day } = getTzParts(date, timeZone);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Constructs an exact UTC Date instance that corresponds to local YYYY-MM-DD HH:mm:ss in timeZone
 */
function getTzDate(year, month, day, hour = 0, minute = 0, second = 0, timeZone = DEFAULT_TZ) {
  const pad = n => String(n).padStart(2, '0');
  const naiveIso = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}.000Z`;
  const utcDate = new Date(naiveIso);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(utcDate);
  const getPart = type => parseInt(parts.find(p => p.type === type).value, 10);
  const h = getPart('hour') === 24 ? 0 : getPart('hour');
  const tzAsUtc = Date.UTC(getPart('year'), getPart('month') - 1, getPart('day'), h, getPart('minute'), getPart('second'));
  const offsetMs = tzAsUtc - utcDate.getTime();
  return new Date(utcDate.getTime() - offsetMs);
}

/**
 * Calculates the exact expected exit Date for an attendance record based on its shift.
 * Handles night shifts crossing midnight correctly.
 */
function getShiftExpectedEndDate(recordDateOrEntrada, startTime = '08:00', endTime = '17:00', timeZone = DEFAULT_TZ) {
  const baseDate = new Date(recordDateOrEntrada);
  let y, m, d;
  if (recordDateOrEntrada instanceof Date && recordDateOrEntrada.toISOString().endsWith('T00:00:00.000Z')) {
    y = recordDateOrEntrada.getUTCFullYear();
    m = recordDateOrEntrada.getUTCMonth() + 1;
    d = recordDateOrEntrada.getUTCDate();
  } else {
    const parts = getTzParts(baseDate, timeZone);
    y = parts.year;
    m = parts.month;
    d = parts.day;
  }

  const [startH] = (startTime || '08:00').split(':').map(Number);
  const [endH, endM] = (endTime || '17:00').split(':').map(Number);

  if (endH < startH) {
    // Night shift crossing midnight -> expected end is next day
    const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
    return getTzDate(nextDay.getUTCFullYear(), nextDay.getUTCMonth() + 1, nextDay.getUTCDate(), endH, endM, 0, timeZone);
  }

  return getTzDate(y, m, d, endH, endM, 0, timeZone);
}

/**
 * Formats "HH:mm" 24h string into "hh:mm AM/PM" 12h display string mathematically
 */
function formatExpectedTime(timeStr) {
  if (!timeStr || timeStr === 'N/A') return 'N/A';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

module.exports = {
  DEFAULT_TZ,
  getTzParts,
  getStartOfDay,
  getTzDate,
  getShiftExpectedEndDate,
  formatExpectedTime
};
