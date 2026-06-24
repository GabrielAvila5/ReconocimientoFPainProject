import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Download, CheckCircle, Clock, AlertTriangle, Calendar, AlertCircle, RefreshCw } from 'lucide-react';

const AttendancePage = () => {
  const [settings, setSettings] = useState(null);
  
  const getTodayString = () => new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  
  const [attendance, setAttendance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [attRes, empRes, setRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/v1/attendance?date=${selectedDate}`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/v1/employees`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/v1/settings/public`, { headers }).catch(() => null)
      ]);
      
      if (!attRes.ok || !empRes.ok) {
        throw new Error('Error al obtener datos del servidor');
      }
      
      const [attData, empData] = await Promise.all([
        attRes.json(),
        empRes.json()
      ]);
      
      const setData = setRes && setRes.ok ? await setRes.json() : null;
      // TODO: fallback a defaults
      setSettings(setData || { workdayStartHour: 8, workdayStartMinute: 0, latenessToleranceMin: 15 });
      
      setAttendance(attData);
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
  }, [selectedDate]);

  // Procesar y fusionar datos (Registros + Faltas)
  const combinedRecords = useMemo(() => {
    if (!employees || employees.length === 0 || !settings) return [];
    
    // Calcular TIME_LIMIT dinámico
    let totalMinutes = (settings.workdayStartHour * 60) + settings.workdayStartMinute + settings.latenessToleranceMin;
    const limitHour = Math.floor(totalMinutes / 60) % 24;
    const limitMinute = totalMinutes % 60;
    const TIME_LIMIT = `${limitHour.toString().padStart(2, '0')}:${limitMinute.toString().padStart(2, '0')}:00`;

    const records = [];
    
    // Diccionario para saber quién ya tiene registro
    const recordedEmployeeIds = new Set();
    
    // Procesar registros del día
    attendance.forEach(record => {
      recordedEmployeeIds.add(record.employeeId);
      
      const employee = record.employee || {};
      
      // Calcular horas (ignorando fecha para validar horario)
      const entradaTime = record.entrada ? new Date(record.entrada).toTimeString().split(' ')[0] : null;
      const salidaTime = record.salida ? new Date(record.salida).toTimeString().split(' ')[0] : null;
      
      let puntualidad = 'A tiempo';
      if (entradaTime && entradaTime > TIME_LIMIT) puntualidad = 'Retardo';
      if (!entradaTime) puntualidad = 'Falta'; // Caso extremo
      
      let tipoStr = 'Entrada';
      if (record.entrada && !record.salida) tipoStr = 'Sin salida';
      if (record.entrada && record.salida) tipoStr = 'Entrada / Salida';
      
      records.push({
        id: record.id,
        employee,
        horaMarcaje: entradaTime || '—',
        horaSalida: salidaTime || '—',
        tipo: tipoStr,
        puntualidad,
        departamento: employee.department?.name || 'Sin departamento',
        metodo: 'Facial - CAM 01', // Harcoded as requested or default
      });
    });
    
    // Agregar "Faltas" (empleados activos sin registro)
    employees.forEach(emp => {
      if (emp.isActive && !recordedEmployeeIds.has(emp.id)) {
        records.push({
          id: `falta-${emp.id}`,
          employee: emp,
          horaMarcaje: '—',
          horaSalida: '—',
          tipo: '—',
          puntualidad: 'Falta',
          departamento: emp.department?.name || 'Sin departamento',
          metodo: '—',
        });
      }
    });
    
    return records;
  }, [attendance, employees, settings]);

  // Aplicar Filtros (Buscador y Departamento)
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
      
      return matchSearch && matchDepartment;
    });
  }, [combinedRecords, searchTerm, selectedDepartment]);

  // Extraer departamentos para dropdown
  const departments = useMemo(() => {
    const deps = employees.map(emp => emp.department?.name).filter(Boolean);
    return [...new Set(deps)];
  }, [employees]);

  // Estadísticas (sobre el total del día, no sobre los filtrados)
  const totalATiempo = combinedRecords.filter(r => r.puntualidad === 'A tiempo').length;
  const totalRetardos = combinedRecords.filter(r => r.puntualidad === 'Retardo').length;
  const totalFaltas = combinedRecords.filter(r => r.puntualidad === 'Falta').length;
  const puntualidadPorcentaje = combinedRecords.length > 0 && (totalATiempo + totalRetardos) > 0
    ? Math.round((totalATiempo / (totalATiempo + totalRetardos)) * 100) 
    : 0;

  // Exportar a CSV con BOM UTF-8
  const exportToCSV = () => {
    if (filteredRecords.length === 0) return;
    
    const headers = ['Nombre', 'Correo', 'Departamento', 'Puntualidad', 'Hora Entrada', 'Hora Salida', 'Tipo', 'Método'];
    const rows = filteredRecords.map(r => [
      `${r.employee.firstName} ${r.employee.lastName}`,
      r.employee.email || r.employee.identifier,
      r.departamento,
      r.puntualidad,
      r.horaMarcaje,
      r.horaSalida,
      r.tipo,
      r.metodo
    ]);
    
    // Crear CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(str => `"${String(str).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    // Añadir BOM para UTF-8 (permite acentos en Excel)
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_Asistencia_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fade-in" style={{ paddingBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ color: '#fff', margin: 0, fontSize: '1.8rem' }}>Registro de Asistencia</h2>
          <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0 0', fontSize: '0.95rem' }}>Monitoreo en tiempo real de entradas, salidas y alertas.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          {/* Date Picker */}
          <div style={{ position: 'relative' }}>
            <Calendar size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa' }} />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ ...inputStyle, paddingLeft: '2.25rem', width: 'auto', background: 'transparent', border: '1px solid #3f3f46' }}
            />
          </div>
          
          <button 
            onClick={exportToCSV}
            disabled={loading || filteredRecords.length === 0}
            style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: (loading || filteredRecords.length === 0) ? 0.5 : 1 }}
          >
            <Download size={18} /> Exportar Reporte
          </button>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Card 1: A Tiempo */}
        <div className="card card-glow-yellow" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '170px', padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-muted text-sm font-semibold">Asistencias a Tiempo</span>
            <div className="icon-box" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)' }}>
              <CheckCircle size={18} style={{ color: '#eab308' }} />
            </div>
          </div>
          <div>
            {loading ? <Skeleton height="2.5rem" width="60px" /> : <h2 style={{ fontSize: '2.5rem', color: '#eab308', lineHeight: '1', margin: '0' }}>{totalATiempo}</h2>}
            {loading ? <Skeleton height="1rem" width="110px" style={{ marginTop: '0.75rem' }} /> : <p className="text-xs text-muted mt-2" style={{ margin: '0.75rem 0 0 0' }}>{puntualidadPorcentaje}% de puntualidad hoy</p>}
          </div>
        </div>

        {/* Card 2: Retardos */}
        <div className="card card-glow" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '170px', padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-muted text-sm font-semibold">Retardos Registrados</span>
            <div className="icon-box" style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)' }}>
              <Clock size={18} style={{ color: '#f97316' }} />
            </div>
          </div>
          <div>
            {loading ? <Skeleton height="2.5rem" width="60px" /> : <h2 style={{ fontSize: '2.5rem', color: '#f97316', lineHeight: '1', margin: '0' }}>{totalRetardos}</h2>}
            {loading || !settings ? <Skeleton height="1rem" width="110px" style={{ marginTop: '0.75rem' }} /> : (
              (() => {
                let totalMinutes = (settings.workdayStartHour * 60) + settings.workdayStartMinute + settings.latenessToleranceMin;
                const limitHour = Math.floor(totalMinutes / 60) % 24;
                const limitMinute = totalMinutes % 60;
                return <p className="text-xs text-muted mt-2" style={{ margin: '0.75rem 0 0 0' }}>Después de las {`${limitHour.toString().padStart(2, '0')}:${limitMinute.toString().padStart(2, '0')}`}</p>;
              })()
            )}
          </div>
        </div>

        {/* Card 3: Faltas */}
        <div className="card card-glow-red" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '170px', padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-muted text-sm font-semibold" style={{ color: '#ef4444' }}>Ausencias / Faltas</span>
            <div className="icon-box" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
              <AlertTriangle size={18} style={{ color: '#ef4444' }} />
            </div>
          </div>
          <div>
            {loading ? <Skeleton height="2.5rem" width="60px" /> : <h2 style={{ fontSize: '2.5rem', color: '#ef4444', lineHeight: '1', margin: '0' }}>{totalFaltas}</h2>}
            {loading ? <Skeleton height="1rem" width="120px" style={{ marginTop: '0.75rem' }} /> : <p className="text-xs text-muted mt-2" style={{ margin: '0.75rem 0 0 0', color: '#fca5a5' }}>Requiere revisión</p>}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa' }} />
          <input 
            type="text" 
            placeholder="Buscar registro por nombre o correo..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.5rem' }}
          />
        </div>
        
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Filter size={18} /> Filtrar por Departamento
          </button>
          
          {isFilterOpen && (
            <div style={dropdownMenu}>
              <div 
                style={dropdownItem} 
                onClick={() => { setSelectedDepartment(''); setIsFilterOpen(false); }}
              >
                Todos los departamentos
              </div>
              {departments.map(dep => (
                <div 
                  key={dep} 
                  style={dropdownItem}
                  onClick={() => { setSelectedDepartment(dep); setIsFilterOpen(false); }}
                >
                  {dep}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* States & Table */}
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
          <table style={tableStyle}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333' }}>
                <th style={thStyle}>Empleado</th>
                <th style={thStyle}>Hora de Entrada</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Puntualidad</th>
                <th style={thStyle}>Departamento</th>
                <th style={thStyle}>Método / Cámara</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4].map(i => (
                <tr key={i} style={{ borderBottom: '1px solid #333' }}>
                  <td style={tdStyle}><Skeleton height="40px" width="150px" /></td>
                  <td style={tdStyle}><Skeleton height="20px" width="80px" /></td>
                  <td style={tdStyle}><Skeleton height="20px" width="70px" /></td>
                  <td style={tdStyle}><Skeleton height="24px" width="60px" borderRadius="12px" /></td>
                  <td style={tdStyle}><Skeleton height="20px" width="100px" /></td>
                  <td style={tdStyle}><Skeleton height="20px" width="120px" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ background: '#1e1e1e', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
          {/* TODO: Turnos Nocturnos. El filtro strict 'date' puede cortar registros que entran en D y salen en D+1. */}
          <table style={tableStyle}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333', background: '#18181b' }}>
                <th style={thStyle}>Empleado</th>
                <th style={thStyle}>Hora de Entrada</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Puntualidad</th>
                <th style={thStyle}>Departamento</th>
                <th style={thStyle}>Método / Cámara</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: '#a1a1aa' }}>
                    No se encontraron registros para esta fecha o filtros.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const getInitials = (f, l) => `${(f||'').charAt(0)}${(l||'').charAt(0)}`.toUpperCase();
                  
                  // Colores de Puntualidad
                  let badgeColor = '#10b981'; // A tiempo
                  let badgeBg = 'rgba(16, 185, 129, 0.1)';
                  if (record.puntualidad === 'Retardo') {
                    badgeColor = '#eab308';
                    badgeBg = 'rgba(234, 179, 8, 0.1)';
                  } else if (record.puntualidad === 'Falta') {
                    badgeColor = '#ef4444';
                    badgeBg = 'rgba(239, 68, 68, 0.1)';
                  }

                  // Colores de Tipo
                  let tipoColor = '#e4e4e7';
                  if (record.tipo === 'Sin salida') tipoColor = '#f97316';
                  if (record.tipo === '—') tipoColor = '#52525b';

                  return (
                    <tr key={record.id} style={{ borderBottom: '1px solid #333', transition: 'background-color 0.2s' }} className="table-row-hover">
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.2)', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {getInitials(record.employee.firstName, record.employee.lastName)}
                          </div>
                          <div>
                            <div style={{ color: '#fff', fontWeight: 500 }}>{record.employee.firstName} {record.employee.lastName}</div>
                            <div style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>{record.employee.email || record.employee.identifier}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, color: '#a1a1aa' }}>
                        {record.horaMarcaje !== '—' && <Clock size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }}/>}
                        {record.horaMarcaje}
                      </td>
                      <td style={{ ...tdStyle, color: tipoColor, fontWeight: record.tipo === 'Sin salida' ? 500 : 'normal' }}>
                        {record.tipo}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ padding: '0.25rem 0.75rem', background: badgeBg, color: badgeColor, borderRadius: '999px', fontSize: '0.75rem', fontWeight: 500, border: `1px solid ${badgeBg}` }}>
                          {record.puntualidad}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ color: '#e4e4e7' }}>{record.departamento}</div>
                      </td>
                      <td style={{ ...tdStyle, color: '#a1a1aa' }}>
                        {record.metodo}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
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
  minWidth: '200px',
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
