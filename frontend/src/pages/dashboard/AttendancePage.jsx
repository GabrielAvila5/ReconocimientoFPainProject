/**
 * AttendancePage Component
 * Versión: 2.1.0 - Despliegue y Sincronización Hostinger
 * Características:
 * - Soporte multi-período completo: Día, Semana, Mes y Año con navegación temporal
 * - Recuadros KPI interactivos enriquecidos con micro-métricas y filtrado en tiempo real
 * - Modal de desglose detallado por categoría (Asistencias a Tiempo, Retardos, Ausencias)
 * - Modal avanzado de exportación a CSV por Día, Semana, Mes, Año o Rango personalizado
 */
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle2, 
  UserX, 
  Eye, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Building2, 
  Users,
  FileSpreadsheet,
  CalendarDays,
  Layers
} from 'lucide-react';

// --- Helpers de Fecha y Períodos (con soporte estricto de Zona Horaria Local) ---
const getLocalDateString = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayString = () => getLocalDateString(new Date());

const formatFriendlyDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-');
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    const dayName = days[dateObj.getDay()];
    return `${dayName}, ${parseInt(d, 10)} de ${months[parseInt(m, 10) - 1]} de ${y}`;
  } catch {
    return dateStr;
  }
};

const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
  } catch {
    return dateStr;
  }
};

const getWeekRange = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const day = dateObj.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(y, m - 1, d + diffToMon);
  const sunday = new Date(y, m - 1, d + diffToMon + 6);
  return {
    start: getLocalDateString(monday),
    end: getLocalDateString(sunday)
  };
};

const getMonthRange = (dateStr) => {
  const [y, m] = dateStr.split('-');
  const year = parseInt(y, 10);
  const month = parseInt(m, 10);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${String(month).padStart(2, '0')}-01`,
    end: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  };
};

const getYearRange = (dateStr) => {
  const year = dateStr.split('-')[0];
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`
  };
};

const getPeriodRange = (periodType, refDate) => {
  if (periodType === 'day') {
    return { start: refDate, end: refDate };
  }
  if (periodType === 'week') {
    return getWeekRange(refDate);
  }
  if (periodType === 'month') {
    return getMonthRange(refDate);
  }
  if (periodType === 'year') {
    return getYearRange(refDate);
  }
  return { start: refDate, end: refDate };
};

const getPeriodLabel = (periodType, refDate) => {
  if (!refDate) return '';
  const [y, m] = refDate.split('-');
  const year = parseInt(y, 10);
  const month = parseInt(m, 10);
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  if (periodType === 'day') {
    return formatFriendlyDate(refDate);
  }
  if (periodType === 'week') {
    const range = getWeekRange(refDate);
    const [, sm, sd] = range.start.split('-');
    const [, em, ed] = range.end.split('-');
    if (sm === em) {
      return `Semana del ${parseInt(sd, 10)} al ${parseInt(ed, 10)} de ${months[parseInt(sm, 10) - 1]} de ${year}`;
    }
    return `Semana del ${parseInt(sd, 10)} de ${months[parseInt(sm, 10) - 1]} al ${parseInt(ed, 10)} de ${months[parseInt(em, 10) - 1]} de ${year}`;
  }
  if (periodType === 'month') {
    return `${months[month - 1]} de ${year}`;
  }
  if (periodType === 'year') {
    return `Año ${year}`;
  }
  return refDate;
};

