import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, Clock, AlertTriangle, Activity, AlertCircle, 
  MoreHorizontal, ScanFace, LogIn, LogOut, RefreshCw, 
  Calendar, CheckCircle2, Bell, Info, Check, ChevronRight, UserX
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useNotifications } from '../../contexts/NotificationContext';

const DashboardOverview = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [activeEvents, setActiveEvents] = useState([]);
  const [employeesCount, setEmployeesCount] = useState(0);
  const [employeesList, setEmployeesList] = useState([]);

  // Notificaciones en tiempo real y pestañas híbridas
  const { unreadCount, markAsRead, socket, refetch: refetchNotifCount } = useNotifications();
  const [activeAlertTab, setActiveAlertTab] = useState('alerts'); // 'alerts' | 'incidents'
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('Todos');
  const [filterDateScope, setFilterDateScope] = useState('today'); // 'today' | 'yesterday' | '7days' | 'all'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchNotifications = useCallback(async () => {
    try {
      setNotificationsLoading(true);
      const token = localStorage.getItem('token');
      const tenantId = localStorage.getItem('tenantId');
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const headers = {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(tenantId ? { 'x-tenant-id': tenantId } : {})
      };
      
      const res = await fetch(`${baseUrl}/api/v1/notifications?limit=6`, { headers });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard notifications:', err);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  const handleMarkAsRead = async (e, id) => {
    e.stopPropagation();
    try {
      await markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const getRelativeTime = (dateString) => {
    if (!dateString) return '';
    try {
      const now = new Date();
      const date = new Date(dateString);
      const diffMs = now - date;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSec < 60) return 'Hace un momento';
      if (diffMin < 60) return `Hace ${diffMin} min`;
      if (diffHours < 24) return `Hace ${diffHours} h`;
      if (diffDays === 1) return 'Ayer';
      if (diffDays < 7) return `Hace ${diffDays} d`;
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  };

  const getNotificationStyle = (type) => {
    switch (type) {
      case 'ERROR':
        return {
          Icon: AlertCircle,
          iconColor: '#ef4444',
          bg: 'rgba(239, 68, 68, 0.08)',
          border: 'rgba(239, 68, 68, 0.25)',
          titleColor: '#fca5a5'
        };
      case 'WARNING':
        return {
          Icon: AlertTriangle,
          iconColor: '#eab308',
          bg: 'rgba(234, 179, 8, 0.08)',
          border: 'rgba(234, 179, 8, 0.25)',
          titleColor: '#fde047'
        };
      case 'SUCCESS':
        return {
          Icon: CheckCircle2,
          iconColor: '#10b981',
          bg: 'rgba(16, 185, 129, 0.08)',
          border: 'rgba(16, 185, 129, 0.25)',
          titleColor: '#86efac'
        };
      case 'INFO':
      default:
        return {
          Icon: Info,
          iconColor: '#3b82f6',
          bg: 'rgba(59, 130, 246, 0.08)',
          border: 'rgba(59, 130, 246, 0.25)',
          titleColor: '#93c5fd'
        };
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      fetchNotifications();
      const token = localStorage.getItem('token');
      const tenantId = localStorage.getItem('tenantId');
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const headers = {
        'Authorization': `Bearer ${token}`,
        ...(tenantId ? { 'x-tenant-id': tenantId } : {})
      };
      
      const [attRes, empRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/attendance`, { headers }),
        fetch(`${baseUrl}/api/v1/employees`, { headers })
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
        setEmployeesList(activeEmps.length ? activeEmps : (Array.isArray(empData) ? empData : []));
      }
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchNotifications]);

  useEffect(() => {
    fetchData();
    // Auto-refresco en tiempo real cada 30 segundos
    const timer = setInterval(() => {
      fetchData();
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchData]);

  useEffect(() => {
    if (!socket) return;
    const handleNewNotif = (newNotif) => {
      setNotifications(prev => {
        const exists = prev.some(n => n.id === newNotif.id);
        if (exists) return prev;
        return [newNotif, ...prev.slice(0, 5)];
      });
      if (refetchNotifCount) refetchNotifCount();
    };
    socket.on('new_notification', handleNewNotif);
    return () => {
      socket.off('new_notification', handleNewNotif);
    };
  }, [socket, refetchNotifCount]);

  // Helpers de fechas
  const getLocalDateStr = (date = new Date()) => {
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateStr(new Date());

  const formatEventDate = (dateObj) => {
    try {
      const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const formatDayOfWeek = (dateObj) => {
    try {
      const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
      const str = d.toLocaleDateString('es-ES', { weekday: 'short' });
      return str.charAt(0).toUpperCase() + str.slice(1);
    } catch {
      return '';
    }
  };

  const todayFullFormatted = useMemo(() => {
    const s = new Date().toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, []);

  // Comparador seguro de fechas contra timezones
  const matchesDate = (recordDate, targetDateStr) => {
    if (!recordDate) return false;
    if (typeof recordDate === 'string') {
      return recordDate.startsWith(targetDateStr);
    }
    return getLocalDateStr(recordDate) === targetDateStr;
  };

  // Filtrar registros de hoy para métricas del dashboard
  const todayRecords = attendanceRecords.filter(r => matchesDate(r.date, todayStr));
  
  const aTiempoCount = todayRecords.filter(r => !r.isLate).length;
  const retardosCount = todayRecords.filter(r => r.isLate).length;
  
  // Faltas: empleados totales - asistencias hoy - empleados con permiso hoy
  const eventosJustificadosHoy = activeEvents.filter(e => 
    matchesDate(e.date, todayStr) && 
    (e.type === 'VACATION' || e.type === 'JUSTIFIED_ABSENCE')
  ).length;
  
  const ausenciasCount = Math.max(0, employeesCount - todayRecords.length - eventosJustificadosHoy);
  const asistenciasHoy = todayRecords.length;
  const asistenciaPctHoy = employeesCount > 0 ? Math.round((asistenciasHoy / employeesCount) * 100) : 0;

  // Cálculo de incidencias operativas del día (Retardos, sin checar y permisos)
  const todayIncidents = useMemo(() => {
    const list = [];

    // 1. Retardos registrados hoy
    todayRecords.filter(r => r.isLate).forEach(r => {
      const entTime = r.entrada ? new Date(r.entrada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      list.push({
        id: `late_${r.id}`,
        category: 'retardo',
        name: `${r.employee?.firstName || 'Colaborador'} ${r.employee?.lastName || ''}`.trim(),
        dept: r.employee?.department?.name || 'General',
        time: entTime,
        desc: r.lateMinutes ? `Entrada ${entTime} · +${r.lateMinutes} min de retardo` : `Entrada con retardo (${entTime})`,
        badge: 'Retardo',
        badgeColor: '#eab308',
        badgeBg: 'rgba(234, 179, 8, 0.15)',
        badgeBorder: 'rgba(234, 179, 8, 0.3)'
      });
    });

    // 2. Colaboradores sin checar hoy (ausencias/pendientes)
    const checkedInEmpIds = new Set(todayRecords.map(r => r.employeeId));
    const justifiedEmpIds = new Set(
      activeEvents
        .filter(e => matchesDate(e.date, todayStr))
        .map(e => e.employeeId)
    );

    const pendingEmployees = employeesList.filter(
      e => !checkedInEmpIds.has(e.id) && !justifiedEmpIds.has(e.id)
    );

    pendingEmployees.slice(0, 5).forEach(e => {
      list.push({
        id: `absent_${e.id}`,
        category: 'falta',
        name: `${e.firstName || 'Colaborador'} ${e.lastName || ''}`.trim(),
        dept: e.department?.name || 'General',
        desc: 'Sin marcaje de entrada registrado el día de hoy',
        badge: 'Sin checar',
        badgeColor: '#ef4444',
        badgeBg: 'rgba(239, 68, 68, 0.15)',
        badgeBorder: 'rgba(239, 68, 68, 0.3)'
      });
    });

    // 3. Permisos o justificaciones de hoy
    activeEvents
      .filter(e => matchesDate(e.date, todayStr))
      .forEach(e => {
        const typeLabel = e.type === 'VACATION' ? 'Vacaciones' : (e.type === 'JUSTIFIED_ABSENCE' ? 'Permiso' : 'Justificado');
        list.push({
          id: `justified_${e.id}`,
          category: 'justificado',
          name: e.employee ? `${e.employee.firstName} ${e.employee.lastName}`.trim() : 'Colaborador',
          dept: e.employee?.department?.name || 'General',
          desc: `${typeLabel} registrado en calendario`,
          badge: typeLabel,
          badgeColor: '#3b82f6',
          badgeBg: 'rgba(59, 130, 246, 0.15)',
          badgeBorder: 'rgba(59, 130, 246, 0.3)'
        });
      });

    return {
      list,
      totalPending: pendingEmployees.length,
      retardosCount: todayRecords.filter(r => r.isLate).length
    };
  }, [todayRecords, employeesList, activeEvents, todayStr]);

  const unreadAlertsBadge = notifications.filter(n => !n.isRead).length || unreadCount || 0;
  const totalTodayIncidents = (todayIncidents.retardosCount || 0) + (todayIncidents.totalPending || 0);

  // Tendencia Semanal (Dinámica según registros reales)
  const computeWeeklyTrend = () => {
    const daysShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const daysFull = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const trend = [];
    
    const now = new Date();
    const todayFormatted = getLocalDateStr(now);

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
        esperados: employeesCount || 0,
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

  // Descomponer registros en eventos discretos en tiempo real (Entradas y Salidas separadas)
  const allEvents = useMemo(() => {
    const list = [];

    attendanceRecords.forEach((r, idx) => {
      const fullName = `${r.employee?.firstName || 'Desconocido'} ${r.employee?.lastName || ''}`.trim();
      const initials = `${r.employee?.firstName?.[0] || ''}${r.employee?.lastName?.[0] || ''}`.toUpperCase() || 'EMP';
      const dept = r.employee?.department?.name || 'General';
      const devName = r.device?.name || 'Kiosco Facial';

      // Evento de Entrada
      if (r.entrada) {
        const entDate = new Date(r.entrada);
        const dateStr = getLocalDateStr(entDate);
        list.push({
          id: `${r.id || idx}_in`,
          recordId: r.id,
          employeeId: r.employeeId,
          name: fullName,
          initials,
          dept,
          type: 'Entrada',
          timestamp: entDate.getTime(),
          rawDate: entDate,
          dateStr,
          dateFormatted: formatEventDate(entDate),
          dayOfWeek: formatDayOfWeek(entDate),
          time: entDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          status: r.isLate ? (r.lateMinutes ? `Retardo (+${r.lateMinutes}m)` : 'Retardo') : 'A tiempo',
          statusColor: r.isLate ? 'badge-warning' : 'badge-success',
          device: devName
        });
      }

      // Evento de Salida
      if (r.salida) {
        const salDate = new Date(r.salida);
        const dateStr = getLocalDateStr(salDate);
        list.push({
          id: `${r.id || idx}_out`,
          recordId: r.id,
          employeeId: r.employeeId,
          name: fullName,
          initials,
          dept,
          type: 'Salida',
          timestamp: salDate.getTime(),
          rawDate: salDate,
          dateStr,
          dateFormatted: formatEventDate(salDate),
          dayOfWeek: formatDayOfWeek(salDate),
          time: salDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          status: r.earlyExit 
            ? 'Salida Anticipada' 
            : (r.overtimeMinutes > 0 ? `Horas Extra (+${+(r.overtimeMinutes / 60).toFixed(1)}h)` : 'Normal'),
          statusColor: r.earlyExit ? 'badge-danger' : (r.overtimeMinutes > 0 ? 'badge-info' : 'badge-neutral'),
          device: devName
        });
      }
    });

    // Ordenar de más reciente a más antiguo por timestamp
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [attendanceRecords]);

  // Fechas de referencia para filtrado
  const yesterdayStr = useMemo(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return getLocalDateStr(y);
  }, []);

  const sevenDaysAgoTs = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.getTime();
  }, []);

  // Filtrado de actividad en tiempo real
  const filteredActivity = useMemo(() => {
    return allEvents.filter(act => {
      // 1. Filtro de Alcance de Fecha (Por defecto 'today' para tiempo real)
      if (filterDateScope === 'today') {
        if (!matchesDate(act.rawDate, todayStr)) return false;
      } else if (filterDateScope === 'yesterday') {
        if (!matchesDate(act.rawDate, yesterdayStr)) return false;
      } else if (filterDateScope === '7days') {
        if (act.timestamp < sevenDaysAgoTs) return false;
      }

      // 2. Filtro de Tipo (Entradas / Salidas)
      if (filterAction !== 'Todos' && act.type !== (filterAction === 'Entradas' ? 'Entrada' : 'Salida')) {
        return false;
      }

      // 3. Filtro de Búsqueda por texto
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        return act.name.toLowerCase().includes(query) || act.dept.toLowerCase().includes(query);
      }

      return true;
    });
  }, [allEvents, filterDateScope, filterAction, searchTerm, todayStr, yesterdayStr, sevenDaysAgoTs]);

  // Reset de página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [filterDateScope, filterAction, searchTerm]);

  const totalPages = Math.ceil(filteredActivity.length / itemsPerPage) || 1;
  const paginatedActivity = filteredActivity.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
          {/* Header & Controls */}
          <div className="flex-mobile-col flex justify-between items-center mb-5 gap-4">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 600 }}>Actividad en Tiempo Real</h3>
                {filterDateScope === 'today' && (
                  <span style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '5px', 
                    padding: '2px 8px', 
                    borderRadius: '12px', 
                    fontSize: '0.7rem', 
                    fontWeight: 600,
                    background: 'rgba(16, 185, 129, 0.12)', 
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.25)' 
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                    En vivo (Hoy)
                  </span>
                )}
              </div>
              <p className="text-xs text-muted" style={{ margin: 0, textTransform: 'capitalize' }}>
                {todayFullFormatted} • {filteredActivity.length} {filteredActivity.length === 1 ? 'evento registrado' : 'eventos registrados'}
              </p>
            </div>

            <div className="flex-mobile-col flex gap-2.5 mobile-w-full items-center" style={{ flexWrap: 'wrap' }}>
              {/* Filtro de Alcance de Fecha */}
              <select 
                value={filterDateScope}
                onChange={(e) => setFilterDateScope(e.target.value)}
                style={{ 
                  backgroundColor: 'var(--bg-main)', 
                  border: '1px solid var(--border-color)', 
                  color: 'white', 
                  padding: '0.45rem 0.65rem', 
                  borderRadius: '8px', 
                  fontSize: '0.82rem', 
                  outline: 'none', 
                  cursor: 'pointer' 
                }}
              >
                <option value="today">📅 Solo Hoy</option>
                <option value="yesterday">📅 Ayer</option>
                <option value="7days">📅 Últimos 7 días</option>
                <option value="all">📅 Todo el Historial</option>
              </select>

              {/* Filtro de Tipo (Entrada/Salida) */}
              <select 
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                style={{ 
                  backgroundColor: 'var(--bg-main)', 
                  border: '1px solid var(--border-color)', 
                  color: 'white', 
                  padding: '0.45rem 0.65rem', 
                  borderRadius: '8px', 
                  fontSize: '0.82rem', 
                  outline: 'none', 
                  cursor: 'pointer' 
                }}
              >
                <option value="Todos">Todos los accesos</option>
                <option value="Entradas">Solo Entradas</option>
                <option value="Salidas">Solo Salidas</option>
              </select>

              {/* Buscador */}
              <div style={{ position: 'relative' }} className="mobile-w-full">
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar colaborador..." 
                  style={{ 
                    backgroundColor: 'var(--bg-main)', 
                    border: '1px solid var(--border-color)', 
                    color: 'white', 
                    padding: '0.45rem 0.75rem 0.45rem 2.2rem', 
                    borderRadius: '8px', 
                    fontSize: '0.82rem', 
                    outline: 'none',
                    minWidth: '160px'
                  }} 
                />
                <svg style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>

              {/* Botón Refrescar */}
              <button
                onClick={fetchData}
                disabled={refreshing}
                title="Actualizar actividad en tiempo real"
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  borderRadius: '8px',
                  padding: '0.45rem 0.6rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={14} className={refreshing ? 'spin-animation' : ''} />
              </button>
            </div>
          </div>

          {/* Tabla de Actividad */}
          <div className="table-responsive-wrapper">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '650px' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', fontSize: '0.78rem' }}>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', fontWeight: 600 }}>Empleado</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', fontWeight: 600 }}>Departamento</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', fontWeight: 600 }}>Fecha (D/M/A)</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', fontWeight: 600 }}>Hora</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', fontWeight: 600 }}>Acceso</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', fontWeight: 600 }}>Estado</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', fontWeight: 600 }}>Dispositivo / Método</th>
                </tr>
              </thead>
              <tbody>
                {paginatedActivity.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={28} style={{ opacity: 0.4 }} />
                        <span style={{ fontSize: '0.9rem', color: '#fff' }}>No hay registros de actividad para este criterio.</span>
                        {filterDateScope === 'today' ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Los accesos de hoy aparecerán aquí en vivo conforme se registren en los kioscos.
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Prueba cambiando el filtro de fecha o limpiando el buscador.
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedActivity.map(act => {
                    const isToday = act.dateStr === todayStr;

                    return (
                      <tr key={act.id} style={{ borderBottom: '1px solid rgba(39, 39, 42, 0.4)' }}>
                        {/* Empleado */}
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div className="flex items-center gap-2.5">
                            <div style={{ 
                              width: 32, 
                              height: 32, 
                              minWidth: 32,
                              borderRadius: '50%', 
                              border: '1px solid var(--accent-amber)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              color: 'var(--accent-amber)', 
                              fontSize: '0.75rem', 
                              fontWeight: 600 
                            }}>
                              {act.initials}
                            </div>
                            <span style={{ fontWeight: 500, color: '#fff', fontSize: '0.85rem' }}>{act.name}</span>
                          </div>
                        </td>

                        {/* Departamento */}
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                          {act.dept}
                        </td>

                        {/* Fecha (Día, Mes, Año) */}
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: '#f4f4f5', fontSize: '0.82rem' }}>
                              {act.dateFormatted}
                            </span>
                            <span style={{ 
                              fontSize: '0.7rem', 
                              color: isToday ? '#10b981' : 'var(--text-muted)' 
                            }}>
                              {isToday ? '● Hoy' : act.dayOfWeek}
                            </span>
                          </div>
                        </td>

                        {/* Hora */}
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--accent-amber)', fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600 }}>
                          {act.time}
                        </td>

                        {/* Tipo de Acceso */}
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span style={{ 
                            backgroundColor: act.type === 'Entrada' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(59, 130, 246, 0.12)', 
                            color: act.type === 'Entrada' ? 'var(--accent-amber)' : '#60a5fa', 
                            padding: '0.2rem 0.55rem', 
                            borderRadius: '4px', 
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            {act.type === 'Entrada' ? <LogIn size={12} /> : <LogOut size={12} />}
                            {act.type}
                          </span>
                        </td>

                        {/* Estado */}
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span className={`badge ${act.statusColor}`} style={{ fontSize: '0.75rem' }}>
                            {act.status}
                          </span>
                        </td>

                        {/* Dispositivo / Método */}
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          <div className="flex items-center gap-1.5" title={`Dispositivo: ${act.device}`}>
                            <ScanFace size={14} style={{ color: '#10b981' }} />
                            <span>Facial • {act.device}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer de Paginación */}
          {filteredActivity.length > itemsPerPage && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginTop: '1rem', 
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border-color)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <span>
                Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredActivity.length)} de {filteredActivity.length} registros
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  style={{
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    color: currentPage === 1 ? 'rgba(255,255,255,0.2)' : '#fff',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Anterior
                </button>
                <span style={{ color: '#fff', fontWeight: 600 }}>{currentPage} / {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  style={{
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    color: currentPage === totalPages ? 'rgba(255,255,255,0.2)' : '#fff',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Header con Tabs Híbridos */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '1rem', 
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)', 
            paddingBottom: '0.75rem',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            {/* Tab switchers */}
            <div style={{ 
              display: 'inline-flex', 
              gap: '4px', 
              background: 'rgba(255, 255, 255, 0.04)', 
              padding: '3px', 
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <button
                type="button"
                onClick={() => setActiveAlertTab('alerts')}
                style={{
                  background: activeAlertTab === 'alerts' ? 'var(--accent-amber, #f59e0b)' : 'transparent',
                  color: activeAlertTab === 'alerts' ? '#000' : 'var(--text-muted)',
                  fontWeight: activeAlertTab === 'alerts' ? 700 : 500,
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                <Bell size={13} />
                <span>Alertas</span>
                {unreadAlertsBadge > 0 && (
                  <span style={{
                    backgroundColor: activeAlertTab === 'alerts' ? '#000' : '#ef4444',
                    color: '#fff',
                    fontSize: '0.65rem',
                    padding: '0 5px',
                    borderRadius: '999px',
                    fontWeight: 700,
                    lineHeight: '16px',
                    minWidth: '16px',
                    textAlign: 'center'
                  }}>
                    {unreadAlertsBadge}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveAlertTab('incidents')}
                style={{
                  background: activeAlertTab === 'incidents' ? 'var(--accent-amber, #f59e0b)' : 'transparent',
                  color: activeAlertTab === 'incidents' ? '#000' : 'var(--text-muted)',
                  fontWeight: activeAlertTab === 'incidents' ? 700 : 500,
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                <AlertTriangle size={13} />
                <span>Incidencias Hoy</span>
                {totalTodayIncidents > 0 && (
                  <span style={{
                    backgroundColor: activeAlertTab === 'incidents' ? '#000' : '#eab308',
                    color: activeAlertTab === 'incidents' ? '#fff' : '#000',
                    fontSize: '0.65rem',
                    padding: '0 5px',
                    borderRadius: '999px',
                    fontWeight: 700,
                    lineHeight: '16px',
                    minWidth: '16px',
                    textAlign: 'center'
                  }}>
                    {totalTodayIncidents}
                  </span>
                )}
              </button>
            </div>

            {/* Quick Link */}
            {activeAlertTab === 'alerts' ? (
              <Link 
                to="/dashboard/notifications" 
                style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--accent-amber)', 
                  textDecoration: 'none', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '2px',
                  fontWeight: 500
                }}
              >
                Ver todas <ChevronRight size={13} />
              </Link>
            ) : (
              <Link 
                to="/dashboard/attendance" 
                style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--accent-amber)', 
                  textDecoration: 'none', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '2px',
                  fontWeight: 500
                }}
              >
                Asistencia <ChevronRight size={13} />
              </Link>
            )}
          </div>

          {/* Subtitle */}
          <div style={{ marginBottom: '0.75rem' }}>
            <p className="text-xs text-muted" style={{ margin: 0 }}>
              {activeAlertTab === 'alerts' 
                ? 'Notificaciones del sistema y eventos en vivo' 
                : 'Retardos y colaboradores sin checar hoy'}
            </p>
          </div>

          {/* Body Content */}
          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.75rem', 
              maxHeight: '440px', 
              overflowY: 'auto', 
              paddingRight: '4px' 
            }}
            className="custom-scrollbar"
          >
            {activeAlertTab === 'alerts' ? (
              /* TAB 1: Alertas reales del sistema */
              notificationsLoading && notifications.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto', opacity: 0.6 }} />
                  <p style={{ fontSize: '0.8rem' }}>Cargando alertas del sistema...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div style={{ 
                  padding: '2.5rem 1rem', 
                  textAlign: 'center', 
                  backgroundColor: 'rgba(16, 185, 129, 0.03)', 
                  borderRadius: '8px',
                  border: '1px dashed rgba(16, 185, 129, 0.2)'
                }}>
                  <CheckCircle2 size={32} style={{ color: '#10b981', margin: '0 auto 0.5rem auto' }} />
                  <h4 style={{ color: '#f4f4f5', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>Bandeja al día</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>
                    No hay alertas pendientes en el sistema.
                  </p>
                </div>
              ) : (
                notifications.map(notif => {
                  const style = getNotificationStyle(notif.type);
                  const IconComp = style.Icon;

                  return (
                    <div 
                      key={notif.id} 
                      style={{ 
                        backgroundColor: style.bg, 
                        border: `1px solid ${style.border}`, 
                        padding: '0.85rem 0.95rem', 
                        borderRadius: '8px', 
                        display: 'flex', 
                        gap: '0.75rem',
                        opacity: notif.isRead ? 0.65 : 1,
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                    >
                      <IconComp size={18} style={{ color: style.iconColor, flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <h4 style={{ 
                            color: style.titleColor, 
                            fontSize: '0.82rem', 
                            fontWeight: 600, 
                            margin: 0,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {notif.title}
                          </h4>
                          
                          {!notif.isRead && (
                            <button
                              type="button"
                              onClick={(e) => handleMarkAsRead(e, notif.id)}
                              title="Marcar como leída"
                              style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: 'none',
                                borderRadius: '4px',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '2px 6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '0.68rem',
                                flexShrink: 0
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                            >
                              <Check size={11} /> Leída
                            </button>
                          )}
                        </div>

                        <p style={{ 
                          color: 'var(--text-muted)', 
                          fontSize: '0.75rem', 
                          marginTop: '0.3rem', 
                          marginBottom: '0.4rem', 
                          lineHeight: 1.35 
                        }}>
                          {notif.message}
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {notif.category ? (
                            <span style={{ 
                              fontSize: '0.62rem', 
                              textTransform: 'uppercase', 
                              letterSpacing: '0.5px', 
                              color: style.iconColor, 
                              fontWeight: 700 
                            }}>
                              {notif.category}
                            </span>
                          ) : <span />}
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {getRelativeTime(notif.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              /* TAB 2: Incidencias de Hoy */
              todayIncidents.list.length === 0 ? (
                <div style={{ 
                  padding: '2.5rem 1rem', 
                  textAlign: 'center', 
                  backgroundColor: 'rgba(16, 185, 129, 0.03)', 
                  borderRadius: '8px',
                  border: '1px dashed rgba(16, 185, 129, 0.2)'
                }}>
                  <CheckCircle2 size={32} style={{ color: '#10b981', margin: '0 auto 0.5rem auto' }} />
                  <h4 style={{ color: '#f4f4f5', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>¡Excelente jornada!</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>
                    Todos los colaboradores están a tiempo y sin incidencias hoy.
                  </p>
                </div>
              ) : (
                <>
                  {todayIncidents.list.map(inc => (
                    <div
                      key={inc.id}
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.07)',
                        padding: '0.75rem 0.9rem',
                        borderRadius: '8px',
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        backgroundColor: inc.badgeBg,
                        border: `1px solid ${inc.badgeBorder}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: inc.badgeColor,
                        flexShrink: 0
                      }}>
                        {inc.category === 'retardo' ? <Clock size={15} /> : (inc.category === 'falta' ? <UserX size={15} /> : <Calendar size={15} />)}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                          <h4 style={{ 
                            fontSize: '0.82rem', 
                            fontWeight: 600, 
                            color: '#f4f4f5', 
                            margin: 0,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {inc.name}
                          </h4>
                          <span style={{
                            fontSize: '0.62rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: inc.badgeBg,
                            color: inc.badgeColor,
                            border: `1px solid ${inc.badgeBorder}`,
                            fontWeight: 700,
                            flexShrink: 0
                          }}>
                            {inc.badge}
                          </span>
                        </div>

                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                          {inc.desc}
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                          <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>
                            {inc.dept}
                          </span>
                          {inc.time && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--accent-amber)', fontFamily: 'monospace', fontWeight: 600 }}>
                              {inc.time}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {todayIncidents.totalPending > 5 && (
                    <p style={{ 
                      fontSize: '0.72rem', 
                      textAlign: 'center', 
                      color: 'var(--text-muted)', 
                      margin: '0.25rem 0 0 0',
                      padding: '0.25rem'
                    }}>
                      +{todayIncidents.totalPending - 5} colaboradores más sin checar...
                    </p>
                  )}
                </>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
