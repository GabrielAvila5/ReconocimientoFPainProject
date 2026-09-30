import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Clock, AlertTriangle, Activity, AlertCircle, ThermometerSnowflake, CameraOff, MoreHorizontal, ScanFace } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const DashboardOverview = () => {
  const [loading, setLoading] = useState(true);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [activeEvents, setActiveEvents] = useState([]);
  const [employeesCount, setEmployeesCount] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('Todos');

  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    const saved = localStorage.getItem('dismissedAlerts');
    return saved ? JSON.parse(saved) : [];
  });

  const allAlerts = [
    {
      id: 1,
      title: 'Persona no autorizada',
      desc: 'Detectada en acceso norte - Cámara 02',
      time: 'Hace 5 min',
      Icon: AlertCircle,
      bg: 'rgba(239, 68, 68, 0.05)',
      border: 'rgba(239, 68, 68, 0.2)',
      iconColor: 'text-red-500',
      titleColor: '#fca5a5',
      closeColor: '#ef4444',
      descColor: '#f87171',
      timeColor: '#991b1b'
    },
    {
      id: 2,
      title: 'Temperatura fuera de rango',
      desc: 'Pedro Sánchez - 38.2°C',
      time: 'Hace 15 min',
      Icon: ThermometerSnowflake,
      bg: 'rgba(245, 158, 11, 0.05)',
      border: 'rgba(245, 158, 11, 0.2)',
      iconColor: 'text-yellow-500',
      titleColor: '#fcd34d',
      closeColor: '#eab308',
      descColor: '#fbbf24',
      timeColor: '#b45309'
    },
    {
      id: 3,
      title: 'Cámara desconectada',
      desc: 'Cámara 03 - Acceso sur',
      time: 'Hace 32 min',
      Icon: CameraOff,
      bg: 'rgba(249, 115, 22, 0.05)',
      border: 'rgba(249, 115, 22, 0.2)',
      iconColor: 'text-orange-500',
      titleColor: '#fdba74',
      closeColor: '#f97316',
      descColor: '#fb923c',
      timeColor: '#c2410c'
    }
  ];

  const systemAlerts = allAlerts.filter(a => !dismissedAlerts.includes(a.id));

  const removeAlert = (id) => {
    const newDismissed = [...dismissedAlerts, id];
    setDismissedAlerts(newDismissed);
    localStorage.setItem('dismissedAlerts', JSON.stringify(newDismissed));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };
        
        const [attRes, empRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/api/v1/attendance`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/api/v1/employees`, { headers })
        ]);

        if (attRes.ok) {
          const data = await attRes.json();
          if (data.records) {
            setAttendanceRecords(data.records);
            setActiveEvents(data.events || []);
          } else {
            setAttendanceRecords(data);
          }
        }
        if (empRes.ok) {
          const empData = await empRes.json();
          const activeEmps = Array.isArray(empData) ? empData.filter(e => e.isActive !== false) : [];
          setEmployeesCount(activeEmps.length || (Array.isArray(empData) ? empData.length : 0));
        }
      } catch (e) {
        console.error('Error fetching dashboard data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Helper para obtener fecha local en formato YYYY-MM-DD
  const getLocalDateStr = (date = new Date()) => {
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateStr(new Date());

  // Comparador seguro de fechas contra timezones
  const matchesDate = (recordDate, targetDateStr) => {
    if (!recordDate) return false;
    if (typeof recordDate === 'string') {
      return recordDate.startsWith(targetDateStr);
    }
    return getLocalDateStr(recordDate) === targetDateStr;
  };

  // Filtrar registros de hoy
  const todayRecords = attendanceRecords.filter(r => matchesDate(r.date, todayStr));
  
  const aTiempoCount = todayRecords.filter(r => !r.isLate).length;
  const retardosCount = todayRecords.filter(r => r.isLate).length;
  
  // Faltas: empleados totales - asitencias hoy - empleados con VACATION o JUSTIFIED_ABSENCE hoy
  const eventosJustificadosHoy = activeEvents.filter(e => 
    matchesDate(e.date, todayStr) && 
    (e.type === 'VACATION' || e.type === 'JUSTIFIED_ABSENCE')
  ).length;
  
  const ausenciasCount = Math.max(0, employeesCount - todayRecords.length - eventosJustificadosHoy);
  const asistenciasHoy = todayRecords.length;
  const asistenciaPctHoy = employeesCount > 0 ? Math.round((asistenciasHoy / employeesCount) * 100) : 0;

  // Tendencia Semanal (Dinámica según registros reales)
  const computeWeeklyTrend = () => {
    const daysShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const daysFull = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const trend = [];
    
    const now = new Date();
    const todayFormatted = getLocalDateStr(now);

    // Buscar el lunes de la semana actual
    const dInit = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = dInit.getDay(); 
    const diffToMonday = dInit.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(dInit.setDate(diffToMonday));
    
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const dateStr = getLocalDateStr(d);
      
      const dayRecords = attendanceRecords.filter(r => matchesDate(r.date, dateStr));
      const onTime = dayRecords.filter(r => !r.isLate).length;
      const late = dayRecords.filter(r => r.isLate).length;
      const totalAttended = dayRecords.length;
      
      const isToday = dateStr === todayFormatted;
      const isFuture = dateStr > todayFormatted;

      trend.push({
        name: daysShort[d.getDay()],
        fullName: daysFull[d.getDay()],
        dateStr,
        dayNum: d.getDate(),
        isToday,
        isFuture,
        // esperados: headcount esperado
        esperados: employeesCount || 0,
        // asistencias: total que registró asistencia
        asistencias: totalAttended,
        aTiempo: onTime,
        retardos: late,
        faltas: Math.max(0, (employeesCount || 0) - totalAttended)
      });
    }
    return trend;
  };
  const barData = computeWeeklyTrend();

  const maxWeeklyValue = Math.max(
    employeesCount || 0,
    ...barData.map(d => Math.max(d.esperados, d.asistencias)),
    4
  );

  // Distribución de Hoy
  let pieData = [];
  if (aTiempoCount > 0) pieData.push({ name: 'A tiempo', value: aTiempoCount, color: '#10b981' });
  if (retardosCount > 0) pieData.push({ name: 'Retardo', value: retardosCount, color: '#eab308' });
  if (ausenciasCount > 0) pieData.push({ name: 'Falta', value: ausenciasCount, color: '#ef4444' });

  if (pieData.length === 0) {
    pieData = [{ name: 'Sin registros', value: 1, color: '#27272a' }];
  }

  // Actividad (Mapeado de registros reales con filtros)
  const filteredActivity = attendanceRecords
    .map((r, index) => {
      const isSalida = r.salida != null;
      const timeToDisplay = isSalida ? new Date(r.salida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (r.entrada ? new Date(r.entrada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--');
      const fullName = `${r.employee?.firstName || 'Desconocido'} ${r.employee?.lastName || ''}`.trim();
      
      return {
        id: r.id || index,
        initials: `${r.employee?.firstName?.[0] || ''}${r.employee?.lastName?.[0] || ''}`.toUpperCase() || 'EMP',
        name: fullName,
        dept: r.employee?.department?.name || 'General',
        time: timeToDisplay,
        type: isSalida ? 'Salida' : 'Entrada',
        status: r.isLate ? 'Retardo' : 'A tiempo',
        statusColor: r.isLate ? 'badge-warning' : 'badge-success'
      };
    })
    .filter(act => {
      if (filterAction !== 'Todos' && act.type !== (filterAction === 'Entradas' ? 'Entrada' : 'Salida')) {
        return false;
      }
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        return act.name.toLowerCase().includes(query) || act.dept.toLowerCase().includes(query);
      }
      return true;
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Dashboard del Administrador</h1>
        <p className="text-muted">Monitoreo en tiempo real del sistema de asistencia</p>
      </div>

      {/* Overview Cards - Mas grandes */}
      <div className="grid grid-cols-4 gap-6">
        <div className="card card-glow" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '170px', padding: '1.75rem' }}>
          <div className="flex justify-between items-center">
            <span className="text-muted text-sm font-semibold">Total Empleados</span>
            <div className="icon-box" style={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}>
              <Users size={18} className="text-muted" />
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: '2.5rem', color: 'var(--primary-orange)', lineHeight: '1' }}>
              {loading ? '-' : employeesCount}
            </h2>
            <p className="text-xs text-muted mt-2"><span style={{ color: 'var(--status-success)' }}>{asistenciaPctHoy}%</span> asistencia hoy</p>
          </div>
        </div>

        <div className="card card-glow" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '170px', padding: '1.75rem' }}>
          <div className="flex justify-between items-center">
            <span className="text-muted text-sm font-semibold">Asistencias Hoy</span>
            <div className="icon-box" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)' }}>
              <Clock size={18} style={{ color: 'var(--accent-amber)' }} />
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: '2.5rem', color: 'var(--accent-amber)', lineHeight: '1' }}>
              {loading ? '-' : asistenciasHoy}
            </h2>
            <p className="text-xs text-muted mt-2">
              <span style={{ color: 'var(--status-success)' }}>{aTiempoCount} a tiempo</span>
              {retardosCount > 0 && <span style={{ color: 'var(--status-warning)' }}> · {retardosCount} retardos</span>}
            </p>
          </div>
        </div>

        <div className="card card-glow" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '170px', padding: '1.75rem' }}>
          <div className="flex justify-between items-center">
            <span className="text-muted text-sm font-semibold">Retardos / Faltas</span>
            <div className="icon-box" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
              <AlertTriangle size={18} style={{ color: 'var(--status-danger)' }} />
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: '2.5rem', color: 'var(--accent-amber)', lineHeight: '1' }}>
              {loading ? '-' : retardosCount} <span style={{fontSize: '1.25rem', color: 'var(--text-muted)'}}>/ {loading ? '-' : ausenciasCount}</span>
            </h2>
            <p className="text-xs text-muted mt-2">Registros de hoy</p>
          </div>
        </div>

        <div className="card card-glow" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '170px', padding: '1.75rem' }}>
          <div className="flex justify-between items-center">
            <span className="text-muted text-sm font-semibold">Estado del Sistema</span>
            <div className="icon-box" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
              <Activity size={18} style={{ color: 'var(--status-success)' }} />
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: '2rem', color: 'var(--status-success)', lineHeight: '1', marginTop: '0.25rem' }}>Activo</h2>
            <p className="text-xs text-muted mt-3">4 cámaras, 2 nodos ~100%</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-3 gap-6">
        <div className="card col-span-2">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Tendencia Semanal</h3>
              <p className="text-xs text-muted">Asistencia y puntualidad de la semana actual</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#f97316' }}></span>
                <span style={{ color: 'var(--text-muted)' }}>Esperados ({employeesCount})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#eab308' }}></span>
                <span style={{ color: 'var(--text-muted)' }}>Asistieron</span>
              </div>
            </div>
          </div>

          <div style={{ width: '100%', height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#9a3412" stopOpacity={0.7}/>
                  </linearGradient>
                  <linearGradient id="barGradient2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#eab308" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#854d0e" stopOpacity={0.8}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="name" 
                  stroke="var(--text-muted)" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={10}
                  tick={({ x, y, payload }) => {
                    const item = barData.find(d => d.name === payload.value);
                    const isToday = item?.isToday;
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text 
                          x={0} 
                          y={12} 
                          textAnchor="middle" 
                          fill={isToday ? '#f97316' : 'var(--text-muted)'} 
                          fontWeight={isToday ? 700 : 500}
                          fontSize={12}
                        >
                          {payload.value} {isToday ? '•' : ''}
                        </text>
                      </g>
                    );
                  }}
                />
                <YAxis 
                  stroke="var(--text-muted)" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  dx={-5} 
                  allowDecimals={false}
                  domain={[0, Math.ceil(maxWeeklyValue * 1.15)]}
                  tickCount={5}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.04)', radius: 6 }} 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div style={{
                          backgroundColor: '#18181b',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                          minWidth: '180px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
                            <span style={{ fontWeight: 600, fontSize: '13px', color: '#f4f4f5' }}>
                              {data.fullName}
                            </span>
                            {data.isToday && (
                              <span style={{ fontSize: '10px', backgroundColor: 'rgba(249, 115, 22, 0.2)', color: '#f97316', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                HOY
                              </span>
                            )}
                            {data.isFuture && (
                              <span style={{ fontSize: '10px', backgroundColor: 'rgba(161, 161, 170, 0.1)', color: '#a1a1aa', padding: '1px 6px', borderRadius: '4px' }}>
                                Próximo
                              </span>
                            )}
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a1a1aa' }}>
                                <span style={{ width: 8, height: 8, borderRadius: '2px', backgroundColor: '#f97316' }}></span>
                                Esperados:
                              </span>
                              <span style={{ fontWeight: 600, color: '#f4f4f5' }}>{data.esperados}</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a1a1aa' }}>
                                <span style={{ width: 8, height: 8, borderRadius: '2px', backgroundColor: '#eab308' }}></span>
                                Asistieron:
                              </span>
                              <span style={{ fontWeight: 600, color: '#f4f4f5' }}>
                                {data.asistencias} {data.esperados > 0 ? `(${Math.round((data.asistencias / data.esperados) * 100)}%)` : ''}
                              </span>
                            </div>

                            {!data.isFuture && (
                              <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                                  <span>✓ A tiempo:</span>
                                  <span>{data.aTiempo}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#eab308' }}>
                                  <span>⚠ Con retardo:</span>
                                  <span>{data.retardos}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                                  <span>✕ Faltas:</span>
                                  <span>{data.faltas}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="esperados" name="Total Esperado" fill="url(#barGradient1)" radius={[4, 4, 0, 0]} barSize={26} />
                <Bar dataKey="asistencias" name="Asistieron" fill="url(#barGradient2)" radius={[4, 4, 0, 0]} barSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Distribución de Hoy</h3>
            <p className="text-xs text-muted mb-2">Estado de puntualidad de la jornada actual</p>
          </div>

          <div style={{ width: '100%', height: '220px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0];
                      const pct = employeesCount > 0 ? Math.round((data.value / employeesCount) * 100) : 0;
                      return (
                        <div style={{
                          backgroundColor: '#18181b',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                          color: '#fff',
                          fontSize: '12px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: data.payload.color }}></span>
                            <span>{data.name}:</span>
                            <span style={{ color: data.payload.color }}>{data.value} ({pct}%)</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Pie 
                  data={pieData} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={60} 
                  outerRadius={88} 
                  paddingAngle={pieData.length > 1 ? 3 : 0} 
                  dataKey="value" 
                  stroke="none"
                  filter="url(#neonGlow)"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Métrica centrada en el donut */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              textAlign: 'center'
            }}>
              <span style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: asistenciasHoy > 0 ? '#10b981' : 'var(--text-muted)',
                lineHeight: 1
              }}>
                {asistenciaPctHoy}%
              </span>
              <span style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                marginTop: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {asistenciasHoy} de {employeesCount}
              </span>
            </div>
          </div>

          {/* Leyenda y desglose en 3 columnas */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.5rem',
            marginTop: '0.5rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border-color)'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '0.4rem 0.25rem',
              borderRadius: '6px',
              backgroundColor: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.15)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#10b981' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                <span>A tiempo</span>
              </div>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f4f4f5', marginTop: '2px' }}>
                {aTiempoCount}
              </span>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '0.4rem 0.25rem',
              borderRadius: '6px',
              backgroundColor: 'rgba(234, 179, 8, 0.05)',
              border: '1px solid rgba(234, 179, 8, 0.15)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#eab308' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#eab308' }}></span>
                <span>Retardos</span>
              </div>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f4f4f5', marginTop: '2px' }}>
                {retardosCount}
              </span>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '0.4rem 0.25rem',
              borderRadius: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.15)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#ef4444' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
                <span>Faltas</span>
              </div>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f4f4f5', marginTop: '2px' }}>
                {ausenciasCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-3 gap-6">
        <div className="card col-span-2">
          <div className="flex-mobile-col flex justify-between items-center mb-6 gap-4">
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Actividad en Tiempo Real</h3>
              <p className="text-xs text-muted">Registro de entradas y salidas del día</p>
            </div>
            <div className="flex-mobile-col flex gap-4 mobile-w-full">
              <div style={{ position: 'relative' }} className="mobile-w-full">
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar empleado..." 
                  style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'white', padding: '0.5rem 1rem 0.5rem 2.5rem', borderRadius: '8px', fontSize: '0.875rem', outline: 'none' }} 
                />
                <svg style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>
              <select 
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', cursor: 'pointer' }}
              >
                <option value="Todos">Todos</option>
                <option value="Entradas">Entradas</option>
                <option value="Salidas">Salidas</option>
              </select>
            </div>
          </div>

          <div className="table-responsive-wrapper">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: '600px' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.75rem 0', textAlign: 'left', fontWeight: 500 }}>Empleado</th>
                  <th style={{ padding: '0.75rem 0', textAlign: 'left', fontWeight: 500 }}>Departamento</th>
                  <th style={{ padding: '0.75rem 0', textAlign: 'left', fontWeight: 500 }}>Hora</th>
                  <th style={{ padding: '0.75rem 0', textAlign: 'left', fontWeight: 500 }}>Tipo</th>
                  <th style={{ padding: '0.75rem 0', textAlign: 'left', fontWeight: 500 }}>Estado</th>
                  <th style={{ padding: '0.75rem 0', textAlign: 'left', fontWeight: 500 }}>Método</th>
                  <th style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 500 }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredActivity.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                      No se encontraron registros de actividad.
                    </td>
                  </tr>
                ) : (
                  filteredActivity.slice(0, 10).map(act => (
                    <tr key={act.id} style={{ borderBottom: '1px solid rgba(39, 39, 42, 0.5)' }}>
                      <td style={{ padding: '0.75rem 0' }}>
                        <div className="flex items-center gap-3">
                          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--accent-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-amber)', fontSize: '0.75rem', fontWeight: 600 }}>
                            {act.initials}
                          </div>
                          <span style={{ fontWeight: 500 }}>{act.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>{act.dept}</td>
                      <td style={{ padding: '0.75rem 0', color: 'var(--accent-amber)', fontFamily: 'monospace' }}>{act.time}</td>
                      <td style={{ padding: '0.75rem 0' }}><span style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-amber)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>{act.type}</span></td>
                      <td style={{ padding: '0.75rem 0' }}><span className={`badge ${act.statusColor}`}>{act.status}</span></td>
                      <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}><div className="flex items-center gap-1"><ScanFace size={14} /> Facial</div></td>
                      <td style={{ padding: '0.75rem 0', textAlign: 'right' }}><MoreHorizontal size={16} className="text-muted cursor-pointer hover:text-white" /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Alertas del Sistema</h3>
              <p className="text-xs text-muted">Notificaciones e incidencias</p>
            </div>
            <Link to="/dashboard/notifications" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'none' }}>Ver todas</Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {systemAlerts.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', marginTop: '1rem' }}>No hay alertas recientes.</p>
            ) : (
              systemAlerts.map(alert => (
                <div key={alert.id} style={{ backgroundColor: alert.bg, border: `1px solid ${alert.border}`, padding: '1rem', borderRadius: '8px', display: 'flex', gap: '1rem' }}>
                  <alert.Icon size={20} className={`flex-shrink-0 ${alert.iconColor}`} />
                  <div style={{ flex: 1 }}>
                    <div className="flex justify-between items-start">
                      <h4 style={{ color: alert.titleColor, fontSize: '0.875rem' }}>{alert.title}</h4>
                      <span onClick={() => removeAlert(alert.id)} style={{ color: alert.closeColor, fontSize: '1rem', cursor: 'pointer', padding: '0 4px' }}>×</span>
                    </div>
                    <p style={{ color: alert.descColor, fontSize: '0.75rem', marginTop: '0.25rem' }}>{alert.desc}</p>
                    <p style={{ color: alert.timeColor, fontSize: '0.7rem', marginTop: '0.5rem' }}>{alert.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
