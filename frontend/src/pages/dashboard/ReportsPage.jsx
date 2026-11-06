import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, RefreshCw, AlertCircle, Clock, CheckCircle, 
  UserX, Camera, Server, Activity, Users, Search, ChevronRight,
  Filter, Zap, ArrowUpRight, TrendingUp, Calendar, CalendarDays, FileText, CheckCircle2, X
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
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

// --- Device Chart Colors ---
const DEVICE_COLORS = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#06b6d4', '#eab308', '#ec4899'];

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

// Subcomponents & Styles placed early to avoid TDZ
const Skeleton = ({ width, height }) => (
  <div style={{ width, height, borderRadius: '8px', background: 'linear-gradient(90deg, #27272a 25%, #3f3f46 50%, #27272a 75%)', backgroundSize: '200% 100%', animation: 'skeleton-loading 1.5s infinite' }} className="skeleton" />
);

const cardStyle = {
  background: COLORS.dark,
  borderRadius: '12px',
  padding: '1.5rem',
  border: `1px solid ${COLORS.border}`,
  position: 'relative',
  overflow: 'hidden'
};

// Helper for Initials
const getInitials = (name) => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (name[0] || '').toUpperCase();
};

const formatDateShort = (str) => {
  if (!str) return '';
  try {
    const parts = str.split('-');
    if (parts.length < 3) return str;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const date = new Date(y, m, d);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  } catch {
    return str;
  }
};

