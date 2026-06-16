import React, { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, Download, Filter, ChevronLeft, ChevronRight, X, UserX, Clock, CheckCircle } from 'lucide-react';
import { holidays } from '../../utils/holidays';

// --- Utils: Mock Data Generator ---
const generateMockData = (year, month, employees) => {
  const records = [];
  if (!employees || employees.length === 0) return records;
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  for (let i = 1; i <= daysInMonth; i++) {
    const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const dateObj = new Date(year, month, i);
    const dayOfWeek = dateObj.getDay();
    
    // Omitir fines de semana para datos falsos (opcional, pero realista)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Dejar un 10% de probabilidad de tener algo el fin de semana
      if (Math.random() > 0.1) continue;
    }
    
    // ¿Es feriado?
    const isHoliday = holidays.some(h => h.date === currentDateStr);
    if (isHoliday) continue; // No generamos faltas/tardanzas en feriados
    
    // Para este día, asignar a 3-8 personas con alguna incidencia
    const incidentCount = Math.floor(Math.random() * 5) + 3; 
    
    // Elegimos empleados al azar
    const shuffled = [...employees].sort(() => 0.5 - Math.random());
    const selectedEmps = shuffled.slice(0, incidentCount);
    
    selectedEmps.forEach(emp => {
      const rand = Math.random();
      let type, time;
      
      if (rand < 0.3) {
        type = 'absence'; // 30% Ausencia
        time = '—';
      } else if (rand < 0.8) {
        type = 'tardiness'; // 50% Tardanza
        // Hora aleatoria entre 08:16 y 09:30
        const h = 8;
        const m = Math.floor(Math.random() * 45) + 16;
        time = `0${h}:${String(m).padStart(2, '0')} AM`;
      } else {
        type = 'permission'; // 20% Permiso
        time = '—';
      }
      
      records.push({
        id: `mock-${currentDateStr}-${emp.id}`,
        date: currentDateStr,
        employee: emp,
        type,
        time,
        status: type === 'absence' ? 'Falta' : (type === 'tardiness' ? 'Llegada' : 'Aprobado')
      });
    });
  }
  return records;
};

