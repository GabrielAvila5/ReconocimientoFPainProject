import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, AlertTriangle, XCircle, CheckCircle2, Check, Clock } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

const NotificationDropdown = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { markAsRead, markAllAsRead, refetch } = useNotifications();

  useEffect(() => {
    fetchNotifications();
  }, [activeTab]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const url = `/api/v1/notifications?limit=15${activeTab === 'unread' ? '&isRead=false' : ''}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'ERROR': return <XCircle size={18} style={{ color: 'var(--danger-red, #ef4444)' }} />;
      case 'WARNING': return <AlertTriangle size={18} style={{ color: 'var(--accent-amber, #f59e0b)' }} />;
      case 'SUCCESS': return <CheckCircle2 size={18} style={{ color: 'var(--success-green, #10b981)' }} />;
      case 'INFO':
      default: return <Info size={18} style={{ color: 'var(--info-blue, #3b82f6)' }} />;
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Justo ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    return `Hace ${diffDays} d`;
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
      // Actualizar estado local para que se refleje inmediatamente
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
    }
    
    if (notif.entityId) {
      console.log(`// TODO: deep link a ${notif.category}/${notif.entityId}`);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    refetch();
  };

  const handleViewAll = () => {
    navigate('/dashboard/notifications');
    onClose();
  };

  return (
    <div 
      style={{
        position: 'absolute',
        top: '60px',
        right: '2rem',
        width: '380px',
        background: 'rgba(15, 15, 15, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header & Tabs */}
      <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', fontWeight: 600 }}>Notificaciones</h3>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={() => setActiveTab('all')}
            style={{ 
              background: 'none', border: 'none', color: activeTab === 'all' ? 'var(--text-main)' : 'var(--text-muted)',
              fontSize: '0.85rem', fontWeight: activeTab === 'all' ? 600 : 400, cursor: 'pointer',
              borderBottom: activeTab === 'all' ? '2px solid var(--primary-orange)' : '2px solid transparent',
              paddingBottom: '0.5rem'
            }}
          >
            Todas
          </button>
          <button 
            onClick={() => setActiveTab('unread')}
            style={{ 
              background: 'none', border: 'none', color: activeTab === 'unread' ? 'var(--text-main)' : 'var(--text-muted)',
              fontSize: '0.85rem', fontWeight: activeTab === 'unread' ? 600 : 400, cursor: 'pointer',
              borderBottom: activeTab === 'unread' ? '2px solid var(--primary-orange)' : '2px solid transparent',
              paddingBottom: '0.5rem'
            }}
          >
            No leídas
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '0.5rem' }} className="custom-scrollbar">
        {loading ? (
          // Skeleton Loader
          [...Array(3)].map((_, i) => (
            <div key={i} style={{ padding: '1rem', display: 'flex', gap: '1rem', opacity: 0.5 }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ width: '80%', height: '14px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
                <div style={{ width: '60%', height: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
              </div>
            </div>
          ))
        ) : notifications.length === 0 ? (
          // Empty State
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Bell className="mx-auto mb-2 opacity-50" size={32} />
            <p>No tienes notificaciones</p>
          </div>
        ) : (
          notifications.map(notif => (
            <div 
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              style={{
                display: 'flex',
                gap: '1rem',
                padding: '1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'background 0.2s ease',
                opacity: notif.isRead ? 0.6 : 1,
                position: 'relative'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {!notif.isRead && (
                <div style={{ position: 'absolute', left: '0.4rem', top: '50%', transform: 'translateY(-50%)', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-orange)' }} />
              )}
              
              <div style={{ 
                width: '36px', height: '36px', borderRadius: '50%', 
                background: 'rgba(255,255,255,0.05)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}>
                {getIcon(notif.type)}
              </div>
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.2rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {notif.title}
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', lineHeight: 1.4 }}>
                  {notif.message.length > 60 ? notif.message.substring(0, 60) + '...' : notif.message}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <Clock size={12} />
                  <span>{formatTime(notif.createdAt)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
        <button 
          onClick={handleMarkAllRead}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <Check size={14} /> Marcar todas leídas
        </button>
        <button 
          onClick={handleViewAll}
          style={{ background: 'none', border: 'none', color: 'var(--primary-orange)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
          onMouseEnter={(e) => e.currentTarget.style.textShadow = '0 0 8px rgba(249, 115, 22, 0.5)'}
          onMouseLeave={(e) => e.currentTarget.style.textShadow = 'none'}
        >
          Ver todas
        </button>
      </div>
    </div>
  );
};

// Se importa Bell solo para el empty state
import { Bell } from 'lucide-react';

export default NotificationDropdown;
