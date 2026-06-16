import React, { useState, useEffect } from 'react';
import { 
  Bell, AlertTriangle, XCircle, CheckCircle2, Info, 
  Search, Filter, Check, Trash2, ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // 'read' or 'unread'
  
  // Stats
  const [stats, setStats] = useState({ total: 0, unread: 0, errors: 0, warnings: 0 });
  const [deletingId, setDeletingId] = useState(null);

  const { markAsRead, markAllAsRead, deleteNotification, deleteReadNotifications, refetch } = useNotifications();

  useEffect(() => {
    fetchNotifications();
  }, [page, typeFilter, statusFilter]);

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/v1/notifications?page=${page}&limit=20`;
      if (typeFilter) url += `&type=${typeFilter}`;
      if (statusFilter === 'read') url += '&isRead=true';
      if (statusFilter === 'unread') url += '&isRead=false';

      const response = await fetch(url);
      if (!response.ok) throw new Error('Error al cargar notificaciones');
      
      const data = await response.json();
      setNotifications(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);

      // Calcular stats básicos basados en la página actual
      setStats({
        total: data.total,
        unread: data.data.filter(n => !n.isRead).length, // Estimación local por ahora
        errors: data.data.filter(n => n.type === 'ERROR').length,
        warnings: data.data.filter(n => n.type === 'WARNING').length,
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    await markAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    refetch();
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    setTimeout(async () => {
      await deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setDeletingId(null);
    }, 200); // Wait for animation
  };

  const handleDeleteRead = async () => {
    await deleteReadNotifications();
    fetchNotifications(); // Reload
    refetch();
  };

  const filteredNotifications = notifications.filter(n => {
    const term = searchTerm.toLowerCase();
    return n.title.toLowerCase().includes(term) || n.message.toLowerCase().includes(term);
  });

  const getIcon = (type) => {
    switch (type) {
      case 'ERROR': return <XCircle size={18} style={{ color: '#ef4444' }} />;
      case 'WARNING': return <AlertTriangle size={18} style={{ color: '#eab308' }} />;
      case 'SUCCESS': return <CheckCircle2 size={18} style={{ color: '#10b981' }} />;
      case 'INFO':
      default: return <Info size={18} style={{ color: '#3b82f6' }} />;
    }
  };
  
  const getCategoryStyle = (cat) => {
    switch(cat.toUpperCase()) {
      case 'SYSTEM': return { color: '#10b981', background: 'rgba(16,185,129,0.15)' };
      case 'DEVICE': return { color: '#3b82f6', background: 'rgba(59,130,246,0.15)' };
      case 'ATTENDANCE': return { color: '#eab308', background: 'rgba(234,179,8,0.15)' };
      case 'SECURITY': return { color: '#ef4444', background: 'rgba(239,68,68,0.15)' };
      default: return { color: 'var(--text-muted)', background: 'rgba(255,255,255,0.1)' };
    }
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('es-ES', { 
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>
      {/* Header en una sola fila */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, letterSpacing: '-0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
              <Bell size={24} style={{ color: 'var(--text-main)' }} />
            </div>
            CENTRO DE NOTIFICACIONES
          </h1>
          <p className="text-muted" style={{ margin: '0.5rem 0 0 0' }}>Gestiona las alertas y eventos del sistema</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={handleDeleteRead} style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Trash2 size={16} /> Eliminar leídas
          </button>
          <button onClick={handleMarkAllAsRead} style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Check size={16} /> Marcar todas leídas
          </button>
        </div>
      </header>

      {/* Cards de Resumen Rediseñadas (usando clases globales) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
        {/* Total Notificaciones - Azul */}
        <div className="card card-glow-blue" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '170px', padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-muted text-sm font-semibold" style={{ letterSpacing: '1px' }}>TOTAL NOTIFICACIONES</span>
            <div className="icon-box" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
              <Bell size={18} style={{ color: '#3b82f6' }} />
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: '2rem', color: '#3b82f6', lineHeight: '1', margin: '0' }}>{stats.total}</h2>
          </div>
        </div>

        {/* No Leídas - Naranja */}
        <div className="card card-glow" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '170px', padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-muted text-sm font-semibold" style={{ letterSpacing: '1px' }}>NO LEÍDAS</span>
            <div className="icon-box" style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)' }}>
              <Bell size={18} style={{ color: '#f97316' }} />
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: '2rem', color: '#f97316', lineHeight: '1', margin: '0' }}>{stats.unread}</h2>
          </div>
        </div>

        {/* Errores Recientes - Rojo */}
        <div className="card card-glow-red" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '170px', padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-muted text-sm font-semibold" style={{ letterSpacing: '1px' }}>ERRORES RECIENTES</span>
            <div className="icon-box" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
              <XCircle size={18} style={{ color: '#ef4444' }} />
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: '2rem', color: '#ef4444', lineHeight: '1', margin: '0' }}>{stats.errors}</h2>
          </div>
        </div>

        {/* Advertencias - Amarillo */}
        <div className="card card-glow-yellow" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '170px', padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-muted text-sm font-semibold" style={{ letterSpacing: '1px' }}>ADVERTENCIAS</span>
            <div className="icon-box" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)' }}>
              <AlertTriangle size={18} style={{ color: '#eab308' }} />
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: '2rem', color: '#eab308', lineHeight: '1', margin: '0' }}>{stats.warnings}</h2>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="table-container" style={{ display: 'flex', flexDirection: 'column', flex: 1, background: '#1e1e1e', borderRadius: '12px', border: '1px solid #333' }}>
        
        {/* Barra de Filtros */}
        <div style={{ display: 'flex', gap: '12px', padding: '1.5rem', borderBottom: '1px solid #333', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} className="text-muted" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Buscar notificación..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                width: '100%', height: '40px', paddingLeft: '2.5rem', 
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '8px', color: '#fff', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
          
          <select 
            value={typeFilter} 
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            style={{
              width: '160px', height: '40px', padding: '0 1rem',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', color: '#fff', outline: 'none', cursor: 'pointer'
            }}
          >
            <option value="" style={{ background: '#1e1e1e' }}>Todos los Tipos</option>
            <option value="INFO" style={{ background: '#1e1e1e' }}>Información</option>
            <option value="WARNING" style={{ background: '#1e1e1e' }}>Advertencias</option>
            <option value="ERROR" style={{ background: '#1e1e1e' }}>Errores</option>
            <option value="SUCCESS" style={{ background: '#1e1e1e' }}>Éxitos</option>
          </select>
          
          <select 
            value={statusFilter} 
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{
              width: '160px', height: '40px', padding: '0 1rem',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', color: '#fff', outline: 'none', cursor: 'pointer'
            }}
          >
            <option value="" style={{ background: '#1e1e1e' }}>Cualquier estado</option>
            <option value="unread" style={{ background: '#1e1e1e' }}>No leídas</option>
            <option value="read" style={{ background: '#1e1e1e' }}>Leídas</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#18181b', borderBottom: '1px solid #333' }}>
                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'left', color: '#a1a1aa', fontWeight: 600 }}>Tipo</th>
                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'left', color: '#a1a1aa', fontWeight: 600 }}>Mensaje</th>
                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'left', color: '#a1a1aa', fontWeight: 600 }}>Categoría</th>
                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'left', color: '#a1a1aa', fontWeight: 600 }}>Fecha/Hora</th>
                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center', color: '#a1a1aa', fontWeight: 600 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" style={{ padding: '2rem', textAlign: 'center' }}>
                    <RefreshCw className="spin text-muted" size={24} style={{ margin: '0 auto' }} />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="5" style={{ padding: '2rem', textAlign: 'center' }}>
                    <div className="text-danger-red" style={{ marginBottom: '1rem' }}>{error}</div>
                    <button onClick={fetchNotifications} style={btnSecondary}>Reintentar</button>
                  </td>
                </tr>
              ) : filteredNotifications.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No se encontraron notificaciones
                  </td>
                </tr>
              ) : (
                filteredNotifications.map(notif => (
                  <tr 
                    key={notif.id} 
                    style={{ 
                      borderBottom: '1px solid #333',
                      borderLeft: !notif.isRead ? '3px solid #f97316' : '3px solid transparent',
                      transition: 'all 0.2s ease',
                      opacity: deletingId === notif.id ? 0 : (notif.isRead ? 0.6 : 1),
                      height: deletingId === notif.id ? 0 : 'auto',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => { if(deletingId !== notif.id) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={(e) => { if(deletingId !== notif.id) e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    {/* Tipo */}
                    <td style={{ padding: '1rem 1.5rem', width: '120px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {getIcon(notif.type)}
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{notif.type}</span>
                      </div>
                    </td>
                    
                    {/* Mensaje */}
                    <td style={{ padding: '1rem 1.5rem', maxWidth: '300px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                        {notif.title}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#a1a1aa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {notif.message}
                      </div>
                    </td>

                    {/* Categoría */}
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span style={{ 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        fontSize: '0.7rem', 
                        textTransform: 'uppercase', 
                        fontWeight: 600,
                        ...getCategoryStyle(notif.category)
                      }}>
                        {notif.category}
                      </span>
                    </td>

                    {/* Fecha/Hora */}
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#a1a1aa' }}>
                      {formatDateTime(notif.createdAt)}
                    </td>

                    {/* Acciones */}
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                        {!notif.isRead && (
                          <button 
                            onClick={() => handleMarkAsRead(notif.id)}
                            style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: 0 }}
                            title="Marcar como leída"
                          >
                            <Check size={18} />
                          </button>
                        )}
                        <button 
                          onClick={() => handleDelete(notif.id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                          title="Eliminar"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="text-sm" style={{ color: '#a1a1aa' }}>
            Mostrando {(page - 1) * 20 + 1} a {Math.min(page * 20, total)} de {total} notificaciones
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              style={{ ...btnSecondary, padding: '0.5rem', border: '1px solid #3f3f46', background: '#1e1e1e', color: '#e4e4e7', borderRadius: '8px' }}
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              style={{ ...btnSecondary, padding: '0.5rem', border: '1px solid #3f3f46', background: '#1e1e1e', color: '#e4e4e7', borderRadius: '8px' }}
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

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

export default NotificationsPage;
