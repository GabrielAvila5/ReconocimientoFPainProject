import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Filter, Plus, RefreshCw, AlertCircle, Wifi, 
  Power, AlertTriangle, Eye, Video, MonitorSmartphone, Server,
  Clock, Check, X, ShieldCheck, Trash2, ArrowRight, Laptop
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
  
  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('kiosk'); // 'kiosk' | 'manual'
  
  // Solicitudes Pendientes
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

  // 3. Escuchar eventos Socket.io para solicitudes en tiempo real
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

    socket.on('new_device_auth_request', handleNewRequest);
    socket.on('device_auth_request_resolved', handleResolvedRequest);

    return () => {
      socket.off('new_device_auth_request', handleNewRequest);
      socket.off('device_auth_request_resolved', handleResolvedRequest);
    };
  }, [socket]);

  // 4. Temporizador local para las solicitudes pendientes
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 5. Aprobar solicitud de Kiosko
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
        description: `Se vinculó como "${nameToSend}"`
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

  // 6. Rechazar solicitud de Kiosko
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

  // 7. Eliminar / Revocar Dispositivo
  const handleDeleteDevice = async (deviceId, deviceName) => {
    if (!window.confirm(`¿Estás seguro de revocar el acceso a "${deviceName}"? Si es un kiosko, será desvinculado inmediatamente.`)) {
      return;
    }

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/v1/devices/${deviceId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Error al revocar dispositivo');

      toast.success('Dispositivo revocado', { description: `Se eliminó "${deviceName}"` });
      setDevices(prev => prev.filter(d => d.id !== deviceId));
    } catch (err) {
      toast.error('Error al eliminar', { description: err.message });
    }
  };

  // 8. Crear dispositivo manual (Cámara / Torniquete)
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

      toast.success('Dispositivo registrado correctamente');
      setIsAddModalOpen(false);
      setManualForm({ name: '', type: 'CAMERA', ipAddress: '', description: '' });
      fetchDevices();
    } catch (err) {
      toast.error('Error al crear dispositivo', { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtrado de Dispositivos
  const filteredDevices = useMemo(() => {
    return devices.filter(device => {
      const matchSearch = 
        (device.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (device.ipAddress || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (device.id || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchStatus = 
        selectedStatus === 'Todos' ? true :
        selectedStatus === 'En Línea' ? device.status === 'ONLINE' :
        selectedStatus === 'Desconectado' ? device.status === 'OFFLINE' :
        selectedStatus === 'Inestable' ? device.status === 'UNSTABLE' : true;
        
      return matchSearch && matchStatus;
    });
  }, [devices, searchTerm, selectedStatus]);

  // Formateador de tiempo restante
  const getTimeRemaining = (expiresAt) => {
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    if (diff <= 0) return 'Expirado';
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m}:${s < 10 ? '0' : ''}${s} min`;
  };

  return (
    <div className="fade-in" style={{ paddingBottom: '2rem' }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: '#fff', margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>Dispositivos y Nodos de Red</h2>
          <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0 0', fontSize: '0.95rem' }}>
            Gestiona la autorización de kioskos y monitorea la salud de cámaras y terminales.
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
            <Plus size={18} /> Añadir Nodo
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', background: '#121212', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #27272a', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa' }} />
          <input 
            type="text" 
            placeholder="Buscar por ID, nombre o IP..." 
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
            <Filter size={18} /> Estado
          </button>
          
          {isFilterOpen && (
            <div style={dropdownMenu}>
              {['Todos', 'En Línea', 'Desconectado', 'Inestable'].map(status => (
                <div 
                  key={status} 
                  style={dropdownItem}
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
          <h3 style={{ color: '#fff', margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>No hay dispositivos registrados</h3>
          <p style={{ color: '#a1a1aa', margin: '0 0 1.5rem 0', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto', fontSize: '0.95rem' }}>
            Para habilitar tu primer Kiosko, abre la URL del Kiosko en una tablet y apruébalo desde aquí.
          </p>
          <button onClick={() => { setActiveTab('kiosk'); setIsAddModalOpen(true); }} style={btnPrimary}>
            <Plus size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}/> Añadir Kiosko o Nodo
          </button>
        </div>
      ) : (
        <div style={gridStyle}>
          {filteredDevices.map(device => {
            const isOnline = device.status === 'ONLINE';
            const isOffline = device.status === 'OFFLINE';
            const isUnstable = device.status === 'UNSTABLE';

            let glowColor = '249, 115, 22'; // Naranja
            let badgeColor = '#f97316';
            let BadgeIcon = Wifi;
            let badgeText = 'En Línea';

            if (isOffline) {
              glowColor = '239, 68, 68';
              badgeColor = '#ef4444';
              BadgeIcon = Power;
              badgeText = 'Desconectado';
            } else if (isUnstable) {
              glowColor = '234, 179, 8';
              badgeColor = '#eab308';
              BadgeIcon = AlertTriangle;
              badgeText = 'Inestable';
            }

            const cardStyle = {
              ...deviceCard,
              background: `linear-gradient(180deg, #18181b 0%, rgba(${glowColor}, 0.04) 100%)`,
              border: `1px solid rgba(${glowColor}, 0.2)`,
            };

            const typeLabel = 
              device.type === 'KIOSK' ? 'Kiosko Checador' :
              device.type === 'CAMERA' ? 'Cámara de Seguridad' : 'Torniquete de Entrada';

            const TypeIcon = 
              device.type === 'KIOSK' ? MonitorSmartphone :
              device.type === 'CAMERA' ? Video : Server;

            return (
              <div key={device.id} style={cardStyle}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      padding: '0.4rem',
                      borderRadius: '8px',
                      color: '#f97316'
                    }}>
                      <TypeIcon size={18} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', fontWeight: 600 }}>{device.name}</h3>
                      <span style={{ fontSize: '0.75rem', color: '#71717a' }}>{typeLabel}</span>
                    </div>
                  </div>
                  <span style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.2rem 0.5rem', 
                    color: badgeColor, 
                    borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500, 
                    border: `1px solid rgba(${glowColor}, 0.3)` 
                  }}>
                    <BadgeIcon size={12} /> {badgeText}
                  </span>
                </div>

                <p style={{ color: '#a1a1aa', margin: '0.5rem 0 1.25rem 0', fontSize: '0.8rem', minHeight: '1.2rem' }}>
                  {device.description || 'Sin descripción asignada'}
                </p>

                {/* Network Data */}
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', background: '#121215', padding: '0.75rem 1rem', borderRadius: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: '#71717a', marginBottom: '0.25rem' }}>Dirección IP</div>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem', fontFamily: 'monospace' }}>
                      {device.ipAddress || 'Dinámica'}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: '#71717a', marginBottom: '0.25rem' }}>Último latido</div>
                    <div style={{ color: '#d4d4d8', fontWeight: 500, fontSize: '0.85rem' }}>
                      {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleTimeString() : 'N/D'}
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                  <button 
                    onClick={() => handleDeleteDevice(device.id, device.name)}
                    style={{ ...btnDelete, flex: 1 }}
                    title="Revocar acceso de este dispositivo"
                  >
                    <Trash2 size={16} /> Revocar Dispositivo
                  </button>
                </div>
              </div>
            );
          })}
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
                  Selecciona el tipo de dispositivo que deseas registrar.
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
                      Abre la URL <code style={{ color: '#f97316', backgroundColor: '#18181b', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>/kiosk</code> en la tablet o navegador que deseas autorizar. La solicitud aparecerá aquí en tiempo real.
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
                                  {isSubmitting ? 'Autorizando...' : 'Confirmar y Vincular'}
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
                                <ShieldCheck size={16} /> Aprobar Kiosko
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
                    <label style={modalLabel}>Dirección IP (Opcional)</label>
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
                    {isSubmitting ? 'Guardando...' : 'Guardar Dispositivo'}
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

const btnDelete = {
  padding: '0.6rem 1rem',
  background: 'rgba(239, 68, 68, 0.08)',
  color: '#ef4444',
  border: '1px solid rgba(239, 68, 68, 0.25)',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: '0.85rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  transition: 'all 0.2s'
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
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
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