// --- Recuadro con Listado de Personal Directo ---
const ReportListCard = ({
  title,
  subtitle,
  count,
  badgeText,
  icon: Icon,
  colorRgb,
  colorHex,
  items = [],
  type,
  loading,
  onFilterTable
}) => {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('registros'); // 'registros' | 'personas'

  // Agrupar por colaborador
  const grouped = useMemo(() => {
    const map = {};
    items.forEach(it => {
      const id = it.employeeId || it.empleado;
      if (!map[id]) {
        map[id] = {
          employeeId: it.employeeId,
          empleado: it.empleado,
          departamento: it.departamento,
          count: 0,
          totalMinutes: 0,
          totalHours: 0,
          lastDate: it.fecha,
          items: []
        };
      }
      map[id].count++;
      if (it.minutosTarde) map[id].totalMinutes += it.minutosTarde;
      if (it.minutos) map[id].totalMinutes += it.minutos;
      if (it.horas) map[id].totalHours += it.horas;
      if (it.fecha && it.fecha > map[id].lastDate) map[id].lastDate = it.fecha;
      map[id].items.push(it);
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [items]);

  // Filtrar según búsqueda
  const filteredList = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (viewMode === 'personas') {
      if (!query) return grouped;
      return grouped.filter(g => 
        (g.empleado && g.empleado.toLowerCase().includes(query)) || 
        (g.departamento && g.departamento.toLowerCase().includes(query))
      );
    } else {
      if (!query) return items;
      return items.filter(it => 
        (it.empleado && it.empleado.toLowerCase().includes(query)) || 
        (it.departamento && it.departamento.toLowerCase().includes(query))
      );
    }
  }, [items, grouped, viewMode, search]);

  return (
    <div 
      className="card-glow" 
      style={{ 
        ...cardStyle, 
        background: `rgba(${colorRgb}, 0.03)`, 
        border: `1px solid rgba(${colorRgb}, 0.25)`, 
        boxShadow: `0 8px 24px rgba(${colorRgb}, 0.05)`,
        display: 'flex',
        flexDirection: 'column',
        height: '420px',
        padding: '1.25rem'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <span style={{ 
            color: colorHex, 
            fontSize: '0.75rem', 
            fontWeight: 700, 
            letterSpacing: '0.8px', 
            textTransform: 'uppercase' 
          }}>
            {title}
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.25rem' }}>
            <h2 style={{ fontSize: '2.25rem', color: colorHex, margin: 0, fontWeight: 700, lineHeight: 1 }}>
              {loading ? <Skeleton width="50px" height="34px" /> : count}
            </h2>
            {badgeText && (
              <span style={{ 
                background: `rgba(${colorRgb}, 0.15)`, 
                color: colorHex, 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                padding: '2px 8px', 
                borderRadius: '12px',
                border: `1px solid rgba(${colorRgb}, 0.3)`
              }}>
                {badgeText}
              </span>
            )}
          </div>
          <p style={{ color: COLORS.textMuted, fontSize: '0.75rem', margin: '0.35rem 0 0 0' }}>{subtitle}</p>
        </div>
        <div style={{ 
          width: '38px', 
          height: '38px', 
          borderRadius: '10px', 
          background: `rgba(${colorRgb}, 0.12)`, 
          border: `1px solid rgba(${colorRgb}, 0.3)`, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: colorHex 
        }}>
          <Icon size={20} />
        </div>
      </div>

      {/* Control bar: search + viewMode toggle */}
      <div className="no-print" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem', 
        marginBottom: '0.75rem',
        marginTop: '0.25rem',
        paddingBottom: '0.75rem',
        borderBottom: `1px solid ${COLORS.border}`
      }}>
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: '8px', color: COLORS.textMuted }} />
          <input 
            type="text" 
            placeholder="Buscar..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              width: '100%',
              background: 'rgba(0, 0, 0, 0.25)',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '6px',
              padding: '4px 8px 4px 28px',
              color: '#fff',
              fontSize: '0.78rem',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ 
          display: 'flex', 
          background: 'rgba(0,0,0,0.3)', 
          borderRadius: '6px', 
          padding: '2px',
          border: `1px solid ${COLORS.border}`
        }}>
          <button
            onClick={() => setViewMode('registros')}
            title="Ver cada registro con fecha y detalle"
            style={{
              background: viewMode === 'registros' ? `rgba(${colorRgb}, 0.2)` : 'transparent',
              color: viewMode === 'registros' ? colorHex : COLORS.textMuted,
              border: 'none',
              borderRadius: '4px',
              padding: '3px 7px',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Registros ({items.length})
          </button>
          <button
            onClick={() => setViewMode('personas')}
            title="Ver acumulado por colaborador"
            style={{
              background: viewMode === 'personas' ? `rgba(${colorRgb}, 0.2)` : 'transparent',
              color: viewMode === 'personas' ? colorHex : COLORS.textMuted,
              border: 'none',
              borderRadius: '4px',
              padding: '3px 7px',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Personas ({grouped.length})
          </button>
        </div>
      </div>

      {/* List content */}
      <div 
        className="custom-scroll" 
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          paddingRight: '4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem'
        }}
      >
        {loading ? (
          <>
            <Skeleton width="100%" height="42px" />
            <Skeleton width="100%" height="42px" />
            <Skeleton width="100%" height="42px" />
          </>
        ) : filteredList.length === 0 ? (
          <div style={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            textAlign: 'center',
            padding: '1rem',
            color: COLORS.textMuted 
          }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '50%', 
              background: 'rgba(255,255,255,0.03)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: '0.5rem',
              color: COLORS.textMuted
            }}>
              <CheckCircle size={20} style={{ color: colorHex }} />
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: COLORS.text }}>
              {search ? 'Sin coincidencias' : `Sin ${title.toLowerCase()}`}
            </p>
            <span style={{ fontSize: '0.72rem', color: COLORS.textMuted, marginTop: '2px' }}>
              {search ? 'Prueba con otro término' : 'Excelente registro en este período'}
            </span>
          </div>
        ) : (
          filteredList.map((item, idx) => {
            const isGrouped = viewMode === 'personas';
            const initials = getInitials(item.empleado);

            return (
              <div
                key={item.id || `${item.employeeId || item.empleado}_${idx}`}
                onClick={() => onFilterTable && onFilterTable(type, item.empleado)}
                style={{
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  padding: '0.5rem 0.65rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.6rem',
                  cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.borderColor = `rgba(${colorRgb}, 0.3)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.025)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                }}
                title={`Click para ver a ${item.empleado} en la tabla`}
              >
                {/* Avatar + Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    minWidth: '30px',
                    borderRadius: '50%',
                    background: `rgba(${colorRgb}, 0.15)`,
                    color: colorHex,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid rgba(${colorRgb}, 0.3)`
                  }}>
                    {initials}
                  </div>
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ 
                      color: COLORS.text, 
                      fontWeight: 600, 
                      fontSize: '0.82rem', 
                      whiteSpace: 'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis' 
                    }}>
                      {item.empleado}
                    </div>
                    <div style={{ 
                      color: COLORS.textMuted, 
                      fontSize: '0.7rem', 
                      whiteSpace: 'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis' 
                    }}>
                      {item.departamento} {!isGrouped && item.fecha && `• ${formatDateShort(item.fecha)}`}
                      {isGrouped && item.lastDate && `• Última: ${formatDateShort(item.lastDate)}`}
                    </div>
                  </div>
                </div>

                {/* Right Badges */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {type === 'tardanzas' && (
                    <>
                      {isGrouped ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span style={{ 
                            background: 'rgba(234, 179, 8, 0.15)', 
                            color: COLORS.yellow, 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontSize: '0.72rem', 
                            fontWeight: 600 
                          }}>
                            {item.count} {item.count === 1 ? 'tardanza' : 'tardanzas'}
                          </span>
                          {item.totalMinutes > 0 && (
                            <span style={{ fontSize: '0.68rem', color: COLORS.textMuted }}>
                              +{item.totalMinutes} min acum.
                            </span>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span style={{ 
                            background: item.tipo === 'Tardanza Justificada' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(234, 179, 8, 0.15)', 
                            color: item.tipo === 'Tardanza Justificada' ? COLORS.blue : COLORS.yellow, 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontSize: '0.72rem', 
                            fontWeight: 600 
                          }}>
                            {item.tipo === 'Tardanza Justificada' ? 'Justificada' : `+${item.minutosTarde} min`}
                          </span>
                          {item.entrada && item.entrada !== 'N/A' && (
                            <span style={{ fontSize: '0.68rem', color: COLORS.textMuted }}>
                              {item.entrada}
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {type === 'ausencias' && (
                    <>
                      {isGrouped ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span style={{ 
                            background: 'rgba(239, 68, 68, 0.15)', 
                            color: COLORS.red, 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontSize: '0.72rem', 
                            fontWeight: 600 
                          }}>
                            {item.count} {item.count === 1 ? 'ausencia' : 'ausencias'}
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span style={{ 
                            background: item.tipo === 'Vacaciones' 
                              ? 'rgba(59, 130, 246, 0.15)' 
                              : item.tipo === 'Falta Justificada' 
                                ? 'rgba(16, 185, 129, 0.15)' 
                                : 'rgba(239, 68, 68, 0.15)', 
                            color: item.tipo === 'Vacaciones' 
                              ? COLORS.blue 
                              : item.tipo === 'Falta Justificada' 
                                ? COLORS.green 
                                : COLORS.red, 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontSize: '0.72rem', 
                            fontWeight: 600 
                          }}>
                            {item.tipo === 'Vacaciones' ? 'Vacaciones' : item.tipo === 'Falta Justificada' ? 'Permiso' : 'Injustificada'}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {type === 'horasExtra' && (
                    <>
                      {isGrouped ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span style={{ 
                            background: 'rgba(168, 85, 247, 0.15)', 
                            color: '#c084fc', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontSize: '0.72rem', 
                            fontWeight: 600 
                          }}>
                            +{item.totalHours.toFixed(1)}h total
                          </span>
                          <span style={{ fontSize: '0.68rem', color: COLORS.textMuted }}>
                            {item.count} {item.count === 1 ? 'turno' : 'turnos'}
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span style={{ 
                            background: 'rgba(168, 85, 247, 0.15)', 
                            color: '#c084fc', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontSize: '0.72rem', 
                            fontWeight: 600 
                          }}>
                            +{item.horas}h ({item.minutos}m)
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="no-print" style={{ 
        marginTop: '0.75rem', 
        paddingTop: '0.5rem', 
        borderTop: `1px solid ${COLORS.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.75rem'
      }}>
        <span style={{ color: COLORS.textMuted }}>
          {items.length} {items.length === 1 ? 'registro' : 'registros'}
        </span>
        <button
          onClick={() => onFilterTable && onFilterTable(type)}
          style={{
            background: 'transparent',
            border: 'none',
            color: colorHex,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.75rem',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}
        >
          Ver en tabla <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

// --- Component ---
const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('asistencia'); // 'asistencia' | 'descansos' | 'eventos' | 'dispositivos'
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros
  const [dateRange, setDateRange] = useState('Este Mes');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedDept, setSelectedDept] = useState('Todos los departamentos');
  const [selectedEmployee, setSelectedEmployee] = useState('Todos los colaboradores');
  const [selectedStatus, setSelectedStatus] = useState('Todos los estados');
  const [selectedEventType, setSelectedEventType] = useState('Todos los tipos');
  const [selectedEventStatus, setSelectedEventStatus] = useState('Todos los estados');
  const [eventSearchTerm, setEventSearchTerm] = useState('');
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Real Data States (Asistencia)
  const [attKpis, setAttKpis] = useState({
    puntualidadPct: 0,
    totalTardanzasInjustificadas: 0,
    totalAusenciasInjustificadas: 0,
    horasExtraAprobadas: 0,
    horasPromedio: 0
  });
  const [attLists, setAttLists] = useState({
    tardanzas: [],
    ausencias: [],
    horasExtra: []
  });
  const [breakKpis, setBreakKpis] = useState({
    totalDescansos: 0,
    promedioDescansoMinutos: 0,
    retornosTardios: 0,
    sinRetorno: 0,
    noTomado: 0,
    aTiempo: 0
  });
  const [attTrendData, setAttTrendData] = useState([]);
  const [attDistribution, setAttDistribution] = useState([]);
  const [peakHoursData, setPeakHoursData] = useState([]);

  const [attTableData, setAttTableData] = useState([]);
  const [breakTableData, setBreakTableData] = useState([]);

  // Real Data States (Dispositivos)
  const [devKpis, setDevKpis] = useState({
    totalLecturas: 0,
    enLinea: 0,
    topNode: 'Sin actividad'
  });
  const [devBarData, setDevBarData] = useState([]);
  const [devTrendData, setDevTrendData] = useState([]);
  const [devDeviceNames, setDevDeviceNames] = useState([]);
  const [devTableData, setDevTableData] = useState([]);

  // Real Data States (Eventos y Permisos)
  const [eventsKpis, setEventsKpis] = useState({
    totalEvents: 0,
    vacationCount: 0,
    vacationDaysTotal: 0,
    overtimeCount: 0,
    overtimeHoursTotal: 0,
    justifiedCount: 0,
    earlyExitCount: 0,
    lateArrivalCount: 0,
    activeEventsCount: 0,
    cancelledEventsCount: 0
  });
  const [eventsDistribution, setEventsDistribution] = useState([]);
  const [eventsDeptBreakdown, setEventsDeptBreakdown] = useState([]);
  const [eventsTableData, setEventsTableData] = useState([]);

  const fetchKpis = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const getLocalDateYMD = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const now = new Date();
      let startStr = '';
      let endStr = '';

      if (dateRange === 'Hoy') {
        const todayStr = getLocalDateYMD(now);
        startStr = `${todayStr}T00:00:00.000Z`;
        endStr = `${todayStr}T23:59:59.999Z`;
      } else if (dateRange === 'Últimos 7 días') {
        const todayStr = getLocalDateYMD(now);
        const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        const pastStr = getLocalDateYMD(past);
        startStr = `${pastStr}T00:00:00.000Z`;
        endStr = `${todayStr}T23:59:59.999Z`;
      } else if (dateRange === 'Este Mes') {
        const todayStr = getLocalDateYMD(now);
        const firstDayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        startStr = `${firstDayStr}T00:00:00.000Z`;
        endStr = `${todayStr}T23:59:59.999Z`;
      } else if (dateRange === 'Este Año') {
        const todayStr = getLocalDateYMD(now);
        const firstDayStr = `${now.getFullYear()}-01-01`;
        startStr = `${firstDayStr}T00:00:00.000Z`;
        endStr = `${todayStr}T23:59:59.999Z`;
      } else if (dateRange === 'Personalizado') {
        if (customStart) startStr = `${customStart}T00:00:00.000Z`;
        if (customEnd) endStr = `${customEnd}T23:59:59.999Z`;
      }

      const qParams = [];
      if (startStr && endStr) {
        qParams.push(`startDate=${encodeURIComponent(startStr)}&endDate=${encodeURIComponent(endStr)}`);
      }
      if (selectedDept && selectedDept !== 'Todos los departamentos') {
        qParams.push(`department=${encodeURIComponent(selectedDept)}`);
      }
      if (selectedEmployee && selectedEmployee !== 'Todos los colaboradores') {
        qParams.push(`employeeId=${encodeURIComponent(selectedEmployee)}`);
      }
      const qStr = qParams.length > 0 ? `?${qParams.join('&')}` : '';

      let url = `${import.meta.env.VITE_API_URL || ''}/api/v1/reports/kpis${qStr}`;

      // 1. Fetch KPIs
      try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          if (data.kpis) setAttKpis(data.kpis);
          if (data.breakKpis) setBreakKpis(data.breakKpis);
          if (data.distribution) setAttDistribution(data.distribution);
          if (data.trend) setAttTrendData(data.trend);
          if (data.peakHours) setPeakHoursData(data.peakHours);
          if (data.lists) setAttLists(data.lists);
        }
      } catch (e) {
        console.error('Error fetching KPIs:', e);
      }

      // 2. Fetch Table Data
      try {
        let tableUrl = `${import.meta.env.VITE_API_URL || ''}/api/v1/reports/attendance-consolidated?limit=200${qParams.length > 0 ? '&' + qParams.join('&') : ''}`;
        const tableRes = await fetch(tableUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (tableRes.ok) {
          const tableData = await tableRes.json();
          setAttTableData(tableData.data || []);
        }
      } catch (e) {
        console.error('Error fetching attendance table:', e);
      }

      // 3. Fetch Breaks Table Data
      try {
        let breakTableUrl = `${import.meta.env.VITE_API_URL || ''}/api/v1/reports/breaks-consolidated?limit=200${qParams.length > 0 ? '&' + qParams.join('&') : ''}`;
        const breakTableRes = await fetch(breakTableUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (breakTableRes.ok) {
          const breakData = await breakTableRes.json();
          setBreakTableData(breakData.data || []);
        }
      } catch (e) {
        console.error('Error fetching break table:', e);
      }

      // 4. Fetch Devices Consolidated Data
      try {
        let devUrl = `${import.meta.env.VITE_API_URL || ''}/api/v1/reports/devices-consolidated`;
        if (startStr && endStr) {
          devUrl += `?startDate=${startStr}&endDate=${endStr}`;
        }
        const devRes = await fetch(devUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (devRes.ok) {
          const devData = await devRes.json();
          if (devData.kpis) setDevKpis(devData.kpis);
          if (devData.barData) setDevBarData(devData.barData);
          if (devData.trendData) setDevTrendData(devData.trendData);
          if (devData.deviceNames) setDevDeviceNames(devData.deviceNames);
          if (devData.tableData) setDevTableData(devData.tableData || []);
        }
      } catch (e) {
        console.error('Error fetching devices report:', e);
      }

      // 5. Fetch Events Consolidated Data
      try {
        let evUrl = `${import.meta.env.VITE_API_URL || ''}/api/v1/reports/events-consolidated`;
        const evParams = [];
        if (startStr && endStr) {
          evParams.push(`startDate=${encodeURIComponent(startStr)}&endDate=${encodeURIComponent(endStr)}`);
        }
        if (selectedDept && selectedDept !== 'Todos los departamentos') {
          evParams.push(`department=${encodeURIComponent(selectedDept)}`);
        }
        if (selectedEmployee && selectedEmployee !== 'Todos los colaboradores') {
          evParams.push(`employeeId=${encodeURIComponent(selectedEmployee)}`);
        }
        if (selectedEventType && selectedEventType !== 'Todos los tipos') {
          evParams.push(`type=${encodeURIComponent(selectedEventType)}`);
        }
        if (selectedEventStatus && selectedEventStatus !== 'Todos los estados') {
          evParams.push(`status=${encodeURIComponent(selectedEventStatus)}`);
        }
        if (evParams.length > 0) {
          evUrl += `?${evParams.join('&')}`;
        }
        const evRes = await fetch(evUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (evRes.ok) {
          const evData = await evRes.json();
          if (evData.kpis) setEventsKpis(evData.kpis);
          if (evData.distribution) setEventsDistribution(evData.distribution || []);
          if (evData.deptBreakdown) setEventsDeptBreakdown(evData.deptBreakdown || []);
          if (evData.events) setEventsTableData(evData.events || []);
        }
      } catch (e) {
        console.error('Error fetching events consolidated report:', e);
      }

      // Fetch Departments & Employees for filter
      const [depRes, empRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/departments`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/employees`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (depRes.ok) {
        const depData = await depRes.json();
        setDepartments(depData.map(d => d.name));
      }
      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(Array.isArray(empData) ? empData : []);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKpis();
  }, [dateRange, customStart, customEnd, selectedDept, selectedEmployee, selectedEventType, selectedEventStatus]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchKpis().then(() => setRefreshing(false));
  };

  const handleFilterFromCard = (type, employeeName = null) => {
    if (type === 'tardanzas') {
      setSelectedStatus('Tardanza');
    } else if (type === 'ausencias') {
      setSelectedStatus('Ausencia');
    } else if (type === 'horasExtra') {
      setSelectedStatus('Horas Extra');
    }
    const tableElem = document.getElementById('reports-attendance-table');
    if (tableElem) {
      tableElem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // --- Filtering Logic ---
  const filterByDateRange = (dataList) => {
    const getLocalDateYMD = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const now = new Date();
    let minDateStr = '';
    let maxDateStr = '';

    if (dateRange === 'Hoy') {
      const todayStr = getLocalDateYMD(now);
      minDateStr = todayStr;
      maxDateStr = todayStr;
    } else if (dateRange === 'Últimos 7 días') {
      const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      minDateStr = getLocalDateYMD(past);
      maxDateStr = getLocalDateYMD(now);
    } else if (dateRange === 'Este Mes') {
      minDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      maxDateStr = getLocalDateYMD(now);
    } else if (dateRange === 'Este Año') {
      minDateStr = `${now.getFullYear()}-01-01`;
      maxDateStr = getLocalDateYMD(now);
    } else if (dateRange === 'Personalizado') {
      if (customStart) minDateStr = customStart;
      if (customEnd) maxDateStr = customEnd;
    }
    
    return dataList.filter(item => {
      const itemDateStr = item.fecha ? item.fecha : (item.date ? item.date.split('T')[0] : null);
      if (itemDateStr) {
        if (minDateStr && itemDateStr < minDateStr) return false;
        if (maxDateStr && itemDateStr > maxDateStr) return false;
        return true;
      }
      return true;
    });
  };

  const availableEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (emp.isActive === false) return false;
      if (selectedDept !== 'Todos los departamentos') {
        const empDept = emp.department?.name || '';
        if (empDept.toLowerCase() !== selectedDept.toLowerCase()) return false;
      }
      return true;
    }).sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));
  }, [employees, selectedDept]);

  const hasActiveFilters = 
    selectedDept !== 'Todos los departamentos' || 
    selectedEmployee !== 'Todos los colaboradores' || 
    selectedStatus !== 'Todos los estados' || 
    selectedEventType !== 'Todos los tipos' || 
    selectedEventStatus !== 'Todos los estados' || 
    dateRange !== 'Este Mes';

  const clearAllFilters = () => {
    setDateRange('Este Mes');
    setCustomStart('');
    setCustomEnd('');
    setSelectedDept('Todos los departamentos');
    setSelectedEmployee('Todos los colaboradores');
    setSelectedStatus('Todos los estados');
    setSelectedEventType('Todos los tipos');
    setSelectedEventStatus('Todos los estados');
    setEventSearchTerm('');
  };

  const filteredEventsTable = useMemo(() => {
    let list = eventsTableData;
    if (selectedEmployee !== 'Todos los colaboradores') {
      list = list.filter(e => e.employeeId === selectedEmployee);
    }
    if (eventSearchTerm.trim()) {
      const q = eventSearchTerm.toLowerCase();
      list = list.filter(e => 
        e.empleado.toLowerCase().includes(q) ||
        e.identificador.toLowerCase().includes(q) ||
        e.departamento.toLowerCase().includes(q) ||
        e.motivo.toLowerCase().includes(q) ||
        e.aprobadoPor.toLowerCase().includes(q)
      );
    }
    return list;
  }, [eventsTableData, selectedEmployee, eventSearchTerm]);

  const filteredAttTrend = attTrendData; // Ya viene filtrado del backend
  const doughnutData = attDistribution; // Ya viene del backend
  const filteredDevTrend = devTrendData;
  
  // Lógica para filtrar tablas también por departamento, empleado y estado
  const filteredAttTable = useMemo(() => {
    let res = attTableData;
    if (selectedDept !== 'Todos los departamentos') {
      res = res.filter(r => r.departamento === selectedDept);
    }
    if (selectedEmployee !== 'Todos los colaboradores') {
      res = res.filter(r => r.employeeId === selectedEmployee);
    }
    if (selectedStatus !== 'Todos los estados') {
      res = res.filter(r => {
        if (selectedStatus === 'Horas Extra') return r.horasExtra;
        if (selectedStatus === 'Salida Tardía Sin Justificar') return r.lateDepartureWithoutOvertime;
        return r.estadoAsistencia === selectedStatus;
      });
    }
    return res;
  }, [attTableData, selectedDept, selectedEmployee, selectedStatus]);
  
  const filteredBreakTable = useMemo(() => {
    let res = breakTableData;
    if (selectedDept !== 'Todos los departamentos') {
      res = res.filter(r => r.departamento === selectedDept);
    }
    if (selectedEmployee !== 'Todos los colaboradores') {
      res = res.filter(r => r.employeeId === selectedEmployee);
    }
    if (selectedStatus !== 'Todos los estados') {
      res = res.filter(r => r.estado === selectedStatus);
    }
    return res;
  }, [breakTableData, selectedDept, selectedEmployee, selectedStatus]);

  const filteredDevTable = useMemo(() => {
    let res = devTableData;
    if (selectedStatus !== 'Todos los estados') {
      res = res.filter(r => r.estado === selectedStatus);
    }
    return res;
  }, [devTableData, selectedStatus]);

  // KPIs
  const attKPI = attKpis;
  const devKPI = devKpis;

  // --- Exports ---
  const exportToCSV = () => {
    let headers, rows;
    const empObj = employees.find(e => e.id === selectedEmployee);
    const empName = empObj ? `${empObj.firstName} ${empObj.lastName}` : null;
    const empFileTag = empName ? `_${empName.replace(/\s+/g, '_')}` : '';
    const tabName = activeTab === 'asistencia' ? 'Asistencia' : activeTab === 'descansos' ? 'Descansos' : activeTab === 'eventos' ? 'Eventos' : 'Dispositivos';
    const dateTag = dateRange.replace(/\s+/g, '_');
    let filename = `Reporte_${tabName}${empFileTag}_${dateTag}.csv`;
    
    if (activeTab === 'asistencia') {
      headers = ['Empleado', 'Departamento', 'Fecha', 'Entrada Real', 'Salida Real', 'Salida Esperada', 'Horas Trabajadas', 'Horas Extra', 'Estado Asistencia'];
      rows = filteredAttTable.map(r => [r.empleado, r.departamento, r.fecha, r.entrada, r.salida, r.horaEsperadaSalida, r.horasTrabajadas || '0', r.horasExtra ? `Sí (${+(r.overtimeMinutes / 60).toFixed(1)}h)` : 'No', r.estadoAsistencia]);
    } else if (activeTab === 'descansos') {
      headers = ['Empleado', 'Departamento', 'Fecha', 'Inicio Descanso', 'Fin Descanso', 'Duración Real', 'Duración Esperada', 'Estado'];
      rows = filteredBreakTable.map(r => [
        r.empleado,
        r.departamento,
        r.fecha,
        r.inicioDescanso || 'N/A',
        r.finDescanso || 'N/A',
        r.duracionReal === 'N/A' || r.duracionReal === null || r.duracionReal === undefined ? 'N/A' : `${r.duracionReal} min`,
        r.duracionEsperada === 'N/A' || r.duracionEsperada === null || r.duracionEsperada === undefined ? 'N/A' : `${r.duracionEsperada} min`,
        r.estado
      ]);
    } else if (activeTab === 'eventos') {
      headers = ['Empleado', 'Identificador', 'Departamento', 'Tipo de Evento', 'Fecha / Rango', 'Duración', 'Motivo', 'Aprobado Por', 'Estado'];
      rows = filteredEventsTable.map(r => [
        r.empleado,
        r.identificador,
        r.departamento,
        r.tipo,
        r.rangoTexto || r.fecha,
        r.duracion,
        r.motivo,
        r.aprobadoPor,
        r.estado === 'ACTIVE' ? 'Activo' : 'Cancelado'
      ]);
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
          <option>Este Año</option>
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

        {activeTab !== 'dispositivos' && (
          <select 
            style={{
              ...selectStyle,
              borderColor: selectedDept !== 'Todos los departamentos' ? COLORS.orange : COLORS.border,
              color: selectedDept !== 'Todos los departamentos' ? COLORS.orange : COLORS.textPrimary
            }} 
            value={selectedDept}
            onChange={(e) => {
              const newDept = e.target.value;
              setSelectedDept(newDept);
              if (newDept !== 'Todos los departamentos' && selectedEmployee !== 'Todos los colaboradores') {
                const emp = employees.find(x => x.id === selectedEmployee);
                if (emp && emp.department?.name !== newDept) {
                  setSelectedEmployee('Todos los colaboradores');
                }
              }
            }}
            title="Filtrar por Departamento"
          >
            <option>Todos los departamentos</option>
            {departments.map(d => <option key={d}>{d}</option>)}
          </select>
        )}

        {activeTab !== 'dispositivos' && (
          <select 
            style={{
              ...selectStyle,
              borderColor: selectedEmployee !== 'Todos los colaboradores' ? COLORS.orange : COLORS.border,
              color: selectedEmployee !== 'Todos los colaboradores' ? COLORS.orange : COLORS.textPrimary,
              fontWeight: selectedEmployee !== 'Todos los colaboradores' ? 600 : 400,
              maxWidth: '240px'
            }} 
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            title="Seleccionar un colaborador para generar reporte individual"
          >
            <option value="Todos los colaboradores">Todos los colaboradores</option>
            {availableEmployees.map(emp => (
              <option key={emp.id} value={emp.id} style={{ background: '#18181b', color: '#fff' }}>
                {emp.firstName} {emp.lastName} {selectedDept === 'Todos los departamentos' && emp.department?.name ? `(${emp.department.name})` : ''}
              </option>
            ))}
          </select>
        )}

        {activeTab === 'asistencia' && (
          <select 
            style={selectStyle} 
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option>Todos los estados</option>
            <option>A tiempo</option>
            <option>Tardanza</option>
            <option>Ausencia</option>
            <option>Falta Justificada</option>
            <option>Vacaciones</option>
            <option>Salida Tardía Sin Justificar</option>
            <option>Horas Extra</option>
          </select>
        )}
        {activeTab === 'descansos' && (
          <select 
            style={selectStyle} 
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option>Todos los estados</option>
            <option>A tiempo</option>
            <option>Regreso Tardío</option>
            <option>Sin Retorno</option>
            <option>No tomado</option>
            <option>Vacaciones</option>
            <option>Falta Justificada</option>
            <option>No aplica</option>
            <option>Pendiente</option>
          </select>
        )}
        {activeTab === 'eventos' && (
          <>
            <select 
              style={selectStyle} 
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
            >
              <option>Todos los tipos</option>
              <option value="VACATION">Vacaciones</option>
              <option value="OVERTIME">Horas Extra</option>
              <option value="JUSTIFIED_ABSENCE">Faltas Justificadas</option>
              <option value="EARLY_EXIT">Salidas Anticipadas</option>
              <option value="LATE_ARRIVAL">Llegadas Tardías</option>
            </select>

            <select 
              style={selectStyle} 
              value={selectedEventStatus}
              onChange={(e) => setSelectedEventStatus(e.target.value)}
            >
              <option>Todos los estados</option>
              <option value="ACTIVE">Activos / Válidos</option>
              <option value="CANCELLED">Cancelados</option>
            </select>
          </>
        )}
        {activeTab === 'dispositivos' && (
          <select 
            style={selectStyle} 
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option>Todos los estados</option>
            <option>En Línea</option>
            <option>Inestable</option>
            <option>Desconectado</option>
          </select>
        )}

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            style={{
              ...btnSecondary,
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              color: COLORS.red,
              borderColor: 'rgba(239, 68, 68, 0.4)',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Restablecer todos los filtros"
          >
            <X size={14} /> Limpiar Filtros
          </button>
        )}
        
      </div>

      {/* Content wrapper for PDF */}
      <div className="printable-report">
        
        {/* Print Only Header */}
        <div style={{ display: 'none', marginBottom: '2rem' }} className="print-only">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ color: '#000', fontSize: '24px', margin: 0, fontWeight: 700 }}>
                {activeTab === 'asistencia' ? 'Reporte Ejecutivo de Asistencia' : 
                 activeTab === 'descansos' ? 'Reporte de Tiempos y Descansos' : 
                 activeTab === 'eventos' ? 'Reporte Oficial de Eventos y Permisos' : 
                 'Reporte Técnico de Dispositivos'}
              </h1>
              <p style={{ color: '#555', margin: '6px 0 0 0', fontSize: '13px' }}>
                Periodo: <strong>{dateRange}</strong> • Departamento: <strong>{selectedDept}</strong>
                {selectedEmployee !== 'Todos los colaboradores' && (() => {
                  const empObj = employees.find(e => e.id === selectedEmployee);
                  return empObj ? <> • Colaborador: <strong>{empObj.firstName} {empObj.lastName}</strong> ({empObj.identifier || 'N/A'})</> : null;
                })()}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: '#000', margin: 0, fontSize: '14px', fontWeight: 600 }}>PAIN Sistema de Gestión</p>
              <p style={{ color: '#666', margin: '4px 0 0 0', fontSize: '11px' }}>Emitido: {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
          <hr style={{ border: '1px solid #ccc', margin: '1rem 0' }} />
        </div>

        {/* Banner de Reporte Individual Activo */}
        {selectedEmployee !== 'Todos los colaboradores' && (() => {
          const empObj = employees.find(e => e.id === selectedEmployee);
          if (!empObj) return null;
          return (
            <div className="no-print" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1.25rem',
              borderRadius: '10px',
              background: 'rgba(249, 115, 22, 0.08)',
              border: '1px solid rgba(249, 115, 22, 0.3)',
              marginBottom: '1.5rem',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '50%',
                  background: 'rgba(249, 115, 22, 0.2)', color: COLORS.orange,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.9rem'
                }}>
                  {empObj.firstName?.[0] || 'C'}{empObj.lastName?.[0] || ''}
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: '1rem' }}>
                    Reporte Individual: {empObj.firstName} {empObj.lastName}
                  </div>
                  <div style={{ color: COLORS.textMuted, fontSize: '0.8rem' }}>
                    Departamento: <strong>{empObj.department?.name || 'General'}</strong> • Identificador: <strong>{empObj.identifier || 'N/A'}</strong> • Período: <strong>{dateRange}</strong>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmployee('Todos los colaboradores')}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: COLORS.orange,
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <X size={14} /> Ver todos los colaboradores
              </button>
            </div>
          );
        })()}

        {/* Tabs */}
        <div className="no-print" style={{ display: 'flex', background: COLORS.darker, borderRadius: '8px', padding: '4px', border: `1px solid ${COLORS.border}`, width: 'fit-content', marginBottom: '2rem', flexWrap: 'wrap', gap: '4px' }}>
          <button 
            onClick={() => { setActiveTab('asistencia'); setSelectedStatus('Todos los estados'); }} 
            style={{ ...toggleBtn, background: activeTab === 'asistencia' ? 'rgba(249, 115, 22, 0.1)' : 'transparent', color: activeTab === 'asistencia' ? COLORS.orange : COLORS.textMuted }}
          >
            Asistencia
          </button>
          <button 
            onClick={() => { setActiveTab('descansos'); setSelectedStatus('Todos los estados'); }} 
            style={{ ...toggleBtn, background: activeTab === 'descansos' ? 'rgba(249, 115, 22, 0.1)' : 'transparent', color: activeTab === 'descansos' ? COLORS.orange : COLORS.textMuted }}
          >
            Descansos
          </button>
          <button 
            onClick={() => { setActiveTab('eventos'); }} 
            style={{ ...toggleBtn, background: activeTab === 'eventos' ? 'rgba(249, 115, 22, 0.1)' : 'transparent', color: activeTab === 'eventos' ? COLORS.orange : COLORS.textMuted }}
          >
            Eventos
          </button>
          <button 
            onClick={() => { setActiveTab('dispositivos'); setSelectedStatus('Todos los estados'); }} 
            style={{ ...toggleBtn, background: activeTab === 'dispositivos' ? 'rgba(249, 115, 22, 0.1)' : 'transparent', color: activeTab === 'dispositivos' ? COLORS.orange : COLORS.textMuted }}
          >
            Dispositivos
          </button>
        </div>

        {/* TAB 1: ASISTENCIA */}
        {activeTab === 'asistencia' && (
          <div className="space-y-6">
            {/* Top Executive KPI Row (Puntualidad & Horas Promedio) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
              {/* Puntualidad Card */}
              <div className="card-glow" style={{ ...cardStyle, background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.25)', boxShadow: '0 4px 20px rgba(16, 185, 129, 0.05)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: COLORS.green, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>Puntualidad General</span>
                  <CheckCircle size={18} style={{ color: COLORS.green }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <h2 style={{ fontSize: '2.5rem', color: COLORS.green, lineHeight: '1', margin: 0, fontWeight: 700 }}>
                    {loading ? <Skeleton width="70px" height="40px" /> : `${attKPI.puntualidadPct}%`}
                  </h2>
                  <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: COLORS.green, fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '12px' }}>
                    {attKPI.puntualidadPct >= 90 ? 'Excelente' : attKPI.puntualidadPct >= 75 ? 'Aceptable' : 'Atención requerida'}
                  </span>
                </div>
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(attKPI.puntualidadPct, 100)}%`, height: '100%', background: COLORS.green, borderRadius: '3px', transition: 'width 0.6s ease' }} />
                  </div>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: COLORS.textMuted }}>
                    Entradas registradas dentro de la tolerancia horaria establecida.
                  </p>
                </div>
              </div>

              {/* Horas Promedio Card */}
              <div className="card-glow" style={{ ...cardStyle, background: 'rgba(59, 130, 246, 0.04)', border: '1px solid rgba(59, 130, 246, 0.25)', boxShadow: '0 4px 20px rgba(59, 130, 246, 0.05)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: COLORS.blue, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>Horas Promedio por Jornada</span>
                  <Clock size={18} style={{ color: COLORS.blue }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <h2 style={{ fontSize: '2.5rem', color: COLORS.blue, lineHeight: '1', margin: 0, fontWeight: 700 }}>
                    {loading ? <Skeleton width="70px" height="40px" /> : `${attKPI.horasPromedio}h`}
                  </h2>
                  <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: COLORS.blue, fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '12px' }}>
                    Jornada estándar (~8h)
                  </span>
                </div>
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min((attKPI.horasPromedio / 8) * 100, 100)}%`, height: '100%', background: COLORS.blue, borderRadius: '3px', transition: 'width 0.6s ease' }} />
                  </div>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: COLORS.textMuted }}>
                    Tiempo efectivo trabajado en registros con entrada y salida completa.
                  </p>
                </div>
              </div>
            </div>

            {/* 3 Main Recuadros with Direct Personnel Lists */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
              <ReportListCard
                title="Tardanzas"
                subtitle="Colaboradores que llegaron fuera del horario límite"
                count={attKPI.totalTardanzasInjustificadas}
                badgeText={`${attLists.tardanzas.length} registros`}
                icon={AlertCircle}
                colorRgb="234, 179, 8"
                colorHex={COLORS.yellow}
                items={attLists.tardanzas}
                type="tardanzas"
                loading={loading}
                onFilterTable={handleFilterFromCard}
              />

              <ReportListCard
                title="Ausencias"
                subtitle="Colaboradores sin asistencia registrada o justificada"
                count={attKPI.totalAusenciasInjustificadas}
                badgeText={`${attLists.ausencias.length} en total`}
                icon={UserX}
                colorRgb="239, 68, 68"
                colorHex={COLORS.red}
                items={attLists.ausencias}
                type="ausencias"
                loading={loading}
                onFilterTable={handleFilterFromCard}
              />

              <ReportListCard
                title="Horas Extra"
                subtitle="Colaboradores con jornada extraordinaria autorizada"
                count={`${attKPI.horasExtraAprobadas}h`}
                badgeText={`${attLists.horasExtra.length} turnos`}
                icon={Clock}
                colorRgb="168, 85, 247"
                colorHex="#c084fc"
                items={attLists.horasExtra}
                type="horasExtra"
                loading={loading}
                onFilterTable={handleFilterFromCard}
              />
            </div>

            {/* Table */}
            <div id="reports-attendance-table" className="table-responsive-wrapper" style={{ ...cardStyle, padding: 0, overflowX: 'auto', marginBottom: '2rem' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: COLORS.darker, borderBottom: `1px solid ${COLORS.border}` }}>
                    <th style={thStyle}>Empleado</th>
                    <th style={thStyle}>Departamento</th>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Entrada</th>
                    <th style={thStyle}>Salida Real</th>
                    <th style={thStyle}>Salida Esperada</th>
                    <th style={thStyle}>Horas Extra</th>
                    <th style={thStyle}>Estado Asistencia</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttTable.length === 0 ? (
                    <tr><td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: COLORS.textMuted }}>No hay datos para el filtro seleccionado.</td></tr>
                  ) : filteredAttTable.slice(0, 100).map((row) => {
                    
                    let statusColor = COLORS.textMuted;
                    let statusBg = 'rgba(255,255,255,0.05)';
                    
                    if (row.estadoAsistencia.includes('A tiempo') || row.estadoAsistencia.includes('Justificada')) {
                      statusColor = COLORS.green;
                      statusBg = 'rgba(16,185,129,0.1)';
                    } else if (row.estadoAsistencia.includes('Vacaciones')) {
                      statusColor = COLORS.blue;
                      statusBg = 'rgba(59, 130, 246, 0.1)';
                    } else if (row.estadoAsistencia.includes('Tardanza') || row.estadoAsistencia.includes('Ausencia')) {
                      statusColor = row.estadoAsistencia.includes('Ausencia') ? COLORS.red : COLORS.yellow;
                      statusBg = row.estadoAsistencia.includes('Ausencia') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(234, 179, 8, 0.1)';
                    }

                    return (
                    <tr key={row.id} style={{ borderBottom: `1px solid ${COLORS.border}`, background: row.lateDepartureWithoutOvertime ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: COLORS.border, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted, fontSize: '0.8rem', fontWeight: 600 }}>
                            {getInitials(row.empleado)}
                          </div>
                          <div>
                            <span style={{ color: COLORS.text, fontWeight: 500 }}>{row.empleado}</span>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>{row.departamento}</td>
                      <td style={tdStyle}>{row.fecha}</td>
                      <td style={tdStyle}>{row.entrada}</td>
                      <td style={tdStyle}>
                        <span style={{ color: row.lateDepartureWithoutOvertime ? COLORS.red : 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {row.salida}
                          {row.lateDepartureWithoutOvertime && <AlertCircle size={14} title="Salida tardía sin horas extra aprobadas" />}
                        </span>
                      </td>
                      <td style={tdStyle}>{row.horaEsperadaSalida}</td>
                      <td style={tdStyle}>
                        {row.horasExtra ? (
                          <span style={{ color: COLORS.blue }}>Sí ({+(row.overtimeMinutes / 60).toFixed(1)}h)</span>
                        ) : (
                          <span style={{ color: COLORS.textMuted }}>No</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ 
                          color: statusColor,
                          background: statusBg,
                          padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem'
                        }}>
                          {row.estadoAsistencia}
                        </span>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
              <div className="no-print" style={{ padding: '1rem', textAlign: 'center', color: COLORS.textMuted, fontSize: '0.85rem' }}>
                Mostrando hasta 100 filas
              </div>
            </div>

            {/* Charts Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }} className="charts-grid">
              {/* Line Chart */}
              <div style={{ ...cardStyle, gridColumn: '1 / -1', height: '400px' }}>
                <h3 style={{ margin: '0 0 1.5rem 0', color: COLORS.text, fontSize: '1.1rem' }}>Tendencia de Asistencia</h3>
                {loading ? <Skeleton width="100%" height="300px" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredAttTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <defs>
                        <linearGradient id="colorATiempo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorPermisos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorTardanzas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.yellow} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLORS.yellow} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorAusencias" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLORS.red} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                      <XAxis dataKey="date" stroke={COLORS.textMuted} fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke={COLORS.textMuted} fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" />
                      <Area type="monotone" dataKey="aTiempo" name="A tiempo" stroke={COLORS.green} fillOpacity={1} fill="url(#colorATiempo)" />
                      <Area type="monotone" dataKey="justificados" name="Justificados" stroke={COLORS.blue} fillOpacity={1} fill="url(#colorPermisos)" />
                      <Area type="monotone" dataKey="tardanzas" name="Tardanzas" stroke={COLORS.yellow} fillOpacity={1} fill="url(#colorTardanzas)" />
                      <Area type="monotone" dataKey="ausencias" name="Ausencias" stroke={COLORS.red} fillOpacity={1} fill="url(#colorAusencias)" />
                    </AreaChart>
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
                      <Tooltip wrapperStyle={{ zIndex: 100 }} content={<CustomTooltip />} />
                      <Legend 
                        iconType="circle" 
                        verticalAlign="bottom" 
                        height={36} 
                        wrapperStyle={{ fontSize: '0.75rem', color: COLORS.textMuted }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Etiqueta Central - Posicionada de forma absoluta */}
                  <div style={{ position: 'absolute', top: 'calc(50% - 10px)', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', zIndex: 0 }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: COLORS.text, lineHeight: '1' }}>{attKPI.puntualidadPct}%</div>
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
          </div>
        )}

        {/* TAB 2: DESCANSOS */}
        {activeTab === 'descansos' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              {renderCard('Total Descansos', breakKpis.totalDescansos, 'Registrados con éxito', CheckCircle, '16, 185, 129')}
              {renderCard('Regresos Tardíos', breakKpis.retornosTardios, 'Excedieron duración', AlertCircle, '239, 68, 68')}
              {renderCard('Sin Retorno', breakKpis.sinRetorno, 'Falta marca de fin', UserX, '234, 179, 8')}
              {renderCard('No Tomados', breakKpis.noTomado, 'No salieron a descanso', Clock, '168, 85, 247')}
              
              {/* Promedio */}
              <div className="card-glow" style={{ ...cardStyle, background: `rgba(59, 130, 246, 0.05)`, border: `1px solid rgba(59, 130, 246, 0.3)`, boxShadow: `0 4px 20px rgba(59, 130, 246, 0.05)` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: COLORS.textMuted, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>Promedio (Minutos)</span>
                  <Clock size={18} style={{ color: COLORS.blue }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '2.5rem', color: COLORS.blue, lineHeight: '1', margin: '1rem 0 0.5rem 0' }}>
                    {loading ? <Skeleton width="60px" height="40px" /> : `${breakKpis.promedioDescansoMinutos}m`}
                  </h2>
                  <p className="text-xs text-muted" style={{ margin: 0 }}>Duración real vs esperada</p>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="table-responsive-wrapper" style={{ ...cardStyle, padding: 0, overflowX: 'auto', marginBottom: '2rem' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: COLORS.darker, borderBottom: `1px solid ${COLORS.border}` }}>
                    <th style={thStyle}>Empleado</th>
                    <th style={thStyle}>Departamento</th>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Inicio Descanso</th>
                    <th style={thStyle}>Fin Descanso</th>
                    <th style={thStyle}>Duración Real</th>
                    <th style={thStyle}>Duración Esperada</th>
                    <th style={thStyle}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBreakTable.length === 0 ? (
                    <tr><td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: COLORS.textMuted }}>No hay datos para el filtro seleccionado.</td></tr>
                  ) : filteredBreakTable.slice(0, 100).map((row) => {
                    
                    let statusColor = COLORS.textMuted;
                    let statusBg = 'rgba(255,255,255,0.05)';
                    
                    if (row.estado === 'A tiempo') {
                      statusColor = COLORS.green;
                      statusBg = 'rgba(16,185,129,0.1)';
                    } else if (row.estado === 'Regreso Tardío' || row.estado === 'No tomado') {
                      statusColor = COLORS.red;
                      statusBg = 'rgba(239, 68, 68, 0.1)';
                    } else if (row.estado === 'Sin Retorno') {
                      statusColor = COLORS.yellow;
                      statusBg = 'rgba(234, 179, 8, 0.1)';
                    } else if (row.estado === 'Vacaciones' || row.estado === 'Falta Justificada') {
                      statusColor = COLORS.blue;
                      statusBg = 'rgba(59, 130, 246, 0.1)';
                    } else if (row.estado === 'Pendiente' || row.estado === 'No aplica') {
                      statusColor = COLORS.textMuted;
                      statusBg = 'transparent';
                    }

                    return (
                    <tr key={row.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: COLORS.border, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted, fontSize: '0.8rem', fontWeight: 600 }}>
                            {getInitials(row.empleado)}
                          </div>
                          <div>
                            <span style={{ color: COLORS.text, fontWeight: 500 }}>{row.empleado}</span>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>{row.departamento}</td>
                      <td style={tdStyle}>{row.fecha}</td>
                      <td style={tdStyle}>{row.inicioDescanso}</td>
                      <td style={tdStyle}>{row.finDescanso}</td>
                      <td style={tdStyle}>{row.duracionReal === 'N/A' ? 'N/A' : `${row.duracionReal}m`}</td>
                      <td style={tdStyle}>{row.duracionEsperada === 'N/A' ? 'N/A' : `${row.duracionEsperada}m`}</td>
                      <td style={tdStyle}>
                        <span style={{ 
                          color: statusColor,
                          background: statusBg,
                          padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem'
                        }}>
                          {row.estado}
                        </span>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
              <div className="no-print" style={{ padding: '1rem', textAlign: 'center', color: COLORS.textMuted, fontSize: '0.85rem' }}>
                Mostrando hasta 100 filas
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DISPOSITIVOS */}
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
                      <Bar name="Lecturas" dataKey="lecturas" radius={[4, 4, 0, 0]} animationDuration={1000}>
                        {devBarData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={DEVICE_COLORS[index % DEVICE_COLORS.length]} />
                        ))}
                      </Bar>
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
                      {devDeviceNames.length === 0 ? (
                        <Line type="monotone" name="Sin actividad" dataKey="none" stroke={COLORS.border} />
                      ) : (
                        devDeviceNames.map((name, idx) => (
                          <Line
                            key={name}
                            type="monotone"
                            name={name}
                            dataKey={name}
                            stroke={DEVICE_COLORS[idx % DEVICE_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        ))
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="table-responsive-wrapper" style={{ ...cardStyle, padding: 0, overflowX: 'auto' }}>
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
                  ) : filteredDevTable.slice(0, 50).map((row) => (
                    <tr key={row.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(249,115,22,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.orange, fontSize: '0.8rem', fontWeight: 600 }}>
                            <Server size={16} />
                          </div>
                          <span style={{ color: COLORS.text, fontWeight: 500 }}>{row.dispositivo}</span>
                        </div>
                      </td>
                      <td style={tdStyle}>{row.ubicacion}</td>
                      <td style={tdStyle}>{row.fecha}</td>
                      <td style={tdStyle}>{row.lecturas}</td>
                      <td style={tdStyle}>{row.uptime}</td>
                      <td style={tdStyle}>
                        <span style={{ 
                          color: row.estado === 'En Línea' ? COLORS.green : row.estado === 'Inestable' ? COLORS.yellow : COLORS.red,
                          background: row.estado === 'En Línea' ? 'rgba(16,185,129,0.1)' : row.estado === 'Inestable' ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)',
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
                Mostrando hasta 50 filas
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: EVENTOS */}
        {activeTab === 'eventos' && (
          <div className="fade-in space-y-6">
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
              {renderCard('Total Eventos', eventsKpis.totalEvents, 'Registrados en el periodo', FileText, '59, 130, 246')}
              {renderCard('Días Vacaciones', `${eventsKpis.vacationDaysTotal} d`, `${eventsKpis.vacationCount} solicitudes`, Calendar, '139, 92, 246')}
              {renderCard('Horas Extra', `${eventsKpis.overtimeHoursTotal} hrs`, `${eventsKpis.overtimeCount} turnos aprobados`, Clock, '59, 130, 246')}
              {renderCard('Faltas Justificadas', eventsKpis.justifiedCount, 'Con justificante médico/oficial', CheckCircle, '16, 185, 129')}
              {renderCard('Salidas / Retardos', eventsKpis.earlyExitCount + eventsKpis.lateArrivalCount, 'Incidencias autorizadas', AlertCircle, '234, 179, 8')}
            </div>

            {/* Visual Analytics Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              {/* Event Distribution Doughnut */}
              <div className="card-glow" style={{ ...cardStyle, padding: '1.5rem' }}>
                <h4 style={{ color: COLORS.text, margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600 }}>Distribución por Tipo de Evento</h4>
                {eventsDistribution.length > 0 ? (
                  <div style={{ height: '250px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={eventsDistribution}
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {eventsDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted }}>
                    No hay eventos registrados en este periodo
                  </div>
                )}
              </div>

              {/* Event by Department Bar Chart */}
              <div className="card-glow" style={{ ...cardStyle, padding: '1.5rem' }}>
                <h4 style={{ color: COLORS.text, margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600 }}>Eventos por Departamento</h4>
                {eventsDeptBreakdown.length > 0 ? (
                  <div style={{ height: '250px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={eventsDeptBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis dataKey="name" stroke={COLORS.textMuted} fontSize={11} angle={-15} textAnchor="end" />
                        <YAxis stroke={COLORS.textMuted} fontSize={11} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="total" name="Eventos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted }}>
                    No hay departamentos con eventos en este periodo
                  </div>
                )}
              </div>
            </div>

            {/* Events Detailed Table */}
            <div id="reports-events-table" className="table-responsive-wrapper" style={{ ...cardStyle, padding: 0, overflowX: 'auto', marginBottom: '2rem' }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h4 style={{ color: COLORS.text, margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                    Detalle Consolidado de Eventos
                  </h4>
                  <p style={{ color: COLORS.textMuted, margin: '0.25rem 0 0 0', fontSize: '0.82rem' }}>
                    Mostrando {filteredEventsTable.length} eventos para el periodo seleccionado ({dateRange})
                  </p>
                </div>
                <div style={{ position: 'relative', minWidth: '240px' }} className="no-print">
                  <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: COLORS.textMuted }} />
                  <input
                    type="text"
                    placeholder="Buscar empleado, motivo..."
                    value={eventSearchTerm}
                    onChange={(e) => setEventSearchTerm(e.target.value)}
                    style={{ ...selectStyle, paddingLeft: '2.2rem', width: '100%', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: `1px solid ${COLORS.border}` }}>
                    <th style={{ padding: '0.75rem 0.65rem', color: COLORS.textMuted, fontSize: '0.73rem', fontWeight: 600, textTransform: 'uppercase' }}>Empleado</th>
                    <th style={{ padding: '0.75rem 0.65rem', color: COLORS.textMuted, fontSize: '0.73rem', fontWeight: 600, textTransform: 'uppercase' }}>Departamento</th>
                    <th style={{ padding: '0.75rem 0.65rem', color: COLORS.textMuted, fontSize: '0.73rem', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Tipo de Evento</th>
                    <th style={{ padding: '0.75rem 0.65rem', color: COLORS.textMuted, fontSize: '0.73rem', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Fecha / Vigencia</th>
                    <th style={{ padding: '0.75rem 0.65rem', color: COLORS.textMuted, fontSize: '0.73rem', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Duración</th>
                    <th style={{ padding: '0.75rem 0.65rem', color: COLORS.textMuted, fontSize: '0.73rem', fontWeight: 600, textTransform: 'uppercase' }}>Motivo</th>
                    <th style={{ padding: '0.75rem 0.65rem', color: COLORS.textMuted, fontSize: '0.73rem', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Aprobador</th>
                    <th style={{ padding: '0.75rem 0.65rem', color: COLORS.textMuted, fontSize: '0.73rem', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEventsTable.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: COLORS.textMuted }}>
                        No se encontraron registros de eventos para el periodo y filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredEventsTable.map((evt, idx) => {
                      const typeConfig = {
                        VACATION: { label: 'Vacaciones', bg: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', border: '#8b5cf633' },
                        OVERTIME: { label: 'Horas Extra', bg: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', border: '#3b82f633' },
                        JUSTIFIED_ABSENCE: { label: 'Falta Justificada', bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '#10b98133' },
                        EARLY_EXIT: { label: 'Salida Anticipada', bg: 'rgba(234, 179, 8, 0.12)', color: '#eab308', border: '#eab30833' },
                        LATE_ARRIVAL: { label: 'Llegada Tardía', bg: 'rgba(249, 115, 22, 0.12)', color: '#f97316', border: '#f9731633' }
                      };
                      const tc = typeConfig[evt.tipo] || { label: evt.tipo, bg: 'rgba(255,255,255,0.08)', color: '#fff', border: '#555' };

                      return (
                        <tr key={evt.id || idx} style={{ borderBottom: `1px solid ${COLORS.border}33`, fontSize: '0.82rem' }}>
                          <td style={{ padding: '0.75rem 0.65rem' }}>
                            <div style={{ color: COLORS.text, fontWeight: 600 }}>{evt.empleado}</div>
                            <div style={{ color: COLORS.textMuted, fontSize: '0.72rem' }}>{evt.identificador}</div>
                          </td>
                          <td style={{ padding: '0.75rem 0.65rem', color: COLORS.textMuted }}>
                            {evt.departamento}
                            {evt.esGrupal && (
                              <span style={{ marginLeft: '0.4rem', padding: '0.1rem 0.35rem', background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600 }}>
                                Grupal
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 0.65rem', whiteSpace: 'nowrap' }}>
                            <span style={{ 
                              padding: '0.2rem 0.55rem', 
                              borderRadius: '999px', 
                              background: tc.bg, 
                              color: tc.color, 
                              border: `1px solid ${tc.border}`,
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              whiteSpace: 'nowrap'
                            }}>
                              {tc.label}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.65rem', color: COLORS.text, whiteSpace: 'nowrap' }}>
                            {evt.rangoTexto}
                          </td>
                          <td style={{ padding: '0.75rem 0.65rem', color: COLORS.textMuted, whiteSpace: 'nowrap' }}>
                            {evt.duracion}
                          </td>
                          <td style={{ padding: '0.75rem 0.65rem', color: COLORS.textMuted, maxWidth: '160px' }}>
                            <span title={evt.motivo} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {evt.motivo}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.65rem', color: COLORS.textMuted, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                            👤 {evt.aprobadoPor}
                          </td>
                          <td style={{ padding: '0.75rem 0.65rem', whiteSpace: 'nowrap' }}>
                            <span style={{ 
                              padding: '0.18rem 0.5rem', 
                              borderRadius: '6px', 
                              background: evt.estado === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                              color: evt.estado === 'ACTIVE' ? '#10b981' : '#ef4444', 
                              border: `1px solid ${evt.estado === 'ACTIVE' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                              fontSize: '0.72rem',
                              fontWeight: 600
                            }}>
                              {evt.estado === 'ACTIVE' ? 'Activo' : 'Cancelado'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .spin-animation { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        .custom-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 4px;
        }
        .custom-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.28);
        }
        
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
