import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Filter, Plus, RefreshCw, AlertCircle, Wifi, 
  Power, AlertTriangle, Eye, Video, MonitorSmartphone, Server
} from 'lucide-react';

// Mock data covering the 3 states
const mockDevices = [
  {
    id: 'CAM-01',
    name: 'CAM-01',
    type: 'Cámara',
    status: 'online',
    ip: '192.168.1.101',
    latency: 12,
    uptime: '45d 12h',
    successRate: '98.5%',
    readsToday: 1245,
    description: 'Cámara Principal - Entrada'
  },
  {
    id: 'KIO-01',
    name: 'KIO-01',
    type: 'Kiosko',
    status: 'online',
    ip: '192.168.1.102',
    latency: 15,
    uptime: '30d 8h',
    successRate: '95.2%',
    readsToday: 850,
    description: 'Kiosko Recepción'
  },
  {
    id: 'CAM-02',
    name: 'CAM-02',
    type: 'Cámara',
    status: 'offline',
    ip: '192.168.1.103',
    latency: 'Timeout',
    uptime: '0d 0h',
    successRate: 'N/A',
    readsToday: 0,
    description: 'Cámara Secundaria - Pasillo'
  },
  {
    id: 'TRN-01',
    name: 'TRN-01',
    type: 'Torniquete',
    status: 'unstable',
    ip: '192.168.1.104',
    latency: 120,
    uptime: '5d 2h',
    successRate: '82.0%',
    readsToday: 320,
    description: 'Torniquete Principal'
  }
];

