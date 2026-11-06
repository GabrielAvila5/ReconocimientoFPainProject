import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Search, Filter, Plus, Trash2, AlertCircle, RefreshCw, X, ClipboardList, CheckCircle2, AlertTriangle, Users, Building, Clock, ChevronLeft, ChevronRight, ExternalLink, Info, Check, CalendarDays, RotateCcw } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import EmployeeSearchSelect from '../../components/EmployeeSearchSelect';

const getTodayLocalString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const EventsPage = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Estado para modal estilizado de cancelación de evento
  const [eventToCancel, setEventToCancel] = useState(null);
  const [isCanceling, setIsCanceling] = useState(false);
  
  // Pestañas operativas
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'TODAY' | 'GLOBAL' | 'COMPLETED' | 'CANCELLED'

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedTemporal, setSelectedTemporal] = useState('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState('ALL');

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/events?status=ALL');
      setEvents(res.data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Error al obtener eventos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleConfirmCancel = async () => {
    if (!eventToCancel) return;
    try {
      setIsCanceling(true);
      await api.delete(`/events/${eventToCancel.id}`);
      toast.success('Evento cancelado exitosamente');
      setEventToCancel(null);
      fetchEvents();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cancelar evento');
    } finally {
      setIsCanceling(false);
    }
  };

  const handleReactivateEvent = async (evt) => {
    try {
      await api.put(`/events/${evt.id}`, { status: 'ACTIVE' });
      toast.success('Evento reactivado exitosamente');
      fetchEvents();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al reactivar evento');
    }
  };

  const handlePermanentDelete = async (evt) => {
    if (!window.confirm(`¿Estás seguro de eliminar permanentemente este registro de evento de la base de datos?`)) return;
    try {
      await api.delete(`/events/${evt.id}?hard=true`);
      toast.success('Evento eliminado definitivamente de la base de datos');
      fetchEvents();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar evento');
    }
  };

  // Helper para determinar el estado temporal real del evento (Concluido, En curso hoy, Programado, Cancelado)
  const getEventTemporalStatus = (evt) => {
    if (evt.status === 'CANCELLED') {
      return {
        key: 'CANCELLED',
        label: 'Cancelado',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.3)'
      };
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const startStr = typeof evt.date === 'string' ? evt.date.split('T')[0] : new Date(evt.date).toISOString().split('T')[0];
    const endStr = evt.dateTo 
      ? (typeof evt.dateTo === 'string' ? evt.dateTo.split('T')[0] : new Date(evt.dateTo).toISOString().split('T')[0]) 
      : startStr;

    if (todayStr > endStr) {
      return {
        key: 'COMPLETED',
        label: 'Concluido',
        color: '#a1a1aa',
        bg: 'rgba(161, 161, 170, 0.1)',
        border: 'rgba(161, 161, 170, 0.25)'
      };
    } else if (todayStr >= startStr && todayStr <= endStr) {
      return {
        key: 'CURRENT',
        label: 'En curso hoy',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.15)',
        border: 'rgba(16, 185, 129, 0.3)'
      };
    } else {
      return {
        key: 'SCHEDULED',
        label: 'Programado',
        color: '#60a5fa',
        bg: 'rgba(59, 130, 246, 0.15)',
        border: 'rgba(59, 130, 246, 0.3)'
      };
    }
  };

  // Helper para formatear rango de fechas y calcular días
  const formatEventRange = (evt) => {
    const startStr = typeof evt.date === 'string' ? evt.date.split('T')[0] : new Date(evt.date).toISOString().split('T')[0];
    const endStr = evt.dateTo 
      ? (typeof evt.dateTo === 'string' ? evt.dateTo.split('T')[0] : new Date(evt.dateTo).toISOString().split('T')[0]) 
      : null;

    const formatDate = (str) => {
      if (!str) return '';
      const [y, m, d] = str.split('-');
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
    };

    if (endStr && endStr !== startStr) {
      const d1 = new Date(startStr);
      const d2 = new Date(endStr);
      const days = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
      return {
        isRange: true,
        startFormatted: formatDate(startStr),
        endFormatted: formatDate(endStr),
        text: `${formatDate(startStr)} ➔ ${formatDate(endStr)}`,
        days: `${days} días`
      };
    }
    return {
      isRange: false,
      startFormatted: formatDate(startStr),
      endFormatted: formatDate(startStr),
      text: formatDate(startStr),
      days: '1 día'
    };
  };

  // Valores únicos para filtros
  const availableDepartments = useMemo(() => {
    const depts = events
      .map(e => e.employee?.department?.name)
      .filter(Boolean);
    return [...new Set(depts)].sort();
  }, [events]);

  const availableYears = useMemo(() => {
    const set = new Set();
    const currentYear = new Date().getFullYear();
    set.add(currentYear);
    events.forEach(e => {
      if (e.date) {
        const y = new Date(e.date).getFullYear();
        if (y) set.add(y);
      }
      if (e.dateTo) {
        const y2 = new Date(e.dateTo).getFullYear();
        if (y2) set.add(y2);
      }
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [events]);

  const months = [
    { num: '0', name: 'Enero' },
    { num: '1', name: 'Febrero' },
    { num: '2', name: 'Marzo' },
    { num: '3', name: 'Abril' },
    { num: '4', name: 'Mayo' },
    { num: '5', name: 'Junio' },
    { num: '6', name: 'Julio' },
    { num: '7', name: 'Agosto' },
    { num: '8', name: 'Septiembre' },
    { num: '9', name: 'Octubre' },
    { num: '10', name: 'Noviembre' },
    { num: '11', name: 'Diciembre' }
  ];

  // Cálculo de KPIs superiores de manera dinámica
  const kpis = useMemo(() => {
    let vacationDaysTotal = 0;
    let vacationToday = 0;
    let vacationEventsCount = 0;

    let overtimeHoursTotal = 0;
    let overtimeToday = 0;
    let overtimeCount = 0;

    let justifiedCount = 0;
    let justifiedToday = 0;

    let incidentsCount = 0;
    let incidentsToday = 0;

    let currentTodayCount = 0;
    let completedCount = 0;
    let globalEventsCount = 0;
    let cancelledCount = 0;

    events.forEach(evt => {
      if (evt.status === 'CANCELLED') {
        cancelledCount++;
        return;
      }
      const temporal = getEventTemporalStatus(evt);
      if (temporal.key === 'CURRENT') currentTodayCount++;
      if (temporal.key === 'COMPLETED') completedCount++;
      if (evt.batchId) globalEventsCount++;

      if (evt.type === 'VACATION') {
        vacationEventsCount++;
        const start = new Date(evt.date);
        const end = evt.dateTo ? new Date(evt.dateTo) : start;
        const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
        vacationDaysTotal += Math.max(1, days);
        if (temporal.key === 'CURRENT') vacationToday++;
      } else if (evt.type === 'OVERTIME') {
        overtimeCount++;
        overtimeHoursTotal += (evt.minutes || 0) / 60;
        if (temporal.key === 'CURRENT') overtimeToday++;
      } else if (evt.type === 'JUSTIFIED_ABSENCE') {
        justifiedCount++;
        if (temporal.key === 'CURRENT') justifiedToday++;
      } else if (evt.type === 'EARLY_EXIT' || evt.type === 'LATE_ARRIVAL') {
        incidentsCount++;
        if (temporal.key === 'CURRENT') incidentsToday++;
      }
    });

    return {
      vacationDaysTotal,
      vacationToday,
      vacationEventsCount,
      overtimeHoursTotal: +overtimeHoursTotal.toFixed(1),
      overtimeToday,
      overtimeCount,
      justifiedCount,
      justifiedToday,
      incidentsCount,
      incidentsToday,
      currentTodayCount,
      completedCount,
      globalEventsCount,
      cancelledCount
    };
  }, [events]);

  // Filtrado compuesto
  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
      const temporal = getEventTemporalStatus(evt);

      // 1. Filtro por Pestaña Activa
      if (activeTab === 'TODAY' && (temporal.key !== 'CURRENT' || evt.status === 'CANCELLED')) return false;
      if (activeTab === 'GLOBAL' && (!evt.batchId || evt.status === 'CANCELLED')) return false;
      if (activeTab === 'COMPLETED' && (temporal.key !== 'COMPLETED' || evt.status === 'CANCELLED')) return false;
      if (activeTab === 'CANCELLED' && evt.status !== 'CANCELLED') return false;

      // 2. Filtro por Tipo de Evento
      if (selectedType !== 'ALL' && evt.type !== selectedType) return false;

      // 3. Filtro por Estado Temporal
      if (selectedTemporal !== 'ALL' && temporal.key !== selectedTemporal) return false;

      // 4. Filtro por Departamento
      if (selectedDepartment !== 'ALL') {
        const deptName = evt.employee?.department?.name || '';
        if (deptName !== selectedDepartment) return false;
      }

      // 5. Filtro por Año
      if (selectedYear !== 'ALL') {
        const y1 = new Date(evt.date).getFullYear();
        const y2 = evt.dateTo ? new Date(evt.dateTo).getFullYear() : y1;
        const targetY = parseInt(selectedYear, 10);
        if (y1 !== targetY && y2 !== targetY) return false;
      }

      // 6. Filtro por Mes
      if (selectedMonth !== 'ALL') {
        const m1 = new Date(evt.date).getMonth();
        const m2 = evt.dateTo ? new Date(evt.dateTo).getMonth() : m1;
        const targetM = parseInt(selectedMonth, 10);
        if (m1 !== targetM && m2 !== targetM) return false;
      }

      // 7. Búsqueda por texto (nombre, DNI, depto, motivo, aprobador)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const fullName = `${evt.employee?.firstName || ''} ${evt.employee?.lastName || ''}`.toLowerCase();
        const identifier = (evt.employee?.identifier || '').toLowerCase();
        const dept = (evt.employee?.department?.name || '').toLowerCase();
        const reason = (evt.reason || '').toLowerCase();
        const approvedBy = (evt.registeredBy?.name || '').toLowerCase();

        if (
          !fullName.includes(q) &&
          !identifier.includes(q) &&
          !dept.includes(q) &&
          !reason.includes(q) &&
          !approvedBy.includes(q)
        ) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [events, activeTab, selectedType, selectedTemporal, selectedDepartment, selectedYear, selectedMonth, searchTerm]);

  // Manejo de paginación
  const totalPages = Math.ceil(filteredEvents.length / pageSize) || 1;
  const paginatedEvents = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredEvents.slice(startIndex, startIndex + pageSize);
  }, [filteredEvents, currentPage, pageSize]);

  // Reset de página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, selectedType, selectedTemporal, selectedDepartment, selectedYear, selectedMonth, searchTerm]);

  const hasActiveFilters = selectedType !== 'ALL' || selectedTemporal !== 'ALL' || selectedDepartment !== 'ALL' || selectedYear !== 'ALL' || selectedMonth !== 'ALL' || searchTerm.trim() !== '';

  const resetAllFilters = () => {
    setSelectedType('ALL');
    setSelectedTemporal('ALL');
    setSelectedDepartment('ALL');
    setSelectedYear('ALL');
    setSelectedMonth('ALL');
    setSearchTerm('');
    setActiveTab('ALL');
  };

  const getInitials = (f, l) => `${(f || '').charAt(0)}${(l || '').charAt(0)}`.toUpperCase();

  return (
    <div className="fade-in" style={{ paddingBottom: '2.5rem' }}>
      {/* Encabezado Principal */}
      <div className="flex-mobile-col" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', gap: '1rem' }}>
        <div>
          <h2 style={{ color: '#fff', margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>Control de Eventos y Permisos</h2>
          <p style={{ color: '#a1a1aa', margin: '0.4rem 0 0 0', fontSize: '0.95rem' }}>
            Gestiona vacaciones, horas extra, permisos justificados y eventos globales del personal.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/dashboard/reports')}
            title="Ir a reportes y analíticas"
            style={{
              ...btnSecondary,
              padding: '0.65rem 1rem',
              fontSize: '0.88rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <ExternalLink size={16} /> Ver en Reportes
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ ...btnPrimary, padding: '0.65rem 1.25rem', fontSize: '0.88rem' }}
            className="mobile-w-full justify-center"
          >
            <Plus size={18} /> Nuevo Evento
          </button>
        </div>
      </div>

      {/* Tarjetas KPI Modernas con Clic Interactivo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {/* Card 1: Vacaciones */}
        <div 
          className="card card-glow-purple" 
          onClick={() => setSelectedType(prev => prev === 'VACATION' ? 'ALL' : 'VACATION')}
          style={{ 
            padding: '1.5rem', 
            cursor: 'pointer',
            border: selectedType === 'VACATION' ? '2px solid #8b5cf6' : '1px solid #27272a',
            boxShadow: selectedType === 'VACATION' ? '0 0 16px rgba(139, 92, 246, 0.25)' : 'none',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
          title="Clic para filtrar únicamente Vacaciones"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 600 }}>Vacaciones</span>
            <div className="icon-box" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)' }}>
              <CalendarDays size={18} style={{ color: '#8b5cf6' }} />
            </div>
          </div>
          <div style={{ margin: '0.75rem 0 0' }}>
            <h3 style={{ color: '#a78bfa', fontSize: '2.2rem', margin: 0, fontWeight: 700, lineHeight: 1 }}>
              {kpis.vacationDaysTotal} <span style={{ fontSize: '0.9rem', color: '#a1a1aa', fontWeight: 400 }}>días</span>
            </h3>
            <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ color: kpis.vacationToday > 0 ? '#34d399' : '#a1a1aa', fontWeight: 600 }}>● {kpis.vacationToday} en curso hoy</span>
              <span>•</span>
              <span>{kpis.vacationEventsCount} solicitudes</span>
            </p>
          </div>
        </div>

        {/* Card 2: Horas Extra */}
        <div 
          className="card card-glow-blue" 
          onClick={() => setSelectedType(prev => prev === 'OVERTIME' ? 'ALL' : 'OVERTIME')}
          style={{ 
            padding: '1.5rem', 
            cursor: 'pointer',
            border: selectedType === 'OVERTIME' ? '2px solid #3b82f6' : '1px solid #27272a',
            boxShadow: selectedType === 'OVERTIME' ? '0 0 16px rgba(59, 130, 246, 0.25)' : 'none',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
          title="Clic para filtrar únicamente Horas Extra"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 600 }}>Horas Extra</span>
            <div className="icon-box" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
              <Clock size={18} style={{ color: '#3b82f6' }} />
            </div>
          </div>
          <div style={{ margin: '0.75rem 0 0' }}>
            <h3 style={{ color: '#60a5fa', fontSize: '2.2rem', margin: 0, fontWeight: 700, lineHeight: 1 }}>
              {kpis.overtimeHoursTotal} <span style={{ fontSize: '0.9rem', color: '#a1a1aa', fontWeight: 400 }}>hrs</span>
            </h3>
            <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ color: kpis.overtimeToday > 0 ? '#34d399' : '#a1a1aa', fontWeight: 600 }}>● {kpis.overtimeToday} activas hoy</span>
              <span>•</span>
              <span>{kpis.overtimeCount} turnos</span>
            </p>
          </div>
        </div>

        {/* Card 3: Faltas Justificadas */}
        <div 
          className="card card-glow-green" 
          onClick={() => setSelectedType(prev => prev === 'JUSTIFIED_ABSENCE' ? 'ALL' : 'JUSTIFIED_ABSENCE')}
          style={{ 
            padding: '1.5rem', 
            cursor: 'pointer',
            border: selectedType === 'JUSTIFIED_ABSENCE' ? '2px solid #10b981' : '1px solid #27272a',
            boxShadow: selectedType === 'JUSTIFIED_ABSENCE' ? '0 0 16px rgba(16, 185, 129, 0.25)' : 'none',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
          title="Clic para filtrar únicamente Faltas Justificadas"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 600 }}>Faltas Justificadas</span>
            <div className="icon-box" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
              <CheckCircle2 size={18} style={{ color: '#10b981' }} />
            </div>
          </div>
          <div style={{ margin: '0.75rem 0 0' }}>
            <h3 style={{ color: '#34d399', fontSize: '2.2rem', margin: 0, fontWeight: 700, lineHeight: 1 }}>
              {kpis.justifiedCount} <span style={{ fontSize: '0.9rem', color: '#a1a1aa', fontWeight: 400 }}>permisos</span>
            </h3>
            <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ color: kpis.justifiedToday > 0 ? '#34d399' : '#a1a1aa', fontWeight: 600 }}>● {kpis.justifiedToday} en curso hoy</span>
              <span>•</span>
              <span>Con justificante</span>
            </p>
          </div>
        </div>

        {/* Card 4: Salidas y Retardos */}
        <div 
          className="card card-glow-yellow" 
          onClick={() => setSelectedType(prev => (prev === 'EARLY_EXIT' || prev === 'LATE_ARRIVAL') ? 'ALL' : 'EARLY_EXIT')}
          style={{ 
            padding: '1.5rem', 
            cursor: 'pointer',
            border: (selectedType === 'EARLY_EXIT' || selectedType === 'LATE_ARRIVAL') ? '2px solid #eab308' : '1px solid #27272a',
            boxShadow: (selectedType === 'EARLY_EXIT' || selectedType === 'LATE_ARRIVAL') ? '0 0 16px rgba(234, 179, 8, 0.25)' : 'none',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
          title="Clic para filtrar incidencias de jornada"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: '#a1a1aa', fontWeight: 600 }}>Salidas y Retardos</span>
            <div className="icon-box" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)' }}>
              <AlertTriangle size={18} style={{ color: '#eab308' }} />
            </div>
          </div>
          <div style={{ margin: '0.75rem 0 0' }}>
            <h3 style={{ color: '#facc15', fontSize: '2.2rem', margin: 0, fontWeight: 700, lineHeight: 1 }}>
              {kpis.incidentsCount} <span style={{ fontSize: '0.9rem', color: '#a1a1aa', fontWeight: 400 }}>reg.</span>
            </h3>
            <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ color: kpis.incidentsToday > 0 ? '#34d399' : '#a1a1aa', fontWeight: 600 }}>● {kpis.incidentsToday} hoy</span>
              <span>•</span>
              <span>Incidencias autorizadas</span>
            </p>
          </div>
        </div>
      </div>

      {/* Pestañas Operativas de Navegación */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid #27272a', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveTab('ALL')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'ALL' ? '2px solid #f97316' : '2px solid transparent',
            color: activeTab === 'ALL' ? '#f97316' : '#a1a1aa',
            padding: '0.5rem 0.85rem',
            fontWeight: 600,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          📋 Todos los Registros ({events.length})
        </button>
        <button 
          onClick={() => setActiveTab('TODAY')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'TODAY' ? '2px solid #10b981' : '2px solid transparent',
            color: activeTab === 'TODAY' ? '#10b981' : '#a1a1aa',
            padding: '0.5rem 0.85rem',
            fontWeight: 600,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
          En Curso Hoy ({kpis.currentTodayCount})
        </button>
        <button 
          onClick={() => setActiveTab('GLOBAL')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'GLOBAL' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'GLOBAL' ? '#3b82f6' : '#a1a1aa',
            padding: '0.5rem 0.85rem',
            fontWeight: 600,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
          title="Eventos asignados a nivel departamento (asignaciones grupales)"
        >
          <Users size={16} />
          Asignaciones Grupales ({kpis.globalEventsCount})
        </button>
        <button 
          onClick={() => setActiveTab('COMPLETED')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'COMPLETED' ? '2px solid #a1a1aa' : '2px solid transparent',
            color: activeTab === 'COMPLETED' ? '#fff' : '#a1a1aa',
            padding: '0.5rem 0.85rem',
            fontWeight: 600,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          🗂️ Historial Concluido ({kpis.completedCount})
        </button>
        {kpis.cancelledCount > 0 && (
          <button 
            onClick={() => setActiveTab('CANCELLED')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'CANCELLED' ? '2px solid #ef4444' : '2px solid transparent',
              color: activeTab === 'CANCELLED' ? '#ef4444' : '#71717a',
              padding: '0.5rem 0.85rem',
              fontWeight: 600,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            🗑️ Cancelados ({kpis.cancelledCount})
          </button>
        )}
      </div>

      {/* Barra de Filtros Avanzada */}
      <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '0.85rem' }}>
          {/* Buscador */}
          <div style={{ gridColumn: 'span 2', minWidth: '240px' }} className="mobile-w-full">
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem', fontWeight: 500 }}>
              Búsqueda rápida
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
              <input 
                type="text" 
                placeholder="Buscar por empleado, DNI, motivo o aprobador..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ ...inputStyle, padding: '0.55rem 0.85rem 0.55rem 2.35rem', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Filtro por Tipo */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem', fontWeight: 500 }}>
              Tipo de Evento
            </label>
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              style={{ ...inputStyle, padding: '0.55rem', fontSize: '0.85rem' }}
            >
              <option value="ALL">Todos los tipos</option>
              <option value="VACATION">Vacaciones</option>
              <option value="OVERTIME">Horas Extra</option>
              <option value="JUSTIFIED_ABSENCE">Falta Justificada</option>
              <option value="EARLY_EXIT">Salida Anticipada</option>
              <option value="LATE_ARRIVAL">Llegada Tardía</option>
            </select>
          </div>

          {/* Filtro por Estado Temporal */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem', fontWeight: 500 }}>
              Estado Temporal
            </label>
            <select
              value={selectedTemporal}
              onChange={e => setSelectedTemporal(e.target.value)}
              style={{ ...inputStyle, padding: '0.55rem', fontSize: '0.85rem' }}
            >
              <option value="ALL">Todos los estados</option>
              <option value="CURRENT">🟢 En curso hoy</option>
              <option value="COMPLETED">⚪ Concluido / Pasado</option>
              <option value="SCHEDULED">🔵 Programado (Futuro)</option>
              <option value="CANCELLED">🔴 Cancelado</option>
            </select>
          </div>

          {/* Filtro por Departamento */}
          {availableDepartments.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem', fontWeight: 500 }}>
                Departamento
              </label>
              <select
                value={selectedDepartment}
                onChange={e => setSelectedDepartment(e.target.value)}
                style={{ ...inputStyle, padding: '0.55rem', fontSize: '0.85rem' }}
              >
                <option value="ALL">Todos los departamentos</option>
                {availableDepartments.map(dep => (
                  <option key={dep} value={dep}>{dep}</option>
                ))}
              </select>
            </div>
          )}

          {/* Filtro Año */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem', fontWeight: 500 }}>
              Año
            </label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              style={{ ...inputStyle, padding: '0.55rem', fontSize: '0.85rem' }}
            >
              <option value="ALL">Todos los años</option>
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Filtro Mes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem', fontWeight: 500 }}>
              Mes
            </label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{ ...inputStyle, padding: '0.55rem', fontSize: '0.85rem' }}
            >
              <option value="ALL">Todos los meses</option>
              {months.map(m => (
                <option key={m.num} value={m.num}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Barra de estado de filtros */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.65rem', borderTop: '1px solid #27272a', fontSize: '0.85rem', color: '#a1a1aa', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span>
            Mostrando <strong style={{ color: '#fff' }}>{filteredEvents.length}</strong> de {events.length} registro(s) encontrados
          </span>
          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              Limpiar todos los filtros ✕
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Eventos Reestructurada */}
      {error ? (
        <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
          <AlertCircle size={40} style={{ margin: '0 auto 1rem auto' }} />
          <h4 style={{ margin: '0 0 0.5rem' }}>Error al cargar eventos</h4>
          <p style={{ margin: '0 0 1rem', color: '#fca5a5' }}>{error}</p>
          <button onClick={fetchEvents} style={{ ...btnPrimary, margin: '0 auto', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={16} /> Reintentar
          </button>
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '5rem 0', background: '#18181b', borderRadius: '12px', border: '1px solid #27272a' }}>
          <RefreshCw className="spin" size={36} style={{ color: '#f97316', margin: '0 auto 1rem' }} />
          <p style={{ color: '#a1a1aa', margin: 0, fontSize: '0.95rem' }}>Cargando registros de eventos...</p>
        </div>
      ) : (
        <div style={{ background: '#18181b', borderRadius: '14px', overflow: 'hidden', border: '1px solid #27272a', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          <div className="table-responsive-wrapper">
            <table style={tableStyle}>
              <thead>
                <tr style={{ borderBottom: '1px solid #27272a', background: '#141417' }}>
                  <th style={thStyle}>Empleado / Alcance</th>
                  <th style={{ ...thStyle, whiteSpace: 'nowrap' }}>Tipo de Evento</th>
                  <th style={{ ...thStyle, whiteSpace: 'nowrap' }}>Fecha / Vigencia</th>
                  <th style={{ ...thStyle, whiteSpace: 'nowrap' }}>Detalle</th>
                  <th style={thStyle}>Motivo / Aprobador</th>
                  <th style={{ ...thStyle, whiteSpace: 'nowrap' }}>Estado</th>
                  <th style={{ ...thStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEvents.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '3.5rem 2rem', textAlign: 'center', color: '#a1a1aa' }}>
                      <Calendar size={40} style={{ color: '#52525b', margin: '0 auto 0.75rem' }} />
                      <h4 style={{ color: '#fff', margin: '0 0 0.5rem', fontSize: '1.1rem' }}>No se encontraron eventos</h4>
                      <p style={{ margin: 0, fontSize: '0.88rem' }}>
                        {hasActiveFilters 
                          ? 'No hay eventos que coincidan con los filtros aplicados.' 
                          : 'Aún no se han registrado eventos o permisos en el sistema.'}
                      </p>
                      {hasActiveFilters && (
                        <button onClick={resetAllFilters} style={{ ...btnSecondary, margin: '1rem auto 0', display: 'inline-flex', padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
                          Restablecer filtros
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedEvents.map(evt => {
                    const temporal = getEventTemporalStatus(evt);
                    const range = formatEventRange(evt);

                    return (
                      <tr key={evt.id} style={{ borderBottom: '1px solid #27272a', transition: 'background-color 0.15s' }} className="table-row-hover">
                        {/* Empleado y Departamento */}
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div style={{ 
                              width: '32px', 
                              height: '32px', 
                              borderRadius: '50%', 
                              background: 'rgba(249, 115, 22, 0.15)', 
                              color: '#f97316', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              fontWeight: 'bold',
                              fontSize: '0.78rem',
                              flexShrink: 0
                            }}>
                              {getInitials(evt.employee?.firstName, evt.employee?.lastName)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {evt.employee?.firstName} {evt.employee?.lastName}
                              </div>
                              <div style={{ color: '#a1a1aa', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px', flexWrap: 'wrap' }}>
                                <span>{evt.employee?.identifier}</span>
                                {evt.employee?.department?.name && (
                                  <>
                                    <span>•</span>
                                    <span style={{ color: '#d4d4d8' }}>{evt.employee?.department?.name}</span>
                                  </>
                                )}
                                {evt.batchId && (
                                  <span 
                                    title="Evento aplicado grupalmente a nivel de departamento"
                                    style={{ 
                                      padding: '0.1rem 0.35rem', 
                                      background: 'rgba(59, 130, 246, 0.12)', 
                                      color: '#60a5fa', 
                                      borderRadius: '4px', 
                                      fontSize: '0.65rem', 
                                      fontWeight: 600, 
                                      border: '1px solid rgba(59, 130, 246, 0.25)' 
                                    }}
                                  >
                                    Grupal
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Tipo de Evento */}
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                          <EventTypeBadge type={evt.type} />
                        </td>

                        {/* Fecha y Rango */}
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                          {range.isRange ? (
                            <div>
                              <div style={{ color: '#e4e4e7', fontWeight: 600, fontSize: '0.82rem' }}>
                                {range.startFormatted}
                              </div>
                              <div style={{ color: '#a1a1aa', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                                <span>al {range.endFormatted}</span>
                                <span style={{ color: '#38bdf8', fontWeight: 500 }}>({range.days})</span>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ color: '#e4e4e7', fontWeight: 500, fontSize: '0.82rem' }}>
                                {range.startFormatted}
                              </div>
                              <div style={{ color: '#71717a', fontSize: '0.72rem', marginTop: '1px' }}>
                                1 día
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Detalles de la Jornada */}
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                          {evt.type === 'OVERTIME' && evt.minutes ? (
                            <div>
                              <span style={{ color: '#60a5fa', fontWeight: 600, fontSize: '0.82rem' }}>
                                {evt.minutes / 60} hrs extra
                              </span>
                              <div style={{ color: '#71717a', fontSize: '0.72rem' }}>({evt.minutes} mins)</div>
                            </div>
                          ) : (evt.startTime || evt.endTime) ? (
                            <div style={{ fontSize: '0.78rem', color: '#e4e4e7' }}>
                              {evt.type === 'EARLY_EXIT' ? (
                                <div>
                                  <span style={{ color: '#eab308', fontWeight: 600 }}>
                                    Salida: {evt.startTime ? new Date(evt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (evt.endTime ? new Date(evt.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hora abierta')}
                                  </span>
                                  {evt.minutes ? <div style={{ color: '#71717a', fontSize: '0.72rem' }}>({(evt.minutes / 60).toFixed(1)} hrs antes)</div> : null}
                                </div>
                              ) : evt.type === 'LATE_ARRIVAL' ? (
                                <div>
                                  <span style={{ color: '#f97316', fontWeight: 600 }}>
                                    Llegada: {evt.startTime ? new Date(evt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Tolerancia'}
                                  </span>
                                </div>
                              ) : (
                                <>
                                  {evt.startTime && <div>De: {new Date(evt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                                  {evt.endTime && <div>A: {new Date(evt.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                                </>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>
                              Jornada completa
                            </span>
                          )}
                        </td>

                        {/* Motivo y Aprobador */}
                        <td style={{ ...tdStyle, maxWidth: '160px' }}>
                          <div style={{ color: '#e4e4e7', fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={evt.reason}>
                            {evt.reason || 'Sin motivo'}
                          </div>
                          <div style={{ color: '#71717a', fontSize: '0.72rem', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            👤 {evt.registeredBy?.name || 'Admin'}
                          </div>
                        </td>

                        {/* Estado Temporal Inteligente */}
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                          <span style={{ 
                            padding: '0.2rem 0.55rem', 
                            background: temporal.bg, 
                            color: temporal.color, 
                            border: `1px solid ${temporal.border}`, 
                            borderRadius: '999px', 
                            fontSize: '0.72rem', 
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}>
                            {temporal.key === 'CURRENT' && (
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 5px #10b981' }} />
                            )}
                            {temporal.label}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {evt.status === 'ACTIVE' ? (
                            <button 
                              onClick={() => setEventToCancel(evt)}
                              style={{ 
                                background: 'rgba(239, 68, 68, 0.1)', 
                                border: '1px solid rgba(239, 68, 68, 0.25)', 
                                color: '#ef4444', 
                                cursor: 'pointer', 
                                padding: '0.32rem 0.55rem',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                fontSize: '0.72rem',
                                fontWeight: 500,
                                transition: 'all 0.2s'
                              }}
                              className="btn-trash-action"
                              title="Cancelar este evento activo"
                            >
                              <Trash2 size={12} /> Cancelar
                            </button>
                          ) : (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center' }}>
                              <button
                                onClick={() => handleReactivateEvent(evt)}
                                style={{
                                  background: 'rgba(16, 185, 129, 0.1)',
                                  border: '1px solid rgba(16, 185, 129, 0.25)',
                                  color: '#10b981',
                                  cursor: 'pointer',
                                  padding: '0.3rem 0.5rem',
                                  borderRadius: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  fontSize: '0.72rem',
                                  fontWeight: 500,
                                  transition: 'all 0.2s'
                                }}
                                title="Reactivar este evento cancelado"
                              >
                                <RotateCcw size={12} /> Reactivar
                              </button>
                              <button
                                onClick={() => handlePermanentDelete(evt)}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.08)',
                                  border: '1px solid rgba(239, 68, 68, 0.2)',
                                  color: '#f87171',
                                  cursor: 'pointer',
                                  padding: '0.3rem 0.5rem',
                                  borderRadius: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  fontSize: '0.72rem',
                                  fontWeight: 500,
                                  transition: 'all 0.2s'
                                }}
                                title="Eliminar definitivamente de la base de datos"
                              >
                                <Trash2 size={12} /> Borrar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Barra de Paginación */}
          {totalPages > 1 && (
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: '#141417' }}>
              <div style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>
                Página <strong style={{ color: '#fff' }}>{currentPage}</strong> de {totalPages} • Total: {filteredEvents.length} eventos
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  style={{
                    ...btnSecondary,
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.82rem',
                    opacity: currentPage === 1 ? 0.4 : 1,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronLeft size={16} /> Anterior
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  style={{
                    ...btnSecondary,
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.82rem',
                    opacity: currentPage === totalPages ? 0.4 : 1,
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  Siguiente <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Estilizado de Confirmación para Cancelar Evento */}
      {eventToCancel && (
        <CancelEventModal 
          event={eventToCancel}
          isCanceling={isCanceling}
          onClose={() => setEventToCancel(null)}
          onConfirm={handleConfirmCancel}
        />
      )}

      {isModalOpen && (
        <CreateEventModal 
          onClose={() => setIsModalOpen(false)} 
          onCreated={() => { setIsModalOpen(false); fetchEvents(); toast.success('Evento creado exitosamente'); }} 
        />
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .btn-trash-action:hover {
          background-color: rgba(239, 68, 68, 0.15) !important;
          transform: scale(1.1);
        }
        .fade-in-up {
          animation: fadeInUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
};

// Modal Estilizado para Cancelar Evento
const CancelEventModal = ({ event, isCanceling, onClose, onConfirm }) => {
  if (!event) return null;

  const eventDateFormatted = new Date(event.date).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const eventDateToFormatted = event.dateTo ? new Date(event.dateTo).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) : null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div 
        className="modal-content page-glow fade-in-up" 
        onClick={e => e.stopPropagation()} 
        style={{
          maxWidth: '460px',
          padding: '1.75rem',
          borderRadius: '20px',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(239, 68, 68, 0.12)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '16px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(239, 68, 68, 0.15)'
          }}>
            <Trash2 size={26} color="#ef4444" />
          </div>
          <button 
            onClick={onClose}
            disabled={isCanceling}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#71717a',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '8px',
              transition: 'color 0.2s'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <h3 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '1.25rem', fontWeight: 700 }}>
          ¿Cancelar este evento?
        </h3>
        
        <p style={{ margin: '0 0 1.25rem 0', color: '#a1a1aa', fontSize: '0.9rem', lineHeight: '1.5' }}>
          ¿Estás seguro de cancelar este evento? No tendrá efecto en la asistencia a partir de ahora.
        </p>

        {/* Resumen detallado del evento */}
        <div style={{
          background: '#121215',
          border: '1px solid #27272a',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#71717a', fontWeight: 600 }}>EMPLEADO</span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>
                {event.employee?.firstName} {event.employee?.lastName}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>
                ID: {event.employee?.identifier}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#71717a', fontWeight: 600 }}>TIPO</span>
            <EventTypeBadge type={event.type} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#71717a', fontWeight: 600 }}>FECHA / RANGO</span>
            <span style={{ fontSize: '0.85rem', color: '#e4e4e7', fontWeight: 500 }}>
              {eventDateFormatted} {eventDateToFormatted ? `hasta ${eventDateToFormatted}` : ''}
            </span>
          </div>

          {(event.startTime || event.endTime || event.minutes) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#71717a', fontWeight: 600 }}>DETALLE</span>
              <span style={{ fontSize: '0.85rem', color: '#d4d4d8' }}>
                {event.type === 'EARLY_EXIT' ? (
                  <span style={{ color: '#eab308', fontWeight: 600 }}>
                    Salida autorizada: {event.startTime ? new Date(event.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : (event.endTime ? new Date(event.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Horario flexible')}
                    {event.minutes ? ` (${(event.minutes / 60).toFixed(1)} hrs antes)` : ''}
                  </span>
                ) : event.type === 'LATE_ARRIVAL' ? (
                  <span style={{ color: '#f97316', fontWeight: 600 }}>
                    Llegada autorizada: {event.startTime ? new Date(event.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Tolerancia'}
                  </span>
                ) : (
                  <>
                    {event.minutes ? `${event.minutes / 60} hrs extra` : null}
                    {event.startTime && `Desde ${new Date(event.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
                    {event.endTime && ` Hasta ${new Date(event.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
                  </>
                )}
              </span>
            </div>
          )}

          {event.reason && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#71717a', fontWeight: 600 }}>MOTIVO</span>
              <span style={{ fontSize: '0.8rem', color: '#a1a1aa', textAlign: 'right', maxWidth: '240px' }}>
                {event.reason}
              </span>
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isCanceling}
            style={{
              padding: '0.65rem 1.25rem',
              background: '#27272a',
              color: '#e4e4e7',
              border: '1px solid #3f3f46',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isCanceling}
            style={{
              padding: '0.65rem 1.25rem',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
              transition: 'opacity 0.2s'
            }}
          >
            {isCanceling ? (
              <>
                <RefreshCw size={14} className="spin" /> Cancelando...
              </>
            ) : (
              <>
                <Trash2 size={15} /> Aceptar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente para el badge del tipo
const EventTypeBadge = ({ type }) => {
  const config = {
    OVERTIME: { label: 'Horas Extra', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
    EARLY_EXIT: { label: 'Salida Anticipada', color: '#eab308', bg: 'rgba(234, 179, 8, 0.12)' },
    JUSTIFIED_ABSENCE: { label: 'Falta Justificada', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
    VACATION: { label: 'Vacaciones', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
    LATE_ARRIVAL: { label: 'Llegada Tardía', color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)' }
  };
  const c = config[type] || { label: type, color: '#fff', bg: '#333' };
  
  return (
    <span style={{ 
      padding: '0.3rem 0.8rem', 
      background: c.bg, 
      color: c.color, 
      borderRadius: '999px', 
      fontSize: '0.78rem', 
      fontWeight: 600, 
      border: `1px solid ${c.color}33`,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      whiteSpace: 'nowrap',
      lineHeight: 1.2
    }}>
      {c.label}
    </span>
  );
};

// Modal para crear un nuevo evento
const CreateEventModal = ({ onClose, onCreated }) => {
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [targetType, setTargetType] = useState('employee');
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await api.get('/departments');
        setDepartments(res.data);
      } catch (err) {
        console.error('Error fetching departments', err);
      }
    };
    fetchDepts();
  }, []);
  
  const [formData, setFormData] = useState({
    type: 'OVERTIME',
    date: getTodayLocalString(),
    dateTo: '',
    startTime: '',
    endTime: '',
    hours: '',
    reason: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [confirmDept, setConfirmDept] = useState(false);

  const executeSubmit = async () => {
    setLoading(true);
    
    // Preparar el payload
    const payload = {
      type: formData.type,
      date: formData.date,
      reason: formData.reason || 'Sin motivo'
    };

    if (targetType === 'employee') {
      payload.employeeId = selectedEmp.id;
    } else {
      payload.departmentId = selectedDeptId;
    }
    
    if ((formData.type === 'VACATION' || formData.type === 'OVERTIME') && formData.dateTo) {
      payload.dateTo = formData.dateTo;
    }
    
    if (formData.type === 'OVERTIME') {
      if (formData.hours) {
        payload.minutes = parseFloat(formData.hours) * 60;
      }
    } else if (formData.type === 'EARLY_EXIT') {
      const empShift = selectedEmp?.shifts?.[0]?.shift || selectedEmp?.department?.shifts?.[0]?.shift;
      if (formData.startTime) {
        payload.startTime = new Date(`${formData.date}T${formData.startTime}`).toISOString();
      }
      const refEnd = formData.endTime || empShift?.endTime;
      if (refEnd) {
        payload.endTime = new Date(`${formData.date}T${refEnd}`).toISOString();
      }
      if (formData.startTime && refEnd) {
        const [sh, sm] = refEnd.split(':').map(Number);
        const [eh, em] = formData.startTime.split(':').map(Number);
        if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
          const diffMin = (sh * 60 + sm) - (eh * 60 + em);
          if (diffMin > 0) {
            payload.minutes = diffMin;
          }
        }
      }
    } else if (formData.type === 'LATE_ARRIVAL') {
      if (formData.startTime) {
        payload.startTime = new Date(`${formData.date}T${formData.startTime}`).toISOString();
      }
    }

    try {
      const res = await api.post('/events', payload);
      if (res.data.message) {
        toast.success(res.data.message); // Mensaje del servidor sobre el batch
      } else {
        toast.success('Evento creado exitosamente');
      }
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Error al crear evento');
    } finally {
      setLoading(false);
      setConfirmDept(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (targetType === 'employee' && !selectedEmp) return toast.error('Debe seleccionar un empleado');
    if (targetType === 'department' && !selectedDeptId) return toast.error('Debe seleccionar un departamento');
    
    // Si es para departamento, mostrar confirmación estilizada
    if (targetType === 'department') {
      setConfirmDept(true);
      return;
    }

    executeSubmit();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content page-glow" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3 style={{ color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={20} /> Registrar Nuevo Evento
          </h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {formData.type === 'OVERTIME' && (
            <div>
              <label style={labelStyle}>Asignar a:</label>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="targetType" 
                    value="employee" 
                    checked={targetType === 'employee'} 
                    onChange={() => setTargetType('employee')}
                  />
                  Empleado Individual
                </label>
                <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="targetType" 
                    value="department" 
                    checked={targetType === 'department'} 
                    onChange={() => setTargetType('department')}
                  />
                  Departamento Completo
                </label>
              </div>
            </div>
          )}

          {targetType === 'employee' || formData.type !== 'OVERTIME' ? (
            <div>
              <label style={labelStyle}>Empleado</label>
              <EmployeeSearchSelect 
                selectedEmp={selectedEmp}
                onSelect={setSelectedEmp}
              />
              {selectedEmp && (() => {
                const empShift = selectedEmp?.shifts?.[0]?.shift || selectedEmp?.department?.shifts?.[0]?.shift;
                if (!empShift) return null;
                return (
                  <div style={{ marginTop: '0.45rem', padding: '0.45rem 0.75rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '6px', fontSize: '0.8rem', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} />
                    <span>Turno habitual asignado: <strong>Entrada {empShift.startTime} — Salida {empShift.endTime}</strong></span>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div>
              <label style={labelStyle}>Departamento</label>
              <select 
                value={selectedDeptId}
                onChange={e => setSelectedDeptId(e.target.value)}
                style={inputStyle}
                required
              >
                <option value="">Seleccione un departamento...</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Tipo de Evento</label>
              <select 
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value})}
                style={inputStyle}
                required
              >
                <option value="OVERTIME">Horas Extra</option>
                <option value="EARLY_EXIT">Salida Anticipada</option>
                <option value="JUSTIFIED_ABSENCE">Falta Justificada</option>
                <option value="VACATION">Vacaciones</option>
                <option value="LATE_ARRIVAL">Llegada Tardía</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Fecha {formData.type === 'VACATION' ? 'Inicio' : ''}</label>
              <input 
                type="date" 
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                style={inputStyle}
                required
              />
            </div>
          </div>

          {(formData.type === 'VACATION' || formData.type === 'OVERTIME') && (
            <div>
              <label style={labelStyle}>Fecha Fin {formData.type === 'OVERTIME' ? '(Opcional)' : ''}</label>
              <input 
                type="date" 
                value={formData.dateTo}
                onChange={e => setFormData({...formData, dateTo: e.target.value})}
                style={inputStyle}
                required={formData.type === 'VACATION'}
              />
            </div>
          )}

          {formData.type === 'OVERTIME' && (
            <div>
              <label style={labelStyle}>Cantidad de Horas Extra</label>
              <input 
                type="number" 
                min="0.5"
                step="0.5"
                value={formData.hours}
                onChange={e => setFormData({...formData, hours: e.target.value})}
                style={inputStyle}
                placeholder="Ej. 2"
                required
              />
            </div>
          )}

          {formData.type === 'EARLY_EXIT' && (() => {
            const empShift = selectedEmp?.shifts?.[0]?.shift || selectedEmp?.department?.shifts?.[0]?.shift;
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>
                    Hora Autorizada de Salida <span style={{ color: '#eab308' }}>*</span>
                  </label>
                  <input 
                    type="time" 
                    value={formData.startTime}
                    onChange={e => setFormData({...formData, startTime: e.target.value})}
                    style={inputStyle}
                    required
                  />
                  <span style={{ fontSize: '0.72rem', color: '#a1a1aa', marginTop: '2px', display: 'block' }}>
                    ¿A qué hora saldrá el colaborador?
                  </span>
                </div>
                <div>
                  <label style={labelStyle}>Hora Habitual de Fin de Turno</label>
                  <input 
                    type="time" 
                    value={formData.endTime || empShift?.endTime || ''}
                    onChange={e => setFormData({...formData, endTime: e.target.value})}
                    style={inputStyle}
                    placeholder="Hora de fin de turno"
                  />
                  <span style={{ fontSize: '0.72rem', color: '#a1a1aa', marginTop: '2px', display: 'block' }}>
                    {empShift?.endTime ? `Turno normal: ${empShift.endTime}` : 'Referencia de salida habitual'}
                  </span>
                </div>
              </div>
            );
          })()}

          {formData.type === 'LATE_ARRIVAL' && (
            <div>
              <label style={labelStyle}>Hora Estimada de Llegada</label>
              <input 
                type="time" 
                value={formData.startTime}
                onChange={e => setFormData({...formData, startTime: e.target.value})}
                style={inputStyle}
                required
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>Motivo / Observaciones</label>
            <textarea 
              value={formData.reason}
              onChange={e => setFormData({...formData, reason: e.target.value})}
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
              placeholder="Detalle el motivo del evento..."
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #3f3f46' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
            <button type="submit" style={btnPrimary} disabled={loading || (targetType === 'employee' && !selectedEmp) || (targetType === 'department' && !selectedDeptId)}>
              {loading ? 'Guardando...' : 'Registrar Evento'}
            </button>
          </div>
        </form>

        {/* Modal de confirmación para asignación masiva a departamento */}
        {confirmDept && (
          <div 
            className="modal-overlay" 
            style={{ zIndex: 1200 }} 
            onClick={() => setConfirmDept(false)}
          >
            <div 
              className="modal-content page-glow fade-in-up" 
              onClick={e => e.stopPropagation()}
              style={{
                maxWidth: '440px',
                padding: '1.75rem',
                border: '1px solid rgba(234, 179, 8, 0.4)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(234, 179, 8, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#eab308'
                }}>
                  <AlertTriangle size={22} />
                </div>
                <h4 style={{ margin: 0, color: '#fff', fontSize: '1.15rem', fontWeight: 700 }}>
                  ¿Confirmar asignación masiva?
                </h4>
              </div>

              <p style={{ margin: '0 0 1.25rem 0', color: '#d4d4d8', fontSize: '0.85rem', lineHeight: '1.5' }}>
                Estás a punto de asignar Horas Extra a todos los empleados activos del departamento:{' '}
                <strong style={{ color: '#fff' }}>
                  {departments.find(d => d.id === selectedDeptId || d.name === selectedDeptId)?.name || selectedDeptId}
                </strong>.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setConfirmDept(false)}
                  style={btnSecondary}
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={executeSubmit}
                  disabled={loading}
                  style={btnPrimary}
                >
                  {loading ? 'Asignando...' : 'Confirmar y Asignar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Styles
const btnPrimary = {
  padding: '0.75rem 1.5rem',
  background: 'var(--primary-orange, #f97316)',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  transition: 'opacity 0.2s',
  fontFamily: 'inherit'
};

const btnSecondary = {
  padding: '0.75rem 1.5rem',
  background: '#1e1e1e',
  color: '#e4e4e7',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  transition: 'background 0.2s',
  fontFamily: 'inherit'
};

const inputStyle = {
  width: '100%',
  padding: '0.75rem',
  background: '#121212',
  color: '#fff',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit'
};

const labelStyle = {
  display: 'block',
  marginBottom: '0.5rem',
  color: '#a1a1aa',
  fontSize: '0.9rem',
  fontWeight: 500,
  fontFamily: 'inherit'
};

const dropdownMenu = {
  position: 'absolute',
  top: '100%',
  right: 0,
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
  fontSize: '0.9rem',
  fontFamily: 'inherit'
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.84rem'
};

const thStyle = {
  padding: '0.8rem 0.65rem',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '0.78rem',
  color: '#a1a1aa'
};

const tdStyle = {
  padding: '0.7rem 0.65rem',
  color: '#e4e4e7',
  verticalAlign: 'middle'
};

export default EventsPage;
