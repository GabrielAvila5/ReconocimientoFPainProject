import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, RefreshCw, AlertCircle, Clock, CheckCircle, 
  UserX, Camera, Server, Activity, Users
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

// --- System Colors ---
const COLORS = {
  orange: '#f97316',
  red: '#ef4444',
  yellow: '#eab308',
  green: '#10b981',
  blue: '#3b82f6',
  dark: '#1e1e1e',
  darker: '#121212',
  border: '#3f3f46',
  text: '#fff',
  textMuted: '#a1a1aa'
};

// --- Mock Data Generators ---
const generateAttendanceMock = (days = 60) => {
  const data = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    
    // Line chart trends
    const base = isWeekend ? 0 : 40;
    const aTiempo = isWeekend ? 0 : base + Math.floor(Math.random() * 10);
    const tardanzas = isWeekend ? 0 : Math.floor(Math.random() * 8);
    const ausencias = isWeekend ? 0 : Math.floor(Math.random() * 3);
    
    data.push({
      date: dateStr,
      aTiempo,
      tardanzas,
      ausencias,
      permisos: isWeekend ? 0 : Math.floor(Math.random() * 2),
      timestamp: d.getTime()
    });
  }
  return data;
};

const generateDeviceMock = (days = 60) => {
  const data = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    
    data.push({
      date: dateStr,
      'CAM-01': isWeekend ? 50 : 300 + Math.floor(Math.random() * 100),
      'KIO-01': isWeekend ? 20 : 150 + Math.floor(Math.random() * 50),
      'CAM-02': isWeekend ? 30 : 200 + Math.floor(Math.random() * 80),
      timestamp: d.getTime()
    });
  }
  return data;
};

const generatePeakHoursMock = () => {
  const data = [];
  let h = 7;
  let m = 0;
  while (h <= 10) {
    const time = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    let base = 5;
    if (h === 8 && m >= 0 && m <= 30) base = 40; // Peak at 8:00 - 8:30
    if (h === 7 && m >= 45) base = 25;
    data.push({
      time,
      accesos: base + Math.floor(Math.random() * 15)
    });
    m += 15;
    if (m >= 60) {
      m = 0;
      h++;
    }
    if (h === 10 && m > 0) break;
  }
  return data;
};

const generateTableMockAttendance = (days = 7) => {
  const table = [];
  const depts = ['TI', 'RRHH', 'Operaciones', 'Ventas'];
  const emps = ['Juan Pérez', 'Ana Gómez', 'Carlos Ruiz', 'María Vega', 'Luis Soto'];
  const now = new Date();
  for (let i = 0; i < days * 5; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - Math.floor(Math.random() * days));
    
    const h = 7 + Math.floor(Math.random() * 2);
    const m = Math.floor(Math.random() * 60);
    const entrada = `0${h}:${String(m).padStart(2,'0')} AM`;
    const salida = `0${h + 9}:${String(m).padStart(2,'0')} PM`;
    
    const isTardy = (h === 8 && m > 15) || h > 8;
    
    table.push({
      id: `att-${i}`,
      empleado: emps[Math.floor(Math.random() * emps.length)],
      departamento: depts[Math.floor(Math.random() * depts.length)],
      fecha: d.toISOString().split('T')[0],
      entrada,
      salida,
      horas: '9.0',
      puntualidad: isTardy ? 'Tardanza' : 'A tiempo'
    });
  }
  return table;
};

const generateTableMockDevices = (days = 7) => {
  const table = [];
  const devices = ['CAM-01', 'KIO-01', 'CAM-02'];
  const locations = ['Entrada Principal', 'Recepción', 'Pasillo Norte'];
  const now = new Date();
  for (let i = 0; i < days * 3; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - Math.floor(Math.random() * days));
    const deviceIdx = Math.floor(Math.random() * devices.length);
    table.push({
      id: `dev-${i}`,
      dispositivo: devices[deviceIdx],
      ubicacion: locations[deviceIdx],
      fecha: d.toISOString().split('T')[0],
      lecturas: 150 + Math.floor(Math.random() * 200),
      uptime: '99.9%',
      estado: Math.random() > 0.9 ? 'Inestable' : 'En Línea'
    });
  }
  return table;
};

