import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Trash2, 
  UserPlus, 
  AlertTriangle, 
  X, 
  Shield, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Camera, 
  UserCheck, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.9rem',
  minWidth: '850px'
};

const thStyle = {
  padding: '1.25rem 1.25rem',
  textAlign: 'left',
  fontWeight: 600,
  color: '#a1a1aa'
};

const tdStyle = {
  padding: '1rem 1.25rem',
  color: '#e4e4e7',
  borderBottom: '1px solid #333'
};

const AdminManager = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [admins, setAdmins] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'logs'
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    confirmPassword: '',
    departmentId: '',
    identifier: '',
    position: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
      const token = localStorage.getItem('token');
      const [adminsRes, logsRes, deptRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/api/v1/admins`, { credentials: 'include' }),
        fetch(`${import.meta.env.VITE_API_URL}/api/v1/admins/audit-log`, { credentials: 'include' }),
        fetch(`${import.meta.env.VITE_API_URL}/api/v1/departments`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        })
      ]);
      
      if (adminsRes.ok) setAdmins(await adminsRes.json());
      if (logsRes.ok) setAuditLogs(await logsRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());
    } catch (error) {
      console.error('Error fetching admins data:', error);
      toast.error('Error al cargar datos de administradores');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncUsers = async () => {
    try {
      setSyncLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admins/sync-users`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar');
      toast.success(data.message || 'Administradores sincronizados con éxito');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      return toast.error('Las contraseñas no coinciden');
    }
    
    setFormLoading(true);
    try {
      const { confirmPassword, ...apiData } = formData;
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(apiData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Error al crear administrador');
      }
      
      toast.success('Administrador y usuario del sistema creados exitosamente');
      setShowAddModal(false);
      setFormData({ 
        name: '', 
        email: '', 
        password: '', 
        confirmPassword: '',
        departmentId: '',
        identifier: '',
        position: ''
      });
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
        method: 'DELETE',
        credentials: 'include'
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
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', margin: 0 }}>Gestión de Cuentas y Personal Administrativo</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.35rem 0 0 0' }}>
                Todos los administradores se registran automáticamente como usuarios en Gestión de Personal con soporte biométrico.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button 
                className="btn-secondary" 
                onClick={handleSyncUsers} 
                disabled={syncLoading}
                title="Asegura que todos los administradores existan como usuarios de personal"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.6rem 1rem' }}
              >
                <RefreshCw size={15} className={syncLoading ? 'spin' : ''} />
                {syncLoading ? 'Sincronizando...' : 'Sincronizar con Personal'}
              </button>
              <button className="btn-primary" onClick={() => setShowAddModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.6rem 1rem' }}>
                <UserPlus size={16} /> Nuevo Administrador
              </button>
            </div>
          </div>
          
          {loading ? (
            <p className="text-muted">Cargando administradores...</p>
          ) : (
            <div className="table-responsive-wrapper">
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Nombre y Correo</th>
                    <th style={thStyle}>Rol</th>
                    <th style={thStyle}>Personal (DNI / Depto)</th>
                    <th style={thStyle}>Biometría Facial</th>
                    <th style={thStyle}>Creado por</th>
                    <th style={thStyle}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map(admin => {
                    const emp = admin.employee;
                    const isEnrolled = emp?.isEnrolled;

                    return (
                      <tr key={admin.id}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 500, color: '#fff' }}>{admin.name}</div>
                          <div style={{ color: '#a1a1aa', fontSize: '0.8rem', marginTop: '2px' }}>{admin.email}</div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ 
                            padding: '0.2rem 0.5rem', 
                            borderRadius: '4px', 
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: admin.role === 'SUPER_ADMIN' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                            color: admin.role === 'SUPER_ADMIN' ? '#fbbf24' : '#60a5fa'
                          }}>
                            {admin.role}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {emp ? (
                            <div>
                              <div style={{ color: '#fff', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                                {emp.identifier}
                              </div>
                              <div style={{ color: '#a1a1aa', fontSize: '0.75rem', marginTop: '2px' }}>
                                {emp.department || 'Administración'} • {emp.position || 'Administrador'}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>Sin vincular</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {emp ? (
                            isEnrolled ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.6rem', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '0.75rem', fontWeight: 500 }}>
                                <CheckCircle2 size={13} /> Enrolado
                              </div>
                            ) : (
                              <button
                                onClick={() => navigate(`/kiosk/enroll/${emp.id}`)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  padding: '0.25rem 0.6rem',
                                  borderRadius: '999px',
                                  background: 'rgba(249, 115, 22, 0.15)',
                                  color: '#f97316',
                                  border: '1px solid rgba(249, 115, 22, 0.3)',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                                title="Hacer clic para enrolar biometría facial"
                              >
                                <Camera size={13} /> Enrolar Rostro
                              </button>
                            )
                          ) : (
                            <span style={{ color: '#71717a', fontSize: '0.75rem' }}>No disponible</span>
                          )}
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
                    );
                  })}
                  {admins.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center text-muted" style={{ padding: '2rem' }}>No hay administradores registrados</td>
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
            <div className="table-responsive-wrapper">
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
          <div className="modal-content page-glow" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--text-main)', margin: 0 }}>Agregar Administrador</h3>
              <button className="btn-icon" onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>

            {/* Informative banner */}
            <div style={{ margin: '1rem 0 0.5rem', padding: '0.85rem 1rem', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.25)', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <UserCheck size={20} style={{ color: 'var(--primary-orange)', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.8rem', color: '#e4e4e7', lineHeight: '1.4' }}>
                <strong style={{ color: '#fff' }}>Registro automático en Personal:</strong> Este administrador aparecerá también como usuario en el sistema para control de asistencias y reconocimiento facial.
              </div>
            </div>
            
            <form onSubmit={handleAddAdmin} style={{ marginTop: '1rem' }}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nombre Completo *</label>
                <input 
                  type="text" 
                  className="auth-input" 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-main)' }}
                  placeholder="Ej. Carlos Mendoza"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Correo Electrónico *</label>
                <input 
                  type="email" 
                  className="auth-input" 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-main)' }}
                  placeholder="admin@empresa.com"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Departamento</label>
                  <select
                    className="auth-input"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(30,30,30,0.95)', color: 'var(--text-main)' }}
                    value={formData.departmentId}
                    onChange={e => setFormData({...formData, departmentId: e.target.value})}
                  >
                    <option value="">ADMINISTRACION (Por defecto)</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Identificador / DNI</label>
                  <input 
                    type="text" 
                    className="auth-input" 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-main)' }}
                    placeholder="Automático (ADM-...)"
                    value={formData.identifier}
                    onChange={e => setFormData({...formData, identifier: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Contraseña *</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    className="auth-input" 
                    style={{ width: '100%', padding: '0.75rem 2.5rem 0.75rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-main)' }}
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.5)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      zIndex: 10
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Mínimo 8 caracteres</p>
              </div>
              
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Confirmar Contraseña *</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    className="auth-input" 
                    style={{ width: '100%', padding: '0.75rem 2.5rem 0.75rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-main)' }}
                    value={formData.confirmPassword}
                    onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.5)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      zIndex: 10
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
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
              ¿Estás seguro de que deseas eliminar al administrador <strong>{showDeleteConfirm.name}</strong> ({showDeleteConfirm.email})?<br/><br/>Esta acción también retirará su usuario de personal.
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