const DevicesPage = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('Todos');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchDevices = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/devices`);
      if (!res.ok) {
        // Fallback to mock data if endpoint doesn't exist (404)
        if (res.status === 404) {
          setTimeout(() => {
            setDevices(mockDevices);
            setLoading(false);
            setIsRefreshing(false);
          }, 800);
          return;
        }
        throw new Error('Error de conexión con el backend');
      }
      const data = await res.json();
      setDevices(data);
    } catch (err) {
      console.warn('Endpoint not ready, using mock data:', err.message);
      // Simulate network delay then set mock data
      setTimeout(() => {
        setDevices(mockDevices);
        setLoading(false);
        setIsRefreshing(false);
      }, 800);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const filteredDevices = useMemo(() => {
    return devices.filter(device => {
      const matchSearch = 
        device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchStatus = 
        selectedStatus === 'Todos' ? true :
        selectedStatus === 'En Línea' ? device.status === 'online' :
        selectedStatus === 'Desconectado' ? device.status === 'offline' :
        selectedStatus === 'Inestable' ? device.status === 'unstable' : true;
        
      return matchSearch && matchStatus;
    });
  }, [devices, searchTerm, selectedStatus]);

  const handleRefresh = () => {
    fetchDevices(true);
  };

  return (
    <div className="fade-in" style={{ paddingBottom: '2rem' }}>
      {/* Banner Temporal */}
      <div style={{ background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)', color: '#f97316', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'center', fontWeight: 'bold' }}>
        Desarrollo para la segunda etapa
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: '#fff', margin: 0, fontSize: '1.8rem' }}>Dispositivos y Nodos de Red</h2>
          <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0 0', fontSize: '0.95rem' }}>Monitorea el estado, salud y conectividad de cámaras y kioskos en tiempo real.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={handleRefresh}
            style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            disabled={isRefreshing || loading}
          >
            <RefreshCw size={18} className={isRefreshing ? "spin-animation" : ""} /> 
            Actualizar
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Video size={18} /> Añadir Nodo
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
          <h3 style={{ margin: '0 0 0.5rem 0' }}>Error de conexión</h3>
          <p style={{ margin: '0 0 1.5rem 0', color: '#fca5a5' }}>{error}</p>
          <button onClick={() => fetchDevices()} style={{ ...btnPrimary, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={16} /> Reintentar
          </button>
        </div>
      ) : loading ? (
        <div style={gridStyle}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ ...deviceCard, border: '1px solid #3f3f46' }}>
              <Skeleton height="24px" width="50%" style={{ marginBottom: '0.5rem' }} />
              <Skeleton height="14px" width="80%" style={{ marginBottom: '1.5rem' }} />
              <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1 }}><Skeleton height="30px" width="100%" /></div>
                <div style={{ flex: 1 }}><Skeleton height="30px" width="100%" /></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <Skeleton height="18px" width="100%" />
                <Skeleton height="18px" width="100%" />
                <Skeleton height="18px" width="100%" />
              </div>
              <Skeleton height="40px" width="100%" />
            </div>
          ))}
        </div>
      ) : filteredDevices.length === 0 ? (
        <div style={{ padding: '4rem 2rem', textAlign: 'center', background: '#1e1e1e', borderRadius: '12px', border: '1px solid #333' }}>
          <Server size={48} style={{ color: '#52525b', margin: '0 auto 1rem auto' }} />
          <h3 style={{ color: '#fff', margin: '0 0 0.5rem 0' }}>No se encontraron dispositivos</h3>
          <p style={{ color: '#a1a1aa', margin: '0 0 1.5rem 0' }}>Ajusta los filtros o añade un nuevo nodo a la red.</p>
          <button onClick={() => setIsAddModalOpen(true)} style={btnPrimary}>
            <Video size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}/> Añadir Nodo
          </button>
        </div>
      ) : (
        <div style={gridStyle}>
          {filteredDevices.map(device => {
            const isOnline = device.status === 'online';
            const isOffline = device.status === 'offline';
            const isUnstable = device.status === 'unstable';

            // Card Glowing and Colors
            let glowColor = '249, 115, 22'; // Naranja
            let badgeColor = '#f97316';
            let BadgeIcon = Wifi;
            let badgeText = 'En Línea';

            if (isOffline) {
              glowColor = '239, 68, 68'; // Rojo
              badgeColor = '#ef4444';
              BadgeIcon = Power;
              badgeText = 'Desconectado';
            } else if (isUnstable) {
              glowColor = '234, 179, 8'; // Amarillo
              badgeColor = '#eab308';
              BadgeIcon = AlertTriangle;
              badgeText = 'Inestable';
            }

            const cardStyle = {
              ...deviceCard,
              background: `linear-gradient(180deg, #18181b 0%, rgba(${glowColor}, 0.03) 100%)`,
              border: `1px solid rgba(${glowColor}, 0.15)`,
            };

            // Latency Color
            let latColor = '#f97316'; // normal = orange
            if (device.latency === 'Timeout') latColor = '#ef4444';
            else if (typeof device.latency === 'number' && device.latency >= 80) latColor = '#eab308';

            return (
              <div key={device.id} style={cardStyle}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', fontWeight: 600 }}>{device.name}</h3>
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
                <p style={{ color: '#a1a1aa', margin: '0 0 1.5rem 0', fontSize: '0.8rem' }}>{device.description}</p>

                {/* Network Data */}
                <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: '#52525b', marginBottom: '0.25rem' }}>Dirección IP</div>
                    <div style={{ color: '#fff', fontWeight: 500, fontSize: '0.9rem' }}>{device.ip}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: '#52525b', marginBottom: '0.25rem' }}>Ping Latencia</div>
                    <div style={{ color: latColor, fontWeight: 500, fontSize: '0.9rem' }}>
                      {typeof device.latency === 'number' ? `${device.latency}ms` : device.latency}
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem', flex: 1 }}>
                  <div style={metricRow}>
                    <span style={metricLabel}>Uptime:</span>
                    <span style={{ color: '#fff', fontSize: '0.9rem' }}>{device.uptime}</span>
                  </div>
                  <div style={metricRow}>
                    <span style={metricLabel}>Tasa de éxito:</span>
                    <span style={{ color: isOffline ? '#f97316' : (parseFloat(device.successRate) < 90 ? '#ef4444' : '#f97316'), fontSize: '0.9rem' }}>
                      {device.successRate}
                    </span>
                  </div>
                  <div style={metricRow}>
                    <span style={metricLabel}>Lecturas hoy:</span>
                    <span style={{ color: '#f97316', fontSize: '0.9rem' }}>{device.readsToday}</span>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto', opacity: isOffline ? 0.6 : 1 }}>
                  <button 
                    style={{ ...btnFeed, flex: 1, borderColor: `rgba(${glowColor}, 0.2)`, color: badgeColor }}
                    disabled={isOffline}
                    className={!isOffline ? "btn-hover-glow" : ""}
                  >
                    <Eye size={16} /> Feed
                  </button>
                  <button 
                    style={{ ...btnPower, borderColor: `rgba(${glowColor}, 0.2)` }}
                    disabled={isOffline}
                    className={!isOffline ? "btn-hover-glow" : ""}
                  >
                    <Power size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div style={modalOverlay}>
          <div style={modalContent} className="fade-in-up">
            <h3 style={{ margin: '0 0 1.5rem 0', color: '#fff', fontSize: '1.25rem' }}>Añadir Nuevo Nodo</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={modalLabel}>Nombre del dispositivo</label>
                <input type="text" placeholder="Ej. CAM-03" style={inputStyle} />
              </div>
              
              <div>
                <label style={modalLabel}>Tipo</label>
                <select style={inputStyle}>
                  <option value="camera">Cámara</option>
                  <option value="kiosk">Kiosko</option>
                  <option value="turnstile">Torniquete</option>
                </select>
              </div>
              
              <div>
                <label style={modalLabel}>Dirección IP</label>
                <input type="text" placeholder="Ej. 192.168.1.105" style={inputStyle} />
              </div>
              
              <div>
                <label style={modalLabel}>Descripción / Ubicación</label>
                <input type="text" placeholder="Ej. Cámara de Salida Norte" style={inputStyle} />
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button 
                style={btnSecondary} 
                onClick={() => setIsAddModalOpen(false)}
              >
                Cancelar
              </button>
              <button 
                style={btnPrimary}
                onClick={() => {
                  // Fake save
                  setIsAddModalOpen(false);
                }}
              >
                Guardar Nodo
              </button>
            </div>
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
        .btn-hover-glow:hover {
          background: rgba(255, 255, 255, 0.05) !important;
        }
        .fade-in-up {
          animation: fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
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
  right: 0, // Align right for status dropdown
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
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
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

const metricRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const metricLabel = {
  color: '#a1a1aa',
  fontSize: '0.85rem'
};

const btnFeed = {
  padding: '0.6rem 0',
  background: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  transition: 'all 0.2s'
};

const btnPower = {
  padding: '0.6rem 1rem',
  background: '#18181b',
  color: '#52525b',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s'
};

const modalOverlay = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  backdropFilter: 'blur(4px)'
};

const modalContent = {
  background: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: '16px',
  padding: '2rem',
  width: '100%',
  maxWidth: '500px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
};

const modalLabel = {
  display: 'block',
  color: '#a1a1aa',
  fontSize: '0.85rem',
  marginBottom: '0.5rem'
};

export default DevicesPage;
