import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Trash2, UserPlus, AlertTriangle, X, Shield, Plus, Clock } from 'lucide-react';
import { toast } from 'sonner';

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
  color: '#e4e4e7',
  borderBottom: '1px solid #333'
};

const AdminManager = () => {
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'logs'
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [adminsRes, logsRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/api/v1/admins`),
        fetch(`${import.meta.env.VITE_API_URL}/api/v1/admins/audit-log`)
      ]);
      
      if (adminsRes.ok) setAdmins(await adminsRes.json());
      if (logsRes.ok) setAuditLogs(await logsRes.json());
    } catch (error) {
      console.error('Error fetching admins data:', error);
      toast.error('Error al cargar datos de administradores');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Error al crear administrador');
      }
      
      toast.success('Administrador creado exitosamente');
      setShowAddModal(false);
      setFormData({ name: '', email: '', password: '' });
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!showDeleteConfirm) return;
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admins/${showDeleteConfirm.id}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al eliminar administrador');
      }
      
      toast.success('Administrador eliminado exitosamente');
      setShowDeleteConfirm(null);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center" style={{ backgroundColor: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <Shield size={48} className="text-muted mb-4" />
        <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Acceso Denegado</h3>
        <p className="text-muted">No tienes permisos para gestionar cuentas de administrador. Solo el Super Administrador puede acceder a esta sección.</p>
      </div>
    );
  }

  return (
    <div className="admin-manager">
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button 
          onClick={() => setActiveTab('list')}
          style={{
            background: activeTab === 'list' ? 'linear-gradient(135deg, var(--primary-orange) 0%, var(--primary-orange-hover) 100%)' : 'transparent',
            color: activeTab === 'list' ? 'white' : 'var(--text-muted)',
            padding: '0.6rem 1.25rem',
            borderRadius: '12px',
            border: activeTab === 'list' ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--border-color)',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
        >
          Lista de Administradores
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          style={{
            background: activeTab === 'logs' ? 'linear-gradient(135deg, var(--primary-orange) 0%, var(--primary-orange-hover) 100%)' : 'transparent',
            color: activeTab === 'logs' ? 'white' : 'var(--text-muted)',
            padding: '0.6rem 1.25rem',
            borderRadius: '12px',
            border: activeTab === 'logs' ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--border-color)',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
        >
          Historial de Auditoría
        </button>
      </div>

      {activeTab === 'list' && (
        <div className="settings-card page-glow">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', margin: 0 }}>Gestión de Cuentas</h3>
            <button className="btn-primary" onClick={() => setShowAddModal(true)}>
              <UserPlus size={16} /> Nuevo Administrador
            </button>
          </div>
          
          {loading ? (
            <p className="text-muted">Cargando administradores...</p>
          ) : (
            <div className="table-responsive">
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Nombre</th>
                    <th style={thStyle}>Correo</th>
                    <th style={thStyle}>Rol</th>
                    <th style={thStyle}>Creado por</th>
                    <th style={thStyle}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map(admin => (
                    <tr key={admin.id}>
                      <td style={tdStyle}>{admin.name}</td>
                      <td style={tdStyle}>{admin.email}</td>
                      <td style={tdStyle}>
                        <span style={{ 
                          padding: '0.2rem 0.5rem', 
                          borderRadius: '4px', 
                          fontSize: '0.8rem',
                          backgroundColor: admin.role === 'SUPER_ADMIN' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          color: admin.role === 'SUPER_ADMIN' ? '#fbbf24' : '#60a5fa'
                        }}>
                          {admin.role}
                        </span>
                      </td>
                      <td style={tdStyle}>{admin.createdByUser?.name || '-'}</td>
                      <td style={tdStyle}>
                        {admin.role === 'ADMIN' && (
                          <button 
                            className="btn-icon" 
                            style={{ color: 'var(--status-danger)' }}
                            onClick={() => setShowDeleteConfirm(admin)}
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {admins.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center text-muted" style={{ padding: '2rem' }}>No hay administradores registrados</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="settings-card page-glow">
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '1.5rem' }}>Historial de Auditoría</h3>
          {loading ? (
            <p className="text-muted">Cargando historial...</p>
          ) : (
            <div className="table-responsive">
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Acción</th>
                    <th style={thStyle}>Ejecutado por</th>
                    <th style={thStyle}>Objetivo (Nombre)</th>
                    <th style={thStyle}>Objetivo (Correo)</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id}>
                      <td style={tdStyle}>{new Date(log.timestamp).toLocaleString()}</td>
                      <td style={tdStyle}>
                        <span style={{ 
                          padding: '0.2rem 0.5rem', 
                          borderRadius: '4px', 
                          fontSize: '0.8rem',
                          backgroundColor: log.action === 'CREATE_ADMIN' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: log.action === 'CREATE_ADMIN' ? '#34d399' : '#f87171'
                        }}>
                          {log.action === 'CREATE_ADMIN' ? 'CREACIÓN' : 'ELIMINACIÓN'}
                        </span>
                      </td>
                      <td style={tdStyle}>{log.performedByName}</td>
                      <td style={tdStyle}>{log.targetName}</td>
                      <td style={tdStyle}>{log.targetEmail}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center text-muted" style={{ padding: '2rem' }}>No hay registros de auditoría</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content page-glow" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--text-main)', margin: 0 }}>Agregar Administrador</h3>
              <button className="btn-icon" onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddAdmin} style={{ marginTop: '1.5rem' }}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nombre Completo</label>
                <input 
                  type="text" 
                  className="auth-input" 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-main)' }}
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Correo Electrónico</label>
                <input 
                  type="email" 
                  className="auth-input" 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-main)' }}
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Contraseña</label>
                <input 
                  type="password" 
                  className="auth-input" 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-main)' }}
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  minLength={8}
                  required
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Mínimo 8 caracteres</p>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)} disabled={formLoading}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={formLoading}>
                  {formLoading ? 'Guardando...' : 'Crear Administrador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content page-glow" style={{ maxWidth: '400px' }}>
            <div className="modal-header" style={{ borderBottom: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--status-danger)' }}>
                <AlertTriangle size={24} />
                <h3 style={{ margin: 0 }}>Confirmar Eliminación</h3>
              </div>
            </div>
            
            <p style={{ color: 'var(--text-muted)', margin: '1rem 0' }}>
              ¿Estás seguro de que deseas eliminar al administrador <strong>{showDeleteConfirm.name}</strong> ({showDeleteConfirm.email})?<br/><br/>Esta acción no se puede deshacer.
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(null)}>
                Cancelar
              </button>
              <button className="btn-primary" style={{ backgroundColor: 'var(--status-danger)', borderColor: 'var(--status-danger)' }} onClick={handleDeleteAdmin}>
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManager;