const AttendancePage = () => {
  const [settings, setSettings] = useState(null);
  
  // Selector de Período de Visualización: 'day' | 'week' | 'month' | 'year'
  const [period, setPeriod] = useState('day');
  const [referenceDate, setReferenceDate] = useState(getTodayString());
  
  const [attendance, setAttendance] = useState([]);
  const [activeEvents, setActiveEvents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros principales
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Filtro interactivo por recuadros (KPI cards)
  // 'ALL' | 'ON_TIME' | 'LATE' | 'ABSENT'
  const [selectedCardFilter, setSelectedCardFilter] = useState('ALL');

  // Estado para Modal de Detalle
  // null | 'ON_TIME' | 'LATE' | 'ABSENT'
  const [detailModal, setDetailModal] = useState(null);

  // Estado para Modal de Exportación Avanzada
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Cálculo del rango activo
  const activeRange = useMemo(() => {
    return getPeriodRange(period, referenceDate);
  }, [period, referenceDate]);

  const activePeriodLabel = useMemo(() => {
    return getPeriodLabel(period, referenceDate);
  }, [period, referenceDate]);

  // Carga de datos según el rango activo
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const tenantId = localStorage.getItem('tenantId');
      const headers = {
        'Authorization': `Bearer ${token}`,
        ...(tenantId ? { 'x-tenant-id': tenantId } : {})
      };

      const { start, end } = activeRange;
      const url = `${import.meta.env.VITE_API_URL || ''}/api/v1/attendance?startDate=${start}&endDate=${end}`;

      const [attRes, empRes, setRes] = await Promise.all([
        fetch(url, { headers }),
        fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/employees`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/settings/public`, { headers }).catch(() => null)
      ]);
      
      if (!attRes.ok || !empRes.ok) {
        throw new Error('Error al obtener datos del servidor');
      }
      
      const [attData, empData] = await Promise.all([
        attRes.json(),
        empRes.json()
      ]);
      
      const setData = setRes && setRes.ok ? await setRes.json() : null;
      setSettings(setData || { workdayStartHour: 8, workdayStartMinute: 0, latenessToleranceMin: 15 });
      
      if (attData.records) {
        setAttendance(attData.records);
        setActiveEvents(attData.events || []);
      } else {
        setAttendance(attData);
        setActiveEvents([]);
      }
      setEmployees(empData);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeRange.start, activeRange.end]);

  // Procesar y fusionar datos (Registros + Faltas de días hábiles)
  const combinedRecords = useMemo(() => {
    if (!employees || employees.length === 0 || !settings) return [];
    
    const records = [];
    const recordedKeys = new Set();
    
    // 1. Procesar registros de asistencia reales del período
    attendance.forEach(record => {
      const recordDateStr = record.date 
        ? (typeof record.date === 'string' ? record.date.split('T')[0] : getLocalDateString(new Date(record.date))) 
        : referenceDate;
      const recordKey = `${record.employeeId}_${recordDateStr}`;
      recordedKeys.add(recordKey);
      
      const employee = record.employee || {};
      
      const entradaTime = record.entrada ? new Date(record.entrada).toTimeString().split(' ')[0] : null;
      const salidaTime = record.salida ? new Date(record.salida).toTimeString().split(' ')[0] : null;
      
      let puntualidad = 'A tiempo';
      if (record.isLate) puntualidad = 'Retardo';
      if (!entradaTime) puntualidad = 'Falta';
      
      let tipoStr = 'Entrada';
      if (record.entrada && !record.salida) tipoStr = 'Sin salida';
      if (record.entrada && record.salida) tipoStr = 'Entrada / Salida';

      let lateMinutes = record.lateMinutes || 0;
      if (record.isLate && !lateMinutes && record.entrada && settings) {
        const d = new Date(record.entrada);
        const mins = d.getHours() * 60 + d.getMinutes();
        const limitMins = (settings.workdayStartHour * 60) + settings.workdayStartMinute + settings.latenessToleranceMin;
        if (mins > limitMins) {
          lateMinutes = mins - limitMins;
        }
      }
      
      records.push({
        id: record.id,
        date: recordDateStr,
        employee,
        horaMarcaje: entradaTime || '—',
        horaSalida: salidaTime || '—',
        rawEntrada: record.entrada,
        rawSalida: record.salida,
        lateMinutes,
        isLate: !!record.isLate,
        isAutoClosed: record.isAutoClosed || false,
        tipo: tipoStr,
        puntualidad,
        departamento: employee.department?.name || 'Sin departamento',
        metodo: 'Facial - CAM 01',
      });
    });
    
    // 2. Determinar días hábiles a evaluar para inasistencias
    const todayStr = getTodayString();
    const effectiveEndStr = activeRange.end > todayStr ? todayStr : activeRange.end;
    
    const evalDays = [];
    if (period === 'day') {
      evalDays.push(activeRange.start);
    } else {
      const [sy, sm, sd] = activeRange.start.split('-').map(Number);
      const [ey, em, ed] = effectiveEndStr.split('-').map(Number);
      let cur = new Date(sy, sm - 1, sd);
      const endLimit = new Date(ey, em - 1, ed);
      while (cur <= endLimit) {
        const dow = cur.getDay(); // 0 Dom, 6 Sab
        if (dow >= 1 && dow <= 5) {
          evalDays.push(getLocalDateString(cur));
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    // 3. Agregar inasistencias en los días hábiles para empleados activos
    evalDays.forEach(dayStr => {
      employees.forEach(emp => {
        if (!emp.isActive) return;
        const key = `${emp.id}_${dayStr}`;
        if (recordedKeys.has(key)) return;

        // Revisar eventos justificados (vacaciones, licencias) en esa fecha
        const empEvent = activeEvents.find(e => {
          if (e.employeeId !== emp.id) return false;
          const evStart = e.date ? (typeof e.date === 'string' ? e.date.split('T')[0] : getLocalDateString(new Date(e.date))) : null;
          const evEnd = e.dateTo ? (typeof e.dateTo === 'string' ? e.dateTo.split('T')[0] : getLocalDateString(new Date(e.dateTo))) : evStart;
          return evStart && dayStr >= evStart && dayStr <= (evEnd || evStart) && (e.type === 'VACATION' || e.type === 'JUSTIFIED_ABSENCE');
        });
        
        let label = 'Falta';
        let badgeType = '—';
        if (empEvent) {
          label = empEvent.type === 'VACATION' ? 'Vacaciones' : 'Falta Justificada';
          badgeType = 'Permiso';
        }

        records.push({
          id: `falta-${emp.id}-${dayStr}`,
          date: dayStr,
          employee: emp,
          horaMarcaje: '—',
          horaSalida: '—',
          rawEntrada: null,
          rawSalida: null,
          lateMinutes: 0,
          isLate: false,
          isAutoClosed: false,
          tipo: badgeType,
          puntualidad: label,
          departamento: emp.department?.name || 'Sin departamento',
          metodo: '—',
          justificationEvent: empEvent || null
        });
      });
    });

    // Ordenar cronológicamente descendente
    return records.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.horaMarcaje || '').localeCompare(a.horaMarcaje || '');
    });
  }, [attendance, employees, settings, activeEvents, activeRange, period, referenceDate]);

  // Aplicar Filtros (Buscador, Departamento y Clic en Recuadros)
  const filteredRecords = useMemo(() => {
    return combinedRecords.filter(record => {
      const { employee } = record;
      const search = searchTerm.toLowerCase();
      
      const matchSearch = 
        employee.firstName?.toLowerCase().includes(search) ||
        employee.lastName?.toLowerCase().includes(search) ||
        employee.email?.toLowerCase().includes(search) ||
        employee.identifier?.toLowerCase().includes(search);
        
      const matchDepartment = selectedDepartment ? record.departamento === selectedDepartment : true;
      
      let matchCard = true;
      if (selectedCardFilter === 'ON_TIME') {
        matchCard = record.puntualidad === 'A tiempo';
      } else if (selectedCardFilter === 'LATE') {
        matchCard = record.puntualidad === 'Retardo';
      } else if (selectedCardFilter === 'ABSENT') {
        matchCard = record.puntualidad === 'Falta' || record.puntualidad === 'Vacaciones' || record.puntualidad === 'Falta Justificada';
      }

      return matchSearch && matchDepartment && matchCard;
    });
  }, [combinedRecords, searchTerm, selectedDepartment, selectedCardFilter]);

  // Departamentos para dropdown
  const departments = useMemo(() => {
    const deps = employees.map(emp => emp.department?.name).filter(Boolean);
    return [...new Set(deps)];
  }, [employees]);

  // Estadísticas Dinámicas del Período
  const stats = useMemo(() => {
    const activeEmployees = employees.filter(e => e.isActive);
    const totalEmployees = activeEmployees.length || 1;
    
    const aTiempoRecords = combinedRecords.filter(r => r.puntualidad === 'A tiempo');
    const aTiempoCount = aTiempoRecords.length;
    const aTiempoEnTurno = aTiempoRecords.filter(r => r.tipo === 'Sin salida').length;
    const aTiempoCompletos = aTiempoRecords.filter(r => r.tipo === 'Entrada / Salida').length;

    const retardoRecords = combinedRecords.filter(r => r.puntualidad === 'Retardo');
    const retardoCount = retardoRecords.length;
    const retardoEnTurno = retardoRecords.filter(r => r.tipo === 'Sin salida').length;
    const retardoCompletos = retardoRecords.filter(r => r.tipo === 'Entrada / Salida').length;
    
    let totalLateMins = 0;
    let lateRecordsCount = 0;
    retardoRecords.forEach(r => {
      if (r.lateMinutes && r.lateMinutes > 0) {
        totalLateMins += r.lateMinutes;
        lateRecordsCount++;
      }
    });
    const avgLateMins = lateRecordsCount > 0 ? Math.round(totalLateMins / lateRecordsCount) : 0;

    const faltasInjustificadas = combinedRecords.filter(r => r.puntualidad === 'Falta');
    const faltasJustificadas = combinedRecords.filter(r => r.puntualidad === 'Vacaciones' || r.puntualidad === 'Falta Justificada');
    const totalInasistencias = faltasInjustificadas.length + faltasJustificadas.length;

    const totalIngresos = aTiempoCount + retardoCount;
    const totalRegistrosPeriodo = combinedRecords.length;

    const puntualidadPorcentaje = totalIngresos > 0 
      ? Math.round((aTiempoCount / totalIngresos) * 100) 
      : 0;
    const retardoPorcentaje = totalIngresos > 0
      ? Math.round((retardoCount / totalIngresos) * 100)
      : 0;
    const tasaAusentismo = totalRegistrosPeriodo > 0
      ? Math.round((totalInasistencias / totalRegistrosPeriodo) * 100)
      : 0;

    let limitStr = '08:15';
    if (settings) {
      const totalMins = (settings.workdayStartHour * 60) + settings.workdayStartMinute + settings.latenessToleranceMin;
      const limitH = Math.floor(totalMins / 60) % 24;
      const limitM = totalMins % 60;
      limitStr = `${limitH.toString().padStart(2, '0')}:${limitM.toString().padStart(2, '0')}`;
    }

    return {
      totalEmployees,
      totalIngresos,
      totalRegistrosPeriodo,
      aTiempoCount,
      aTiempoEnTurno,
      aTiempoCompletos,
      puntualidadPorcentaje,
      retardoCount,
      retardoEnTurno,
      retardoCompletos,
      retardoPorcentaje,
      avgLateMins,
      limitStr,
      faltasInjustificadasCount: faltasInjustificadas.length,
      faltasJustificadasCount: faltasJustificadas.length,
      totalInasistencias,
      tasaAusentismo,
      toleranceMin: settings?.latenessToleranceMin || 15
    };
  }, [combinedRecords, employees, settings]);

  // Manejo de Navegación según el Período
  const handlePrev = () => {
    const [y, m, dNum] = referenceDate.split('-').map(Number);
    const d = new Date(y, m - 1, dNum);
    if (period === 'day') d.setDate(d.getDate() - 1);
    else if (period === 'week') d.setDate(d.getDate() - 7);
    else if (period === 'month') d.setMonth(d.getMonth() - 1);
    else if (period === 'year') d.setFullYear(d.getFullYear() - 1);
    setReferenceDate(getLocalDateString(d));
  };

  const handleNext = () => {
    const [y, m, dNum] = referenceDate.split('-').map(Number);
    const d = new Date(y, m - 1, dNum);
    if (period === 'day') d.setDate(d.getDate() + 1);
    else if (period === 'week') d.setDate(d.getDate() + 7);
    else if (period === 'month') d.setMonth(d.getMonth() + 1);
    else if (period === 'year') d.setFullYear(d.getFullYear() + 1);
    setReferenceDate(getLocalDateString(d));
  };

  const handleQuickReturn = () => {
    setReferenceDate(getTodayString());
  };

  // Exportar a CSV con BOM UTF-8
  const exportToCSV = (customRecords = null, customName = null) => {
    const listToExport = customRecords || filteredRecords;
    if (listToExport.length === 0) return;
    
    const headers = [
      'Fecha',
      'Empleado',
      'Correo / ID',
      'Departamento',
      'Puntualidad',
      'Hora Entrada',
      'Minutos Retardo',
      'Hora Salida',
      'Tipo Marcaje',
      'Método'
    ];
    const rows = listToExport.map(r => [
      r.date || referenceDate,
      `${r.employee.firstName || ''} ${r.employee.lastName || ''}`.trim(),
      r.employee.email || r.employee.identifier || '—',
      r.departamento,
      r.puntualidad,
      r.horaMarcaje,
      r.lateMinutes ? `+${r.lateMinutes} min` : '0',
      r.horaSalida,
      r.tipo,
      r.metodo
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(str => `"${String(str).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    const filterSuffix = selectedCardFilter !== 'ALL' ? `_${selectedCardFilter.toLowerCase()}` : '';
    const periodSuffix = `_${period}_${activeRange.start}_${activeRange.end}`;
    a.download = customName || `Reporte_Asistencia${periodSuffix}${filterSuffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fade-in" style={{ paddingBottom: '2rem' }}>
      
      {/* Header con Controles de Período y Fechas */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: '#fff', margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>Registro de Asistencia</h2>
          <p style={{ color: '#a1a1aa', margin: '0.4rem 0 0 0', fontSize: '0.95rem' }}>
            {period === 'day' 
              ? `Monitoreo en tiempo real de ingresos, tolerancias y estatus del personal para el ${activePeriodLabel}.`
              : `Consolidado de asistencia para: ${activePeriodLabel}.`}
          </p>
        </div>
        
        {/* Controles de Vista de Período & Fechas */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* Selector de Período (Pills: Día / Semana / Mes / Año) */}
          <div style={{ 
            display: 'flex', 
            background: '#18181b', 
            border: '1px solid #3f3f46', 
            borderRadius: '10px', 
            padding: '3px', 
            gap: '3px' 
          }}>
            {[
              { id: 'day', label: 'Día' },
              { id: 'week', label: 'Semana' },
              { id: 'month', label: 'Mes' },
              { id: 'year', label: 'Año' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                style={{
                  background: period === p.id ? 'var(--primary-orange, #f97316)' : 'transparent',
                  color: period === p.id ? '#fff' : '#a1a1aa',
                  border: 'none',
                  borderRadius: '7px',
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.82rem',
                  fontWeight: period === p.id ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Navegador de Fechas según el Período Activo */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#18181b', border: '1px solid #3f3f46', borderRadius: '10px', overflow: 'hidden' }}>
            <button 
              type="button" 
              onClick={handlePrev} 
              style={{ background: 'transparent', border: 'none', color: '#a1a1aa', padding: '0.65rem 0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title={`Retroceder ${period === 'day' ? 'un día' : period === 'week' ? 'una semana' : period === 'month' ? 'un mes' : 'un año'}`}
            >
              <ChevronLeft size={16} />
            </button>
            
            {period === 'day' ? (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Calendar size={15} style={{ position: 'absolute', left: '0.65rem', color: '#f97316', pointerEvents: 'none' }} />
                <input 
                  type="date" 
                  value={referenceDate}
                  onChange={(e) => setReferenceDate(e.target.value)}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: '#fff', 
                    padding: '0.65rem 0.75rem 0.65rem 2.2rem', 
                    fontSize: '0.88rem', 
                    outline: 'none', 
                    cursor: 'pointer' 
                  }}
                />
              </div>
            ) : (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                padding: '0.65rem 0.95rem', 
                fontSize: '0.86rem', 
                color: '#fff', 
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}>
                {period === 'week' ? <CalendarDays size={15} color="#f97316" /> : <Calendar size={15} color="#f97316" />}
                {activePeriodLabel}
              </div>
            )}

            <button 
              type="button" 
              onClick={handleNext} 
              style={{ background: 'transparent', border: 'none', color: '#a1a1aa', padding: '0.65rem 0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title={`Avanzar ${period === 'day' ? 'un día' : period === 'week' ? 'una semana' : period === 'month' ? 'un mes' : 'un año'}`}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Botón Rápido de Retorno al Período Actual */}
          {referenceDate !== getTodayString() && (
            <button
              onClick={handleQuickReturn}
              style={{
                background: 'rgba(249, 115, 22, 0.12)',
                border: '1px solid rgba(249, 115, 22, 0.35)',
                color: '#f97316',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title="Volver a la fecha de hoy"
            >
              {period === 'day' ? 'Hoy' : period === 'week' ? 'Esta semana' : period === 'month' ? 'Este mes' : 'Este año'}
            </button>
          )}
          
          {/* Botón Principal para Exportar Reporte */}
          <button 
            onClick={() => setIsExportModalOpen(true)}
            disabled={loading}
            style={{ 
              ...btnPrimary, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              padding: '0.65rem 1.25rem', 
              fontSize: '0.88rem',
              boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)'
            }}
          >
            <Download size={16} /> Exportar Reporte
          </button>
        </div>
      </div>

      {/* Recuadros KPI Interactivos y Enriquecidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        
        {/* Recuadro 1: Asistencias a Tiempo */}
        <div 
          className="card card-glow-green" 
          onClick={() => setSelectedCardFilter(prev => prev === 'ON_TIME' ? 'ALL' : 'ON_TIME')}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between', 
            minHeight: '210px', 
            padding: '1.5rem',
            cursor: 'pointer',
            borderRadius: '16px',
            position: 'relative',
            border: selectedCardFilter === 'ON_TIME' ? '2px solid #10b981' : '1px solid rgba(16, 185, 129, 0.25)',
            boxShadow: selectedCardFilter === 'ON_TIME' 
              ? '0 0 20px rgba(16, 185, 129, 0.28), inset 0 0 15px rgba(16, 185, 129, 0.05)' 
              : '0 4px 20px rgba(0, 0, 0, 0.2)',
            transform: selectedCardFilter === 'ON_TIME' ? 'translateY(-2px)' : 'none',
            transition: 'all 0.25s ease'
          }}
          title="Clic para filtrar únicamente Asistencias a Tiempo en la tabla"
        >
          {/* Header del recuadro */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#a1a1aa', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  Asistencias a Tiempo
                </span>
                {selectedCardFilter === 'ON_TIME' && (
                  <span style={{ 
                    background: 'rgba(16, 185, 129, 0.2)', 
                    color: '#10b981', 
                    fontSize: '0.68rem', 
                    fontWeight: 700, 
                    padding: '2px 7px', 
                    borderRadius: '10px',
                    border: '1px solid rgba(16, 185, 129, 0.4)' 
                  }}>
                    ● ACTIVO
                  </span>
                )}
              </div>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#71717a' }}>
                {period === 'day' ? 'Entradas registradas dentro de la tolerancia' : `Ingresos puntuales del período (${period})`}
              </p>
            </div>
            
            <div className="icon-box" style={{ 
              backgroundColor: 'rgba(16, 185, 129, 0.12)', 
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CheckCircle2 size={20} style={{ color: '#10b981' }} />
            </div>
          </div>

          {/* Métrica principal + Badge de Porcentaje */}
          <div style={{ margin: '0.75rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
              {loading ? (
                <Skeleton height="2.5rem" width="70px" />
              ) : (
                <h2 style={{ fontSize: '2.5rem', color: '#10b981', lineHeight: '1', margin: 0, fontWeight: 700 }}>
                  {stats.aTiempoCount}
                </h2>
              )}
              {!loading && (
                <span style={{ 
                  background: 'rgba(16, 185, 129, 0.15)', 
                  color: '#34d399', 
                  fontSize: '0.75rem', 
                  fontWeight: 600, 
                  padding: '3px 9px', 
                  borderRadius: '12px',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}>
                  {stats.puntualidadPorcentaje}% puntualidad
                </span>
              )}
            </div>

            {/* Barra de progreso sutil */}
            <div style={{ marginTop: '0.6rem', width: '100%', height: '5px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ 
                width: `${Math.min(stats.puntualidadPorcentaje, 100)}%`, 
                height: '100%', 
                background: '#10b981', 
                borderRadius: '3px', 
                transition: 'width 0.5s ease' 
              }} />
            </div>

            {/* Micro-datos contextuales */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.65rem', flexWrap: 'wrap', fontSize: '0.76rem' }}>
              {period === 'day' ? (
                <>
                  <span style={{ color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                    <strong style={{ color: '#e4e4e7' }}>{stats.aTiempoEnTurno}</strong> en turno activo
                  </span>
                  <span style={{ color: '#52525b' }}>•</span>
                  <span style={{ color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <strong style={{ color: '#e4e4e7' }}>{stats.aTiempoCompletos}</strong> jornada completa
                  </span>
                </>
              ) : (
                <>
                  <span style={{ color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                    <strong style={{ color: '#e4e4e7' }}>{stats.aTiempoCount}</strong> ingresos a tiempo
                  </span>
                  <span style={{ color: '#52525b' }}>•</span>
                  <span style={{ color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    de <strong style={{ color: '#e4e4e7' }}>{stats.totalIngresos}</strong> asistencias totales
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Footer de acción */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            paddingTop: '0.75rem', 
            borderTop: '1px solid rgba(255, 255, 255, 0.06)' 
          }}>
            <span style={{ fontSize: '0.75rem', color: selectedCardFilter === 'ON_TIME' ? '#34d399' : '#71717a', fontWeight: selectedCardFilter === 'ON_TIME' ? 600 : 400 }}>
              {selectedCardFilter === 'ON_TIME' ? 'Filtro aplicado en tabla' : 'Clic para filtrar en tabla'}
            </span>

            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDetailModal('ON_TIME');
              }}
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34d399',
                borderRadius: '6px',
                padding: '0.3rem 0.65rem',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.2s'
              }}
              title="Ver desglose detallado de colaboradores a tiempo"
            >
              <Eye size={13} /> Ver desglose
            </button>
          </div>
        </div>

        {/* Recuadro 2: Retardos Registrados */}
        <div 
          className="card card-glow" 
          onClick={() => setSelectedCardFilter(prev => prev === 'LATE' ? 'ALL' : 'LATE')}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between', 
            minHeight: '210px', 
            padding: '1.5rem',
            cursor: 'pointer',
            borderRadius: '16px',
            position: 'relative',
            border: selectedCardFilter === 'LATE' ? '2px solid #f97316' : '1px solid rgba(249, 115, 22, 0.25)',
            boxShadow: selectedCardFilter === 'LATE' 
              ? '0 0 20px rgba(249, 115, 22, 0.28), inset 0 0 15px rgba(249, 115, 22, 0.05)' 
              : '0 4px 20px rgba(0, 0, 0, 0.2)',
            transform: selectedCardFilter === 'LATE' ? 'translateY(-2px)' : 'none',
            transition: 'all 0.25s ease'
          }}
          title="Clic para filtrar únicamente Retardos Registrados en la tabla"
        >
          {/* Header del recuadro */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#a1a1aa', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  Retardos Registrados
                </span>
                {selectedCardFilter === 'LATE' && (
                  <span style={{ 
                    background: 'rgba(249, 115, 22, 0.2)', 
                    color: '#f97316', 
                    fontSize: '0.68rem', 
                    fontWeight: 700, 
                    padding: '2px 7px', 
                    borderRadius: '10px',
                    border: '1px solid rgba(249, 115, 22, 0.4)' 
                  }}>
                    ● ACTIVO
                  </span>
                )}
              </div>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#71717a' }}>
                {period === 'day' ? `Ingresos posteriores al límite de las ${stats.limitStr}` : `Retardos acumulados en el período (${period})`}
              </p>
            </div>
            
            <div className="icon-box" style={{ 
              backgroundColor: 'rgba(249, 115, 22, 0.12)', 
              border: '1px solid rgba(249, 115, 22, 0.3)',
              borderRadius: '12px',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Clock size={20} style={{ color: '#f97316' }} />
            </div>
          </div>

          {/* Métrica principal + Badge */}
          <div style={{ margin: '0.75rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
              {loading ? (
                <Skeleton height="2.5rem" width="70px" />
              ) : (
                <h2 style={{ fontSize: '2.5rem', color: '#f97316', lineHeight: '1', margin: 0, fontWeight: 700 }}>
                  {stats.retardoCount}
                </h2>
              )}
              {!loading && (
                <span style={{ 
                  background: 'rgba(249, 115, 22, 0.15)', 
                  color: '#fb923c', 
                  fontSize: '0.75rem', 
                  fontWeight: 600, 
                  padding: '3px 9px', 
                  borderRadius: '12px',
                  border: '1px solid rgba(249, 115, 22, 0.3)'
                }}>
                  {stats.retardoPorcentaje}% de los ingresos
                </span>
              )}
            </div>

            {/* Barra de proporción */}
            <div style={{ marginTop: '0.6rem', width: '100%', height: '5px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ 
                width: `${Math.min(stats.retardoPorcentaje, 100)}%`, 
                height: '100%', 
                background: '#f97316', 
                borderRadius: '3px', 
                transition: 'width 0.5s ease' 
              }} />
            </div>

            {/* Micro-datos contextuales */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.65rem', flexWrap: 'wrap', fontSize: '0.76rem' }}>
              <span style={{ color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f97316' }}></span>
                <strong style={{ color: '#e4e4e7' }}>{stats.avgLateMins > 0 ? `+${stats.avgLateMins} min` : `${stats.toleranceMin}m tol.`}</strong> promedio
              </span>
              <span style={{ color: '#52525b' }}>•</span>
              <span style={{ color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <strong style={{ color: '#e4e4e7' }}>{stats.retardoCount}</strong> retrasos en el período
              </span>
            </div>
          </div>

          {/* Footer de acción */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            paddingTop: '0.75rem', 
            borderTop: '1px solid rgba(255, 255, 255, 0.06)' 
          }}>
            <span style={{ fontSize: '0.75rem', color: selectedCardFilter === 'LATE' ? '#fb923c' : '#71717a', fontWeight: selectedCardFilter === 'LATE' ? 600 : 400 }}>
              {selectedCardFilter === 'LATE' ? 'Filtro aplicado en tabla' : 'Clic para filtrar en tabla'}
            </span>

            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDetailModal('LATE');
              }}
              style={{
                background: 'rgba(249, 115, 22, 0.1)',
                border: '1px solid rgba(249, 115, 22, 0.3)',
                color: '#fb923c',
                borderRadius: '6px',
                padding: '0.3rem 0.65rem',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.2s'
              }}
              title="Ver desglose detallado de retardos"
            >
              <Eye size={13} /> Ver desglose
            </button>
          </div>
        </div>

        {/* Recuadro 3: Ausencias / Faltas */}
        <div 
          className="card card-glow-red" 
          onClick={() => setSelectedCardFilter(prev => prev === 'ABSENT' ? 'ALL' : 'ABSENT')}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between', 
            minHeight: '210px', 
            padding: '1.5rem',
            cursor: 'pointer',
            borderRadius: '16px',
            position: 'relative',
            border: selectedCardFilter === 'ABSENT' ? '2px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.25)',
            boxShadow: selectedCardFilter === 'ABSENT' 
              ? '0 0 20px rgba(239, 68, 68, 0.28), inset 0 0 15px rgba(239, 68, 68, 0.05)' 
              : '0 4px 20px rgba(0, 0, 0, 0.2)',
            transform: selectedCardFilter === 'ABSENT' ? 'translateY(-2px)' : 'none',
            transition: 'all 0.25s ease'
          }}
          title="Clic para filtrar únicamente Ausencias y Faltas en la tabla"
        >
          {/* Header del recuadro */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#ef4444', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  Ausencias / Faltas
                </span>
                {selectedCardFilter === 'ABSENT' && (
                  <span style={{ 
                    background: 'rgba(239, 68, 68, 0.2)', 
                    color: '#ef4444', 
                    fontSize: '0.68rem', 
                    fontWeight: 700, 
                    padding: '2px 7px', 
                    borderRadius: '10px',
                    border: '1px solid rgba(239, 68, 68, 0.4)' 
                  }}>
                    ● ACTIVO
                  </span>
                )}
              </div>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#71717a' }}>
                {period === 'day' ? 'Colaboradores sin registro o con justificación hoy' : `Inasistencias en días laborables (${period})`}
              </p>
            </div>
            
            <div className="icon-box" style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.12)', 
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AlertTriangle size={20} style={{ color: '#ef4444' }} />
            </div>
          </div>

          {/* Métrica principal + Badge */}
          <div style={{ margin: '0.75rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
              {loading ? (
                <Skeleton height="2.5rem" width="70px" />
              ) : (
                <h2 style={{ fontSize: '2.5rem', color: '#ef4444', lineHeight: '1', margin: 0, fontWeight: 700 }}>
                  {stats.totalInasistencias}
                </h2>
              )}
              {!loading && (
                <span style={{ 
                  background: 'rgba(239, 68, 68, 0.15)', 
                  color: '#f87171', 
                  fontSize: '0.75rem', 
                  fontWeight: 600, 
                  padding: '3px 9px', 
                  borderRadius: '12px',
                  border: '1px solid rgba(239, 68, 68, 0.3)'
                }}>
                  {stats.tasaAusentismo}% ausentismo
                </span>
              )}
            </div>

            {/* Barra de proporción */}
            <div style={{ marginTop: '0.6rem', width: '100%', height: '5px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ 
                width: `${Math.min(stats.tasaAusentismo, 100)}%`, 
                height: '100%', 
                background: '#ef4444', 
                borderRadius: '3px', 
                transition: 'width 0.5s ease' 
              }} />
            </div>

            {/* Micro-datos contextuales */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.65rem', flexWrap: 'wrap', fontSize: '0.76rem' }}>
              <span style={{ color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }}></span>
                <strong style={{ color: '#fca5a5' }}>{stats.faltasInjustificadasCount}</strong> injustificadas
              </span>
              <span style={{ color: '#52525b' }}>•</span>
              <span style={{ color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <strong style={{ color: '#93c5fd' }}>{stats.faltasJustificadasCount}</strong> justificadas / vac.
              </span>
            </div>
          </div>

          {/* Footer de acción */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            paddingTop: '0.75rem', 
            borderTop: '1px solid rgba(255, 255, 255, 0.06)' 
          }}>
            <span style={{ fontSize: '0.75rem', color: selectedCardFilter === 'ABSENT' ? '#f87171' : '#71717a', fontWeight: selectedCardFilter === 'ABSENT' ? 600 : 400 }}>
              {selectedCardFilter === 'ABSENT' ? 'Filtro aplicado en tabla' : 'Clic para filtrar en tabla'}
            </span>

            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDetailModal('ABSENT');
              }}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                borderRadius: '6px',
                padding: '0.3rem 0.65rem',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.2s'
              }}
              title="Ver desglose detallado de inasistencias y permisos"
            >
              <Eye size={13} /> Ver desglose
            </button>
          </div>
        </div>

      </div>

      {/* Banner de Filtro Activo por Tarjeta */}
      {selectedCardFilter !== 'ALL' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.25rem',
          background: selectedCardFilter === 'ON_TIME' 
            ? 'rgba(16, 185, 129, 0.08)' 
            : selectedCardFilter === 'LATE' 
              ? 'rgba(249, 115, 22, 0.08)' 
              : 'rgba(239, 68, 68, 0.08)',
          border: `1px solid ${
            selectedCardFilter === 'ON_TIME' 
              ? 'rgba(16, 185, 129, 0.35)' 
              : selectedCardFilter === 'LATE' 
                ? 'rgba(249, 115, 22, 0.35)' 
                : 'rgba(239, 68, 68, 0.35)'
          }`,
          borderRadius: '12px',
          marginBottom: '1.25rem',
          color: '#fff',
          fontSize: '0.88rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: selectedCardFilter === 'ON_TIME' ? '#10b981' : selectedCardFilter === 'LATE' ? '#f97316' : '#ef4444',
              color: '#000',
              fontWeight: 800,
              fontSize: '0.75rem'
            }}>
              {selectedCardFilter === 'ON_TIME' ? '✓' : selectedCardFilter === 'LATE' ? '!' : '✕'}
            </span>
            <span>
              Filtrando la vista por: <strong style={{ color: selectedCardFilter === 'ON_TIME' ? '#10b981' : selectedCardFilter === 'LATE' ? '#f97316' : '#ef4444' }}>
                {selectedCardFilter === 'ON_TIME' ? 'Asistencias a Tiempo' : selectedCardFilter === 'LATE' ? 'Retardos Registrados' : 'Ausencias / Faltas'}
              </strong> ({filteredRecords.length} registros en el período)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setDetailModal(selectedCardFilter)}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#e4e4e7',
                borderRadius: '8px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.2s'
              }}
            >
              <Eye size={13} /> Ver Desglose
            </button>
            <button
              onClick={() => setSelectedCardFilter('ALL')}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                borderRadius: '8px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.2s'
              }}
            >
              <X size={14} /> Quitar Filtro (Ver Todos)
            </button>
          </div>
        </div>
      )}

      {/* Barra de Búsqueda & Filtro por Departamento */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '280px', maxWidth: '450px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa' }} />
          <input 
            type="text" 
            placeholder="Buscar por nombre, correo o identificador..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.5rem' }}
          />
        </div>
        
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            style={{ 
              ...btnSecondary, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              borderColor: selectedDepartment ? '#f97316' : '#3f3f46',
              color: selectedDepartment ? '#f97316' : '#e4e4e7'
            }}
          >
            <Filter size={18} /> 
            {selectedDepartment ? `Depto: ${selectedDepartment}` : 'Filtrar por Departamento'}
          </button>
          
          {isFilterOpen && (
            <div style={dropdownMenu}>
              <div 
                style={{ ...dropdownItem, fontWeight: !selectedDepartment ? 600 : 400, color: !selectedDepartment ? '#f97316' : '#e4e4e7' }} 
                onClick={() => { setSelectedDepartment(''); setIsFilterOpen(false); }}
              >
                Todos los departamentos
              </div>
              {departments.map(dep => (
                <div 
                  key={dep} 
                  style={{ ...dropdownItem, fontWeight: selectedDepartment === dep ? 600 : 400, color: selectedDepartment === dep ? '#f97316' : '#e4e4e7' }}
                  onClick={() => { setSelectedDepartment(dep); setIsFilterOpen(false); }}
                >
                  {dep}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumen de conteo */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', color: '#a1a1aa', fontSize: '0.85rem' }}>
          Mostrando <strong style={{ color: '#fff', margin: '0 4px' }}>{filteredRecords.length}</strong> de {combinedRecords.length} registros en el período
        </div>
      </div>

      {/* Estados & Tabla de Registros */}
      {error ? (
        <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'center' }}>
          <AlertCircle size={40} style={{ margin: '0 auto 1rem auto', opacity: 0.8 }} />
          <h3 style={{ margin: '0 0 0.5rem 0' }}>Error al cargar registros</h3>
          <p style={{ margin: '0 0 1.5rem 0', color: '#fca5a5' }}>{error}</p>
          <button onClick={fetchData} style={{ ...btnPrimary, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={16} /> Reintentar
          </button>
        </div>
      ) : loading ? (
        <div style={{ background: '#1e1e1e', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
          <div className="table-responsive-wrapper">
            <table style={tableStyle}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333' }}>
                  {period !== 'day' && <th style={thStyle}>Fecha</th>}
                  <th style={thStyle}>Empleado</th>
                  <th style={thStyle}>Hora de Entrada</th>
                  <th style={thStyle}>Hora de Salida</th>
                  <th style={thStyle}>Tipo</th>
                  <th style={thStyle}>Puntualidad</th>
                  <th style={thStyle}>Departamento</th>
                  <th style={thStyle}>Método / Cámara</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map(i => (
                  <tr key={i} style={{ borderBottom: '1px solid #333' }}>
                    {period !== 'day' && <td style={tdStyle}><Skeleton height="20px" width="75px" /></td>}
                    <td style={tdStyle}><Skeleton height="40px" width="160px" /></td>
                    <td style={tdStyle}><Skeleton height="20px" width="80px" /></td>
                    <td style={tdStyle}><Skeleton height="20px" width="80px" /></td>
                    <td style={tdStyle}><Skeleton height="20px" width="70px" /></td>
                    <td style={tdStyle}><Skeleton height="24px" width="75px" borderRadius="12px" /></td>
                    <td style={tdStyle}><Skeleton height="20px" width="100px" /></td>
                    <td style={tdStyle}><Skeleton height="20px" width="110px" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ background: '#1e1e1e', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
          <div className="table-responsive-wrapper">
            <table style={tableStyle}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333', background: '#18181b' }}>
                {period !== 'day' && <th style={thStyle}>Fecha</th>}
                <th style={thStyle}>Empleado</th>
                <th style={thStyle}>Hora de Entrada</th>
                <th style={thStyle}>Hora de Salida</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Puntualidad</th>
                <th style={thStyle}>Departamento</th>
                <th style={thStyle}>Método / Cámara</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={period !== 'day' ? 8 : 7} style={{ padding: '3.5rem', textAlign: 'center', color: '#a1a1aa' }}>
                    <UserX size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.5, display: 'block' }} />
                    <p style={{ margin: 0, fontWeight: 500 }}>No se encontraron registros para este período o filtros.</p>
                    {selectedCardFilter !== 'ALL' && (
                      <button 
                        onClick={() => setSelectedCardFilter('ALL')}
                        style={{ marginTop: '1rem', background: 'transparent', border: '1px solid #3f3f46', color: '#f97316', padding: '0.4rem 0.9rem', borderRadius: '6px', fontSize: '0.82rem', cursor: 'pointer' }}
                      >
                        Limpiar filtro de recuadro
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const getInitials = (f, l) => `${(f||'').charAt(0)}${(l||'').charAt(0)}`.toUpperCase();
                  
                  // Colores de Puntualidad
                  let badgeColor = '#10b981';
                  let badgeBg = 'rgba(16, 185, 129, 0.12)';
                  let borderBadge = 'rgba(16, 185, 129, 0.3)';
                  if (record.puntualidad === 'Retardo') {
                    badgeColor = '#f97316';
                    badgeBg = 'rgba(249, 115, 22, 0.12)';
                    borderBadge = 'rgba(249, 115, 22, 0.3)';
                  } else if (record.puntualidad === 'Falta') {
                    badgeColor = '#ef4444';
                    badgeBg = 'rgba(239, 68, 68, 0.12)';
                    borderBadge = 'rgba(239, 68, 68, 0.3)';
                  } else if (record.puntualidad === 'Vacaciones' || record.puntualidad === 'Falta Justificada') {
                    badgeColor = '#3b82f6';
                    badgeBg = 'rgba(59, 130, 246, 0.12)';
                    borderBadge = 'rgba(59, 130, 246, 0.3)';
                  }

                  // Colores de Tipo
                  let tipoColor = '#e4e4e7';
                  if (record.tipo === 'Sin salida') tipoColor = '#f97316';
                  if (record.tipo === '—') tipoColor = '#71717a';

                  return (
                    <tr key={record.id} style={{ borderBottom: '1px solid #27272a', transition: 'background-color 0.2s' }} className="table-row-hover">
                      {/* Columna de Fecha cuando no es vista Día */}
                      {period !== 'day' && (
                        <td style={{ ...tdStyle, color: '#f97316', fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                          {formatShortDate(record.date)}
                        </td>
                      )}

                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <div style={{ 
                            width: '38px', 
                            height: '38px', 
                            borderRadius: '50%', 
                            background: record.puntualidad === 'A tiempo' ? 'rgba(16, 185, 129, 0.15)' : record.puntualidad === 'Retardo' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(239, 68, 68, 0.15)', 
                            color: record.puntualidad === 'A tiempo' ? '#10b981' : record.puntualidad === 'Retardo' ? '#f97316' : '#ef4444', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            border: `1px solid ${record.puntualidad === 'A tiempo' ? 'rgba(16, 185, 129, 0.3)' : record.puntualidad === 'Retardo' ? 'rgba(249, 115, 22, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                          }}>
                            {getInitials(record.employee.firstName, record.employee.lastName)}
                          </div>
                          <div>
                            <div style={{ color: '#fff', fontWeight: 600 }}>{record.employee.firstName} {record.employee.lastName}</div>
                            <div style={{ color: '#a1a1aa', fontSize: '0.78rem' }}>{record.employee.email || record.employee.identifier}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, color: record.horaMarcaje !== '—' ? '#e4e4e7' : '#71717a' }}>
                        {record.horaMarcaje !== '—' && <Clock size={13} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle', color: '#a1a1aa' }}/>}
                        {record.horaMarcaje}
                        {record.lateMinutes > 0 && (
                          <span style={{ 
                            marginLeft: '6px', 
                            background: 'rgba(249, 115, 22, 0.15)', 
                            color: '#f97316', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontSize: '0.72rem', 
                            fontWeight: 600 
                          }}>
                            +{record.lateMinutes}m
                          </span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, color: record.horaSalida !== '—' ? '#e4e4e7' : '#71717a' }}>
                        {record.horaSalida !== '—' && <Clock size={13} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle', color: '#a1a1aa' }}/>}
                        {record.horaSalida}
                        {record.isAutoClosed && (
                          <span title="Cierre automático por el sistema" style={{ marginLeft: '6px', color: '#f97316' }}>
                            <AlertCircle size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
                          </span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, color: tipoColor, fontWeight: record.tipo === 'Sin salida' ? 600 : 'normal' }}>
                        {record.tipo}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ 
                          padding: '0.3rem 0.75rem', 
                          background: badgeBg, 
                          color: badgeColor, 
                          borderRadius: '999px', 
                          fontSize: '0.75rem', 
                          fontWeight: 600, 
                          border: `1px solid ${borderBadge}`,
                          display: 'inline-block'
                        }}>
                          {record.puntualidad}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ color: '#e4e4e7', fontSize: '0.85rem' }}>{record.departamento}</div>
                      </td>
                      <td style={{ ...tdStyle, color: '#a1a1aa', fontSize: '0.82rem' }}>
                        {record.metodo}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Modal de Detalle Enriquecido para Cada Recuadro */}
      {detailModal && (
        <AttendanceDetailModal
          type={detailModal}
          records={combinedRecords}
          stats={stats}
          period={period}
          activePeriodLabel={activePeriodLabel}
          onClose={() => setDetailModal(null)}
          onApplyFilter={(type) => {
            setSelectedCardFilter(type);
            setDetailModal(null);
          }}
          onExportGroup={(recordsToExport, name) => exportToCSV(recordsToExport, name)}
        />
      )}

      {/* Modal de Exportación Avanzada por Día, Semana, Mes, Año o Rango */}
      {isExportModalOpen && (
        <AttendanceExportModal
          currentPeriod={period}
          currentRange={activeRange}
          currentPeriodLabel={activePeriodLabel}
          currentFilteredRecords={filteredRecords}
          departments={departments}
          onClose={() => setIsExportModalOpen(false)}
          onDirectExport={() => {
            exportToCSV();
            setIsExportModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

// --- Modal de Detalle Estilizado ---
const AttendanceDetailModal = ({
  type,
  records = [],
  stats,
  period,
  activePeriodLabel,
  onClose,
  onApplyFilter,
  onExportGroup
}) => {
  const [modalSearch, setModalSearch] = useState('');

  const modalRecords = useMemo(() => {
    if (type === 'ON_TIME') {
      return records.filter(r => r.puntualidad === 'A tiempo');
    }
    if (type === 'LATE') {
      return records.filter(r => r.puntualidad === 'Retardo');
    }
    if (type === 'ABSENT') {
      return records.filter(r => r.puntualidad === 'Falta' || r.puntualidad === 'Vacaciones' || r.puntualidad === 'Falta Justificada');
    }
    return [];
  }, [type, records]);

  const filteredModalRecords = useMemo(() => {
    const q = modalSearch.toLowerCase().trim();
    if (!q) return modalRecords;
    return modalRecords.filter(r => {
      const emp = r.employee || {};
      const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const identifier = (emp.identifier || '').toLowerCase();
      const dept = (r.departamento || '').toLowerCase();
      const date = (r.date || '').toLowerCase();
      return fullName.includes(q) || email.includes(q) || identifier.includes(q) || dept.includes(q) || date.includes(q);
    });
  }, [modalRecords, modalSearch]);

  const deptBreakdown = useMemo(() => {
    const map = {};
    modalRecords.forEach(r => {
      const d = r.departamento || 'Sin departamento';
      map[d] = (map[d] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [modalRecords]);

  const config = {
    ON_TIME: {
      title: 'Detalle: Asistencias a Tiempo',
      subtitle: `${modalRecords.length} registros dentro de tolerancia en el período`,
      color: '#10b981',
      colorBg: 'rgba(16, 185, 129, 0.12)',
      colorBorder: 'rgba(16, 185, 129, 0.35)',
      Icon: CheckCircle2,
      badge: `${stats.puntualidadPorcentaje}% de los ingresos`,
      metricLabel1: 'Total Puntuales',
      metricVal1: stats.aTiempoCount,
      metricLabel2: 'Jornada Completa',
      metricVal2: stats.aTiempoCompletos
    },
    LATE: {
      title: 'Detalle: Retardos Registrados',
      subtitle: `${modalRecords.length} registros posteriores a la tolerancia`,
      color: '#f97316',
      colorBg: 'rgba(249, 115, 22, 0.12)',
      colorBorder: 'rgba(249, 115, 22, 0.35)',
      Icon: Clock,
      badge: `${stats.retardoPorcentaje}% de los ingresos`,
      metricLabel1: 'Promedio de Retardo',
      metricVal1: stats.avgLateMins > 0 ? `+${stats.avgLateMins}m` : '—',
      metricLabel2: 'Retardos Totales',
      metricVal2: stats.retardoCount
    },
    ABSENT: {
      title: 'Detalle: Ausencias y Faltas',
      subtitle: `${modalRecords.length} inasistencias detectadas en días laborables`,
      color: '#ef4444',
      colorBg: 'rgba(239, 68, 68, 0.12)',
      colorBorder: 'rgba(239, 68, 68, 0.35)',
      Icon: AlertTriangle,
      badge: `${stats.tasaAusentismo}% tasa ausentismo`,
      metricLabel1: 'Faltas Injustificadas',
      metricVal1: stats.faltasInjustificadasCount,
      metricLabel2: 'Permisos / Vacaciones',
      metricVal2: stats.faltasJustificadasCount
    }
  }[type] || {};

  const IconComponent = config.Icon || AlertCircle;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div 
        className="modal-content page-glow fade-in-up" 
        onClick={e => e.stopPropagation()} 
        style={{
          maxWidth: '680px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.75rem',
          borderRadius: '20px',
          border: `1px solid ${config.colorBorder}`,
          boxShadow: `0 20px 50px rgba(0,0,0,0.8), 0 0 30px ${config.colorBg}`,
          background: '#18181b',
          overflow: 'hidden'
        }}
      >
        {/* Header Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              backgroundColor: config.colorBg,
              border: `1px solid ${config.colorBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: config.color
            }}>
              <IconComponent size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', fontWeight: 700 }}>
                  {config.title}
                </h3>
                <span style={{ 
                  background: config.colorBg, 
                  color: config.color, 
                  border: `1px solid ${config.colorBorder}`,
                  fontSize: '0.72rem', 
                  fontWeight: 600, 
                  padding: '2px 8px', 
                  borderRadius: '10px' 
                }}>
                  {config.badge}
                </span>
              </div>
              <p style={{ margin: '0.3rem 0 0 0', color: '#a1a1aa', fontSize: '0.82rem' }}>
                {config.subtitle} • <span style={{ color: '#e4e4e7' }}>{activePeriodLabel}</span>
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              padding: '0.25rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Resumen KPIs Rápidos dentro del Modal */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
          gap: '0.75rem', 
          marginBottom: '1.25rem' 
        }}>
          <div style={{ background: '#27272a', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #3f3f46' }}>
            <span style={{ color: '#a1a1aa', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Registros</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: config.color, marginTop: '0.2rem' }}>{modalRecords.length}</div>
          </div>
          <div style={{ background: '#27272a', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #3f3f46' }}>
            <span style={{ color: '#a1a1aa', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>{config.metricLabel1}</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginTop: '0.2rem' }}>{config.metricVal1}</div>
          </div>
          <div style={{ background: '#27272a', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #3f3f46' }}>
            <span style={{ color: '#a1a1aa', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>{config.metricLabel2}</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginTop: '0.2rem' }}>{config.metricVal2}</div>
          </div>
        </div>

        {/* Distribución por Departamento */}
        {deptBreakdown.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <span style={{ color: '#a1a1aa', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
              Departamentos Afectados ({deptBreakdown.length}):
            </span>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {deptBreakdown.map(([dept, count]) => (
                <span 
                  key={dept}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#e4e4e7',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.74rem'
                  }}
                >
                  <Building2 size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', color: '#a1a1aa' }} />
                  {dept}: <strong style={{ color: config.color }}>{count}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Buscador interno */}
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa' }} />
          <input 
            type="text" 
            placeholder="Buscar por colaborador, depto o fecha..." 
            value={modalSearch}
            onChange={(e) => setModalSearch(e.target.value)}
            style={{ 
              width: '100%', 
              background: '#121212', 
              border: '1px solid #3f3f46', 
              borderRadius: '8px', 
              padding: '0.6rem 0.75rem 0.6rem 2.25rem', 
              color: '#fff', 
              fontSize: '0.85rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Lista Scrollable */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          maxHeight: '340px', 
          border: '1px solid #27272a', 
          borderRadius: '10px', 
          background: '#121212',
          padding: '0.5rem' 
        }}>
          {filteredModalRecords.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#a1a1aa' }}>
              No se encontraron registros en este desglose.
            </div>
          ) : (
            filteredModalRecords.map((r) => {
              const emp = r.employee || {};
              const getInitials = (f, l) => `${(f||'').charAt(0)}${(l||'').charAt(0)}`.toUpperCase();

              return (
                <div 
                  key={r.id} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    marginBottom: '0.35rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      background: config.colorBg,
                      color: config.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: `1px solid ${config.colorBorder}`
                    }}>
                      {getInitials(emp.firstName, emp.lastName)}
                    </div>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.88rem' }}>
                        {emp.firstName} {emp.lastName}
                        {period !== 'day' && r.date && (
                          <span style={{ marginLeft: '8px', color: '#f97316', fontSize: '0.76rem', fontWeight: 500 }}>
                            ({formatShortDate(r.date)})
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#a1a1aa', fontSize: '0.75rem' }}>
                        {r.departamento} • {emp.identifier || emp.email || 'Sin identificador'}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {type === 'ABSENT' ? (
                      <span style={{ 
                        background: r.puntualidad === 'Falta' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: r.puntualidad === 'Falta' ? '#ef4444' : '#60a5fa',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        border: `1px solid ${r.puntualidad === 'Falta' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                      }}>
                        {r.puntualidad}
                      </span>
                    ) : (
                      <div>
                        <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>
                          {r.horaMarcaje} {r.horaSalida !== '—' && `➔ ${r.horaSalida}`}
                        </div>
                        {r.lateMinutes > 0 && (
                          <div style={{ color: '#f97316', fontSize: '0.74rem', fontWeight: 600, marginTop: '2px' }}>
                            +{r.lateMinutes} min retardo
                          </div>
                        )}
                        {r.tipo === 'Sin salida' && (
                          <div style={{ color: '#a1a1aa', fontSize: '0.72rem' }}>
                            En turno activo
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Acciones del Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #27272a' }}>
          <button
            onClick={() => onApplyFilter(type)}
            style={{
              background: config.colorBg,
              border: `1px solid ${config.colorBorder}`,
              color: config.color,
              padding: '0.65rem 1.1rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
          >
            <Filter size={15} /> Filtrar tabla principal con este grupo
          </button>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              onClick={() => onExportGroup(modalRecords, `Reporte_Detalle_${type.toLowerCase()}_${period}.csv`)}
              style={{
                background: '#27272a',
                border: '1px solid #3f3f46',
                color: '#e4e4e7',
                padding: '0.65rem 1rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Download size={14} /> Exportar CSV
            </button>
            <button
              onClick={onClose}
              style={{
                background: '#3f3f46',
                border: 'none',
                color: '#fff',
                padding: '0.65rem 1.1rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Modal de Exportación Avanzada (Día, Semana, Mes, Año, Rango) ---
const AttendanceExportModal = ({
  currentPeriod,
  currentRange,
  currentPeriodLabel,
  currentFilteredRecords,
  departments,
  onClose,
  onDirectExport
}) => {
  const [exportPeriod, setExportPeriod] = useState(currentPeriod);
  const [customDate, setCustomDate] = useState(currentRange.start);
  const [customEndDate, setCustomEndDate] = useState(currentRange.end);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [isExporting, setIsExporting] = useState(false);

  // Selector de Mes y Año para exportación mensual / anual
  const currentYear = new Date().getFullYear();
  const [selectedMonthNum, setSelectedMonthNum] = useState(String(new Date().getMonth() + 1));
  const [selectedYearNum, setSelectedYearNum] = useState(String(currentYear));

  // Cálculo del rango dinámico según selección en modal
  const exportRange = useMemo(() => {
    if (exportPeriod === 'day') {
      return { start: customDate, end: customDate, label: formatFriendlyDate(customDate) };
    }
    if (exportPeriod === 'week') {
      const w = getWeekRange(customDate);
      return { ...w, label: `Semana del ${formatShortDate(w.start)} al ${formatShortDate(w.end)}` };
    }
    if (exportPeriod === 'month') {
      const year = parseInt(selectedYearNum, 10);
      const month = parseInt(selectedMonthNum, 10);
      const lastDay = new Date(year, month, 0).getDate();
      const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      return {
        start: `${year}-${String(month).padStart(2, '0')}-01`,
        end: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
        label: `${months[month - 1]} de ${year}`
      };
    }
    if (exportPeriod === 'year') {
      return {
        start: `${selectedYearNum}-01-01`,
        end: `${selectedYearNum}-12-31`,
        label: `Año ${selectedYearNum}`
      };
    }
    if (exportPeriod === 'custom') {
      return {
        start: customDate,
        end: customEndDate,
        label: `Del ${formatShortDate(customDate)} al ${formatShortDate(customEndDate)}`
      };
    }
    return currentRange;
  }, [exportPeriod, customDate, customEndDate, selectedMonthNum, selectedYearNum, currentRange]);

  // Ejecución de la exportación
  const handleExecuteExport = async () => {
    try {
      setIsExporting(true);

      // Si el rango seleccionado coincide exactamente con la vista actual y no hay filtros extra, usar los datos en memoria
      const matchesCurrent = exportRange.start === currentRange.start && 
                             exportRange.end === currentRange.end && 
                             !selectedDept && 
                             selectedStatus === 'ALL';

      let dataToExport = [];

      if (matchesCurrent && currentFilteredRecords.length > 0) {
        dataToExport = currentFilteredRecords;
      } else {
        // Consultar el endpoint con el rango seleccionado
        const token = localStorage.getItem('token');
        const tenantId = localStorage.getItem('tenantId');
        const headers = {
          'Authorization': `Bearer ${token}`,
          ...(tenantId ? { 'x-tenant-id': tenantId } : {})
        };

        const [attRes, empRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/attendance?startDate=${exportRange.start}&endDate=${exportRange.end}`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/employees`, { headers })
        ]);

        if (!attRes.ok) throw new Error('Error al obtener datos para exportar');
        const attData = await attRes.json();
        const empData = await empRes.json();
        const recordsRaw = attData.records || attData || [];
        const eventsRaw = attData.events || [];

        // Generar lista combinada completa para el rango
        const recordedKeys = new Set();
        const combined = [];

        recordsRaw.forEach(rec => {
          const recDate = rec.date 
            ? (typeof rec.date === 'string' ? rec.date.split('T')[0] : getLocalDateString(new Date(rec.date))) 
            : exportRange.start;
          recordedKeys.add(`${rec.employeeId}_${recDate}`);
          
          let puntualidad = 'A tiempo';
          if (rec.isLate) puntualidad = 'Retardo';
          if (!rec.entrada) puntualidad = 'Falta';

          let tipoStr = 'Entrada';
          if (rec.entrada && !rec.salida) tipoStr = 'Sin salida';
          if (rec.entrada && rec.salida) tipoStr = 'Entrada / Salida';

          combined.push({
            date: recDate,
            employee: rec.employee || {},
            horaMarcaje: rec.entrada ? new Date(rec.entrada).toTimeString().split(' ')[0] : '—',
            horaSalida: rec.salida ? new Date(rec.salida).toTimeString().split(' ')[0] : '—',
            lateMinutes: rec.lateMinutes || 0,
            tipo: tipoStr,
            puntualidad,
            departamento: rec.employee?.department?.name || 'Sin departamento',
            metodo: 'Facial - CAM 01'
          });
        });

        // Inasistencias en días hábiles
        const todayStr = getTodayString();
        const effEnd = exportRange.end > todayStr ? todayStr : exportRange.end;
        const evalDays = [];
        
        if (exportPeriod === 'day') {
          evalDays.push(exportRange.start);
        } else {
          const [sy, sm, sd] = exportRange.start.split('-').map(Number);
          const [ey, em, ed] = effEnd.split('-').map(Number);
          let c = new Date(sy, sm - 1, sd);
          const eLim = new Date(ey, em - 1, ed);
          while (c <= eLim) {
            const dow = c.getDay();
            if (dow >= 1 && dow <= 5) evalDays.push(getLocalDateString(c));
            c.setDate(c.getDate() + 1);
          }
        }

        evalDays.forEach(dStr => {
          (empData || []).forEach(emp => {
            if (!emp.isActive) return;
            const key = `${emp.id}_${dStr}`;
            if (recordedKeys.has(key)) return;

            const ev = eventsRaw.find(e => {
              if (e.employeeId !== emp.id) return false;
              const s = e.date ? (typeof e.date === 'string' ? e.date.split('T')[0] : getLocalDateString(new Date(e.date))) : null;
              const en = e.dateTo ? (typeof e.dateTo === 'string' ? e.dateTo.split('T')[0] : getLocalDateString(new Date(e.dateTo))) : s;
              return s && dStr >= s && dStr <= (en || s);
            });

            let lab = 'Falta';
            let t = '—';
            if (ev) {
              lab = ev.type === 'VACATION' ? 'Vacaciones' : 'Falta Justificada';
              t = 'Permiso';
            }

            combined.push({
              date: dStr,
              employee: emp,
              horaMarcaje: '—',
              horaSalida: '—',
              lateMinutes: 0,
              tipo: t,
              puntualidad: lab,
              departamento: emp.department?.name || 'Sin departamento',
              metodo: '—'
            });
          });
        });

        dataToExport = combined;
      }

      // Aplicar filtros de departamento y estatus si fueron seleccionados
      if (selectedDept) {
        dataToExport = dataToExport.filter(r => r.departamento === selectedDept);
      }
      if (selectedStatus === 'ON_TIME') {
        dataToExport = dataToExport.filter(r => r.puntualidad === 'A tiempo');
      } else if (selectedStatus === 'LATE') {
        dataToExport = dataToExport.filter(r => r.puntualidad === 'Retardo');
      } else if (selectedStatus === 'ABSENT') {
        dataToExport = dataToExport.filter(r => r.puntualidad === 'Falta' || r.puntualidad === 'Vacaciones' || r.puntualidad === 'Falta Justificada');
      }

      // Generar CSV
      const headers = ['Fecha', 'Empleado', 'Correo / ID', 'Departamento', 'Puntualidad', 'Hora Entrada', 'Minutos Retardo', 'Hora Salida', 'Tipo', 'Método'];
      const rows = dataToExport.map(r => [
        r.date,
        `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.trim(),
        r.employee?.email || r.employee?.identifier || '—',
        r.departamento,
        r.puntualidad,
        r.horaMarcaje,
        r.lateMinutes ? `+${r.lateMinutes} min` : '0',
        r.horaSalida,
        r.tipo,
        r.metodo
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(str => `"${String(str).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reporte_Asistencia_${exportPeriod.toUpperCase()}_${exportRange.start}_al_${exportRange.end}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      onClose();
    } catch (err) {
      console.error(err);
      alert('Error al generar el reporte: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const monthsList = [
    { num: '1', name: 'Enero' },
    { num: '2', name: 'Febrero' },
    { num: '3', name: 'Marzo' },
    { num: '4', name: 'Abril' },
    { num: '5', name: 'Mayo' },
    { num: '6', name: 'Junio' },
    { num: '7', name: 'Julio' },
    { num: '8', name: 'Agosto' },
    { num: '9', name: 'Septiembre' },
    { num: '10', name: 'Octubre' },
    { num: '11', name: 'Noviembre' },
    { num: '12', name: 'Diciembre' }
  ];

  const yearsList = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div 
        className="modal-content page-glow fade-in-up" 
        onClick={e => e.stopPropagation()} 
        style={{
          maxWidth: '560px',
          width: '95%',
          padding: '1.75rem',
          borderRadius: '20px',
          border: '1px solid rgba(249, 115, 22, 0.35)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(249, 115, 22, 0.12)',
          background: '#18181b'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(249, 115, 22, 0.12)',
              border: '1px solid rgba(249, 115, 22, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f97316'
            }}>
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', fontWeight: 700 }}>
                Exportar Reporte de Asistencia
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', color: '#a1a1aa', fontSize: '0.82rem' }}>
                Descarga consolidados por día, semana, mes, año o rango personalizado.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Acceso rápido a descargar vista activa */}
        <div style={{
          background: 'rgba(249, 115, 22, 0.08)',
          border: '1px solid rgba(249, 115, 22, 0.25)',
          borderRadius: '12px',
          padding: '0.85rem 1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div>
            <span style={{ fontSize: '0.74rem', color: '#f97316', fontWeight: 700, textTransform: 'uppercase' }}>
              Descarga Rápida (Vista Actual)
            </span>
            <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600, marginTop: '2px' }}>
              {currentPeriodLabel}
            </div>
          </div>
          <button
            onClick={onDirectExport}
            style={{
              ...btnPrimary,
              padding: '0.5rem 0.9rem',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              whiteSpace: 'nowrap'
            }}
          >
            <Download size={14} /> Exportar Vista
          </button>
        </div>

        {/* Configuración de Período a Exportar */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', color: '#e4e4e7', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Selecciona el Período a Exportar:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.4rem' }}>
            {[
              { id: 'day', label: 'Día' },
              { id: 'week', label: 'Semana' },
              { id: 'month', label: 'Mes' },
              { id: 'year', label: 'Año' },
              { id: 'custom', label: 'Rango' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setExportPeriod(p.id)}
                style={{
                  background: exportPeriod === p.id ? 'rgba(249, 115, 22, 0.2)' : '#27272a',
                  color: exportPeriod === p.id ? '#f97316' : '#a1a1aa',
                  border: exportPeriod === p.id ? '1px solid #f97316' : '1px solid #3f3f46',
                  borderRadius: '8px',
                  padding: '0.55rem 0.2rem',
                  fontSize: '0.8rem',
                  fontWeight: exportPeriod === p.id ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Controles Dinámicos según Período */}
        <div style={{ background: '#121212', border: '1px solid #27272a', borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem' }}>
          
          {exportPeriod === 'day' && (
            <div>
              <label style={{ display: 'block', color: '#a1a1aa', fontSize: '0.78rem', marginBottom: '0.35rem' }}>Día Específico:</label>
              <input 
                type="date" 
                value={customDate} 
                onChange={e => setCustomDate(e.target.value)} 
                style={{ ...inputStyle, padding: '0.6rem 0.75rem', fontSize: '0.88rem' }}
              />
            </div>
          )}

          {exportPeriod === 'week' && (
            <div>
              <label style={{ display: 'block', color: '#a1a1aa', fontSize: '0.78rem', marginBottom: '0.35rem' }}>Fecha de Referencia (Se tomará la semana completa):</label>
              <input 
                type="date" 
                value={customDate} 
                onChange={e => setCustomDate(e.target.value)} 
                style={{ ...inputStyle, padding: '0.6rem 0.75rem', fontSize: '0.88rem' }}
              />
              <span style={{ display: 'block', marginTop: '0.4rem', color: '#f97316', fontSize: '0.75rem' }}>
                ➔ Rango resultante: {exportRange.label}
              </span>
            </div>
          )}

          {exportPeriod === 'month' && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 2 }}>
                <label style={{ display: 'block', color: '#a1a1aa', fontSize: '0.78rem', marginBottom: '0.35rem' }}>Mes:</label>
                <select 
                  value={selectedMonthNum} 
                  onChange={e => setSelectedMonthNum(e.target.value)}
                  style={{ ...inputStyle, padding: '0.6rem 0.75rem', fontSize: '0.88rem' }}
                >
                  {monthsList.map(m => (
                    <option key={m.num} value={m.num}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#a1a1aa', fontSize: '0.78rem', marginBottom: '0.35rem' }}>Año:</label>
                <select 
                  value={selectedYearNum} 
                  onChange={e => setSelectedYearNum(e.target.value)}
                  style={{ ...inputStyle, padding: '0.6rem 0.75rem', fontSize: '0.88rem' }}
                >
                  {yearsList.map(y => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {exportPeriod === 'year' && (
            <div>
              <label style={{ display: 'block', color: '#a1a1aa', fontSize: '0.78rem', marginBottom: '0.35rem' }}>Año Completo a Exportar:</label>
              <select 
                value={selectedYearNum} 
                onChange={e => setSelectedYearNum(e.target.value)}
                style={{ ...inputStyle, padding: '0.6rem 0.75rem', fontSize: '0.88rem' }}
              >
                {yearsList.map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
          )}

          {exportPeriod === 'custom' && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#a1a1aa', fontSize: '0.78rem', marginBottom: '0.35rem' }}>Fecha Desde:</label>
                <input 
                  type="date" 
                  value={customDate} 
                  onChange={e => setCustomDate(e.target.value)} 
                  style={{ ...inputStyle, padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#a1a1aa', fontSize: '0.78rem', marginBottom: '0.35rem' }}>Fecha Hasta:</label>
                <input 
                  type="date" 
                  value={customEndDate} 
                  onChange={e => setCustomEndDate(e.target.value)} 
                  style={{ ...inputStyle, padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          )}

        </div>

        {/* Filtros Opcionales de Exportación */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', color: '#a1a1aa', fontSize: '0.78rem', marginBottom: '0.35rem' }}>Filtrar por Departamento:</label>
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              style={{ ...inputStyle, padding: '0.55rem 0.75rem', fontSize: '0.82rem' }}
            >
              <option value="">Todos los departamentos</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', color: '#a1a1aa', fontSize: '0.78rem', marginBottom: '0.35rem' }}>Filtrar por Estatus:</label>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              style={{ ...inputStyle, padding: '0.55rem 0.75rem', fontSize: '0.82rem' }}
            >
              <option value="ALL">Todos los estatus</option>
              <option value="ON_TIME">Solo A Tiempo</option>
              <option value="LATE">Solo Retardos</option>
              <option value="ABSENT">Solo Ausencias / Faltas</option>
            </select>
          </div>
        </div>

        {/* Footer de Acciones */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#27272a',
              border: '1px solid #3f3f46',
              color: '#fff',
              padding: '0.65rem 1.1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleExecuteExport}
            disabled={isExporting}
            style={{
              ...btnPrimary,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.35rem',
              fontSize: '0.85rem',
              opacity: isExporting ? 0.6 : 1
            }}
          >
            {isExporting ? <RefreshCw size={15} className="spin-animation" /> : <Download size={15} />}
            {isExporting ? 'Generando Reporte...' : 'Descargar Reporte CSV'}
          </button>
        </div>

      </div>
    </div>
  );
};

// --- Subcomponents ---
const Skeleton = ({ width, height, borderRadius = '4px', style = {} }) => (
  <div style={{ width, height, borderRadius, background: 'linear-gradient(90deg, #27272a 25%, #3f3f46 50%, #27272a 75%)', backgroundSize: '200% 100%', animation: 'skeleton-loading 1.5s infinite', ...style }} className="skeleton" />
);

// --- Styles ---
const btnPrimary = {
  padding: '0.75rem 1.5rem',
  background: 'var(--primary-orange, #f97316)',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 600,
  transition: 'opacity 0.2s'
};

const btnSecondary = {
  padding: '0.75rem 1.5rem',
  background: '#1e1e1e',
  color: '#e4e4e7',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 500,
  transition: 'background 0.2s'
};

const inputStyle = {
  width: '100%',
  padding: '0.75rem',
  background: '#121212',
  color: '#fff',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  outline: 'none',
  boxSizing: 'border-box'
};

const dropdownMenu = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: '0.5rem',
  background: '#27272a',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  padding: '0.5rem',
  zIndex: 10,
  minWidth: '220px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
};

const dropdownItem = {
  padding: '0.5rem 1rem',
  color: '#e4e4e7',
  cursor: 'pointer',
  borderRadius: '4px',
  fontSize: '0.9rem'
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.9rem'
};

const thStyle = {
  padding: '1.25rem 1.5rem',
  textAlign: 'left',
  fontWeight: 600,
  color: '#a1a1aa'
};

const tdStyle = {
  padding: '1rem 1.5rem',
  color: '#e4e4e7'
};

export default AttendancePage;
