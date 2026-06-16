import React from 'react';
import { Users, Clock, AlertTriangle, Activity, AlertCircle, ThermometerSnowflake, CameraOff, MoreHorizontal, ScanFace } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const DashboardOverview = () => {
  // Mock data for Tendencia Semanal (2 bars per day as in screenshot)
  const barData = [
    { name: 'Lun', value1: 240, value2: 210 },
    { name: 'Mar', value1: 245, value2: 220 },
    { name: 'Mié', value1: 235, value2: 200 },
    { name: 'Jue', value1: 250, value2: 240 },
    { name: 'Vie', value1: 238, value2: 225 },
  ];

  // Mock data for Distribucion de Hoy
  const pieData = [
    { name: 'A tiempo', value: 75, color: '#f97316' }, 
    { name: 'Retardo', value: 14, color: '#eab308' },  
    { name: 'Falta', value: 7, color: '#b45309' },     
    { name: 'Permiso', value: 4, color: '#78350f' },   
  ];

  // Mock data for Actividad
  const recentActivity = [
    { id: 1, initials: 'MG', name: 'María García', dept: 'Desarrollo', time: '08:02:34', type: 'Entrada', status: 'A tiempo', statusColor: 'badge-success' },
    { id: 2, initials: 'CL', name: 'Carlos López', dept: 'Marketing', time: '08:15:22', type: 'Entrada', status: 'Retardo', statusColor: 'badge-warning' },
    { id: 3, initials: 'AM', name: 'Ana Martínez', dept: 'Ventas', time: '07:58:11', type: 'Entrada', status: 'A tiempo', statusColor: 'badge-success' },
    { id: 4, initials: 'PS', name: 'Pedro Sánchez', dept: 'Recursos Humanos', time: '08:01:45', type: 'Entrada', status: 'A tiempo', statusColor: 'badge-success' },
    { id: 5, initials: 'LT', name: 'Laura Torres', dept: 'Finanzas', time: '08:22:03', type: 'Entrada', status: 'Retardo', statusColor: 'badge-warning' },
    { id: 6, initials: 'RD', name: 'Roberto Díaz', dept: 'Desarrollo', time: '12:30:15', type: 'Salida', status: 'Normal', statusColor: 'badge-neutral' },
  ];

  // Custom Label for Pie Chart
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value, color }) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 20;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    return (
      <text x={x} y={y} fill={color} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12} fontWeight={500}>
        {`${name} ${value}%`}
      </text>
    );
  };

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
            <h2 style={{ fontSize: '2.5rem', color: 'var(--primary-orange)', lineHeight: '1' }}>248</h2>
            <p className="text-xs text-muted mt-2"><span style={{ color: 'var(--status-success)' }}>92%</span> asistencia hoy ~+3</p>
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
            <h2 style={{ fontSize: '2.5rem', color: 'var(--accent-amber)', lineHeight: '1' }}>228</h2>
            <p className="text-xs text-muted mt-2">A tiempo ~+12</p>
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
            <h2 style={{ fontSize: '2.5rem', color: 'var(--accent-amber)', lineHeight: '1' }}>15 <span style={{fontSize: '1.25rem', color: 'var(--text-muted)'}}>/ 5</span></h2>
            <p className="text-xs text-muted mt-2">8 justificados ~-2</p>
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
          <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Tendencia Semanal</h3>
          <p className="text-xs text-muted mb-6">Asistencia y puntualidad de la semana actual</p>
          <div style={{ width: '100%', height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#9a3412" stopOpacity={0.8}/>
                  </linearGradient>
                  <linearGradient id="barGradient2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#eab308" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#854d0e" stopOpacity={0.8}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} dx={-10} ticks={[0, 65, 130, 195, 260]} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                <Bar dataKey="value1" fill="url(#barGradient1)" radius={[2, 2, 0, 0]} barSize={35} />
                <Bar dataKey="value2" fill="url(#barGradient2)" radius={[2, 2, 0, 0]} barSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Distribución de Hoy</h3>
          <p className="text-xs text-muted mb-2">Estado de puntualidad de la jornada actual</p>
          <div style={{ width: '100%', height: '240px', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
                <Pie 
                  data={pieData} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={55} 
                  outerRadius={85} 
                  paddingAngle={2} 
                  dataKey="value" 
                  stroke="none"
                  labelLine={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }}
                  label={renderCustomizedLabel}
                  filter="url(#neonGlow)"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 text-xs mt-4">
            {pieData.map(item => (
              <div key={item.name} className="flex items-center gap-1">
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color }}></div>
                <span className="text-muted">{item.name}</span>
              </div>
            ))}
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
                <input type="text" placeholder="Buscar empleado..." style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'white', padding: '0.5rem 1rem 0.5rem 2.5rem', borderRadius: '8px', fontSize: '0.875rem', outline: 'none' }} />
                <svg style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>
              <select style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', cursor: 'pointer' }}>
                <option>Todos</option>
                <option>Entradas</option>
                <option>Salidas</option>
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
                {recentActivity.map(act => (
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
                ))}
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
            <a href="#" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'none' }}>Ver todas</a>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1rem', borderRadius: '8px', display: 'flex', gap: '1rem' }}>
              <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
              <div style={{ flex: 1 }}>
                <div className="flex justify-between items-start">
                  <h4 style={{ color: '#fca5a5', fontSize: '0.875rem' }}>Persona no autorizada</h4>
                  <span style={{ color: '#ef4444', fontSize: '1rem', cursor: 'pointer' }}>×</span>
                </div>
                <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.25rem' }}>Detectada en acceso norte - Cámara 02</p>
                <p style={{ color: '#991b1b', fontSize: '0.7rem', marginTop: '0.5rem' }}>Hace 5 min</p>
              </div>
            </div>

            <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '1rem', borderRadius: '8px', display: 'flex', gap: '1rem' }}>
              <ThermometerSnowflake size={20} className="text-yellow-500 flex-shrink-0" />
              <div style={{ flex: 1 }}>
                <div className="flex justify-between items-start">
                  <h4 style={{ color: '#fcd34d', fontSize: '0.875rem' }}>Temperatura fuera de rango</h4>
                  <span style={{ color: '#eab308', fontSize: '1rem', cursor: 'pointer' }}>×</span>
                </div>
                <p style={{ color: '#fbbf24', fontSize: '0.75rem', marginTop: '0.25rem' }}>Pedro Sánchez - 38.2°C</p>
                <p style={{ color: '#b45309', fontSize: '0.7rem', marginTop: '0.5rem' }}>Hace 15 min</p>
              </div>
            </div>

            <div style={{ backgroundColor: 'rgba(249, 115, 22, 0.05)', border: '1px solid rgba(249, 115, 22, 0.2)', padding: '1rem', borderRadius: '8px', display: 'flex', gap: '1rem' }}>
              <CameraOff size={20} className="text-orange-500 flex-shrink-0" />
              <div style={{ flex: 1 }}>
                <div className="flex justify-between items-start">
                  <h4 style={{ color: '#fdba74', fontSize: '0.875rem' }}>Cámara desconectada</h4>
                  <span style={{ color: '#f97316', fontSize: '1rem', cursor: 'pointer' }}>×</span>
                </div>
                <p style={{ color: '#fb923c', fontSize: '0.75rem', marginTop: '0.25rem' }}>Cámara 03 - Acceso sur</p>
                <p style={{ color: '#c2410c', fontSize: '0.7rem', marginTop: '0.5rem' }}>Hace 32 min</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
