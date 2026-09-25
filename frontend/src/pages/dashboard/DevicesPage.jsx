import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Filter, Plus, RefreshCw, AlertCircle, Wifi, 
  Power, AlertTriangle, Video, MonitorSmartphone, Server,
  Clock, X, ShieldCheck, Trash2, ArrowRight,
  Lock, Unlock, Ban, CalendarPlus, CalendarX, RotateCcw,
  Info, ShieldAlert, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { useNotifications } from '../../contexts/NotificationContext';

const DevicesPage = () => {
  const { socket } = useNotifications();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('Todos');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // Modal de Añadir / Emparejar
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('kiosk'); // 'kiosk' | 'manual'
  
  // Modal de Acción (Bloquear / Dar de Baja con motivo opcional)
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: null, // 'block' | 'deactivate'
    device: null,
    reason: ''
  });

  // Solicitudes Pendientes de Kiosko
  const [pendingRequests, setPendingRequests] = useState([]);
  const [approvingId, setApprovingId] = useState(null);
  const [kioskCustomName, setKioskCustomName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formulario Manual (Cámara / Torniquete)
  const [manualForm, setManualForm] = useState({
    name: '',
    type: 'CAMERA',
    ipAddress: '',
    description: ''
  });

  // 1. Obtener lista de dispositivos
  const fetchDevices = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setIsRefreshing(true);
      else setLoading(true);
      setError(null);

      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/v1/devices`, {
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Error al cargar la lista de dispositivos');
      }

      const data = await res.json();
      setDevices(data);
    } catch (err) {
      console.error('Error fetching devices:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // 2. Obtener solicitudes de kiosko pendientes
  const fetchPendingRequests = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/v1/devices/auth-requests/pending`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setPendingRequests(data);
      }
    } catch (err) {
      console.warn('Error fetching pending auth requests:', err);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchPendingRequests();
  }, []);

  // 3. Escuchar eventos Socket.io para actualizaciones en tiempo real
  useEffect(() => {
    if (!socket) return;

    const handleNewRequest = (newReq) => {
      setPendingRequests(prev => {
        if (prev.some(r => r.id === newReq.id)) return prev;
        return [newReq, ...prev];
      });
      toast.info('Nueva solicitud de Kiosko', {
        description: `Código: ${newReq.pairingCode} desde ${newReq.ipAddress}`
      });
    };

    const handleResolvedRequest = ({ id }) => {
      setPendingRequests(prev => prev.filter(r => r.id !== id));
    };

    const handleDeviceUpdated = (updatedDev) => {
      setDevices(prev => prev.map(d => d.id === updatedDev.id ? { ...d, ...updatedDev } : d));
    };

    const handleDeviceCreated = (newDev) => {
      setDevices(prev => [newDev, ...prev.filter(d => d.id !== newDev.id)]);
    };

    const handleDeviceDeleted = ({ id }) => {
      setDevices(prev => prev.filter(d => d.id !== id));
    };

    socket.on('new_device_auth_request', handleNewRequest);
    socket.on('device_auth_request_resolved', handleResolvedRequest);
    socket.on('device_updated', handleDeviceUpdated);
    socket.on('device_created', handleDeviceCreated);
    socket.on('device_deleted', handleDeviceDeleted);

    return () => {
      socket.off('new_device_auth_request', handleNewRequest);
      socket.off('device_auth_request_resolved', handleResolvedRequest);
      socket.off('device_updated', handleDeviceUpdated);
      socket.off('device_created', handleDeviceCreated);
      socket.off('device_deleted', handleDeviceDeleted);
    };
  }, [socket]);

  // Temporizador local para tiempo restante de solicitudes pendientes
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 4. Bloquear / Desbloquear Temporalmente
  const handleToggleBlock = async (device, customReason = null) => {
    const willBlock = !device.isBlocked;
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/v1/devices/${device.id}/block`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          isBlocked: willBlock,
          reason: customReason || (willBlock ? 'Bloqueado temporalmente por administración' : null)
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al actualizar bloqueo');
      }

      const data = await res.json();
      setDevices(prev => prev.map(d => d.id === device.id ? data.device : d));
      setActionModal({ isOpen: false, type: null, device: null, reason: '' });

      if (willBlock) {
        toast.warning('Dispositivo bloqueado temporalmente', {
          description: `"${device.name}" no podrá operar hasta ser desbloqueado.`
        });
      } else {
        toast.success('Dispositivo desbloqueado', {
          description: `"${device.name}" ha sido reactivado para operaciones.`
        });
      }
    } catch (err) {
      toast.error('Error al cambiar bloqueo', { description: err.message });
    }
  };

  // 5. Dar de Baja / Reactivar Dispositivo
  const handleToggleStatus = async (device, customReason = null) => {
    const willBeActive = !device.isActive;
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/v1/devices/${device.id}/status-toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          isActive: willBeActive,
          reason: customReason || (willBeActive ? null : 'Dado de baja por el administrador')
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al cambiar estado');
      }

      const data = await res.json();
      setDevices(prev => prev.map(d => d.id === device.id ? data.device : d));
      setActionModal({ isOpen: false, type: null, device: null, reason: '' });

      if (willBeActive) {
        toast.success('Dispositivo reactivado (Alta)', {
          description: `"${device.name}" volvió a estar activo.`
        });
      } else {
        toast.info('Dispositivo dado de baja', {
          description: `Se registró la baja de "${device.name}". Su historial de alta/baja queda guardado.`
        });
      }
    } catch (err) {
      toast.error('Error al actualizar estado', { description: err.message });
    }
  };

  // 6. Aprobar solicitud de Kiosko
  const handleApprove = async (request) => {
    try {
      setIsSubmitting(true);
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const nameToSend = kioskCustomName.trim() || `Kiosko ${request.pairingCode}`;

      const res = await fetch(`${baseUrl}/api/v1/devices/auth-requests/${request.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: nameToSend })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al aprobar solicitud');
      }

      toast.success('Kiosko autorizado exitosamente', {
        description: `Se dio de alta como "${nameToSend}"`
      });

      setApprovingId(null);
      setKioskCustomName('');
      setPendingRequests(prev => prev.filter(r => r.id !== request.id));
      fetchDevices();
    } catch (err) {
      toast.error('Error al autorizar', { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 7. Rechazar solicitud de Kiosko
  const handleReject = async (requestId) => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/v1/devices/auth-requests/${requestId}/reject`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Error al rechazar solicitud');

      toast.info('Solicitud rechazada');
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err) {
      toast.error('Error al rechazar', { description: err.message });
    }
  };

  // 8. Eliminar permanentemente
  const handleDeleteDevice = async (deviceId, deviceName) => {
    if (!window.confirm(`¿Estás seguro de eliminar definitivamente "${deviceName}" de la base de datos?\n\nTip: Si solo deseas suspenderlo o retirarlo de servicio temporalmente, se recomienda usar "Bloquear" o "Dar de baja" para conservar la fecha de alta y baja.`)) {
      return;
    }

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/v1/devices/${deviceId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Error al eliminar dispositivo');

      toast.success('Dispositivo eliminado', { description: `Se eliminó definitivamente "${deviceName}"` });
      setDevices(prev => prev.filter(d => d.id !== deviceId));
    } catch (err) {
      toast.error('Error al eliminar', { description: err.message });
    }
  };

  // 9. Crear dispositivo manual (Cámara / Torniquete)
  const handleSaveManual = async (e) => {
    e.preventDefault();
    if (!manualForm.name) {
      toast.error('El nombre es requerido');
      return;
    }

    try {
      setIsSubmitting(true);
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/v1/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(manualForm)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar dispositivo');
      }

      toast.success('Dispositivo registrado (Alta exitosa)');
      setIsAddModalOpen(false);
      setManualForm({ name: '', type: 'CAMERA', ipAddress: '', description: '' });
      fetchDevices();
    } catch (err) {
      toast.error('Error al crear dispositivo', { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Métricas rápidas
  const metrics = useMemo(() => {
    const total = devices.length;
    const online = devices.filter(d => d.isActive && !d.isBlocked && d.status === 'ONLINE').length;
    const blocked = devices.filter(d => d.isBlocked).length;
    const deactivated = devices.filter(d => !d.isActive).length;
    return { total, online, blocked, deactivated };
  }, [devices]);

  // Filtrado de Dispositivos
  const filteredDevices = useMemo(() => {
    return devices.filter(device => {
      const matchSearch = 
        (device.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (device.ipAddress || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (device.id || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchStatus = 
        selectedStatus === 'Todos' ? true :
        selectedStatus === 'Activos' ? device.isActive && !device.isBlocked :
        selectedStatus === 'Bloqueados' ? device.isBlocked :
        selectedStatus === 'Dados de Baja' ? !device.isActive :
        selectedStatus === 'En Línea' ? device.isActive && !device.isBlocked && device.status === 'ONLINE' :
        selectedStatus === 'Desconectados' ? device.status === 'OFFLINE' : true;
        
      return matchSearch && matchStatus;
    });
  }, [devices, searchTerm, selectedStatus]);

  // Formato de Fechas
  const formatDateTime = (dateString) => {
    if (!dateString) return 'No registrado';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Fecha inválida';
    return d.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getTimeRemaining = (expiresAt) => {
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    if (diff <= 0) return 'Expirado';
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m}:${s < 10 ? '0' : ''}${s} min`;
  };

  // Clasificador visual de IP
  const getIpBadge = (ip) => {
    if (!ip) return { text: 'Sin IP asignada', color: '#71717a' };
    if (ip === '127.0.0.1' || ip === 'localhost') {
      return { text: 'Localhost (Misma máquina)', color: '#a1a1aa' };
    }
    if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.16.')) {
      return { text: 'Red Local (LAN)', color: '#38bdf8' };
    }
    return { text: 'IP de Red / WAN', color: '#818cf8' };
  };

  return (
    <div className="fade-in" style={{ paddingBottom: '2.5rem' }}>
      {/* Banner Superior Automático de Solicitudes Pendientes */}
      {pendingRequests.length > 0 && (
        <div 
          onClick={() => {
            setActiveTab('kiosk');
            setIsAddModalOpen(true);
          }}
          style={{
            background: 'linear-gradient(90deg, rgba(234, 179, 8, 0.15) 0%, rgba(249, 115, 22, 0.1) 100%)',
            border: '1px solid rgba(234, 179, 8, 0.4)',
            color: '#fef08a',
            padding: '1rem 1.5rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(234, 179, 8, 0.15)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          className="pending-banner-hover"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#eab308',
              boxShadow: '0 0 10px #eab308',
              animation: 'pulse 1.5s infinite'
            }} />
            <div>
              <strong style={{ color: '#fff', fontSize: '1rem' }}>
                {pendingRequests.length === 1 
                  ? '1 kiosko esperando autorización' 
                  : `${pendingRequests.length} kioskos esperando autorización`}
              </strong>
              <span style={{ color: '#d4d4d8', marginLeft: '0.75rem', fontSize: '0.9rem' }}>
                Se detectaron solicitudes de emparejamiento recientes en la red.
              </span>
            </div>
          </div>
          <button style={{
            background: '#eab308',
            color: '#000',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            Revisar solicitud <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: '#fff', margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>Dispositivos y Nodos de Red</h2>
          <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0 0', fontSize: '0.95rem' }}>
            Monitorea el ciclo de vida (altas y bajas), bloqueos temporales de seguridad y telemetría de red.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={() => {
              fetchDevices(true);
              fetchPendingRequests();
            }}
            style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            disabled={isRefreshing || loading}
          >
            <RefreshCw size={18} className={isRefreshing ? "spin-animation" : ""} /> 
            Actualizar
          </button>
          <button 
            onClick={() => {
              setActiveTab('kiosk');
              setIsAddModalOpen(true);
            }}
            style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={18} /> Añadir Dispositivo
          </button>
        </div>
      </div>

      {/* Tarjetas de Resumen / KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.75rem'
      }}>
        <div style={kpiCardStyle}>
          <div style={{ color: '#a1a1aa', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Registrados
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginTop: '0.3rem' }}>
            {metrics.total}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.2rem' }}>
            Nodos en base de datos
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            En Línea (Operativos)
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#22c55e', marginTop: '0.3rem' }}>
            {metrics.online}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.2rem' }}>
            Listos para checador
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ color: '#eab308', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Bloqueados Temporalmente
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#eab308', marginTop: '0.3rem' }}>
            {metrics.blocked}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.2rem' }}>
            Pausados por administración
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Dados de Baja
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444', marginTop: '0.3rem' }}>
            {metrics.deactivated}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.2rem' }}>
            Fuera de servicio (Histórico)
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', background: '#121212', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #27272a', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa' }} />
          <input 
            type="text" 
            placeholder="Buscar por nombre, ID o dirección IP..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#fff', paddingLeft: '2.5rem', fontSize: '0.95rem', fontFamily: 'inherit' }}
          />
        </div>
        
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            style={{ ...btnFilter, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
          >
            <Filter size={18} /> {selectedStatus}
          </button>
          
          {isFilterOpen && (
            <div style={dropdownMenu}>
              {['Todos', 'Activos', 'Bloqueados', 'Dados de Baja', 'En Línea', 'Desconectados'].map(status => (
                <div 
                  key={status} 
                  style={{
                    ...dropdownItem,
                    backgroundColor: selectedStatus === status ? 'rgba(249, 115, 22, 0.2)' : 'transparent',
                    color: selectedStatus === status ? '#f97316' : '#e4e4e7',
                    fontWeight: selectedStatus === status ? 600 : 400
                  }}
                  onClick={() => { setSelectedStatus(status); setIsFilterOpen(false); }}
                >
                  {status}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      {error ? (
        <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'center' }}>
          <AlertCircle size={40} style={{ margin: '0 auto 1rem auto', opacity: 0.8 }} />
          <h3 style={{ margin: '0 0 0.5rem 0' }}>Error al conectar con la base de datos</h3>
          <p style={{ margin: '0 0 1.5rem 0', color: '#fca5a5' }}>{error}</p>
          <button onClick={() => fetchDevices()} style={{ ...btnPrimary, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={16} /> Reintentar
          </button>
        </div>
      ) : loading ? (
        <div style={gridStyle}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ ...deviceCard, border: '1px solid #3f3f46' }}>
              <Skeleton height="24px" width="50%" style={{ marginBottom: '0.5rem' }} />
              <Skeleton height="14px" width="80%" style={{ marginBottom: '1.5rem' }} />
              <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1 }}><Skeleton height="30px" width="100%" /></div>
                <div style={{ flex: 1 }}><Skeleton height="30px" width="100%" /></div>
              </div>
              <Skeleton height="40px" width="100%" />
            </div>
          ))}
        </div>
      ) : filteredDevices.length === 0 ? (
        <div style={{ padding: '4rem 2rem', textAlign: 'center', background: '#1e1e1e', borderRadius: '16px', border: '1px solid #27272a' }}>
          <Server size={48} style={{ color: '#52525b', margin: '0 auto 1rem auto' }} />
          <h3 style={{ color: '#fff', margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>No se encontraron dispositivos</h3>
          <p style={{ color: '#a1a1aa', margin: '0 0 1.5rem 0', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto', fontSize: '0.95rem' }}>
            {searchTerm || selectedStatus !== 'Todos'
              ? 'Prueba cambiando los filtros de búsqueda o restableciendo el estado a "Todos".'
              : 'Para habilitar tu primer Kiosko, abre la URL del Kiosko en una tablet y apruébalo desde aquí.'}
          </p>
          <button onClick={() => { setActiveTab('kiosk'); setIsAddModalOpen(true); }} style={btnPrimary}>
            <Plus size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}/> Añadir Kiosko o Nodo
          </button>
        </div>
      ) : (
        <div style={gridStyle}>
          {filteredDevices.map(device => {
            const isBlocked = !!device.isBlocked;
            const isDeactivated = !device.isActive;
            const isOnline = device.status === 'ONLINE' && !isDeactivated && !isBlocked;
            const isOffline = device.status === 'OFFLINE' && !isDeactivated && !isBlocked;

            // Determinación del Estado Visual
            let badgeBg = 'rgba(34, 197, 94, 0.15)';
            let badgeBorder = 'rgba(34, 197, 94, 0.4)';
            let badgeColor = '#4ade80';
            let BadgeIcon = Wifi;
            let badgeText = 'En Línea';
            let cardGlow = '34, 197, 94';

            if (isDeactivated) {
              badgeBg = 'rgba(239, 68, 68, 0.15)';
              badgeBorder = 'rgba(239, 68, 68, 0.35)';
              badgeColor = '#f87171';
              BadgeIcon = Ban;
              badgeText = 'Dado de Baja';
              cardGlow = '239, 68, 68';
            } else if (isBlocked) {
              badgeBg = 'rgba(234, 179, 8, 0.15)';
              badgeBorder = 'rgba(234, 179, 8, 0.4)';
              badgeColor = '#fde047';
              BadgeIcon = Lock;
              badgeText = 'Bloqueado Temporalmente';
              cardGlow = '234, 179, 8';
            } else if (isOffline) {
              badgeBg = 'rgba(113, 113, 122, 0.15)';
              badgeBorder = 'rgba(113, 113, 122, 0.3)';
              badgeColor = '#a1a1aa';
              BadgeIcon = Power;
              badgeText = 'Desconectado';
              cardGlow = '113, 113, 122';
            }

            const typeLabel = 
              device.type === 'KIOSK' ? 'Kiosko Checador' :
              device.type === 'CAMERA' ? 'Cámara de Seguridad' : 'Torniquete de Entrada';

            const TypeIcon = 
              device.type === 'KIOSK' ? MonitorSmartphone :
              device.type === 'CAMERA' ? Video : Server;

            const ipInfo = getIpBadge(device.ipAddress);

            return (
              <div 
                key={device.id} 
                style={{
                  ...deviceCard,
                  background: `linear-gradient(180deg, #18181b 0%, rgba(${cardGlow}, 0.03) 100%)`,
                  border: `1px solid rgba(${cardGlow}, 0.25)`,
                  opacity: isDeactivated ? 0.75 : 1
                }}
              >
                {/* Header del Card */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                      backgroundColor: isBlocked ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255,255,255,0.06)',
                      padding: '0.45rem',
                      borderRadius: '10px',
                      color: isBlocked ? '#eab308' : '#f97316'
                    }}>
                      <TypeIcon size={20} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', fontWeight: 700 }}>
                        {device.name}
                      </h3>
                      <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>{typeLabel}</span>
                    </div>
                  </div>
                  <span style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.25rem 0.6rem', 
                    backgroundColor: badgeBg,
                    color: badgeColor, 
                    borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, 
                    border: `1px solid ${badgeBorder}` 
                  }}>
                    <BadgeIcon size={12} /> {badgeText}
                  </span>
                </div>

                <p style={{ color: '#a1a1aa', margin: '0 0 1rem 0', fontSize: '0.8rem', minHeight: '1.2rem', lineHeight: '1.4' }}>
                  {device.description || 'Sin descripción asignada'}
                </p>

                {/* Motivos de bloqueo o baja si existen */}
                {isBlocked && device.blockedReason && (
                  <div style={{
                    backgroundColor: 'rgba(234, 179, 8, 0.1)',
                    border: '1px solid rgba(234, 179, 8, 0.25)',
                    color: '#fef08a',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}>
                    <ShieldAlert size={14} color="#eab308" />
                    <span><strong>Motivo de bloqueo:</strong> {device.blockedReason}</span>
                  </div>
                )}

                {isDeactivated && device.deactivatedReason && (
                  <div style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#fca5a5',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}>
                    <Ban size={14} color="#ef4444" />
                    <span><strong>Motivo de baja:</strong> {device.deactivatedReason}</span>
                  </div>
                )}

                {/* Ciclo de Vida: Fecha de Alta y Fecha de Baja */}
                <div style={{
                  background: '#121215',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  border: '1px solid #27272a',
                  marginBottom: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#22c55e', fontSize: '0.75rem', fontWeight: 600 }}>
                      <CalendarPlus size={14} /> Fecha de Alta:
                    </div>
                    <div style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 500 }}>
                      {formatDateTime(device.createdAt)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: isDeactivated ? '#ef4444' : '#71717a', fontSize: '0.75rem', fontWeight: 600 }}>
                      <CalendarX size={14} /> Fecha de Baja:
                    </div>
                    <div style={{ color: isDeactivated ? '#fca5a5' : '#71717a', fontSize: '0.8rem', fontWeight: 500 }}>
                      {isDeactivated ? formatDateTime(device.deactivatedAt) : 'Activo (En servicio)'}
                    </div>
                  </div>
                </div>

                {/* Network & Telemetría */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', background: '#121215', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #27272a' }}>
                  <div style={{ flex: 1.2 }}>
                    <div style={{ fontSize: '0.7rem', color: '#71717a', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      Dirección IP
                    </div>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem', fontFamily: 'monospace' }}>
                      {device.ipAddress || 'Dinámica'}
                    </div>
                    <span style={{ fontSize: '0.65rem', color: ipInfo.color }}>
                      {ipInfo.text}
                    </span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.7rem', color: '#71717a', marginBottom: '0.2rem' }}>Último latido</div>
                    <div style={{ color: '#d4d4d8', fontWeight: 500, fontSize: '0.85rem' }}>
                      {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleTimeString() : 'N/D'}
                    </div>
                  </div>
                </div>

                {/* Acciones del Dispositivo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {/* Botón de Bloqueo Temporal */}
                    {isBlocked ? (
                      <button
                        onClick={() => handleToggleBlock(device)}
                        style={{ ...btnActionYellow, flex: 1, backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', borderColor: 'rgba(34, 197, 94, 0.3)' }}
                        title="Desbloquear este dispositivo para reactivar su operación"
                      >
                        <Unlock size={15} /> Desbloquear
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setActionModal({
                            isOpen: true,
                            type: 'block',
                            device,
                            reason: ''
                          });
                        }}
                        disabled={isDeactivated}
                        style={{ 
                          ...btnActionYellow, 
                          flex: 1,
                          opacity: isDeactivated ? 0.5 : 1,
                          cursor: isDeactivated ? 'not-allowed' : 'pointer'
                        }}
                        title="Bloquear temporalmente para impedir checadas"
                      >
                        <Lock size={15} /> Bloquear Temp.
                      </button>
                    )}

                    {/* Botón de Dar de Baja / Reactivar */}
                    {isDeactivated ? (
                      <button
                        onClick={() => handleToggleStatus(device)}
                        style={{ ...btnActionSecondary, flex: 1, color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}
                        title="Reactivar y dar de alta nuevamente"
                      >
                        <RotateCcw size={15} /> Reactivar Alta
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setActionModal({
                            isOpen: true,
                            type: 'deactivate',
                            device,
                            reason: ''
                          });
                        }}
                        style={{ ...btnActionSecondary, flex: 1 }}
                        title="Dar de baja y retirar de servicio (conservando registros)"
                      >
                        <Ban size={15} /> Dar de Baja
                      </button>
                    )}
                  </div>

                  {/* Botón de Eliminación Definitiva */}
                  <button 
                    onClick={() => handleDeleteDevice(device.id, device.name)}
                    style={{
                      ...btnDeleteMinimal
                    }}
                    title="Eliminar registro completamente de la base de datos"
                  >
                    <Trash2 size={13} /> Eliminar registro definitivo
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Acción (Bloquear o Dar de Baja con Motivo) */}
      {actionModal.isOpen && (
        <div style={modalOverlay}>
          <div style={modalContent} className="fade-in-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {actionModal.type === 'block' ? (
                  <div style={{ padding: '0.5rem', borderRadius: '10px', backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
                    <Lock size={22} />
                  </div>
                ) : (
                  <div style={{ padding: '0.5rem', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                    <Ban size={22} />
                  </div>
                )}
                <div>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', fontWeight: 700 }}>
                    {actionModal.type === 'block' ? 'Bloquear Dispositivo Temporalmente' : 'Dar de Baja Dispositivo'}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>
                    Dispositivo: {actionModal.device?.name}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setActionModal({ isOpen: false, type: null, device: null, reason: '' })}
                style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: '#d4d4d8', fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
              {actionModal.type === 'block' 
                ? 'El kiosko se bloqueará de inmediato en pantalla y no permitirá registros de asistencia. Podrás desbloquearlo en cualquier momento con un solo clic.' 
                : 'Se registrará formalmente la fecha y hora de baja del dispositivo. Las checadas previas se mantendrán intactas en los reportes.'}
            </p>

            <label style={modalLabel}>Motivo o justificación (opcional):</label>
            <input 
              type="text"
              placeholder={actionModal.type === 'block' ? 'Ej. Mantenimiento, revisión de cámara, sospecha...' : 'Ej. Reemplazo por tablet nueva, fin de ciclo...'}
              value={actionModal.reason}
              onChange={(e) => setActionModal({ ...actionModal, reason: e.target.value })}
              style={{ ...inputStyle, marginBottom: '1.5rem' }}
              autoFocus
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setActionModal({ isOpen: false, type: null, device: null, reason: '' })}
                style={btnSecondary}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (actionModal.type === 'block') {
                    handleToggleBlock(actionModal.device, actionModal.reason);
                  } else {
                    handleToggleStatus(actionModal.device, actionModal.reason);
                  }
                }}
                style={{
                  ...btnPrimary,
                  backgroundColor: actionModal.type === 'block' ? '#eab308' : '#ef4444',
                  color: actionModal.type === 'block' ? '#000' : '#fff'
                }}
              >
                {actionModal.type === 'block' ? 'Confirmar Bloqueo' : 'Confirmar Baja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reestructurado: Añadir Nodo / Autorizar Kiosko */}
      {isAddModalOpen && (
        <div style={modalOverlay}>
          <div style={modalContent} className="fade-in-up">
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.3rem', fontWeight: 700 }}>Añadir Nodo de Red</h3>
                <p style={{ margin: '0.25rem 0 0 0', color: '#a1a1aa', fontSize: '0.85rem' }}>
                  Selecciona el tipo de dispositivo que deseas dar de alta.
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsAddModalOpen(false);
                  setApprovingId(null);
                }}
                style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Pestañas de Selección de Tipo */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: '#121215', padding: '0.4rem', borderRadius: '10px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('kiosk')}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  background: activeTab === 'kiosk' ? '#f97316' : 'transparent',
                  color: activeTab === 'kiosk' ? '#fff' : '#a1a1aa',
                  transition: 'all 0.2s'
                }}
              >
                <MonitorSmartphone size={16} /> Kiosko (Autorización Remota)
                {pendingRequests.length > 0 && (
                  <span style={{
                    backgroundColor: activeTab === 'kiosk' ? '#fff' : '#eab308',
                    color: '#000',
                    fontSize: '0.7rem',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '99px',
                    fontWeight: 'bold'
                  }}>
                    {pendingRequests.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('manual')}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  background: activeTab === 'manual' ? '#f97316' : 'transparent',
                  color: activeTab === 'manual' ? '#fff' : '#a1a1aa',
                  transition: 'all 0.2s'
                }}
              >
                <Video size={16} /> Cámara / Torniquete Manual
              </button>
            </div>

            {/* Contenido Pestaña 1: Kiosko (Autorización Remota) */}
            {activeTab === 'kiosk' && (
              <div>
                {pendingRequests.length === 0 ? (
                  <div style={{
                    padding: '2.5rem 1.5rem',
                    textAlign: 'center',
                    background: '#121215',
                    borderRadius: '16px',
                    border: '1px dashed #3f3f46'
                  }}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(249, 115, 22, 0.1)',
                      border: '1px solid rgba(249, 115, 22, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1rem auto'
                    }}>
                      <div className="radar-pulse" />
                      <MonitorSmartphone size={24} color="#f97316" />
                    </div>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '1.05rem' }}>
                      Esperando solicitudes de kiosko...
                    </h4>
                    <p style={{ margin: '0 0 1.5rem 0', color: '#a1a1aa', fontSize: '0.85rem', lineHeight: '1.5' }}>
                      Abre la URL <code style={{ color: '#f97316', backgroundColor: '#18181b', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>/kiosk</code> en la tablet o navegador que deseas dar de alta. La solicitud aparecerá aquí en tiempo real.
                    </p>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#71717a', fontSize: '0.8rem' }}>
                      <span className="pulse-dot" /> Escuchando la red
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '380px', overflowY: 'auto' }}>
                    <div style={{ color: '#a1a1aa', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                      Solicitudes pendientes detectadas:
                    </div>
                    {pendingRequests.map(req => {
                      const isApprovingThis = approvingId === req.id;

                      return (
                        <div key={req.id} style={{
                          background: '#121215',
                          border: '1px solid rgba(249, 115, 22, 0.3)',
                          borderRadius: '14px',
                          padding: '1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{
                                backgroundColor: 'rgba(249, 115, 22, 0.15)',
                                color: '#f97316',
                                padding: '0.4rem 0.75rem',
                                borderRadius: '8px',
                                fontFamily: 'monospace',
                                fontWeight: 800,
                                fontSize: '1.1rem',
                                letterSpacing: '0.05em'
                              }}>
                                {req.pairingCode}
                              </div>
                              <div>
                                <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>IP: {req.ipAddress}</div>
                                <div style={{ color: '#71717a', fontSize: '0.75rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {req.userAgent}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#eab308', fontSize: '0.75rem' }}>
                              <Clock size={14} />
                              <span>{getTimeRemaining(req.expiresAt)}</span>
                            </div>
                          </div>

                          {/* Sub-formulario de Aprobación para asignar Nombre */}
                          {isApprovingThis ? (
                            <div style={{
                              background: '#18181b',
                              border: '1px solid #3f3f46',
                              borderRadius: '10px',
                              padding: '1rem',
                              marginTop: '0.25rem'
                            }}>
                              <label style={modalLabel}>Asignar nombre a este Kiosko:</label>
                              <input 
                                type="text"
                                placeholder={`Ej. Kiosko Recepción (${req.pairingCode})`}
                                value={kioskCustomName}
                                onChange={(e) => setKioskCustomName(e.target.value)}
                                style={{ ...inputStyle, marginBottom: '0.75rem' }}
                                autoFocus
                              />
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                <button
                                  type="button"
                                  onClick={() => setApprovingId(null)}
                                  style={{ ...btnSecondary, padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApprove(req)}
                                  disabled={isSubmitting}
                                  style={{ ...btnPrimary, padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                                >
                                  {isSubmitting ? 'Dando de alta...' : 'Confirmar Alta'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                              <button
                                type="button"
                                onClick={() => handleReject(req.id)}
                                style={{
                                  padding: '0.5rem 1rem',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  color: '#ef4444',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  fontSize: '0.85rem'
                                }}
                              >
                                Rechazar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setApprovingId(req.id);
                                  setKioskCustomName(`Kiosko ${req.pairingCode}`);
                                }}
                                style={{
                                  padding: '0.5rem 1.25rem',
                                  background: '#f97316',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  fontSize: '0.85rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.4rem'
                                }}
                              >
                                <ShieldCheck size={16} /> Aprobar y Dar de Alta
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Contenido Pestaña 2: Registro Manual (Cámara / Torniquete) */}
            {activeTab === 'manual' && (
              <form onSubmit={handleSaveManual}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={modalLabel}>Nombre del dispositivo</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Cámara Entrada Principal" 
                      value={manualForm.name}
                      onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                      style={inputStyle} 
                      required
                    />
                  </div>
                  
                  <div>
                    <label style={modalLabel}>Tipo</label>
                    <select 
                      value={manualForm.type}
                      onChange={(e) => setManualForm({ ...manualForm, type: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="CAMERA">Cámara IP</option>
                      <option value="TURNSTILE">Torniquete de Acceso</option>
                    </select>
                  </div>
                  
                  <div>
                    <label style={modalLabel}>Dirección IP de Red (Opcional)</label>
                    <input 
                      type="text" 
                      placeholder="Ej. 192.168.1.120" 
                      value={manualForm.ipAddress}
                      onChange={(e) => setManualForm({ ...manualForm, ipAddress: e.target.value })}
                      style={inputStyle} 
                    />
                  </div>
                  
                  <div>
                    <label style={modalLabel}>Ubicación / Descripción</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Pasillo Norte, Piso 1" 
                      value={manualForm.description}
                      onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                      style={inputStyle} 
                    />
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                  <button 
                    type="button"
                    style={btnSecondary} 
                    onClick={() => setIsAddModalOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    style={btnPrimary}
                  >
                    {isSubmitting ? 'Registrando...' : 'Registrar y Dar de Alta'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .spin-animation {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
        .fade-in-up {
          animation: fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pending-banner-hover:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(234, 179, 8, 0.25) !important;
        }
        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #22c55e;
          animation: pulse 1.8s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.6; }
          100% { transform: scale(0.95); opacity: 1; }
        }
        .radar-pulse {
          position: absolute;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: 1px solid rgba(249, 115, 22, 0.4);
          animation: radar 2s infinite ease-out;
        }
        @keyframes radar {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}} />
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

const btnFilter = {
  ...btnSecondary,
  background: '#121212',
};

const btnActionYellow = {
  padding: '0.55rem 0.75rem',
  background: 'rgba(234, 179, 8, 0.1)',
  color: '#eab308',
  border: '1px solid rgba(234, 179, 8, 0.3)',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.8rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.4rem',
  transition: 'all 0.2s'
};

const btnActionSecondary = {
  padding: '0.55rem 0.75rem',
  background: '#18181b',
  color: '#d4d4d8',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.8rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.4rem',
  transition: 'all 0.2s'
};

const btnDeleteMinimal = {
  padding: '0.4rem',
  background: 'transparent',
  color: '#71717a',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.75rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.35rem',
  transition: 'color 0.2s',
  marginTop: '0.2rem'
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
  fontFamily: 'inherit',
  fontSize: '0.95rem'
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
  minWidth: '180px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
};

const dropdownItem = {
  padding: '0.5rem 1rem',
  color: '#e4e4e7',
  cursor: 'pointer',
  borderRadius: '4px',
  fontSize: '0.9rem'
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: '1.5rem'
};

const deviceCard = {
  borderRadius: '16px',
  padding: '1.5rem',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.2s, box-shadow 0.2s',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
};

const kpiCardStyle = {
  background: '#18181b',
  border: '1px solid #27272a',
  borderRadius: '14px',
  padding: '1.25rem',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
};

const modalOverlay = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  backdropFilter: 'blur(6px)'
};

const modalContent = {
  background: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: '20px',
  padding: '2rem',
  width: '100%',
  maxWidth: '540px',
  boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
};

const modalLabel = {
  display: 'block',
  color: '#a1a1aa',
  fontSize: '0.85rem',
  marginBottom: '0.5rem'
};

export default DevicesPage;
