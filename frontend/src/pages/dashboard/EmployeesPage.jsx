import React, { useState, useEffect, useMemo } from 'react';
import FaceRegistration from '../../components/FaceRecognition/FaceRegistration';
import DepartmentsTab from '../../components/DepartmentsTab';
import { Search, Filter, Users, Fingerprint, Clock, MoreVertical, Plus, AlertCircle, AlertTriangle, RefreshCw, Camera, Trash2, Edit, Calendar, X, Shield, ExternalLink, FileText, CheckCircle2, LogOut, LogIn, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

const EmployeesPage = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [showRegistration, setShowRegistration] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  
  // States for filtering and tabs
  const [activeTab, setActiveTab] = useState('empleados');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [departmentsList, setDepartmentsList] = useState([]);

  // States for Real-Time Presence & Attendance
  const [attendances, setAttendances] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [presenceFilter, setPresenceFilter] = useState('all'); // 'all' | 'inside' | 'exited' | 'absent'
  const [biometricFilter, setBiometricFilter] = useState('all'); // 'all' | 'pending' | 'enrolled'

  // States for modal
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEventHistoryOpen, setIsEventHistoryOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  
  // State for Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState(null);

  // State for Delete Modal
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    try {
      setIsDeleting(true);
      const token = localStorage.getItem('token');
      const tenantId = localStorage.getItem('tenantId');
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${baseUrl}/api/v1/employees/${employeeToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          ...(tenantId ? { 'x-tenant-id': tenantId } : {})
        }
      });
      if (res.ok) {
        toast.success(`Empleado ${employeeToDelete.firstName} ${employeeToDelete.lastName} eliminado correctamente`);
        setEmployeeToDelete(null);
        fetchEmployees();
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || errData.message || 'Error al eliminar empleado');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error de conexión al eliminar');
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchEmployees = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      else setRefreshing(true);
      setError(null);
      const token = localStorage.getItem('token');
      const tenantId = localStorage.getItem('tenantId');
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const headers = {
        'Authorization': `Bearer ${token}`,
        ...(tenantId ? { 'x-tenant-id': tenantId } : {})
      };
      
      const [resEmp, resDep, resAtt] = await Promise.all([
        fetch(`${baseUrl}/api/v1/employees`, { headers }),
        fetch(`${baseUrl}/api/v1/departments`, { headers }),
        fetch(`${baseUrl}/api/v1/attendance`, { headers })
      ]);

      if (!resEmp.ok) {
        const errData = await resEmp.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'Error al obtener empleados del servidor');
      }
      
      const data = await resEmp.json();
      setEmployees(data);
      
      if (resDep.ok) {
        const depData = await resDep.json();
        setDepartmentsList(depData);
      }

      if (resAtt.ok) {
        const attData = await resAtt.json();
        const records = attData.records || (Array.isArray(attData) ? attData : []);
        setAttendances(records);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!showRegistration) {
      fetchEmployees(true);
      // Auto-refresco en vivo de presencia cada 30 segundos
      const timer = setInterval(() => {
        fetchEmployees(false);
      }, 30000);
      return () => clearInterval(timer);
    }
  }, [showRegistration]);

  // Helpers de presencia en tiempo real
  const getLocalDateStr = (date = new Date()) => {
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = useMemo(() => getLocalDateStr(new Date()), []);

  const matchesDate = (recordDate, targetDateStr) => {
    if (!recordDate) return false;
    if (typeof recordDate === 'string') {
      return recordDate.startsWith(targetDateStr);
    }
    return getLocalDateStr(recordDate) === targetDateStr;
  };

  const formatHour = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' hrs';
    } catch {
      return '';
    }
  };

  const formatTimeSafe = (timeVal) => {
    if (!timeVal) return '';
    if (typeof timeVal === 'string' && timeVal.includes('T')) {
      const d = new Date(timeVal);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }
    if (typeof timeVal === 'string' && timeVal.includes(':')) {
      const parts = timeVal.split(':');
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m)) {
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }
    const d = new Date(timeVal);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return String(timeVal);
  };

  // Configuraciones y clasificación temporal de eventos (En curso, Concluido, Programado)
  const EVENT_CONFIG = {
    OVERTIME: { label: 'Horas Extra', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)' },
    EARLY_EXIT: { label: 'Salida Anticipada', color: '#eab308', bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)' },
    JUSTIFIED_ABSENCE: { label: 'Falta Justificada', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)' },
    VACATION: { label: 'Vacaciones', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.3)' },
    LATE_ARRIVAL: { label: 'Llegada Tardía', color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)' }
  };

  const getEventTemporalStatus = (evt) => {
    if (!evt) return { statusKey: 'COMPLETED', label: 'Concluido', color: '#a1a1aa', bg: 'rgba(161, 161, 170, 0.1)', border: 'rgba(161, 161, 170, 0.25)' };
    if (evt.status === 'CANCELLED') {
      return { statusKey: 'CANCELLED', label: 'Cancelado', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)' };
    }
    
    const today = new Date();
    const tStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const startStr = typeof evt.date === 'string' ? evt.date.split('T')[0] : new Date(evt.date).toISOString().split('T')[0];
    const endStr = evt.dateTo 
      ? (typeof evt.dateTo === 'string' ? evt.dateTo.split('T')[0] : new Date(evt.dateTo).toISOString().split('T')[0]) 
      : startStr;
    
    if (tStr > endStr) {
      return { statusKey: 'COMPLETED', label: 'Concluido', color: '#a1a1aa', bg: 'rgba(161, 161, 170, 0.1)', border: 'rgba(161, 161, 170, 0.25)' };
    } else if (tStr >= startStr && tStr <= endStr) {
      return { statusKey: 'CURRENT', label: 'En curso hoy', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' };
    } else {
      return { statusKey: 'SCHEDULED', label: 'Programado', color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)' };
    }
  };

  const formatEventRange = (evt) => {
    if (!evt) return '';
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
      return `${formatDate(startStr)} ➔ ${formatDate(endStr)} (${days} días)`;
    }
    return formatDate(startStr);
  };

  // Mapeo indexado de asistencia de hoy por empleado
  const todayAttendanceByEmpId = useMemo(() => {
    const map = new Map();
    (attendances || []).forEach(r => {
      const isToday = matchesDate(r.date, todayStr) || (r.entrada && matchesDate(r.entrada, todayStr));
      if (isToday && r.employeeId) {
        const existing = map.get(r.employeeId);
        // Priorizar registro abierto (salida == null)
        if (!existing) {
          map.set(r.employeeId, r);
        } else if (!r.salida && existing.salida) {
          map.set(r.employeeId, r);
        } else if (new Date(r.createdAt || r.entrada || 0) > new Date(existing.createdAt || existing.entrada || 0)) {
          if (!(!existing.salida && r.salida)) {
            map.set(r.employeeId, r);
          }
        }
      }
    });
    return map;
  }, [attendances, todayStr]);

  const getEmployeePresence = (empId) => {
    const att = todayAttendanceByEmpId.get(empId);
    if (!att || !att.entrada) {
      return { status: 'absent', label: 'Sin registro hoy', sublabel: 'No ha ingresado', record: null };
    }
    if (!att.salida) {
      return { status: 'inside', label: 'En instalaciones', sublabel: `Entrada: ${formatHour(att.entrada)}`, record: att };
    }
    return { status: 'exited', label: 'Turno concluido', sublabel: `Salida: ${formatHour(att.salida)}`, record: att };
  };

  // Derive data
  const departments = useMemo(() => {
    const deps = employees
      .map(emp => emp.department?.name)
      .filter(Boolean);
    return [...new Set(deps)];
  }, [employees]);

  // Computed stats
  const totalEmployees = employees.length;
  const enrolledProfiles = employees.filter(emp => emp.faceDescriptor && emp.faceDescriptor !== '[]' && emp.faceDescriptor.length > 10).length;
  const coverage = totalEmployees > 0 ? Math.round((enrolledProfiles / totalEmployees) * 100) : 0;

  const staffInside = useMemo(() => {
    return employees.filter(emp => getEmployeePresence(emp.id).status === 'inside').length;
  }, [employees, todayAttendanceByEmpId]);

  const staffExited = useMemo(() => {
    return employees.filter(emp => getEmployeePresence(emp.id).status === 'exited').length;
  }, [employees, todayAttendanceByEmpId]);

  const staffAbsent = useMemo(() => {
    return employees.filter(emp => getEmployeePresence(emp.id).status === 'absent').length;
  }, [employees, todayAttendanceByEmpId]);

  const filteredEmployees = useMemo(() => {
    const filtered = employees.filter(emp => {
      const matchSearch = 
        emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.identifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.position || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchDepartment = selectedDepartment ? emp.department?.name === selectedDepartment : true;
      
      const presence = getEmployeePresence(emp.id);
      let matchPresence = true;
      if (presenceFilter === 'inside') {
        matchPresence = presence.status === 'inside';
      } else if (presenceFilter === 'exited') {
        matchPresence = presence.status === 'exited';
      } else if (presenceFilter === 'absent') {
        matchPresence = presence.status === 'absent';
      }

      let matchBiometric = true;
      const hasBio = emp.faceDescriptor && emp.faceDescriptor !== '[]' && emp.faceDescriptor.length > 10;
      if (biometricFilter === 'pending') {
        matchBiometric = !hasBio;
      } else if (biometricFilter === 'enrolled') {
        matchBiometric = hasBio;
      }

      return matchSearch && matchDepartment && matchPresence && matchBiometric;
    });

    return filtered.sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [employees, searchTerm, selectedDepartment, presenceFilter, biometricFilter, todayAttendanceByEmpId]);

  const handleRowClick = async (empId) => {
    setSelectedEmployeeId(empId);
    setIsModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setEmployeeDetails(null);
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/employees/${empId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al obtener detalles del empleado');
      const data = await res.json();
      setEmployeeDetails(data);
    } catch (err) {
      console.error(err);
      setModalError(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleCancelEvent = async (eventId) => {
    if (!window.confirm('¿Estás seguro de cancelar este evento?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/events/${eventId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al cancelar evento');
      // Update local state to remove the event from employeeDetails
      setEmployeeDetails(prev => ({
        ...prev,
        eventRequests: prev.eventRequests.filter(evt => evt.id !== eventId)
      }));
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  if (showRegistration) {
    return (
      <div className="fade-in">
        <FaceRegistration onComplete={() => setShowRegistration(false)} />
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ paddingBottom: '2rem' }}>
      {/* Header & Tabs */}
      <div className="flex-mobile-col" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
        <div>
          <h2 style={{ color: '#fff', margin: 0, fontSize: '1.8rem' }}>Gestión de Personal</h2>
          <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0 0', fontSize: '0.95rem' }}>Administra empleados, departamentos, enrolamiento biométrico y presencia en vivo.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => fetchEmployees(false)}
            title="Sincronizar datos de empleados y presencia en vivo"
            style={{
              background: '#27272a',
              border: '1px solid #3f3f46',
              color: '#e4e4e7',
              borderRadius: '8px',
              padding: '0.55rem 0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              transition: 'background 0.2s'
            }}
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            <span>{refreshing ? 'Sincronizando...' : 'Actualizar'}</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #333' }}>
        <button 
          onClick={() => setActiveTab('empleados')} 
          style={{ padding: '0.75rem 1rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'empleados' ? '2px solid #f97316' : '2px solid transparent', color: activeTab === 'empleados' ? '#f97316' : '#a1a1aa', cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}
        >
          Lista de Empleados
        </button>
        <button 
          onClick={() => setActiveTab('departamentos')} 
          style={{ padding: '0.75rem 1rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'departamentos' ? '2px solid #f97316' : '2px solid transparent', color: activeTab === 'departamentos' ? '#f97316' : '#a1a1aa', cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}
        >
          Departamentos
        </button>
      </div>

      {activeTab === 'departamentos' ? (
        <DepartmentsTab onDepartmentChange={() => fetchEmployees(false)} />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
            <button 
              onClick={() => setShowRegistration(true)}
              style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={18} /> Agregar Empleado
            </button>
          </div>

      {/* Cards KPI Interactivos con Monitoreo en Vivo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Card 1: Total Empleados */}
        <div 
          className="card card-glow-blue" 
          onClick={() => { setPresenceFilter('all'); setBiometricFilter('all'); }}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between', 
            minHeight: '170px', 
            padding: '1.75rem',
            cursor: 'pointer',
            border: presenceFilter === 'all' && biometricFilter === 'all' ? '2px solid rgba(59, 130, 246, 0.7)' : '1px solid #27272a',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
          title="Clic para ver todos los empleados"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-muted text-sm font-semibold">Total Empleados</span>
            <div className="icon-box" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
              <Users size={18} style={{ color: '#3b82f6' }} />
            </div>
          </div>
          <div>
            {loading ? (
              <Skeleton height="2.5rem" width="60px" />
            ) : (
              <h2 style={{ fontSize: '2.5rem', color: '#3b82f6', lineHeight: '1', margin: '0', fontWeight: 700 }}>
                {totalEmployees || '—'}
              </h2>
            )}
            {loading ? (
              <Skeleton height="1rem" width="110px" style={{ marginTop: '0.75rem' }} />
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                <p className="text-xs text-muted" style={{ margin: 0 }}>Registrados en el sistema</p>
                {presenceFilter === 'all' && biometricFilter === 'all' && (
                  <span style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: 600 }}>Todos</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Perfiles Biométricos Enrolados */}
        <div 
          className="card card-glow-yellow" 
          onClick={() => {
            setBiometricFilter(prev => prev === 'pending' ? 'all' : 'pending');
            setPresenceFilter('all');
          }}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between', 
            minHeight: '170px', 
            padding: '1.75rem',
            cursor: 'pointer',
            border: biometricFilter === 'pending' ? '2px solid #eab308' : '1px solid #27272a',
            boxShadow: biometricFilter === 'pending' ? '0 0 18px rgba(234, 179, 8, 0.25)' : 'none',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
          title="Clic para ver empleados pendientes de enrolamiento"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-muted text-sm font-semibold">Perfiles Biométricos Enrolados</span>
            <div className="icon-box" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)' }}>
              <Fingerprint size={18} style={{ color: '#eab308' }} />
            </div>
          </div>
          <div>
            {loading ? (
              <Skeleton height="2.5rem" width="60px" />
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '2.5rem', color: '#eab308', lineHeight: '1', margin: '0', fontWeight: 700 }}>
                  {enrolledProfiles || '—'}
                </h2>
                {biometricFilter === 'pending' && (
                  <span style={{ 
                    marginLeft: 'auto', 
                    fontSize: '0.68rem', 
                    padding: '0.2rem 0.5rem', 
                    background: 'rgba(234, 179, 8, 0.2)', 
                    color: '#facc15', 
                    borderRadius: '4px',
                    fontWeight: 700
                  }}>
                    FILTRO: PENDIENTES
                  </span>
                )}
              </div>
            )}
            {loading ? (
              <Skeleton height="1rem" width="100px" style={{ marginTop: '0.75rem' }} />
            ) : (
              <p className="text-xs text-muted mt-2" style={{ margin: '0.75rem 0 0 0' }}>
                {coverage}% de cobertura • <span style={{ color: totalEmployees - enrolledProfiles > 0 ? '#facc15' : '#a1a1aa' }}>{totalEmployees - enrolledProfiles} sin enrolar</span>
              </p>
            )}
          </div>
        </div>

        {/* Card 3: En Instalaciones Ahora (Tiempo Real Funcional) */}
        <div 
          className="card card-glow-green" 
          onClick={() => {
            setPresenceFilter(prev => prev === 'inside' ? 'all' : 'inside');
            setBiometricFilter('all');
          }}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between', 
            minHeight: '170px', 
            padding: '1.75rem',
            cursor: 'pointer',
            border: presenceFilter === 'inside' ? '2px solid #10b981' : '1px solid #27272a',
            boxShadow: presenceFilter === 'inside' ? '0 0 20px rgba(16, 185, 129, 0.25)' : 'none',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
          title="Clic para ver solo las personas que están en instalaciones ahora"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="text-muted text-sm font-semibold">En Instalaciones Ahora</span>
              <span 
                style={{ 
                  display: 'inline-block', 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  backgroundColor: '#10b981', 
                  boxShadow: '0 0 8px #10b981'
                }} 
                title="Monitoreo en vivo"
              />
            </div>
            <div className="icon-box" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
              <Clock size={18} style={{ color: '#10b981' }} />
            </div>
          </div>
          <div>
            {loading ? (
              <Skeleton height="2.5rem" width="60px" />
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '2.5rem', color: '#10b981', lineHeight: '1', margin: '0', fontWeight: 700 }}>
                  {staffInside}
                </h2>
                <span style={{ color: '#a1a1aa', fontSize: '1rem', fontWeight: 500 }}>
                  de {totalEmployees}
                </span>
                {presenceFilter === 'inside' && (
                  <span style={{ 
                    marginLeft: 'auto', 
                    fontSize: '0.68rem', 
                    padding: '0.2rem 0.5rem', 
                    background: 'rgba(16, 185, 129, 0.2)', 
                    color: '#34d399', 
                    borderRadius: '4px',
                    fontWeight: 700
                  }}>
                    FILTRO ACTIVO
                  </span>
                )}
              </div>
            )}
            {loading ? (
              <Skeleton height="1rem" width="120px" style={{ marginTop: '0.75rem' }} />
            ) : (
              <div style={{ marginTop: '0.65rem', fontSize: '0.75rem', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ color: '#34d399', fontWeight: 600 }}>● {staffInside} en planta</span>
                <span>•</span>
                <span style={{ color: '#f59e0b' }}>{staffExited} salieron</span>
                <span>•</span>
                <span style={{ color: '#71717a' }}>{staffAbsent} sin registro</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex-mobile-col" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <div className="mobile-w-full" style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa' }} />
          <input 
            type="text" 
            placeholder="Buscar empleado por nombre o correo..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.5rem' }}
          />
        </div>
        
        <div className="mobile-w-full" style={{ position: 'relative' }}>
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            className="mobile-w-full justify-center"
          >
            <Filter size={18} /> {selectedDepartment ? `Área: ${selectedDepartment}` : 'Filtrar por Departamento'}
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

      {/* Quick Filter Pills (Filtros Rápidos Interactivos) */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem' }}>
        <span style={{ fontSize: '0.78rem', color: '#71717a', marginRight: '0.25rem', fontWeight: 500 }}>Filtro rápido:</span>
        <button
          onClick={() => { setPresenceFilter('all'); setBiometricFilter('all'); }}
          style={{
            padding: '0.3rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.78rem',
            cursor: 'pointer',
            border: (presenceFilter === 'all' && biometricFilter === 'all') ? '1px solid #3b82f6' : '1px solid #27272a',
            background: (presenceFilter === 'all' && biometricFilter === 'all') ? 'rgba(59, 130, 246, 0.15)' : '#18181b',
            color: (presenceFilter === 'all' && biometricFilter === 'all') ? '#60a5fa' : '#a1a1aa',
            fontWeight: (presenceFilter === 'all' && biometricFilter === 'all') ? 600 : 400,
            transition: 'all 0.15s ease'
          }}
        >
          Todos ({totalEmployees})
        </button>
        <button
          onClick={() => {
            setPresenceFilter(prev => prev === 'inside' ? 'all' : 'inside');
            setBiometricFilter('all');
          }}
          style={{
            padding: '0.3rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.78rem',
            cursor: 'pointer',
            border: presenceFilter === 'inside' ? '1px solid #10b981' : '1px solid #27272a',
            background: presenceFilter === 'inside' ? 'rgba(16, 185, 129, 0.15)' : '#18181b',
            color: presenceFilter === 'inside' ? '#34d399' : '#a1a1aa',
            fontWeight: presenceFilter === 'inside' ? 600 : 400,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
          En instalaciones ({staffInside})
        </button>
        <button
          onClick={() => {
            setPresenceFilter(prev => prev === 'exited' ? 'all' : 'exited');
            setBiometricFilter('all');
          }}
          style={{
            padding: '0.3rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.78rem',
            cursor: 'pointer',
            border: presenceFilter === 'exited' ? '1px solid #f59e0b' : '1px solid #27272a',
            background: presenceFilter === 'exited' ? 'rgba(245, 158, 11, 0.15)' : '#18181b',
            color: presenceFilter === 'exited' ? '#fbbf24' : '#a1a1aa',
            fontWeight: presenceFilter === 'exited' ? 600 : 400,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
          Turno concluido ({staffExited})
        </button>
        <button
          onClick={() => {
            setPresenceFilter(prev => prev === 'absent' ? 'all' : 'absent');
            setBiometricFilter('all');
          }}
          style={{
            padding: '0.3rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.78rem',
            cursor: 'pointer',
            border: presenceFilter === 'absent' ? '1px solid #ef4444' : '1px solid #27272a',
            background: presenceFilter === 'absent' ? 'rgba(239, 68, 68, 0.15)' : '#18181b',
            color: presenceFilter === 'absent' ? '#f87171' : '#a1a1aa',
            fontWeight: presenceFilter === 'absent' ? 600 : 400,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#71717a' }} />
          Sin registro hoy ({staffAbsent})
        </button>
        <button
          onClick={() => {
            setBiometricFilter(prev => prev === 'pending' ? 'all' : 'pending');
            setPresenceFilter('all');
          }}
          style={{
            padding: '0.3rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.78rem',
            cursor: 'pointer',
            border: biometricFilter === 'pending' ? '1px solid #eab308' : '1px solid #27272a',
            background: biometricFilter === 'pending' ? 'rgba(234, 179, 8, 0.15)' : '#18181b',
            color: biometricFilter === 'pending' ? '#facc15' : '#a1a1aa',
            fontWeight: biometricFilter === 'pending' ? 600 : 400,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.15s ease'
          }}
        >
          <Fingerprint size={12} />
          Sin biometría ({totalEmployees - enrolledProfiles})
        </button>

        {(presenceFilter !== 'all' || biometricFilter !== 'all' || selectedDepartment || searchTerm) && (
          <button
            onClick={() => {
              setPresenceFilter('all');
              setBiometricFilter('all');
              setSelectedDepartment('');
              setSearchTerm('');
            }}
            style={{
              padding: '0.3rem 0.65rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              border: 'none',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}
          >
            Limpiar filtros ✕
          </button>
        )}
      </div>

      {/* State Handlers & Table */}
      {error ? (
        <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'center' }}>
          <AlertCircle size={40} style={{ margin: '0 auto 1rem auto', opacity: 0.8 }} />
          <h3 style={{ margin: '0 0 0.5rem 0' }}>Error al cargar empleados</h3>
          <p style={{ margin: '0 0 1.5rem 0', color: '#fca5a5' }}>{error}</p>
          <button onClick={fetchEmployees} style={{ ...btnPrimary, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={16} /> Reintentar
          </button>
        </div>
      ) : loading ? (
        <div style={{ background: '#1e1e1e', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
          <div className="table-responsive-wrapper">
            <table style={tableStyle}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333' }}>
                  <th style={thStyle}>Empleado</th>
                  <th style={thStyle}>Departamento / Cargo</th>
                  <th style={thStyle}>Estado Biométrico</th>
                  <th style={thStyle}>Presencia Hoy</th>
                  <th style={thStyle}>Estado Laboral</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map(i => (
                  <tr key={i} style={{ borderBottom: '1px solid #333' }}>
                    <td style={tdStyle}><Skeleton height="40px" width="150px" /></td>
                    <td style={tdStyle}><Skeleton height="40px" width="120px" /></td>
                    <td style={tdStyle}><Skeleton height="24px" width="80px" borderRadius="12px" /></td>
                    <td style={tdStyle}><Skeleton height="24px" width="105px" borderRadius="12px" /></td>
                    <td style={tdStyle}><Skeleton height="24px" width="60px" borderRadius="12px" /></td>
                    <td style={tdStyle}><Skeleton height="24px" width="24px" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : employees.length === 0 ? (
        <div style={{ padding: '4rem 2rem', textAlign: 'center', background: '#1e1e1e', borderRadius: '12px', border: '1px solid #333' }}>
          <Users size={48} style={{ color: '#52525b', margin: '0 auto 1rem auto' }} />
          <h3 style={{ color: '#fff', margin: '0 0 0.5rem 0' }}>No hay empleados registrados</h3>
          <p style={{ color: '#a1a1aa', margin: '0 0 1.5rem 0' }}>Comienza registrando a tu primer empleado en el sistema.</p>
          <button onClick={() => setShowRegistration(true)} style={btnPrimary}>
            + Agregar Empleado
          </button>
        </div>
      ) : (
        <div style={{ background: '#1e1e1e', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
          <div className="table-responsive-wrapper">
            <table style={tableStyle}>
              <thead>
              <tr style={{ borderBottom: '1px solid #333', background: '#18181b' }}>
                <th style={thStyle}>Empleado</th>
                <th style={thStyle}>Departamento / Cargo</th>
                <th style={thStyle}>Estado Biométrico</th>
                <th style={thStyle}>Presencia Hoy</th>
                <th style={thStyle}>Estado Laboral</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: '#a1a1aa' }}>
                    No se encontraron empleados que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(emp => {
                  const hasBiometric = emp.faceDescriptor && emp.faceDescriptor !== '[]' && emp.faceDescriptor.length > 10;
                  const getInitials = (f, l) => `${(f||'').charAt(0)}${(l||'').charAt(0)}`.toUpperCase();

                  return (
                    <tr key={emp.id} onClick={() => handleRowClick(emp.id)} style={{ borderBottom: '1px solid #333', transition: 'background-color 0.2s', cursor: 'pointer' }} className="table-row-hover">
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.2)', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {getInitials(emp.firstName, emp.lastName)}
                          </div>
                          <div>
                            <div style={{ color: '#fff', fontWeight: 500 }}>{emp.firstName} {emp.lastName}</div>
                            <div style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>{emp.email || emp.identifier}</div>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        {emp.departmentId ? (
                          <div style={{ color: '#e4e4e7' }}>{emp.department?.name}</div>
                        ) : (
                          <span style={{ padding: '0.2rem 0.5rem', background: 'rgba(249, 115, 22, 0.1)', color: '#f97316', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
                            Pendiente (Sin depto)
                          </span>
                        )}
                        {(() => {
                          const empEmailLower = (emp.email || '').trim().toLowerCase();
                          const empFullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim().toLowerCase();

                          const isSuperAdmin = 
                            emp.adminRole === 'SUPER_ADMIN' ||
                            emp.position?.toLowerCase().includes('super') ||
                            (user?.role === 'SUPER_ADMIN' && (
                              (user.email && empEmailLower === user.email.trim().toLowerCase()) ||
                              empEmailLower.includes('gabrielmorag') ||
                              (empFullName.includes('gabriel') && empFullName.includes('avila'))
                            ));

                          const isAdmin = 
                            isSuperAdmin ||
                            emp.adminRole === 'ADMIN' ||
                            emp.position?.toLowerCase().includes('administrador');

                          if (isAdmin) {
                            return (
                              <div style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <span style={{ 
                                  display: 'inline-block',
                                  padding: '0.15rem 0.5rem', 
                                  background: isSuperAdmin ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                  color: isSuperAdmin ? '#fbbf24' : '#60a5fa',
                                  border: isSuperAdmin ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  width: 'fit-content'
                                }}>
                                  {isSuperAdmin ? 'Super Administrador' : 'Administrador'}
                                </span>
                                {emp.position && !emp.position.toLowerCase().includes('administrador') && (
                                  <span style={{ color: '#a1a1aa', fontSize: '0.75rem' }}>{emp.position}</span>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div style={{ color: '#a1a1aa', fontSize: '0.8rem', marginTop: '0.25rem' }}>{emp.position || 'Sin cargo'}</div>
                          );
                        })()}
                      </td>
                      <td style={tdStyle}>
                        {hasBiometric ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <span style={{ padding: '0.25rem 0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 500, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                              Enrolado
                            </span>
                            {emp.enrolledAt && (
                              <span style={{ fontSize: '0.7rem', color: '#a1a1aa', marginTop: '4px' }}>
                                {new Date(emp.enrolledAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ padding: '0.25rem 0.75rem', background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 500, border: '1px solid rgba(234, 179, 8, 0.2)' }}>
                            Pendiente
                          </span>
                        )}
                      </td>
                      {/* Presencia Hoy */}
                      <td style={tdStyle}>
                        {(() => {
                          const presence = getEmployeePresence(emp.id);
                          if (presence.status === 'inside') {
                            return (
                              <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px' }}>
                                <span style={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '0.4rem', 
                                  padding: '0.2rem 0.65rem', 
                                  background: 'rgba(16, 185, 129, 0.12)', 
                                  color: '#10b981', 
                                  borderRadius: '999px', 
                                  fontSize: '0.75rem', 
                                  fontWeight: 600, 
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  width: 'fit-content'
                                }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                                  En planta
                                </span>
                                <span style={{ fontSize: '0.7rem', color: '#a1a1aa', paddingLeft: '0.25rem' }}>
                                  {presence.sublabel}
                                </span>
                              </div>
                            );
                          }
                          if (presence.status === 'exited') {
                            return (
                              <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px' }}>
                                <span style={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '0.4rem', 
                                  padding: '0.2rem 0.65rem', 
                                  background: 'rgba(234, 179, 8, 0.12)', 
                                  color: '#facc15', 
                                  borderRadius: '999px', 
                                  fontSize: '0.75rem', 
                                  fontWeight: 500, 
                                  border: '1px solid rgba(234, 179, 8, 0.3)',
                                  width: 'fit-content'
                                }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#eab308' }} />
                                  Turno concluido
                                </span>
                                <span style={{ fontSize: '0.7rem', color: '#a1a1aa', paddingLeft: '0.25rem' }}>
                                  {presence.sublabel}
                                </span>
                              </div>
                            );
                          }
                          return (
                            <span style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.4rem', 
                              padding: '0.2rem 0.65rem', 
                              background: 'rgba(255, 255, 255, 0.04)', 
                              color: '#71717a', 
                              borderRadius: '999px', 
                              fontSize: '0.75rem', 
                              fontWeight: 500, 
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              width: 'fit-content'
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#52525b' }} />
                              Sin registro hoy
                            </span>
                          );
                        })()}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ padding: '0.25rem 0.75rem', background: emp.isActive ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: emp.isActive ? '#3b82f6' : '#ef4444', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 500, border: `1px solid ${emp.isActive ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)'}` }}>
                          {emp.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <ActionMenu hasBiometric={hasBiometric} employee={emp} navigate={navigate} onRefresh={fetchEmployees} setIsEditModalOpen={setIsEditModalOpen} setEmployeeToEdit={setEmployeeToEdit} setEmployeeToDelete={setEmployeeToDelete} />
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

      {/* Employee Details Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content page-glow" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--text-main)', margin: 0 }}>Detalles del Empleado</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={24} />
              </button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              {modalLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <RefreshCw className="spin" size={24} style={{ color: '#f97316', margin: '0 auto' }} />
                  <p style={{ color: '#a1a1aa', marginTop: '1rem' }}>Cargando información...</p>
                </div>
              ) : modalError ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: '#ef4444' }}>
                  <AlertCircle size={32} style={{ margin: '0 auto 1rem' }} />
                  <p>{modalError}</p>
                </div>
              ) : employeeDetails ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #333', paddingBottom: '1.5rem' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.2)', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.5rem' }}>
                      {`${(employeeDetails.firstName||'').charAt(0)}${(employeeDetails.lastName||'').charAt(0)}`.toUpperCase()}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>{employeeDetails.firstName} {employeeDetails.lastName}</h4>
                      <p style={{ margin: '0.2rem 0 0 0', color: '#a1a1aa', fontSize: '0.9rem' }}>{employeeDetails.email || employeeDetails.identifier}</p>
                      <p style={{ margin: '0.2rem 0 0 0', color: '#e4e4e7', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span>{employeeDetails.department?.name || 'Sin departamento'}</span>
                        <span>•</span>
                        {(() => {
                          const empEmailLower = (employeeDetails.email || '').trim().toLowerCase();
                          const empFullName = `${employeeDetails.firstName || ''} ${employeeDetails.lastName || ''}`.trim().toLowerCase();

                          const isSuperAdminModal = 
                            employeeDetails.adminRole === 'SUPER_ADMIN' ||
                            employeeDetails.position?.toLowerCase().includes('super') ||
                            (user?.role === 'SUPER_ADMIN' && (
                              (user.email && empEmailLower === user.email.trim().toLowerCase()) ||
                              empEmailLower.includes('gabrielmorag') ||
                              (empFullName.includes('gabriel') && empFullName.includes('avila'))
                            ));

                          const isAdminModal = 
                            isSuperAdminModal ||
                            employeeDetails.adminRole === 'ADMIN' ||
                            employeeDetails.position?.toLowerCase().includes('administrador');

                          if (isAdminModal) {
                            return (
                              <span style={{
                                padding: '0.1rem 0.5rem',
                                background: isSuperAdminModal ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                color: isSuperAdminModal ? '#fbbf24' : '#60a5fa',
                                border: isSuperAdminModal ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600
                              }}>
                                {isSuperAdminModal ? 'Super Administrador' : 'Administrador'}
                              </span>
                            );
                          }
                          return <span>{employeeDetails.position || 'Sin cargo'}</span>;
                        })()}
                      </p>
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h5 style={{ margin: '0 0 0.5rem 0', color: '#a1a1aa', fontSize: '0.9rem' }}>Presencia Hoy ({todayStr})</h5>
                    {(() => {
                      const presence = getEmployeePresence(employeeDetails.id);
                      if (presence.status === 'inside') {
                        return (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.85rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>En instalaciones ahora</span>
                            <span style={{ color: '#e4e4e7', fontSize: '0.8rem' }}>({presence.sublabel})</span>
                          </div>
                        );
                      }
                      if (presence.status === 'exited') {
                        return (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.85rem', background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', borderRadius: '8px', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#eab308' }} />
                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Turno concluido</span>
                            <span style={{ color: '#e4e4e7', fontSize: '0.8rem' }}>({presence.sublabel})</span>
                          </div>
                        );
                      }

                      const activeTodayEvent = employeeDetails.eventRequests?.find(e => {
                        if (e.status === 'CANCELLED') return false;
                        const eDate = typeof e.date === 'string' ? e.date.split('T')[0] : '';
                        const eDateTo = e.dateTo ? (typeof e.dateTo === 'string' ? e.dateTo.split('T')[0] : '') : eDate;
                        return todayStr >= eDate && todayStr <= eDateTo;
                      });

                      if (activeTodayEvent) {
                        const eventCfg = EVENT_CONFIG[activeTodayEvent.type] || { label: activeTodayEvent.type, color: '#eab308' };
                        const exitTime = formatTimeSafe(activeTodayEvent.startTime || activeTodayEvent.endTime);
                        return (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.85rem', background: 'rgba(234, 179, 8, 0.12)', color: '#facc15', borderRadius: '8px', border: '1px solid rgba(234, 179, 8, 0.3)', flexWrap: 'wrap' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: eventCfg.color || '#eab308' }} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Sin registro hoy</span>
                            <span style={{ color: '#d4d4d8', fontSize: '0.8rem' }}>
                              • Evento activo: <strong style={{ color: eventCfg.color }}>{eventCfg.label}</strong>
                              {activeTodayEvent.type === 'EARLY_EXIT' && exitTime ? ` (Salida autorizada: ${exitTime})` : ''}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.85rem', background: 'rgba(255, 255, 255, 0.05)', color: '#a1a1aa', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#71717a' }} />
                          <span style={{ fontSize: '0.85rem' }}>Sin registro el día de hoy</span>
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <h5 style={{ margin: '0 0 0.5rem 0', color: '#a1a1aa', fontSize: '0.9rem' }}>Estado Biométrico</h5>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {employeeDetails.faceDescriptor && employeeDetails.faceDescriptor !== '[]' && employeeDetails.faceDescriptor.length > 10 ? (
                        <span style={{ padding: '0.3rem 0.8rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '999px', fontSize: '0.8rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                          Enrolado el {new Date(employeeDetails.enrolledAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <span style={{ padding: '0.3rem 0.8rem', background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', borderRadius: '999px', fontSize: '0.8rem', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
                          Pendiente de enrolamiento
                        </span>
                      )}
                      <button
                        onClick={() => {
                          setIsModalOpen(false);
                          navigate(`/kiosk/enroll/${employeeDetails.id}`);
                        }}
                        style={{
                          padding: '0.3rem 0.75rem',
                          background: 'rgba(249, 115, 22, 0.15)',
                          border: '1px solid rgba(249, 115, 22, 0.3)',
                          color: '#f97316',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontWeight: 500
                        }}
                      >
                        <Camera size={14} />
                        {employeeDetails.faceDescriptor && employeeDetails.faceDescriptor !== '[]' && employeeDetails.faceDescriptor.length > 10 ? 'Re-enrolar Biometría' : 'Enrolar Biometría'}
                      </button>
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h5 style={{ margin: '0 0 0.5rem 0', color: '#a1a1aa', fontSize: '0.9rem' }}>Horario Asignado</h5>
                    {(() => {
                      const empShift = employeeDetails.shifts?.[0]?.shift;
                      const deptShift = employeeDetails.department?.shifts?.[0]?.shift;
                      const effShift = employeeDetails.effectiveShift;

                      if (empShift) {
                        return (
                          <span style={{ padding: '0.3rem 0.8rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '999px', fontSize: '0.8rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                            Específico: {formatTimeSafe(empShift.startTime)} - {formatTimeSafe(empShift.endTime)}
                          </span>
                        );
                      } else if (deptShift) {
                        return (
                          <span style={{ padding: '0.3rem 0.8rem', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderRadius: '999px', fontSize: '0.8rem', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                            Por Departamento: {formatTimeSafe(deptShift.startTime)} - {formatTimeSafe(deptShift.endTime)}
                          </span>
                        );
                      } else if (effShift) {
                        return (
                          <span style={{ padding: '0.3rem 0.8rem', background: 'rgba(161, 161, 170, 0.1)', color: '#a1a1aa', borderRadius: '999px', fontSize: '0.8rem', border: '1px solid rgba(161, 161, 170, 0.2)' }}>
                            Horario Global: {formatTimeSafe(effShift.startTime)} - {formatTimeSafe(effShift.endTime)}
                          </span>
                        );
                      } else {
                        return (
                          <span style={{ padding: '0.3rem 0.8rem', background: 'rgba(161, 161, 170, 0.1)', color: '#a1a1aa', borderRadius: '999px', fontSize: '0.8rem', border: '1px solid rgba(161, 161, 170, 0.2)' }}>
                            Horario Global del Sistema
                          </span>
                        );
                      }
                    })()}
                  </div>
                  
                  <div>
                    <h5 style={{ margin: '0 0 0.75rem 0', color: '#a1a1aa', fontSize: '0.9rem' }}>Último Registro de Asistencia</h5>
                    {employeeDetails.attendances && employeeDetails.attendances.length > 0 ? (
                      <div style={{ background: '#18181b', padding: '1rem', borderRadius: '8px', border: '1px solid #333' }}>
                        <p style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '0.95rem' }}>
                          <Calendar size={14} style={{ display: 'inline', marginRight: '6px', color: '#a1a1aa', verticalAlign: 'middle' }} /> 
                          {new Date(employeeDetails.attendances[0].date).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '0.5rem' }}>
                          <div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#a1a1aa' }}>Entrada</p>
                            <p style={{ margin: '0.2rem 0 0 0', color: '#fff', fontWeight: 500 }}>
                              {employeeDetails.attendances[0].entrada ? new Date(employeeDetails.attendances[0].entrada).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}
                            </p>
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#a1a1aa' }}>Salida</p>
                            <p style={{ margin: '0.2rem 0 0 0', color: '#fff', fontWeight: 500 }}>
                              {employeeDetails.attendances[0].salida ? new Date(employeeDetails.attendances[0].salida).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}
                              {employeeDetails.attendances[0].isAutoClosed && (
                                <span title="Cierre automático por el sistema" style={{ marginLeft: '4px', color: '#f97316' }}>
                                  <AlertCircle size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
                                </span>
                              )}
                            </p>
                          </div>
                          {(() => {
                            const currentShift = employeeDetails.shifts?.[0]?.shift || employeeDetails.department?.shifts?.[0]?.shift || employeeDetails.effectiveShift;
                            const normalEndTimeStr = currentShift ? currentShift.endTime : '17:00';
                            const targetDate = employeeDetails.attendances[0].date.split('T')[0];
                            const overtimeEventsDay = employeeDetails.eventRequests?.filter(e => e.type === 'OVERTIME' && e.date.startsWith(targetDate)) || [];
                            const totalOvertimeMinutes = overtimeEventsDay.reduce((sum, e) => sum + (e.minutes || 0), 0);
                            const earlyExitDay = employeeDetails.eventRequests?.find(e => e.type === 'EARLY_EXIT' && e.date.startsWith(targetDate));
                            
                            let expectedEndTime = normalEndTimeStr;
                            let extraInfo = null;

                            if (totalOvertimeMinutes > 0) {
                              const [h, m] = normalEndTimeStr.split(':').map(Number);
                              const dateObj = new Date();
                              dateObj.setHours(h, m + totalOvertimeMinutes, 0);
                              expectedEndTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              extraInfo = ' (con horas extra acumuladas)';
                            }

                            const displayNormalEndTime = formatTimeSafe(normalEndTimeStr);

                            return (
                              <>
                                <div>
                                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#a1a1aa' }}>Salida Normal</p>
                                  <p style={{ margin: '0.2rem 0 0 0', color: '#fff', fontWeight: 500 }}>
                                    {displayNormalEndTime}
                                  </p>
                                </div>
                                {earlyExitDay && (
                                  <div>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#eab308' }}>Salida Autorizada</p>
                                    <p style={{ margin: '0.2rem 0 0 0', color: '#fef08a', fontWeight: 600 }}>
                                      {formatTimeSafe(earlyExitDay.startTime || earlyExitDay.endTime) || 'Salida anticipada'}
                                    </p>
                                  </div>
                                )}
                                {totalOvertimeMinutes > 0 && (
                                  <div>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#3b82f6' }}>Salida Esperada</p>
                                    <p style={{ margin: '0.2rem 0 0 0', color: '#fff', fontWeight: 500 }} title={extraInfo || ''}>
                                      {expectedEndTime}
                                    </p>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: '#18181b', padding: '1.5rem 1rem', borderRadius: '8px', border: '1px solid #333', textAlign: 'center' }}>
                        <Clock size={24} style={{ color: '#52525b', margin: '0 auto 0.5rem' }} />
                        <p style={{ margin: 0, color: '#a1a1aa', fontSize: '0.9rem' }}>El empleado aún no tiene registros de asistencia.</p>
                      </div>
                    )}
                  </div>
                  
                  {employeeDetails.eventRequests && employeeDetails.eventRequests.length > 0 && (
                    <div style={{ marginTop: '1.5rem' }}>
                      <h5 style={{ margin: '0 0 0.75rem 0', color: '#a1a1aa', fontSize: '0.9rem' }}>Eventos Recientes</h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {employeeDetails.eventRequests.map(evt => {
                          const conf = EVENT_CONFIG[evt.type] || { label: evt.type, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.3)' };
                          const temporal = getEventTemporalStatus(evt);
                          const evtDateStr = new Date(evt.date).toLocaleDateString(undefined, { timeZone: 'UTC' });

                          const activeShift = 
                            employeeDetails.shifts?.[0]?.shift || 
                            employeeDetails.department?.shifts?.[0]?.shift || 
                            employeeDetails.effectiveShift || null;
                          const shiftStart = activeShift?.startTime ? formatTimeSafe(activeShift.startTime) : null;
                          const shiftEnd = activeShift?.endTime ? formatTimeSafe(activeShift.endTime) : null;

                          const exitTime = (evt.startTime || evt.endTime) ? formatTimeSafe(evt.startTime || evt.endTime) : null;
                          const arrivalTime = evt.startTime ? formatTimeSafe(evt.startTime) : null;

                          let overtimeText = null;
                          let calculatedEndTime = null;
                          if (evt.type === 'OVERTIME' && evt.minutes) {
                            const evtDate = evt.date.split('T')[0];
                            const overtimeEventsForDay = employeeDetails.eventRequests?.filter(e => e.type === 'OVERTIME' && e.date.startsWith(evtDate)) || [];
                            const totalMinutes = overtimeEventsForDay.reduce((sum, e) => sum + (e.minutes || 0), 0);

                            const normalEndTimeStr = activeShift ? activeShift.endTime : '17:00';
                            const [h, m] = normalEndTimeStr.split(':').map(Number);
                            const endObj = new Date();
                            endObj.setHours(h, m + totalMinutes, 0);
                            calculatedEndTime = endObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            
                            const hours = (evt.minutes / 60).toFixed(1).replace('.0', '');
                            const totalHoursStr = (totalMinutes / 60).toFixed(1).replace('.0', '');
                            overtimeText = `${hours}h (Día: ${totalHoursStr}h, Termina a las ${calculatedEndTime})`;
                          }

                          return (
                            <div 
                              key={evt.id} 
                              style={{ 
                                background: conf.bg, 
                                border: `1px solid ${conf.border}`, 
                                padding: '0.85rem 1rem', 
                                borderRadius: '8px', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '0.55rem' 
                              }}
                            >
                              {/* Fila Superior: Tipo, Fecha y Estado */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <span style={{ 
                                    padding: '0.2rem 0.55rem', 
                                    background: conf.bg, 
                                    color: conf.color, 
                                    border: `1px solid ${conf.border}`, 
                                    borderRadius: '4px', 
                                    fontSize: '0.8rem', 
                                    fontWeight: 700 
                                  }}>
                                    {conf.label}
                                  </span>
                                  <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Calendar size={13} style={{ color: '#a1a1aa' }} />
                                    {evtDateStr}{evt.dateTo ? ` al ${new Date(evt.dateTo).toLocaleDateString(undefined, { timeZone: 'UTC' })}` : ''}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ 
                                    padding: '0.2rem 0.55rem', 
                                    background: temporal.bg, 
                                    color: temporal.color, 
                                    border: `1px solid ${temporal.border}`, 
                                    borderRadius: '999px', 
                                    fontSize: '0.75rem', 
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}>
                                    {temporal.statusKey === 'CURRENT' && (
                                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                                    )}
                                    {temporal.label}
                                  </span>
                                  <button 
                                    onClick={() => handleCancelEvent(evt.id)} 
                                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.2rem' }} 
                                    title="Eliminar Evento"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>

                              {/* Fila Media: Desglose de Horarios (Llegada programada, Salida habitual y Hora de salida) */}
                              <div style={{ 
                                background: 'rgba(0, 0, 0, 0.35)', 
                                padding: '0.65rem 0.85rem', 
                                borderRadius: '6px', 
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.35rem',
                                fontSize: '0.82rem'
                              }}>
                                {/* Horario habitual según turno (A qué hora debería llegar y salir) */}
                                {shiftStart && shiftEnd && (
                                  <div style={{ color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                    <Clock size={13} style={{ color: '#71717a' }} />
                                    <span>Jornada habitual según turno:</span>
                                    <span style={{ color: '#e4e4e7' }}>Entrada: <strong style={{ color: '#fff' }}>{shiftStart}</strong></span>
                                    <span>•</span>
                                    <span style={{ color: '#e4e4e7' }}>Salida: <strong style={{ color: '#fff' }}>{shiftEnd}</strong></span>
                                  </div>
                                )}

                                {/* A qué hora saldrá (Salida Anticipada) */}
                                {evt.type === 'EARLY_EXIT' && (
                                  <div style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', fontWeight: 500, marginTop: '0.1rem' }}>
                                    <LogOut size={14} style={{ color: '#eab308' }} />
                                    <span>Salida anticipada autorizada:</span>
                                    <strong style={{ color: '#fef08a', fontSize: '0.88rem', background: 'rgba(234, 179, 8, 0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                                      {exitTime ? `Saldrá a las ${exitTime}` : 'Salida autorizada (Horario libre)'}
                                    </strong>
                                    {shiftEnd && exitTime && (
                                      <span style={{ color: '#ca8a04', fontSize: '0.78rem' }}>
                                        (Salida habitual: {shiftEnd})
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* A qué hora llegará (Llegada Tardía) */}
                                {evt.type === 'LATE_ARRIVAL' && (
                                  <div style={{ color: '#f97316', display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', fontWeight: 500, marginTop: '0.1rem' }}>
                                    <LogIn size={14} style={{ color: '#f97316' }} />
                                    <span>Llegada tardía autorizada:</span>
                                    <strong style={{ color: '#fdba74', fontSize: '0.88rem', background: 'rgba(249, 115, 22, 0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(249, 115, 22, 0.3)' }}>
                                      {arrivalTime ? `Llegará a las ${arrivalTime}` : 'Tolerancia especial'}
                                    </strong>
                                    {shiftStart && (
                                      <span style={{ color: '#c2410c', fontSize: '0.78rem' }}>
                                        (Entrada habitual: {shiftStart})
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Horas Extra */}
                                {evt.type === 'OVERTIME' && (
                                  <div style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', fontWeight: 500, marginTop: '0.1rem' }}>
                                    <Clock size={14} style={{ color: '#60a5fa' }} />
                                    <span>Horas extra autorizadas:</span>
                                    <strong style={{ color: '#93c5fd', fontSize: '0.88rem', background: 'rgba(59, 130, 246, 0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                                      +{evt.minutes ? (evt.minutes / 60).toFixed(1).replace('.0', '') : '0'} hrs ({evt.minutes || 0} mins)
                                    </strong>
                                    {calculatedEndTime && (
                                      <span style={{ color: '#3b82f6', fontSize: '0.78rem' }}>
                                        (Termina a las {calculatedEndTime})
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Vacaciones o Falta Justificada */}
                                {(evt.type === 'VACATION' || evt.type === 'JUSTIFIED_ABSENCE') && (
                                  <div style={{ color: conf.color, display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', fontWeight: 500 }}>
                                    <Calendar size={13} />
                                    <span>Cobertura de jornada:</span>
                                    <strong style={{ color: '#fff', fontSize: '0.85rem' }}>
                                      Jornada completa {shiftStart && shiftEnd ? `(${shiftStart} a ${shiftEnd})` : ''}
                                    </strong>
                                  </div>
                                )}

                                {/* Motivo del evento */}
                                {evt.reason && (
                                  <div style={{ color: '#d4d4d8', fontSize: '0.78rem', marginTop: '0.2rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.3rem' }}>
                                    <span style={{ color: '#a1a1aa', fontWeight: 500 }}>Motivo: </span>
                                    <span style={{ fontStyle: 'italic' }}>"{evt.reason}"</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            {employeeDetails && (
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #3f3f46', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <button 
                  type="button"
                  onClick={() => setIsEventHistoryOpen(true)}
                  style={{
                    padding: '0.65rem 1.25rem',
                    background: 'rgba(59, 130, 246, 0.12)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Calendar size={16} /> Historial Global de Eventos ({employeeDetails.eventRequests?.length || 0})
                </button>
                <button style={btnSecondary} onClick={() => setIsModalOpen(false)}>Cerrar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Historial Completo de Eventos del Empleado */}
      {isEventHistoryOpen && employeeDetails && (
        <EmployeeEventHistoryModal
          employee={employeeDetails}
          onClose={() => setIsEventHistoryOpen(false)}
          onCancelEvent={handleCancelEvent}
          navigate={navigate}
          getEventTemporalStatus={getEventTemporalStatus}
          formatEventRange={formatEventRange}
          EVENT_CONFIG={EVENT_CONFIG}
        />
      )}

      {/* Edit Employee Modal */}
      {isEditModalOpen && (
        <EditEmployeeModal 
          employee={employeeToEdit}
          departmentsList={departmentsList}
          onClose={() => { setIsEditModalOpen(false); setEmployeeToEdit(null); }}
          onSaved={() => { 
            setIsEditModalOpen(false); 
            setEmployeeToEdit(null); 
            fetchEmployees(); 
          }}
        />
      )}

      {/* Delete Confirmation Modal con estilos elegantes */}
      {employeeToDelete && (
        <div className="modal-overlay" onClick={() => !isDeleting && setEmployeeToDelete(null)}>
          <div 
            className="modal-content page-glow" 
            onClick={(e) => e.stopPropagation()} 
            style={{ maxWidth: '440px', padding: '1.75rem', borderRadius: '16px', background: '#18181b', border: '1px solid rgba(239, 68, 68, 0.3)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', flexShrink: 0 }}>
                <AlertTriangle size={26} />
              </div>
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', fontWeight: 600 }}>Eliminar Empleado</h3>
                <p style={{ margin: '0.25rem 0 0', color: '#a1a1aa', fontSize: '0.85rem' }}>Esta acción es permanente e irreversible</p>
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                <span style={{ color: '#a1a1aa' }}>Nombre:</span>
                <strong style={{ color: '#fff' }}>{employeeToDelete.firstName} {employeeToDelete.lastName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                <span style={{ color: '#a1a1aa' }}>Identificador:</span>
                <code style={{ color: '#f97316', background: 'rgba(249, 115, 22, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{employeeToDelete.identifier}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: '#a1a1aa' }}>Correo:</span>
                <span style={{ color: '#e4e4e7' }}>{employeeToDelete.email || 'Sin correo'}</span>
              </div>
            </div>

            <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              ⚠️ Se eliminará su biometría facial registrada, asistencias, eventos y turnos asociados.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                type="button" 
                onClick={() => setEmployeeToDelete(null)}
                disabled={isDeleting}
                style={{ ...btnSecondary, padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={confirmDeleteEmployee}
                disabled={isDeleting}
                style={{ 
                  background: '#dc2626', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  padding: '0.6rem 1.25rem', 
                  fontWeight: 600, 
                  fontSize: '0.9rem',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: isDeleting ? 0.7 : 1,
                  boxShadow: '0 2px 10px rgba(220, 38, 38, 0.3)'
                }}
              >
                {isDeleting ? (
                  <>
                    <RefreshCw size={16} className="spin" /> Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} /> Eliminar definitivamente
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

// --- Subcomponents ---

const Skeleton = ({ width, height, borderRadius = '4px', style = {} }) => (
  <div style={{ width, height, borderRadius, background: 'linear-gradient(90deg, #27272a 25%, #3f3f46 50%, #27272a 75%)', backgroundSize: '200% 100%', animation: 'skeleton-loading 1.5s infinite', ...style }} className="skeleton" />
);

const ActionMenu = ({ hasBiometric, employee, navigate, onRefresh, setIsEditModalOpen, setEmployeeToEdit, setEmployeeToDelete }) => {
  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setEmployeeToDelete(employee);
  };

  const handleEditEmployee = (e) => {
    e.stopPropagation();
    setEmployeeToEdit(employee);
    setIsEditModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
      <button 
        onClick={(e) => { e.stopPropagation(); navigate(`/kiosk/enroll/${employee.id}`); }}
        title={hasBiometric ? "Re-enrolar" : "Enrolar"}
        style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: '#3b82f6', cursor: 'pointer', padding: '0.4rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {hasBiometric ? <RefreshCw size={16} /> : <Camera size={16} />}
      </button>

      <button 
        onClick={handleEditEmployee}
        title="Editar empleado"
        style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', color: '#eab308', cursor: 'pointer', padding: '0.4rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Edit size={16} />
      </button>

      <button 
        onClick={handleDeleteClick}
        title="Eliminar empleado"
        style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', cursor: 'pointer', padding: '0.4rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};

// --- Styles ---

// Removed cardStyle and iconBoxStyle as they are replaced by .card classes

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

const actionMenuItem = {
  padding: '0.5rem 1rem',
  color: '#e4e4e7',
  cursor: 'pointer',
  borderRadius: '4px',
  fontSize: '0.85rem'
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.9rem',
  minWidth: '800px'
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

const labelStyle = {
  display: 'block',
  marginBottom: '0.5rem',
  color: '#a1a1aa',
  fontSize: '0.9rem'
};

// --- Edit Employee Modal Component ---
const EditEmployeeModal = ({ employee, departmentsList, onClose, onSaved }) => {
  const [formData, setFormData] = useState({
    firstName: employee.firstName || '',
    lastName: employee.lastName || '',
    identifier: employee.identifier || '',
    email: employee.email || '',
    departmentId: employee.departmentId || '',
    position: employee.position || '',
    isActive: employee.isActive
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/employees/${employee.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al actualizar empleado');
      }
      onSaved();
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content page-glow" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h3 style={{ color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Edit size={20} /> Editar Empleado
          </h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Nombre(s)</label>
              <input type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Apellidos</label>
              <input type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} style={inputStyle} required />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Identificador (DNI / Matrícula)</label>
            <input type="text" value={formData.identifier} onChange={e => setFormData({...formData, identifier: e.target.value})} style={inputStyle} required />
          </div>
          <div>
            <label style={labelStyle}>Correo Electrónico (Opcional)</label>
            <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Departamento</label>
              <select value={formData.departmentId} onChange={e => setFormData({...formData, departmentId: e.target.value})} style={inputStyle} required>
                <option value="">Seleccione un departamento...</option>
                {departmentsList.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Cargo (Opcional)</label>
              <input type="text" value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})} style={inputStyle} placeholder="Ej. Desarrollador" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} />
            <label htmlFor="isActive" style={{ color: '#e4e4e7', cursor: 'pointer' }}>Empleado Activo</label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #3f3f46' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
            <button type="submit" style={btnPrimary} disabled={loading}>{loading ? 'Guardando...' : 'Guardar Cambios'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Modal de Historial Completo de Eventos del Empleado ---
const EmployeeEventHistoryModal = ({ 
  employee, 
  onClose, 
  onCancelEvent, 
  navigate,
  getEventTemporalStatus,
  formatEventRange,
  EVENT_CONFIG
}) => {
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const events = useMemo(() => employee?.eventRequests || [], [employee]);

  // Años disponibles en los registros del empleado
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

  // Cálculo de estadísticas globales del empleado
  const stats = useMemo(() => {
    let vacationDays = 0;
    let overtimeMins = 0;
    let justifiedAbsences = 0;
    let otherCount = 0;

    events.forEach(evt => {
      if (evt.status === 'CANCELLED') return;
      if (evt.type === 'VACATION') {
        const start = new Date(evt.date);
        const end = evt.dateTo ? new Date(evt.dateTo) : start;
        const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
        vacationDays += Math.max(1, days);
      } else if (evt.type === 'OVERTIME') {
        overtimeMins += (evt.minutes || 0);
      } else if (evt.type === 'JUSTIFIED_ABSENCE') {
        justifiedAbsences++;
      } else {
        otherCount++;
      }
    });

    return {
      vacationDays,
      overtimeHours: +(overtimeMins / 60).toFixed(1),
      justifiedAbsences,
      otherCount,
      totalEvents: events.length
    };
  }, [events]);

  // Filtrado reactivo de eventos
  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
      const temporal = getEventTemporalStatus(evt);
      if (selectedStatus !== 'ALL' && temporal.statusKey !== selectedStatus) {
        return false;
      }
      if (selectedType !== 'ALL' && evt.type !== selectedType) {
        return false;
      }

      // Filtro de Año
      if (selectedYear !== 'ALL') {
        const y1 = new Date(evt.date).getFullYear();
        const y2 = evt.dateTo ? new Date(evt.dateTo).getFullYear() : y1;
        const targetYear = parseInt(selectedYear, 10);
        if (y1 !== targetYear && y2 !== targetYear) return false;
      }

      // Filtro de Mes
      if (selectedMonth !== 'ALL') {
        const m1 = new Date(evt.date).getMonth();
        const m2 = evt.dateTo ? new Date(evt.dateTo).getMonth() : m1;
        const targetMonth = parseInt(selectedMonth, 10);
        if (m1 !== targetMonth && m2 !== targetMonth) return false;
      }

      // Búsqueda por texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const reason = (evt.reason || '').toLowerCase();
        const approvedBy = (evt.registeredBy?.name || '').toLowerCase();
        const typeLabel = (EVENT_CONFIG[evt.type]?.label || '').toLowerCase();
        if (!reason.includes(q) && !approvedBy.includes(q) && !typeLabel.includes(q)) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [events, selectedYear, selectedMonth, selectedType, selectedStatus, searchQuery, getEventTemporalStatus, EVENT_CONFIG]);

  const hasActiveFilters = selectedYear !== 'ALL' || selectedMonth !== 'ALL' || selectedType !== 'ALL' || selectedStatus !== 'ALL' || searchQuery.trim() !== '';

  const resetFilters = () => {
    setSelectedYear('ALL');
    setSelectedMonth('ALL');
    setSelectedType('ALL');
    setSelectedStatus('ALL');
    setSearchQuery('');
  };

  const getInitials = (f, l) => `${(f || '').charAt(0)}${(l || '').charAt(0)}`.toUpperCase();

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div 
        className="modal-content page-glow" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          maxWidth: '820px', 
          width: '95%',
          maxHeight: '90vh', 
          display: 'flex', 
          flexDirection: 'column',
          background: '#141417',
          border: '1px solid #3f3f46',
          borderRadius: '16px',
          overflow: 'hidden',
          padding: 0
        }}
      >
        {/* Encabezado */}
        <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#18181b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>
              {getInitials(employee.firstName, employee.lastName)}
            </div>
            <div>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', fontWeight: 600 }}>
                Historial Global de Eventos
              </h3>
              <p style={{ margin: '0.2rem 0 0', color: '#a1a1aa', fontSize: '0.85rem' }}>
                <strong style={{ color: '#e4e4e7' }}>{employee.firstName} {employee.lastName}</strong> • {employee.identifier} • {employee.department?.name || 'General'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => {
                onClose();
                navigate('/dashboard/reports');
              }}
              title="Ir a reportes para ver el impacto en asistencias"
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#60a5fa',
                borderRadius: '8px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease'
              }}
            >
              <ExternalLink size={14} /> Ver en Reportes
            </button>
            <button 
              onClick={onClose} 
              style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.25rem' }}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Cuerpo del Modal con Scroll */}
        <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1 }}>
          {/* Tarjetas de Resumen KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: '#1c1c21', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '10px', padding: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600 }}>Vacaciones</span>
              <div style={{ fontSize: '1.6rem', color: '#a78bfa', fontWeight: 700, margin: '0.25rem 0 0' }}>
                {stats.vacationDays} <span style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 400 }}>días</span>
              </div>
            </div>
            <div style={{ background: '#1c1c21', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '10px', padding: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600 }}>Horas Extra</span>
              <div style={{ fontSize: '1.6rem', color: '#60a5fa', fontWeight: 700, margin: '0.25rem 0 0' }}>
                {stats.overtimeHours} <span style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 400 }}>hrs</span>
              </div>
            </div>
            <div style={{ background: '#1c1c21', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600 }}>Faltas Justificadas</span>
              <div style={{ fontSize: '1.6rem', color: '#34d399', fontWeight: 700, margin: '0.25rem 0 0' }}>
                {stats.justifiedAbsences} <span style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 400 }}>días</span>
              </div>
            </div>
            <div style={{ background: '#1c1c21', border: '1px solid rgba(234, 179, 8, 0.25)', borderRadius: '10px', padding: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600 }}>Otras Incidencias</span>
              <div style={{ fontSize: '1.6rem', color: '#facc15', fontWeight: 700, margin: '0.25rem 0 0' }}>
                {stats.otherCount} <span style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 400 }}>reg.</span>
              </div>
            </div>
          </div>

          {/* Barra de Filtros (Año, Mes, Tipo, Estado, Búsqueda) */}
          <div style={{ background: '#1c1c21', border: '1px solid #27272a', borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
              {/* Filtro Año */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem' }}>Año</label>
                <select 
                  value={selectedYear} 
                  onChange={e => setSelectedYear(e.target.value)}
                  style={{ ...inputStyle, padding: '0.5rem', fontSize: '0.85rem' }}
                >
                  <option value="ALL">Todos los años</option>
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Filtro Mes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem' }}>Mes</label>
                <select 
                  value={selectedMonth} 
                  onChange={e => setSelectedMonth(e.target.value)}
                  style={{ ...inputStyle, padding: '0.5rem', fontSize: '0.85rem' }}
                >
                  <option value="ALL">Todos los meses</option>
                  {months.map(m => (
                    <option key={m.num} value={m.num}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Filtro Tipo */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem' }}>Tipo de Evento</label>
                <select 
                  value={selectedType} 
                  onChange={e => setSelectedType(e.target.value)}
                  style={{ ...inputStyle, padding: '0.5rem', fontSize: '0.85rem' }}
                >
                  <option value="ALL">Todos los tipos</option>
                  <option value="VACATION">Vacaciones</option>
                  <option value="OVERTIME">Horas Extra</option>
                  <option value="JUSTIFIED_ABSENCE">Falta Justificada</option>
                  <option value="EARLY_EXIT">Salida Anticipada</option>
                  <option value="LATE_ARRIVAL">Llegada Tardía</option>
                </select>
              </div>

              {/* Filtro Estado Temporal */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.35rem' }}>Estado</label>
                <select 
                  value={selectedStatus} 
                  onChange={e => setSelectedStatus(e.target.value)}
                  style={{ ...inputStyle, padding: '0.5rem', fontSize: '0.85rem' }}
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="CURRENT">🟢 En curso hoy</option>
                  <option value="COMPLETED">⚪ Concluido / Pasado</option>
                  <option value="SCHEDULED">🔵 Programado (Futuro)</option>
                  <option value="CANCELLED">🔴 Cancelado</option>
                </select>
              </div>
            </div>

            {/* Buscador de texto y reset */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
                <input 
                  type="text"
                  placeholder="Buscar en motivos o por quien aprobó..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: '2.25rem', padding: '0.5rem 0.5rem 0.5rem 2.25rem', fontSize: '0.85rem' }}
                />
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  style={{
                    padding: '0.5rem 0.85rem',
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Limpiar filtros ✕
                </button>
              )}
            </div>
          </div>

          {/* Contador de resultados */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', fontSize: '0.85rem', color: '#a1a1aa' }}>
            <span>Mostrando <strong style={{ color: '#fff' }}>{filteredEvents.length}</strong> de {events.length} evento(s)</span>
            {hasActiveFilters && <span style={{ color: '#f97316', fontSize: '0.78rem' }}>● Filtros aplicados</span>}
          </div>

          {/* Lista de Eventos */}
          {filteredEvents.length === 0 ? (
            <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', background: '#1c1c21', borderRadius: '12px', border: '1px solid #27272a' }}>
              <Calendar size={40} style={{ color: '#52525b', margin: '0 auto 0.75rem' }} />
              <h4 style={{ color: '#fff', margin: '0 0 0.5rem' }}>No se encontraron eventos</h4>
              <p style={{ color: '#a1a1aa', fontSize: '0.88rem', margin: '0 0 1rem' }}>
                {hasActiveFilters 
                  ? 'No hay eventos que coincidan con los filtros seleccionados.' 
                  : 'Este empleado aún no tiene eventos ni incidencias registradas.'}
              </p>
              {hasActiveFilters && (
                <button onClick={resetFilters} style={{ ...btnSecondary, padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                  Restablecer filtros
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {filteredEvents.map(evt => {
                const conf = EVENT_CONFIG[evt.type] || { label: evt.type, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)' };
                const temporal = getEventTemporalStatus(evt);
                const rangeStr = formatEventRange(evt);

                const activeShift = 
                  employee?.shifts?.[0]?.shift || 
                  employee?.department?.shifts?.[0]?.shift || 
                  employee?.effectiveShift || null;
                const shiftStart = activeShift?.startTime ? formatTimeSafe(activeShift.startTime) : null;
                const shiftEnd = activeShift?.endTime ? formatTimeSafe(activeShift.endTime) : null;
                const exitTime = (evt.startTime || evt.endTime) ? formatTimeSafe(evt.startTime || evt.endTime) : null;
                const arrivalTime = evt.startTime ? formatTimeSafe(evt.startTime) : null;

                return (
                  <div 
                    key={evt.id}
                    style={{
                      background: '#1c1c21',
                      border: `1px solid ${conf.border}`,
                      borderRadius: '10px',
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                      transition: 'border-color 0.2s',
                      position: 'relative'
                    }}
                  >
                    {/* Fila Superior: Tipo, Rango de Fecha y Badges */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                        <span style={{ 
                          padding: '0.25rem 0.65rem', 
                          background: conf.bg, 
                          color: conf.color, 
                          border: `1px solid ${conf.border}`, 
                          borderRadius: '6px', 
                          fontSize: '0.8rem', 
                          fontWeight: 700 
                        }}>
                          {conf.label}
                        </span>
                        <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>
                          {rangeStr}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span style={{ 
                          padding: '0.2rem 0.6rem', 
                          background: temporal.bg, 
                          color: temporal.color, 
                          border: `1px solid ${temporal.border}`, 
                          borderRadius: '999px', 
                          fontSize: '0.75rem', 
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}>
                          {temporal.statusKey === 'CURRENT' && (
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                          )}
                          {temporal.label}
                        </span>

                        <button 
                          onClick={() => onCancelEvent(evt.id)} 
                          style={{ 
                            background: 'transparent', 
                            border: 'none', 
                            color: '#ef4444', 
                            cursor: 'pointer', 
                            padding: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: 0.8
                          }} 
                          title="Eliminar evento de forma permanente"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Fila Media: Desglose Completo de Horarios Programados y Autorizados */}
                    <div style={{ 
                      background: 'rgba(0, 0, 0, 0.4)', 
                      padding: '0.75rem 1rem', 
                      borderRadius: '8px', 
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      fontSize: '0.82rem'
                    }}>
                      {shiftStart && shiftEnd && (
                        <div style={{ color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <Clock size={13} style={{ color: '#71717a' }} />
                          <span>Jornada habitual según turno:</span>
                          <span style={{ color: '#e4e4e7' }}>Entrada: <strong style={{ color: '#fff' }}>{shiftStart}</strong></span>
                          <span>•</span>
                          <span style={{ color: '#e4e4e7' }}>Salida: <strong style={{ color: '#fff' }}>{shiftEnd}</strong></span>
                        </div>
                      )}

                      {evt.type === 'EARLY_EXIT' && (
                        <div style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', fontWeight: 500 }}>
                          <LogOut size={14} style={{ color: '#eab308' }} />
                          <span>Salida anticipada autorizada:</span>
                          <strong style={{ color: '#fef08a', fontSize: '0.9rem', background: 'rgba(234, 179, 8, 0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                            {exitTime ? `Saldrá a las ${exitTime}` : 'Salida autorizada (Horario libre)'}
                          </strong>
                          {shiftEnd && exitTime && (
                            <span style={{ color: '#ca8a04', fontSize: '0.78rem' }}>
                              (Salida habitual: {shiftEnd})
                            </span>
                          )}
                        </div>
                      )}

                      {evt.type === 'LATE_ARRIVAL' && (
                        <div style={{ color: '#f97316', display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', fontWeight: 500 }}>
                          <LogIn size={14} style={{ color: '#f97316' }} />
                          <span>Llegada tardía autorizada:</span>
                          <strong style={{ color: '#fdba74', fontSize: '0.9rem', background: 'rgba(249, 115, 22, 0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(249, 115, 22, 0.3)' }}>
                            {arrivalTime ? `Llegará a las ${arrivalTime}` : 'Tolerancia especial'}
                          </strong>
                          {shiftStart && (
                            <span style={{ color: '#c2410c', fontSize: '0.78rem' }}>
                              (Entrada habitual: {shiftStart})
                            </span>
                          )}
                        </div>
                      )}

                      {evt.type === 'OVERTIME' && (
                        <div style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', fontWeight: 500 }}>
                          <Clock size={14} style={{ color: '#60a5fa' }} />
                          <span>Horas extra autorizadas:</span>
                          <strong style={{ color: '#93c5fd', fontSize: '0.9rem', background: 'rgba(59, 130, 246, 0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                            +{evt.minutes ? (evt.minutes / 60).toFixed(1).replace('.0', '') : '0'} hrs ({evt.minutes || 0} mins)
                          </strong>
                          {shiftEnd && (
                            <span style={{ color: '#3b82f6', fontSize: '0.78rem' }}>
                              (Salida normal: {shiftEnd})
                            </span>
                          )}
                        </div>
                      )}

                      {(evt.type === 'VACATION' || evt.type === 'JUSTIFIED_ABSENCE') && (
                        <div style={{ color: conf.color, display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', fontWeight: 500 }}>
                          <Calendar size={13} />
                          <span>Cobertura de jornada:</span>
                          <strong style={{ color: '#fff', fontSize: '0.85rem' }}>
                            Jornada completa {shiftStart && shiftEnd ? `(${shiftStart} a ${shiftEnd})` : ''}
                          </strong>
                        </div>
                      )}
                    </div>

                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <p style={{ margin: 0, color: '#e4e4e7', fontSize: '0.85rem', lineHeight: '1.4' }}>
                        <span style={{ color: '#a1a1aa', fontWeight: 500 }}>Motivo: </span>
                        {evt.reason || 'Sin motivo especificado'}
                      </p>
                    </div>

                    {/* Fila Inferior: Auditoría y Registro */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#71717a', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.25rem' }}>
                      <span>
                        👤 Aprobado por: <strong style={{ color: '#a1a1aa' }}>{evt.registeredBy?.name || 'Administrador'}</strong>
                      </span>
                      <span>
                        🕒 Registrado el: {new Date(evt.createdAt).toLocaleDateString()} a las {new Date(evt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer del Modal */}
        <div style={{ padding: '1rem 1.75rem', borderTop: '1px solid #27272a', background: '#18181b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#71717a' }}>
            ℹ️ Todos los eventos concluidos o en curso se computan automáticamente en el módulo de <strong style={{ color: '#a1a1aa' }}>Reportes y Analíticas</strong>.
          </p>
          <button style={btnSecondary} onClick={onClose}>
            Cerrar Historial
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeesPage;
