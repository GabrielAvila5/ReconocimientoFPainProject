import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Clock, Calendar, FileText, Monitor, Bell, Settings, LogOut, Maximize, Menu, X } from 'lucide-react';
import { Toaster } from 'sonner';
import { useNotifications } from '../contexts/NotificationContext';
import NotificationDropdown from '../components/NotificationDropdown';

const DashboardLayout = () => {
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [bellAnim, setBellAnim] = useState(false);
  const prevUnreadRef = useRef(unreadCount);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setBellAnim(true);
      setTimeout(() => setBellAnim(false), 400);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const navItemsPrincipal = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} /> },
    { name: 'Empleados', path: '/dashboard/employees', icon: <Users size={18} /> },
    { name: 'Asistencia', path: '/dashboard/attendance', icon: <Clock size={18} /> },
    { name: 'Calendario', path: '/dashboard/calendar', icon: <Calendar size={18} /> },
    { name: 'Reportes', path: '/dashboard/reports', icon: <FileText size={18} />, badge: 3 },
  ];

  const navItemsSistema = [
    { name: 'Dispositivos', path: '/dashboard/devices', icon: <Monitor size={18} /> },
    { name: 'Notificaciones', path: '/dashboard/notifications', icon: <Bell size={18} />, badge: 5 },
    { name: 'Configuración', path: '/dashboard/settings', icon: <Settings size={18} /> },
  ];

  return (
    <div className="app-container">
      {/* Mobile Overlay */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`} style={{ width: 'var(--sidebar-width)', backgroundColor: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        {/* Logo Area */}
        <div style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ backgroundColor: 'var(--primary-orange)', padding: '0.5rem', borderRadius: '8px', color: 'white' }}>
              <Monitor size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.9rem', lineHeight: '1.2' }}>Sistema de entrada salida<br/>PAIN</h3>
              <p className="text-xs text-muted">Sistema de Gestión</p>
            </div>
          </div>
          {/* Close button for mobile */}
          <button 
            className="show-mobile"
            onClick={() => setIsSidebarOpen(false)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1rem' }}>
          <div style={{ marginBottom: '2rem' }}>
            <p className="text-xs text-muted font-semibold" style={{ marginBottom: '1rem', paddingLeft: '0.5rem' }}>PRINCIPAL</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {navItemsPrincipal.map(item => (
                <NavLink 
                  key={item.name} 
                  to={item.path}
                  end={item.path === '/dashboard'}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.75rem 1rem', borderRadius: '12px', textDecoration: 'none',
                    color: isActive ? 'var(--primary-orange)' : 'var(--text-muted)',
                    background: isActive ? 'linear-gradient(90deg, rgba(249, 115, 22, 0.15) 0%, rgba(20, 20, 20, 0) 100%)' : 'transparent',
                    border: isActive ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent',
                    boxShadow: isActive ? '0 0 15px rgba(245, 158, 11, 0.15)' : 'none',
                    fontWeight: isActive ? 600 : 500,
                    transition: 'all 0.2s ease'
                  })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {item.icon}
                    <span style={{ fontSize: '0.9rem' }}>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span style={{ backgroundColor: 'var(--primary-orange)', color: 'white', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '99px', fontWeight: 'bold' }}>
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted font-semibold" style={{ marginBottom: '1rem', paddingLeft: '0.5rem' }}>SISTEMA</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {navItemsSistema.map(item => (
                <NavLink 
                  key={item.name} 
                  to={item.path}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.75rem 1rem', borderRadius: '12px', textDecoration: 'none',
                    color: isActive ? 'var(--primary-orange)' : 'var(--text-muted)',
                    background: isActive ? 'linear-gradient(90deg, rgba(249, 115, 22, 0.15) 0%, rgba(20, 20, 20, 0) 100%)' : 'transparent',
                    border: isActive ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent',
                    boxShadow: isActive ? '0 0 15px rgba(245, 158, 11, 0.15)' : 'none',
                    fontWeight: isActive ? 600 : 500,
                    transition: 'all 0.2s ease'
                  })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {item.icon}
                    <span style={{ fontSize: '0.9rem' }}>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span style={{ backgroundColor: 'var(--primary-orange)', color: 'white', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '99px', fontWeight: 'bold' }}>
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

        {/* User Profile Footer */}
        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--accent-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--bg-main)', flexShrink: 0 }}>
            JD
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Juan Domínguez</h4>
            <p className="text-xs text-muted">Administrador</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="page-glow" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {/* Topbar */}
        <header className="topbar" style={{ position: 'relative', zIndex: 50, height: '70px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              className="show-mobile"
              onClick={() => setIsSidebarOpen(true)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <Menu size={24} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }} className="hidden-mobile">
              <span>Inicio</span>
              <span>/</span>
              <span style={{ color: 'var(--text-main)' }}>Dashboard</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <button onClick={() => window.open('/kiosk', '_blank')} className="btn-primary hidden-mobile">
              <Maximize size={16} /> Abrir Kiosko
            </button>
            <div 
              ref={dropdownRef}
              style={{ position: 'relative', cursor: 'pointer' }}
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <div style={{ transform: bellAnim ? 'rotate(15deg)' : 'none', transition: 'transform 0.1s ease', animation: bellAnim ? 'bell-shake 0.4s ease' : 'none' }}>
                <Bell size={20} className={unreadCount > 0 ? "text-main" : "text-muted"} />
              </div>
              {unreadCount > 0 && (
                <span style={{ 
                  position: 'absolute', top: -6, right: -6, 
                  backgroundColor: 'var(--primary-orange)', 
                  color: 'white', fontSize: '0.65rem', fontWeight: 'bold',
                  height: '16px', minWidth: '16px', padding: '0 4px',
                  borderRadius: '99px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              {showNotifications && (
                <NotificationDropdown onClose={() => setShowNotifications(false)} />
              )}
            </div>
          </div>
        </header>

        <style>{`
          @keyframes bell-shake {
            0%, 100% { transform: rotate(0deg); }
            20% { transform: rotate(-12deg); }
            40% { transform: rotate(12deg); }
            60% { transform: rotate(-8deg); }
            80% { transform: rotate(8deg); }
          }
        `}</style>

        {/* Page Content */}
        <div className="page-content" style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', padding: '2rem' }}>
          <Outlet />
        </div>
      </main>
      <Toaster theme="dark" position="top-right" />
    </div>
  );
};

export default DashboardLayout;