// --- Componente Principal ---
const CalendarPage = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // View states
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week'
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth()); // 0-11
  
  // Week view state: starting Sunday
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  });

  // Modal State
  const [modalData, setModalData] = useState(null); // null = closed, { dateStr, ... }
  const [modalLoading, setModalLoading] = useState(false);

  // Fetch empleados para usarlos en el mock generator
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/employees`);
        if (res.ok) {
          const data = await res.json();
          setEmployees(data);
        }
      } catch (err) {
        console.error('Error fetching employees:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  // Generar Mock Data para el mes actual y el mes anterior (para tendencias)
  const currentMonthData = useMemo(() => {
    return generateMockData(selectedYear, selectedMonth, employees);
  }, [selectedYear, selectedMonth, employees]);
  
  const prevMonthData = useMemo(() => {
    const prevM = selectedMonth === 0 ? 11 : selectedMonth - 1;
    const prevY = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
    return generateMockData(prevY, prevM, employees);
  }, [selectedYear, selectedMonth, employees]);

  // --- Lógica de Tendencias y Estadísticas (Mes entero) ---
  const stats = useMemo(() => {
    const currAbsences = currentMonthData.filter(r => r.type === 'absence').length;
    const prevAbsences = prevMonthData.filter(r => r.type === 'absence').length;
    const diffAbsences = prevAbsences === 0 ? 0 : Math.round(((currAbsences - prevAbsences) / prevAbsences) * 100);

    const currTardiness = currentMonthData.filter(r => r.type === 'tardiness').length;
    const prevTardiness = prevMonthData.filter(r => r.type === 'tardiness').length;
    const diffTardiness = prevTardiness === 0 ? 0 : Math.round(((currTardiness - prevTardiness) / prevTardiness) * 100);

    // Asistencia perfecta (estimado: empleados sin faltas ni tardanzas)
    // Para simplificar, calculamos % de días*empleado limpios
    const totalPossibleDays = employees.length * 20; // asumiendo 20 dias habiles
    const currIncidents = currAbsences + currTardiness;
    const prevIncidents = prevAbsences + prevTardiness;
    
    const currPerfect = Math.max(0, Math.round(((totalPossibleDays - currIncidents) / totalPossibleDays) * 100));
    const prevPerfect = Math.max(0, Math.round(((totalPossibleDays - prevIncidents) / totalPossibleDays) * 100));
    const diffPerfect = currPerfect - prevPerfect;

    return {
      currAbsences, diffAbsences,
      currTardiness, diffTardiness,
      currPerfect, diffPerfect
    };
  }, [currentMonthData, prevMonthData, employees.length]);

  // --- Lógica del Calendario (Vista Mes) ---
  const calendarDays = useMemo(() => {
    const days = [];
    const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1).getDay(); // 0 (Sun) - 6 (Sat)
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    
    // Rellenar días del mes anterior (celdas vacías)
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    
    // Días del mes actual
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      
      const dayData = currentMonthData.filter(r => r.date === dateStr);
      const isHoliday = holidays.find(h => h.date === dateStr);
      
      days.push({
        dayNumber: i,
        dateStr,
        isHoliday,
        absences: dayData.filter(r => r.type === 'absence').length,
        tardiness: dayData.filter(r => r.type === 'tardiness').length,
        permissions: dayData.filter(r => r.type === 'permission').length,
        records: dayData
      });
    }
    return days;
  }, [selectedYear, selectedMonth, currentMonthData]);

  // --- Lógica del Calendario (Vista Semana) ---
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekStart]);

  // Filtrar empleados que tuvieron alguna actividad en la semana seleccionada
  const activeEmployeesInWeek = useMemo(() => {
    if (viewMode !== 'week') return [];
    
    const startStr = weekDays[0].toISOString().split('T')[0];
    const endStr = weekDays[6].toISOString().split('T')[0];
    
    // Extraer todos los employeeIds que aparecen en el rango
    const activeIds = new Set();
    currentMonthData.forEach(r => {
      if (r.date >= startStr && r.date <= endStr) {
        activeIds.add(r.employee.id);
      }
    });
    
    return employees.filter(emp => activeIds.has(emp.id));
  }, [weekDays, currentMonthData, employees, viewMode]);

  // Navegación
  const prevPeriod = () => {
    if (viewMode === 'month') {
      if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(selectedYear - 1); }
      else { setSelectedMonth(selectedMonth - 1); }
    } else {
      const d = new Date(weekStart);
      d.setDate(d.getDate() - 7);
      setWeekStart(d);
    }
  };

  const nextPeriod = () => {
    if (viewMode === 'month') {
      if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(selectedYear + 1); }
      else { setSelectedMonth(selectedMonth + 1); }
    } else {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + 7);
      setWeekStart(d);
    }
  };

  const goToday = () => {
    const now = new Date();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
    
    const day = now.getDay();
    const diff = now.getDate() - day;
    setWeekStart(new Date(now.setDate(diff)));
  };

  // Nombres de Meses
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  // Click Handler para celdas del mes
  const handleDayClick = (day) => {
    if (!day || (!day.isHoliday && day.records.length === 0)) return;
    
    setModalData(null); // reset old state
    setModalLoading(true);
    
    // Simulate delay
    setTimeout(() => {
      setModalData(day);
      setModalLoading(false);
    }, 300);
  };

  // Componente de tendencia (Arrow)
  const TrendArrow = ({ diff, isInverse = false }) => {
    if (diff === 0) return <span style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>0%</span>;
    // isInverse: if true, up is good (green). if false, up is bad (red)
    const isUp = diff > 0;
    const isGood = isInverse ? isUp : !isUp;
    const color = isGood ? '#10b981' : '#ef4444';
    const bg = isGood ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
    const arrow = isUp ? '↑' : '↓';
    
    return (
      <span style={{ backgroundColor: bg, color: color, padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
        {arrow}{Math.abs(diff)}%
      </span>
    );
  };

  // Exportar (CSV/Excel exact match & Print PDF)
  const exportCSV = () => {
    // Generar reporte de todo el mes
    const headers = ['Fecha', 'Empleado', 'Departamento', 'Estado', 'Hora Entrada', 'Hora Salida'];
    const rows = [];
    
    currentMonthData.forEach(r => {
      let estado = '';
      if (r.type === 'absence') estado = 'Ausencia';
      if (r.type === 'tardiness') estado = 'Tardanza';
      if (r.type === 'permission') estado = 'Permiso/Vacaciones';
      
      rows.push([
        r.date,
        `${r.employee.firstName} ${r.employee.lastName}`,
        r.employee.department?.name || '—',
        estado,
        r.type === 'tardiness' ? r.time : '—', // Solo tardanza tiene hora específica en el mock
        '—' // Salida
      ]);
    });
    
    // CSV con BOM \uFEFF
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(str => `"${String(str).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_Calendario_${selectedYear}_${String(selectedMonth+1).padStart(2,'0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    // Para PDF nativo, simplemente llamamos al print dialog que será estilizado vía CSS
    window.print();
  };

  return (
    <div className="fade-in" style={{ paddingBottom: '2rem' }}>
      <style>{`
        /* Print Styles */
        @media print {
          body * { visibility: hidden; }
          .printable-calendar, .printable-calendar * { visibility: visible; }
          .printable-calendar { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      
      {/* Header */}
      <div className="no-print" style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#fff', margin: 0, fontSize: '1.8rem' }}>Calendario Operativo</h2>
        <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0 0', fontSize: '0.95rem' }}>Visualiza la asistencia, turnos y anomalías del personal a lo largo del mes.</p>
      </div>

      {/* Cards */}
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Card 1: Ausencias */}
        <div style={{ ...cardBaseStyle, background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.3)', boxShadow: '0 4px 20px rgba(239, 68, 68, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#a1a1aa', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '1px' }}>TOTAL AUSENCIAS</span>
            <UserX size={18} style={{ color: 'rgba(239, 68, 68, 0.3)' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', margin: '1rem 0 0.5rem 0' }}>
              <h2 style={{ fontSize: '2.5rem', color: '#ef4444', lineHeight: '1', margin: 0 }}>{stats.currAbsences}</h2>
              <TrendArrow diff={stats.diffAbsences} isInverse={false} />
            </div>
            <p className="text-xs text-muted" style={{ margin: 0 }}>vs mes anterior</p>
          </div>
        </div>

        {/* Card 2: Tardanzas */}
        <div style={{ ...cardBaseStyle, background: 'rgba(249, 115, 22, 0.05)', borderColor: 'rgba(249, 115, 22, 0.3)', boxShadow: '0 4px 20px rgba(249, 115, 22, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#a1a1aa', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '1px' }}>LLEGADAS TARDÍAS</span>
            <Clock size={18} style={{ color: 'rgba(249, 115, 22, 0.3)' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', margin: '1rem 0 0.5rem 0' }}>
              <h2 style={{ fontSize: '2.5rem', color: '#f97316', lineHeight: '1', margin: 0 }}>{stats.currTardiness}</h2>
              <TrendArrow diff={stats.diffTardiness} isInverse={false} />
            </div>
            <p className="text-xs text-muted" style={{ margin: 0 }}>vs mes anterior</p>
          </div>
        </div>

        {/* Card 3: Perfecta */}
        <div style={{ ...cardBaseStyle, background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.3)', boxShadow: '0 4px 20px rgba(16, 185, 129, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#a1a1aa', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '1px' }}>ASISTENCIA PERFECTA</span>
            <CheckCircle size={18} style={{ color: 'rgba(16, 185, 129, 0.3)' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', margin: '1rem 0 0.5rem 0' }}>
              <h2 style={{ fontSize: '2.5rem', color: '#10b981', lineHeight: '1', margin: 0 }}>{stats.currPerfect}%</h2>
              <TrendArrow diff={stats.diffPerfect} isInverse={true} />
            </div>
            <p className="text-xs text-muted" style={{ margin: 0 }}>empleados sin incidencias</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Toggle & Date Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: '#18181b', borderRadius: '8px', padding: '4px', border: '1px solid #3f3f46' }}>
            <button 
              onClick={() => setViewMode('month')} 
              style={{ ...toggleBtn, background: viewMode === 'month' ? 'rgba(249, 115, 22, 0.1)' : 'transparent', color: viewMode === 'month' ? '#f97316' : '#a1a1aa' }}
            >
              Mes
            </button>
            <button 
              onClick={() => setViewMode('week')} 
              style={{ ...toggleBtn, background: viewMode === 'week' ? 'rgba(249, 115, 22, 0.1)' : 'transparent', color: viewMode === 'week' ? '#f97316' : '#a1a1aa' }}
            >
              Semana
            </button>
          </div>
          
          {viewMode === 'month' && (
            <>
              <div style={{ width: '1px', height: '24px', background: '#3f3f46' }}></div>
              <select style={selectStyle} value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select style={selectStyle} value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </>
          )}

          <div style={{ display: 'flex', gap: '4px', marginLeft: '0.5rem' }}>
            <button onClick={prevPeriod} style={iconBtn}><ChevronLeft size={16} /></button>
            <button onClick={nextPeriod} style={iconBtn}><ChevronRight size={16} /></button>
            <button onClick={goToday} style={{ ...iconBtn, padding: '0 1rem', fontSize: '0.8rem' }}>Hoy</button>
          </div>
        </div>

        {/* Filters & Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <select style={selectStyle}>
            <option>Todos los Depts</option>
          </select>
          <select style={selectStyle}>
            <option>Todos</option>
          </select>
          <button style={iconBtn}><Filter size={16} /></button>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={exportCSV} style={{ ...btnPrimary, padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <Download size={14} /> Excel
            </button>
            <button onClick={exportPDF} style={{ ...btnPrimary, background: '#ef4444', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <Download size={14} /> PDF
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="no-print" style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'center', fontSize: '0.85rem', color: '#e4e4e7', flexWrap: 'wrap' }}>
        <span style={{ color: '#a1a1aa' }}>Leyenda:</span>
        <div style={legendItem}><span style={{ ...circle, background: '#ef4444' }}></span> Ausencias</div>
        <div style={legendItem}><span style={{ ...circle, background: '#f97316' }}></span> Tardanzas</div>
        <div style={legendItem}><span style={{ ...circle, background: '#a855f7' }}></span> Permisos / Vacaciones</div>
        <div style={legendItem}><span style={{ ...circle, background: '#3b82f6' }}></span> Feriados</div>
        <div style={legendItem}><span style={{ ...circle, background: '#10b981' }}></span> A Tiempo</div>
      </div>

      {/* Main Grid Area */}
      <div className="printable-calendar" style={{ background: '#18181b', borderRadius: '12px', border: '1px solid #27272a', overflowX: 'auto', width: '100%', maxWidth: '100%' }}>
        {viewMode === 'month' ? (
          <>
            {/* Cabecera Días */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #27272a', minWidth: '800px' }}>
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day, i) => (
                <div key={day} style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, color: i === 0 || i === 6 ? '#f97316' : '#a1a1aa' }}>
                  {day}
                </div>
              ))}
            </div>
            
            {/* Matriz Días */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(120px, auto)', minWidth: '800px' }}>
              {calendarDays.map((day, index) => {
                if (!day) return <div key={`empty-${index}`} style={{ borderRight: '1px solid #27272a', borderBottom: '1px solid #27272a', background: '#121212' }}></div>;
                
                const hasData = day.records.length > 0 || day.isHoliday;
                let dominantColor = 'transparent';
                if (hasData) {
                  if (day.absences > 0) dominantColor = '#ef4444';
                  else if (day.tardiness > 0) dominantColor = '#f97316';
                  else if (day.permissions > 0) dominantColor = '#a855f7';
                  else dominantColor = '#10b981'; // a tiempo (aunque aquí no lo marcamos explicito)
                }

                return (
                  <div 
                    key={day.dayNumber} 
                    className="calendar-cell"
                    onClick={() => handleDayClick(day)}
                    style={{ 
                      padding: '0.75rem', 
                      borderRight: '1px solid #27272a', 
                      borderBottom: '1px solid #27272a',
                      position: 'relative',
                      cursor: hasData ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                      '--dominant-color': dominantColor
                    }}
                  >
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>{day.dayNumber}</span>
                    
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {day.isHoliday && (
                        <div className="calendar-badge" style={{ ...badgeStyle, background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                          {day.isHoliday.name}
                        </div>
                      )}
                      {day.absences > 0 && (
                        <div className="calendar-badge" style={{ ...badgeStyle, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                          Ausencias <span style={badgeNum( '#ef4444', 'rgba(239, 68, 68, 0.2)')}>{day.absences}</span>
                        </div>
                      )}
                      {day.tardiness > 0 && (
                        <div className="calendar-badge" style={{ ...badgeStyle, background: 'rgba(249, 115, 22, 0.15)', color: '#f97316' }}>
                          Tardanzas <span style={badgeNum( '#f97316', 'rgba(249, 115, 22, 0.2)')}>{day.tardiness}</span>
                        </div>
                      )}
                      {day.permissions > 0 && (
                        <div className="calendar-badge" style={{ ...badgeStyle, background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
                          Permisos <span style={badgeNum( '#a855f7', 'rgba(168, 85, 247, 0.2)')}>{day.permissions}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* CSS para Hover en celda */}
            <style>{`
              .calendar-cell:hover {
                background-color: rgba(255,255,255,0.02);
                box-shadow: inset 0 0 0 1px var(--dominant-color);
              }
            `}</style>
          </>
        ) : (
          /* VISTA SEMANA */
          <div style={{ padding: '1rem', overflowX: 'auto' }}>
            <h3 style={{ color: '#fff', marginBottom: '1rem' }}>
              Semana: {weekDays[0].getDate()} {monthNames[weekDays[0].getMonth()]} - {weekDays[6].getDate()} {monthNames[weekDays[6].getMonth()]}
            </h3>
            {/* // TODO: vista semana completa tipo Google Calendar */}
            
            {activeEmployeesInWeek.length === 0 ? (
               <div style={{ padding: '3rem', textAlign: 'center', color: '#a1a1aa' }}>
                 No hay registros en esta semana.
               </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th style={{ ...thWeek, width: '200px' }}>Empleado</th>
                    {weekDays.map(d => (
                      <th key={d.toISOString()} style={thWeek}>
                        {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()]} {d.getDate()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeEmployeesInWeek.map(emp => (
                    <tr key={emp.id} style={{ borderBottom: '1px solid #27272a' }}>
                      <td style={tdWeek}>
                         <div style={{ color: '#fff', fontWeight: 500 }}>{emp.firstName} {emp.lastName}</div>
                      </td>
                      {weekDays.map(d => {
                        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                        // Buscar el record de este emp este dia
                        const r = currentMonthData.find(x => x.employee.id === emp.id && x.date === dateStr);
                        return (
                          <td key={d.toISOString()} style={tdWeek}>
                            {r ? (
                              <span style={{ 
                                padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem',
                                background: r.type === 'absence' ? 'rgba(239, 68, 68, 0.1)' : (r.type === 'tardiness' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(168, 85, 247, 0.1)'),
                                color: r.type === 'absence' ? '#ef4444' : (r.type === 'tardiness' ? '#f97316' : '#a855f7')
                              }}>
                                {r.type === 'absence' ? 'Falta' : (r.type === 'tardiness' ? r.time : 'Permiso')}
                              </span>
                            ) : (
                              <span style={{ color: '#3f3f46' }}>—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modal Overlay */}
      {modalData || modalLoading ? (
        <div style={overlayStyle}>
          <div style={modalStyle} className="fade-in">
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#fff' }}>
                {modalData && !modalLoading ? (() => {
                  const d = new Date(modalData.dateStr + 'T12:00:00');
                  const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][d.getDay()];
                  const mName = monthNames[d.getMonth()];
                  return `${dayName}, ${d.getDate()} De ${mName} De ${d.getFullYear()}`;
                })() : 'Cargando detalle...'}
              </h2>
              <button onClick={() => { setModalData(null); setModalLoading(false); }} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            
            <p style={{ color: '#a1a1aa', marginBottom: '2rem', fontSize: '0.9rem' }}>Resumen de asistencia y anomalías del día.</p>

            {modalLoading ? (
              // Skeleton Loader
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <Skeleton width="33%" height="80px" borderRadius="12px" />
                  <Skeleton width="33%" height="80px" borderRadius="12px" />
                  <Skeleton width="33%" height="80px" borderRadius="12px" />
                </div>
                <Skeleton width="100%" height="40px" borderRadius="8px" />
                <Skeleton width="100%" height="60px" borderRadius="12px" />
                <Skeleton width="100%" height="60px" borderRadius="12px" />
              </div>
            ) : (
              // Modal Content
              <>
                {/* 3 Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2.5rem' }}>
                  <div style={{ ...modalCard, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                    <h2 style={{ fontSize: '2rem', color: '#ef4444', margin: '0 0 0.25rem 0', lineHeight: 1 }}>{modalData.absences}</h2>
                    <span style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '1px' }}>AUSENCIA{modalData.absences !== 1 ? 'S' : ''}</span>
                  </div>
                  <div style={{ ...modalCard, borderColor: 'rgba(249, 115, 22, 0.3)' }}>
                    <h2 style={{ fontSize: '2rem', color: '#f97316', margin: '0 0 0.25rem 0', lineHeight: 1 }}>{modalData.tardiness}</h2>
                    <span style={{ color: '#f97316', fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '1px' }}>TARDANZAS</span>
                  </div>
                  <div style={{ ...modalCard, borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                    <h2 style={{ fontSize: '2rem', color: '#10b981', margin: '0 0 0.25rem 0', lineHeight: 1 }}>{employees.length - modalData.absences - modalData.tardiness - modalData.permissions}</h2>
                    <span style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '1px' }}>A TIEMPO</span>
                  </div>
                </div>

                {/* Lists */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  {/* Ausencias */}
                  {modalData.absences > 0 && (
                    <div>
                      <h3 style={{ color: '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', letterSpacing: '1px' }}>
                        <UserX size={16} /> AUSENCIAS INJUSTIFICADAS
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {modalData.records.filter(r => r.type === 'absence').map(r => (
                          <div key={r.id} style={listItem}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div style={avatar( '#ef4444', 'rgba(239, 68, 68, 0.1)')}>{r.employee.firstName[0]}{r.employee.lastName[0]}</div>
                              <div>
                                <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 500 }}>{r.employee.firstName} {r.employee.lastName}</div>
                                <div style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>{r.employee.department?.name || 'Operaciones'}</div>
                              </div>
                            </div>
                            <span style={{ padding: '2px 8px', borderRadius: '99px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>Falta</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tardanzas */}
                  {modalData.tardiness > 0 && (
                    <div>
                      <h3 style={{ color: '#f97316', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', letterSpacing: '1px' }}>
                        <Clock size={16} /> LLEGADAS TARDÍAS
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {modalData.records.filter(r => r.type === 'tardiness').map(r => (
                          <div key={r.id} style={listItem}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div style={avatar( '#f97316', 'rgba(249, 115, 22, 0.1)')}>{r.employee.firstName[0]}{r.employee.lastName[0]}</div>
                              <div>
                                <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 500 }}>{r.employee.firstName} {r.employee.lastName}</div>
                                <div style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>{r.employee.department?.name || 'Ventas'}</div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ color: '#f97316', fontWeight: 600, fontSize: '0.9rem' }}>{r.time}</div>
                              <div style={{ color: '#f97316', fontSize: '0.75rem', opacity: 0.8 }}>Llegada</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Permisos */}
                  {modalData.permissions > 0 && (
                    <div>
                      <h3 style={{ color: '#a855f7', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', letterSpacing: '1px' }}>
                        <UserX size={16} /> PERMISOS / VACACIONES
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {modalData.records.filter(r => r.type === 'permission').map(r => (
                          <div key={r.id} style={listItem}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div style={avatar( '#a855f7', 'rgba(168, 85, 247, 0.1)')}>{r.employee.firstName[0]}{r.employee.lastName[0]}</div>
                              <div>
                                <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 500 }}>{r.employee.firstName} {r.employee.lastName}</div>
                                <div style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>{r.employee.department?.name || 'IT'}</div>
                              </div>
                            </div>
                            <span style={{ padding: '2px 8px', borderRadius: '99px', background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', fontSize: '0.75rem', border: '1px solid rgba(168, 85, 247, 0.3)' }}>Aprobado</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

// --- Styles ---

const Skeleton = ({ width, height, borderRadius }) => (
  <div style={{ width, height, borderRadius, background: 'linear-gradient(90deg, #27272a 25%, #3f3f46 50%, #27272a 75%)', backgroundSize: '200% 100%', animation: 'skeleton-loading 1.5s infinite' }} className="skeleton" />
);

const cardBaseStyle = {
  borderRadius: '12px',
  padding: '1.5rem',
  border: '1px solid',
  display: 'flex',
  flexDirection: 'column',
  height: '140px'
};

const toggleBtn = {
  padding: '6px 12px',
  border: 'none',
  borderRadius: '6px',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s'
};

const selectStyle = {
  background: 'transparent',
  border: '1px solid #3f3f46',
  color: '#e4e4e7',
  padding: '6px 12px',
  borderRadius: '6px',
  outline: 'none',
  fontSize: '0.85rem',
  cursor: 'pointer'
};

const iconBtn = {
  background: 'transparent',
  border: '1px solid #3f3f46',
  color: '#e4e4e7',
  width: '32px',
  height: '32px',
  borderRadius: '6px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background 0.2s'
};

const btnPrimary = {
  background: 'var(--primary-orange, #f97316)',
  border: 'none',
  borderRadius: '6px',
  color: 'white',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'opacity 0.2s'
};

const legendItem = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontWeight: 500
};

const circle = {
  width: '10px',
  height: '10px',
  borderRadius: '50%',
  display: 'inline-block'
};

const badgeStyle = {
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: 'bold',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  letterSpacing: '0.5px'
};

const badgeNum = (color, bg) => ({
  background: bg,
  color: color,
  padding: '0 4px',
  borderRadius: '2px',
  marginLeft: '4px'
});

const thWeek = {
  padding: '1rem',
  textAlign: 'left',
  color: '#a1a1aa',
  borderBottom: '1px solid #3f3f46'
};

const tdWeek = {
  padding: '1rem',
  borderRight: '1px solid #27272a'
};

const overlayStyle = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
};

const modalStyle = {
  background: '#121212', // Slightly darker than cards
  border: '1px solid #27272a',
  borderRadius: '16px',
  width: '100%',
  maxWidth: '500px',
  maxHeight: '90vh',
  overflowY: 'auto',
  padding: '2rem',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
};

const modalCard = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid',
  borderRadius: '8px',
  padding: '1rem',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center'
};

const listItem = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid #27272a',
  borderRadius: '12px',
  padding: '1rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const avatar = (color, bg) => ({
  width: '36px', height: '36px',
  borderRadius: '50%',
  background: bg,
  color: color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 'bold',
  fontSize: '0.9rem'
});

export default CalendarPage;