// --- Custom Recharts Tooltip ---
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: COLORS.dark, border: `1px solid ${COLORS.border}`, borderRadius: '8px', padding: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
        <p style={{ margin: '0 0 0.5rem 0', color: COLORS.text, fontWeight: 600 }}>{label}</p>
        {payload.map((entry, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
            <span style={{ display: 'block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: entry.color }} />
            <span style={{ color: COLORS.textMuted }}>{entry.name}:</span>
            <span style={{ color: COLORS.text, fontWeight: 500 }}>{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Helper for Initials
const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
};

// --- Component ---
const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('asistencia'); // 'asistencia' | 'dispositivos'
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros
  const [dateRange, setDateRange] = useState('Este Mes');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedDept, setSelectedDept] = useState('Todos los departamentos');
  const [departments, setDepartments] = useState([]);

  // Mock Data States
  const [attTrendData, setAttTrendData] = useState([]);
  const [devTrendData, setDevTrendData] = useState([]);
  const [peakHoursData, setPeakHoursData] = useState([]);
  const [attTableData, setAttTableData] = useState([]);
  const [devTableData, setDevTableData] = useState([]);

  useEffect(() => {
    // Simular fetch inicial
    setLoading(true);
    setTimeout(() => {
      setAttTrendData(generateAttendanceMock(60));
      setDevTrendData(generateDeviceMock(60));
      setPeakHoursData(generatePeakHoursMock());
      setAttTableData(generateTableMockAttendance(30));
      setDevTableData(generateTableMockDevices(30));
      setDepartments(['TI', 'RRHH', 'Operaciones', 'Ventas']);
      setLoading(false);
    }, 800);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  // --- Filtering Logic ---
  const filterByDateRange = (dataList) => {
    const now = new Date();
    let startTimestamp = 0;
    let endTimestamp = now.getTime();

    if (dateRange === 'Hoy') {
      const today = new Date(now.setHours(0,0,0,0));
      startTimestamp = today.getTime();
    } else if (dateRange === 'Últimos 7 días') {
      const past = new Date(now.setDate(now.getDate() - 7));
      startTimestamp = past.getTime();
    } else if (dateRange === 'Este Mes') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      startTimestamp = firstDay.getTime();
    } else if (dateRange === 'Personalizado') {
      if (customStart) startTimestamp = new Date(customStart).getTime();
      if (customEnd) endTimestamp = new Date(customEnd).setHours(23,59,59,999);
    }
    
    return dataList.filter(item => {
      // If item has timestamp (charts) or date string (tables)
      let itemTime = item.timestamp;
      if (!itemTime && item.fecha) {
        itemTime = new Date(item.fecha).getTime();
      }
      return itemTime >= startTimestamp && itemTime <= endTimestamp;
    });
  };

  const filteredAttTrend = useMemo(() => filterByDateRange(attTrendData), [attTrendData, dateRange, customStart, customEnd]);
  const filteredDevTrend = useMemo(() => filterByDateRange(devTrendData), [devTrendData, dateRange, customStart, customEnd]);
  
  // Lógica para filtrar tablas también por departamento
  const filteredAttTable = useMemo(() => {
    let res = filterByDateRange(attTableData);
    if (selectedDept !== 'Todos los departamentos') {
      res = res.filter(r => r.departamento === selectedDept);
    }
    return res;
  }, [attTableData, dateRange, customStart, customEnd, selectedDept]);
  
  const filteredDevTable = useMemo(() => filterByDateRange(devTableData), [devTableData, dateRange, customStart, customEnd]);

  // --- KPI Calculations (Asistencia) ---
  const attKPI = useMemo(() => {
    let totalATiempo = 0;
    let totalTardanzas = 0;
    let totalAusencias = 0;
    filteredAttTrend.forEach(d => {
      totalATiempo += d.aTiempo;
      totalTardanzas += d.tardanzas;
      totalAusencias += d.ausencias;
    });
    const total = totalATiempo + totalTardanzas;
    const pct = total > 0 ? Math.round((totalATiempo / total) * 100) : 0;
    return { pct, tardanzas: totalTardanzas, ausencias: totalAusencias, avgHours: '8.7' };
  }, [filteredAttTrend]);

  // --- KPI Calculations (Dispositivos) ---
  const devKPI = useMemo(() => {
    let totalLecturas = 0;
    const nodeTotals = { 'CAM-01': 0, 'KIO-01': 0, 'CAM-02': 0 };
    filteredDevTrend.forEach(d => {
      totalLecturas += (d['CAM-01'] + d['KIO-01'] + d['CAM-02']);
      nodeTotals['CAM-01'] += d['CAM-01'];
      nodeTotals['KIO-01'] += d['KIO-01'];
      nodeTotals['CAM-02'] += d['CAM-02'];
    });
    let topNode = 'N/A';
    let max = -1;
    Object.keys(nodeTotals).forEach(k => {
      if (nodeTotals[k] > max) { max = nodeTotals[k]; topNode = k; }
    });
    return { totalLecturas, topNode, enLinea: 3 }; // mock 3 active
  }, [filteredDevTrend]);

  // --- Doughnut Chart Data ---
  const doughnutData = useMemo(() => {
    let totalP = 0;
    filteredAttTrend.forEach(d => totalP += d.permisos);
    return [
      { name: 'A tiempo', value: attKPI.pct > 0 ? attKPI.pct : 80, color: COLORS.green },
      { name: 'Tardanzas', value: attKPI.tardanzas, color: COLORS.yellow },
      { name: 'Ausencias', value: attKPI.ausencias, color: COLORS.red },
      { name: 'Permisos', value: totalP, color: COLORS.blue }
    ];
  }, [attKPI, filteredAttTrend]);

  // --- Bar Chart Dispositivos Data ---
  const devBarData = useMemo(() => {
    const nodeTotals = { 'CAM-01': 0, 'KIO-01': 0, 'CAM-02': 0 };
    filteredDevTrend.forEach(d => {
      nodeTotals['CAM-01'] += d['CAM-01'];
      nodeTotals['KIO-01'] += d['KIO-01'];
      nodeTotals['CAM-02'] += d['CAM-02'];
    });
    return Object.keys(nodeTotals).map(k => ({ name: k, lecturas: nodeTotals[k] }));
  }, [filteredDevTrend]);

  // --- Exports ---
  const exportToCSV = () => {
    let headers, rows;
    let filename = `Reporte_${activeTab === 'asistencia' ? 'Asistencia' : 'Dispositivos'}.csv`;
    
    if (activeTab === 'asistencia') {
      headers = ['Empleado', 'Departamento', 'Fecha', 'Hora Entrada', 'Hora Salida', 'Horas', 'Puntualidad'];
      rows = filteredAttTable.map(r => [r.empleado, r.departamento, r.fecha, r.entrada, r.salida, r.horas, r.puntualidad]);
    } else {
      headers = ['Dispositivo', 'Ubicación', 'Fecha', 'Lecturas', 'Uptime', 'Estado'];
      rows = filteredDevTable.map(r => [r.dispositivo, r.ubicacion, r.fecha, r.lecturas, r.uptime, r.estado]);
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(str => `"${String(str).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  // --- Render Helpers ---
  const renderCard = (title, value, subtitle, Icon, color) => (
    <div className="card-glow" style={{ ...cardStyle, background: `rgba(${color}, 0.05)`, border: `1px solid rgba(${color}, 0.3)`, boxShadow: `0 4px 20px rgba(${color}, 0.05)` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: COLORS.textMuted, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>{title}</span>
        <Icon size={18} style={{ color: `rgb(${color})` }} />
      </div>
      <div>
        <h2 style={{ fontSize: '2.5rem', color: `rgb(${color})`, lineHeight: '1', margin: '1rem 0 0.5rem 0' }}>
          {loading ? <Skeleton width="60px" height="40px" /> : value}
        </h2>
        <p className="text-xs text-muted" style={{ margin: 0 }}>{subtitle}</p>
      </div>
    </div>
  );

  return (
    <div className="fade-in" style={{ paddingBottom: '2rem' }}>
      
      {/* Styles for PDF Print */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-report, .printable-report * { visibility: visible; }
          .printable-report { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .card-glow { page-break-inside: avoid; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: COLORS.text, margin: 0, fontSize: '1.8rem' }}>Reportes y Analíticas</h2>
          <p style={{ color: COLORS.textMuted, margin: '0.5rem 0 0 0', fontSize: '0.95rem' }}>Visualiza, analiza y exporta los datos de asistencia y dispositivos.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={handleRefresh}
            style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            disabled={refreshing || loading}
          >
            <RefreshCw size={18} className={refreshing ? "spin-animation" : ""} /> 
            Actualizar
          </button>
          <button 
            onClick={exportToCSV}
            style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Download size={18} /> Exportar CSV
          </button>
          <button 
            onClick={handlePrint}
            style={{ ...btnPrimary, background: COLORS.blue, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Download size={18} /> Exportar PDF
          </button>
        </div>
      </div>

      {/* Global Filters */}
      <div className="no-print" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', background: COLORS.darker, padding: '1rem', borderRadius: '12px', border: `1px solid ${COLORS.border}`, alignItems: 'center', flexWrap: 'wrap' }}>
        
        <select 
          style={selectStyle} 
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
        >
          <option>Hoy</option>
          <option>Últimos 7 días</option>
          <option>Este Mes</option>
          <option>Personalizado</option>
        </select>

        {dateRange === 'Personalizado' && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input 
              type="date" 
              style={selectStyle} 
              value={customStart}
              max={customEnd || undefined}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span style={{ color: COLORS.textMuted }}>-</span>
            <input 
              type="date" 
              style={selectStyle} 
              value={customEnd}
              min={customStart || undefined}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
        )}

        <select 
          style={selectStyle} 
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
        >
          <option>Todos los departamentos</option>
          {departments.map(d => <option key={d}>{d}</option>)}
        </select>
        
      </div>

      {/* Content wrapper for PDF */}
      <div className="printable-report">
        
        {/* Print Only Header */}
        <div style={{ display: 'none', marginBottom: '2rem' }} className="print-only">
          <h1 style={{ color: '#000', fontSize: '24px' }}>Reporte de {activeTab === 'asistencia' ? 'Asistencia' : 'Dispositivos'}</h1>
          <p style={{ color: '#555' }}>Generado el {new Date().toLocaleDateString()}</p>
          <hr style={{ border: '1px solid #ddd' }} />
        </div>

        {/* Tabs */}
        <div className="no-print" style={{ display: 'flex', background: COLORS.darker, borderRadius: '8px', padding: '4px', border: `1px solid ${COLORS.border}`, width: 'fit-content', marginBottom: '2rem' }}>
          <button 
            onClick={() => setActiveTab('asistencia')} 
            style={{ ...toggleBtn, background: activeTab === 'asistencia' ? 'rgba(249, 115, 22, 0.1)' : 'transparent', color: activeTab === 'asistencia' ? COLORS.orange : COLORS.textMuted }}
          >
            Asistencia
          </button>
          <button 
            onClick={() => setActiveTab('dispositivos')} 
            style={{ ...toggleBtn, background: activeTab === 'dispositivos' ? 'rgba(249, 115, 22, 0.1)' : 'transparent', color: activeTab === 'dispositivos' ? COLORS.orange : COLORS.textMuted }}
          >
            Dispositivos
          </button>
        </div>

        {/* TAB 1: ASISTENCIA */}
        {activeTab === 'asistencia' && (
          <div className="fade-in">
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              {renderCard('Puntualidad Prom.', `${attKPI.pct}%`, 'En el rango seleccionado', CheckCircle, '16, 185, 129')}
              {renderCard('Total Tardanzas', attKPI.tardanzas, 'Llegadas después de 08:15 AM', Clock, '249, 115, 22')}
              {renderCard('Total Ausencias', attKPI.ausencias, 'Sin registro en días laborables', UserX, '239, 68, 68')}
              
              {/* Horas Promedio */}
              <div className="card-glow" style={{ ...cardStyle, background: `rgba(59, 130, 246, 0.05)`, border: `1px solid rgba(59, 130, 246, 0.3)`, boxShadow: `0 4px 20px rgba(59, 130, 246, 0.05)` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: COLORS.textMuted, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>Horas Promedio</span>
                  <Clock size={18} style={{ color: COLORS.blue }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '2.5rem', color: COLORS.blue, lineHeight: '1', margin: '1rem 0 0.5rem 0' }}>
                    {loading ? <Skeleton width="60px" height="40px" /> : `${attKPI.avgHours}h`}
                  </h2>
                  <p className="text-xs text-muted" style={{ margin: 0 }}>Registros completos (E/S)</p>
                  {/* // TODO: incluir registros sin salida cuando se implemente cierre automático de turno. */}
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }} className="charts-grid">
              {/* Line Chart */}
              <div style={{ ...cardStyle, gridColumn: '1 / -1', height: '400px' }}>
                <h3 style={{ margin: '0 0 1.5rem 0', color: COLORS.text, fontSize: '1.1rem' }}>Tendencia de Asistencia</h3>
                {loading ? <Skeleton width="100%" height="300px" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredAttTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                      <XAxis dataKey="date" stroke={COLORS.textMuted} fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke={COLORS.textMuted} fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" />
                      <Line type="monotone" name="A tiempo" dataKey="aTiempo" stroke={COLORS.green} strokeWidth={3} dot={{r: 0}} activeDot={{r: 6}} animationDuration={1000} />
                      <Line type="monotone" name="Tardanzas" dataKey="tardanzas" stroke={COLORS.yellow} strokeWidth={3} dot={{r: 0}} activeDot={{r: 6}} animationDuration={1000} />
                      <Line type="monotone" name="Ausencias" dataKey="ausencias" stroke={COLORS.red} strokeWidth={3} dot={{r: 0}} activeDot={{r: 6}} animationDuration={1000} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Doughnut Chart */}
              <div style={{ ...cardStyle, height: '350px' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: COLORS.text, fontSize: '1.1rem' }}>Distribución del Período</h3>
                {loading ? <Skeleton width="100%" height="250px" /> : (
                  <div style={{ position: 'relative', width: '100%', height: 'calc(100% - 2rem)' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                      <defs>
                        <filter id="neonGlowReport" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                      </defs>
                      <Pie
                        data={doughnutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={75}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                        animationDuration={1000}
                        filter="url(#neonGlowReport)"
                      >
                        {doughnutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend 
                        iconType="circle" 
                        verticalAlign="bottom" 
                        height={36} 
                        wrapperStyle={{ fontSize: '0.75rem', color: COLORS.textMuted }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Etiqueta Central - Posicionada de forma absoluta */}
                  <div style={{ position: 'absolute', top: 'calc(50% - 10px)', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: COLORS.text, lineHeight: '1' }}>{attKPI.pct}%</div>
                    <div style={{ fontSize: '0.75rem', color: COLORS.textMuted, marginTop: '0.25rem' }}>A tiempo</div>
                  </div>
                </div>
                )}
              </div>

              {/* Bar Chart (Horas Pico) */}
              <div style={{ ...cardStyle, height: '350px' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: COLORS.text, fontSize: '1.1rem' }}>Horas Pico de Acceso (Mañana)</h3>
                {loading ? <Skeleton width="100%" height="250px" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={peakHoursData} margin={{ top: 5, right: 5, bottom: 25, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                      <XAxis dataKey="time" stroke={COLORS.textMuted} fontSize={11} tickLine={false} axisLine={false} dy={10} interval={1} height={40} />
                      <YAxis stroke={COLORS.textMuted} fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar name="Accesos" dataKey="accesos" fill={COLORS.orange} radius={[4, 4, 0, 0]} animationDuration={1000}>
                        {peakHoursData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS.orange} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Table */}
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: COLORS.darker, borderBottom: `1px solid ${COLORS.border}` }}>
                    <th style={thStyle}>Empleado</th>
                    <th style={thStyle}>Departamento</th>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Entrada</th>
                    <th style={thStyle}>Salida</th>
                    <th style={thStyle}>Horas</th>
                    <th style={thStyle}>Puntualidad</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttTable.length === 0 ? (
                    <tr><td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: COLORS.textMuted }}>No hay datos para el filtro seleccionado.</td></tr>
                  ) : filteredAttTable.slice(0, 20).map((row) => ( // Paginacion simulada (primeras 20)
                    <tr key={row.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.orange, fontSize: '0.75rem', fontWeight: 600 }}>
                            {getInitials(row.empleado)}
                          </div>
                          <span style={{ fontWeight: 500 }}>{row.empleado}</span>
                        </div>
                      </td>
                      <td style={tdStyle}>{row.departamento}</td>
                      <td style={tdStyle}>{row.fecha}</td>
                      <td style={tdStyle}>{row.entrada}</td>
                      <td style={tdStyle}>{row.salida}</td>
                      <td style={tdStyle}>{row.horas}</td>
                      <td style={tdStyle}>
                        <span style={{ 
                          color: row.puntualidad === 'A tiempo' ? COLORS.green : COLORS.yellow,
                          background: row.puntualidad === 'A tiempo' ? 'rgba(16,185,129,0.1)' : 'rgba(234,179,8,0.1)',
                          padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem'
                        }}>
                          {row.puntualidad}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="no-print" style={{ padding: '1rem', textAlign: 'center', color: COLORS.textMuted, fontSize: '0.85rem' }}>
                Mostrando hasta 20 filas (Paginación simulada)
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DISPOSITIVOS */}
        {activeTab === 'dispositivos' && (
          <div className="fade-in">
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              {renderCard('Total Lecturas', devKPI.totalLecturas.toLocaleString(), 'En el rango seleccionado', Activity, '249, 115, 22')}
              {renderCard('Disp. En Línea', devKPI.enLinea, 'Nodos activos actualmente', Server, '16, 185, 129')}
              {renderCard('Más Activo', devKPI.topNode, 'Mayor volumen de lecturas', Camera, '59, 130, 246')}
            </div>

            {/* Note about missing metrics */}
            {/* // TODO: agregar métricas de rechazo cuando el backend implemente el log de intentos fallidos. */}

            {/* Charts Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', marginBottom: '2rem' }} className="charts-grid-dev">
              
              {/* Bar Chart - Lecturas por dispositivo */}
              <div style={{ ...cardStyle, height: '350px' }}>
                <h3 style={{ margin: '0 0 1.5rem 0', color: COLORS.text, fontSize: '1.1rem' }}>Lecturas por Dispositivo</h3>
                {loading ? <Skeleton width="100%" height="250px" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={devBarData} margin={{ top: 5, right: 5, bottom: 20, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                      <XAxis dataKey="name" stroke={COLORS.textMuted} fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke={COLORS.textMuted} fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar name="Lecturas" dataKey="lecturas" fill={COLORS.orange} radius={[4, 4, 0, 0]} animationDuration={1000} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Line Chart - Actividad diaria */}
              <div style={{ ...cardStyle, height: '350px' }}>
                <h3 style={{ margin: '0 0 1.5rem 0', color: COLORS.text, fontSize: '1.1rem' }}>Actividad Diaria por Nodo</h3>
                {loading ? <Skeleton width="100%" height="250px" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredDevTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                      <XAxis dataKey="date" stroke={COLORS.textMuted} fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke={COLORS.textMuted} fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" />
                      <Line type="monotone" name="CAM-01" dataKey="CAM-01" stroke={COLORS.blue} strokeWidth={2} dot={false} activeDot={{r: 4}} />
                      <Line type="monotone" name="KIO-01" dataKey="KIO-01" stroke={COLORS.orange} strokeWidth={2} dot={false} activeDot={{r: 4}} />
                      <Line type="monotone" name="CAM-02" dataKey="CAM-02" stroke={COLORS.green} strokeWidth={2} dot={false} activeDot={{r: 4}} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Table */}
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: COLORS.darker, borderBottom: `1px solid ${COLORS.border}` }}>
                    <th style={thStyle}>Dispositivo</th>
                    <th style={thStyle}>Ubicación</th>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Lecturas Totales</th>
                    <th style={thStyle}>Uptime</th>
                    <th style={thStyle}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDevTable.length === 0 ? (
                    <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: COLORS.textMuted }}>No hay datos para el filtro seleccionado.</td></tr>
                  ) : filteredDevTable.slice(0, 20).map((row) => (
                    <tr key={row.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td style={tdStyle}>{row.dispositivo}</td>
                      <td style={tdStyle}>{row.ubicacion}</td>
                      <td style={tdStyle}>{row.fecha}</td>
                      <td style={tdStyle}>{row.lecturas}</td>
                      <td style={tdStyle}>{row.uptime}</td>
                      <td style={tdStyle}>
                        <span style={{ 
                          color: row.estado === 'En Línea' ? COLORS.green : COLORS.yellow,
                          background: row.estado === 'En Línea' ? 'rgba(16,185,129,0.1)' : 'rgba(234,179,8,0.1)',
                          padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem'
                        }}>
                          {row.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="no-print" style={{ padding: '1rem', textAlign: 'center', color: COLORS.textMuted, fontSize: '0.85rem' }}>
                Mostrando hasta 20 filas (Paginación simulada)
              </div>
            </div>

          </div>
        )}

      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .spin-animation { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        
        @media print {
          .print-only { display: block !important; }
          .charts-grid, .charts-grid-dev { display: block !important; }
          .charts-grid > div, .charts-grid-dev > div { 
             page-break-inside: avoid; 
             margin-bottom: 2rem; 
             border: 1px solid #ddd !important;
          }
          body { background: #fff !important; color: #000 !important; }
          * { color: #000 !important; }
        }
      `}} />
    </div>
  );
};

// --- Subcomponents & Styles ---
const Skeleton = ({ width, height }) => (
  <div style={{ width, height, borderRadius: '8px', background: 'linear-gradient(90deg, #27272a 25%, #3f3f46 50%, #27272a 75%)', backgroundSize: '200% 100%', animation: 'skeleton-loading 1.5s infinite' }} className="skeleton" />
);

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

const selectStyle = {
  background: 'transparent',
  border: '1px solid #3f3f46',
  color: '#fff',
  padding: '0.6rem 1rem',
  borderRadius: '8px',
  outline: 'none',
  fontSize: '0.9rem',
  cursor: 'pointer'
};

const toggleBtn = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: '6px',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s'
};

const cardStyle = {
  background: COLORS.dark,
  borderRadius: '12px',
  padding: '1.5rem',
  border: `1px solid ${COLORS.border}`,
  position: 'relative',
  overflow: 'hidden'
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.9rem'
};

const thStyle = {
  padding: '1rem 1.5rem',
  textAlign: 'left',
  fontWeight: 600,
  color: COLORS.textMuted
};

const tdStyle = {
  padding: '1rem 1.5rem',
  color: COLORS.text,
  borderBottom: `1px solid ${COLORS.border}`
};

export default ReportsPage;
