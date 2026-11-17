import React, { useState, useEffect, useMemo } from 'react';
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
  CheckCircle2,
  Lock,
  ShieldCheck,
  ArrowUpRight
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
  const [showPromoteConfirm, setShowPromoteConfirm] = useState(null);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'promote'
  const [selectedAdminToPromote, setSelectedAdminToPromote] = useState('');
  const [promoteLoading, setPromoteLoading] = useState(false);
  
  const initialFormData = { 
    name: '', 
    email: '', 
    password: '', 
    confirmPassword: '',
    role: 'ADMIN',
    departmentId: '',
    identifier: '',
    position: '',
    syncEmployee: false
  };

  const [formData, setFormData] = useState(initialFormData);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Validación de contexto: Determina si el entorno activo es la empresa raíz PAIN
  const isPainCompany = useMemo(() => {
    const activeTenant = localStorage.getItem('tenantId');
    if (activeTenant && activeTenant !== 'default-company-pain') {
      return false;
    }
    if (user?.company?.slug && user.company.slug !== 'pain') {
      return false;
    }
    if (user?.companyId && user.companyId !== 'default-company-pain') {
      return false;
    }
    return true;
  }, [user]);

  // Regla Zero-Trust: Solo un Super Administrador en la empresa PAIN puede generar otros Super Administradores
  const canCreateSuperAdmin = user?.role === 'SUPER_ADMIN' && isPainCompany;

  // Administradores existentes que pueden ser ascendidos a Super Administrador
  const promotableAdmins = useMemo(() => {
    return (admins || []).filter(a => a.role !== 'SUPER_ADMIN');
  }, [admins]);

  const handlePromoteAdmin = async (targetId) => {
    const adminId = targetId || selectedAdminToPromote;
    if (!adminId) {
      return toast.error('Por favor selecciona un administrador para ascender');
    }

    setPromoteLoading(true);
    try {
      const authHeader = getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/v1/admins/${adminId}/promote`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Error al ascender administrador');
      }

      toast.success(data.message || 'Administrador ascendido a Super Administrador exitosamente');
      setShowPromoteConfirm(null);
      setShowAddModal(false);
      setSelectedAdminToPromote('');
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPromoteLoading(false);
    }
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    const tenantId = localStorage.getItem('tenantId');
    return {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(tenantId ? { 'x-tenant-id': tenantId } : {})
    };
  };

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN' || user?.role === 'CORPORATE_ADMIN' || user?.role === 'ADMIN') {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const authHeader = getAuthHeaders();
      const [adminsRes, logsRes, deptRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL || ""}/api/v1/admins`, { 
          headers: authHeader,
          credentials: 'include' 
        }),
        fetch(`${import.meta.env.VITE_API_URL || ""}/api/v1/admins/audit-log`, { 
          headers: authHeader,
          credentials: 'include' 
        }),
        fetch(`${import.meta.env.VITE_API_URL || ""}/api/v1/departments`, {
          headers: authHeader
        })
      ]);
      
      if (adminsRes.ok) {
        const data = await adminsRes.json();
        setAdmins(Array.isArray(data) ? data : []);
      }
      if (logsRes.ok) {
        const data = await logsRes.json();
        setAuditLogs(Array.isArray(data) ? data : []);
      }
      if (deptRes.ok) {
        const data = await deptRes.json();
        setDepartments(Array.isArray(data) ? data : (Array.isArray(data?.departments) ? data.departments : []));
      }
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
      const authHeader = getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/v1/admins/sync-users`, {
        method: 'POST',
        headers: authHeader,
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

    if (formData.role === 'SUPER_ADMIN' && !canCreateSuperAdmin) {
      return toast.error('No tienes autorización para generar Super Administradores fuera de la empresa PAIN');
    }
    
    setFormLoading(true);
    try {
      const authHeader = getAuthHeaders();
      const { confirmPassword, ...apiData } = formData;
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/v1/admins`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeader
        },
        credentials: 'include',
        body: JSON.stringify(apiData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Error al crear administrador');
      }
      
      const successMessage = apiData.role === 'SUPER_ADMIN'
        ? 'Super Administrador de la empresa PAIN generado exitosamente'
        : 'Administrador creado exitosamente';
      toast.success(successMessage);
      setShowAddModal(false);
      setFormData(initialFormData);
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
      const authHeader = getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/v1/admins/${showDeleteConfirm.id}`, {
        method: 'DELETE',
        headers: authHeader,
        credentials: 'include'
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || data.message || 'Error al eliminar administrador');
      }
      
      toast.success('Administrador eliminado exitosamente');
      setShowDeleteConfirm(null);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (user && !['SUPER_ADMIN', 'CORPORATE_ADMIN', 'ADMIN'].includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center" style={{ backgroundColor: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <Shield size={48} className="text-muted mb-4" />
        <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Acceso Denegado</h3>
        <p className="text-muted">No tienes permisos para gestionar cuentas de administrador.</p>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', margin: 0 }}>Gestión de Cuentas y Personal Administrativo</h3>
                {isPainCompany && (
                  <span style={{ 
                    fontSize: '0.72rem', 
                    padding: '0.15rem 0.5rem', 
                    borderRadius: '999px', 
                    background: 'rgba(245, 158, 11, 0.15)', 
                    color: '#fbbf24', 
                    fontWeight: 600,
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    <Shield size={11} /> Sede Matriz PAIN
                  </span>
                )}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.35rem 0 0 0' }}>
                Administración de accesos del sistema. Los Super Administradores solo pueden ser generados dentro de la empresa PAIN.
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
              <button 
                className="btn-primary" 
                onClick={() => {
                  setModalMode('create');
                  setShowAddModal(true);
                }} 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.6rem 1rem' }}
              >
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
                  {Array.isArray(admins) && admins.map(admin => {
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
                            padding: '0.25rem 0.6rem', 
                            borderRadius: '6px', 
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            backgroundColor: admin.role === 'SUPER_ADMIN' 
                              ? 'rgba(245, 158, 11, 0.15)' 
                              : admin.role === 'CORPORATE_ADMIN'
                              ? 'rgba(168, 85, 247, 0.15)'
                              : admin.role === 'SUPERVISOR'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : admin.role === 'VIEWER'
                              ? 'rgba(156, 163, 175, 0.15)'
                              : 'rgba(59, 130, 246, 0.15)',
                            color: admin.role === 'SUPER_ADMIN' 
                              ? '#fbbf24' 
                              : admin.role === 'CORPORATE_ADMIN'
                              ? '#c084fc'
                              : admin.role === 'SUPERVISOR'
                              ? '#34d399'
                              : admin.role === 'VIEWER'
                              ? '#9ca3af'
                              : '#60a5fa',
                            border: admin.role === 'SUPER_ADMIN'
                              ? '1px solid rgba(245, 158, 11, 0.35)'
                              : '1px solid transparent'
                          }}>
                            {admin.role === 'SUPER_ADMIN' && <Shield size={12} />}
                            {admin.role === 'SUPER_ADMIN' 
                              ? 'SUPER ADMIN (PAIN)' 
                              : admin.role === 'CORPORATE_ADMIN'
                              ? 'ADMIN CORP'
                              : admin.role === 'SUPERVISOR'
                              ? 'SUPERVISOR'
                              : admin.role === 'VIEWER'
                              ? 'VISOR'
                              : 'ADMINISTRADOR'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {admin.role === 'SUPER_ADMIN' ? (
                            <span style={{ color: '#fbbf24', fontSize: '0.8rem', fontWeight: 500 }}>
                              Exento (Cuenta SaaS Global)
                            </span>
                          ) : emp ? (
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
                          {admin.role === 'SUPER_ADMIN' ? (
                            <span style={{ color: '#71717a', fontSize: '0.75rem', fontStyle: 'italic' }}>
                              No requerida
                            </span>
                          ) : emp ? (
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {admin.role === 'SUPER_ADMIN' ? (
                              <span 
                                title="Super Administrador protegido de la empresa PAIN ante eliminación directa" 
                                style={{ color: '#52525b', display: 'inline-flex', alignItems: 'center', padding: '0.25rem', cursor: 'not-allowed' }}
                              >
                                <Lock size={15} />
                              </span>
                            ) : (
                              <>
                                {canCreateSuperAdmin && (
                                  <button 
                                    className="btn-icon" 
                                    style={{ color: '#fbbf24', padding: '0.25rem', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                                    onClick={() => setShowPromoteConfirm(admin)}
                                    title="Ascender a Super Administrador de PAIN"
                                  >
                                    <ShieldCheck size={15} />
                                  </button>
                                )}
                                <button 
                                  className="btn-icon" 
                                  style={{ color: 'var(--status-danger)' }}
                                  onClick={() => setShowDeleteConfirm(admin)}
                                  title="Eliminar"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(!Array.isArray(admins) || admins.length === 0) && (
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
                  {Array.isArray(auditLogs) && auditLogs.map(log => (
                    <tr key={log.id}>
                      <td style={tdStyle}>{new Date(log.timestamp).toLocaleString()}</td>
                      <td style={tdStyle}>
                        <span style={{ 
                          padding: '0.2rem 0.5rem', 
                          borderRadius: '4px', 
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          backgroundColor: log.action === 'CREATE_ADMIN' 
                            ? 'rgba(16, 185, 129, 0.2)' 
                            : log.action === 'PROMOTE_SUPER_ADMIN'
                            ? 'rgba(245, 158, 11, 0.2)'
                            : 'rgba(239, 68, 68, 0.2)',
                          color: log.action === 'CREATE_ADMIN' 
                            ? '#34d399' 
                            : log.action === 'PROMOTE_SUPER_ADMIN'
                            ? '#fbbf24'
                            : '#f87171'
                        }}>
                          {log.action === 'CREATE_ADMIN' 
                            ? 'CREACIÓN' 
                            : log.action === 'PROMOTE_SUPER_ADMIN'
                            ? 'ASCENSO SUPER ADMIN'
                            : 'ELIMINACIÓN'}
                        </span>
                      </td>
                      <td style={tdStyle}>{log.performedByName}</td>
                      <td style={tdStyle}>{log.targetName}</td>
                      <td style={tdStyle}>{log.targetEmail}</td>
                    </tr>
                  ))}
                  {(!Array.isArray(auditLogs) || auditLogs.length === 0) && (
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
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !formLoading) setShowAddModal(false); }}>
          <div 
            className="modal-content page-glow" 
            style={{ 
              maxWidth: '560px', 
              width: '94%', 
              maxHeight: '85vh', 
              display: 'flex', 
              flexDirection: 'column', 
              padding: 0, 
              overflow: 'hidden',
              borderRadius: '16px' 
            }}
          >
            {/* Modal Header (Fixed) */}
            <div className="modal-header" style={{ padding: '1.2rem 1.5rem', margin: 0, borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h3 style={{ color: 'var(--text-main)', margin: 0, fontSize: '1.15rem' }}>
                  {modalMode === 'promote'
                    ? 'Ascender a Super Administrador'
                    : (formData.role === 'SUPER_ADMIN' ? 'Nuevo Super Administrador' : 'Nuevo Administrador')}
                </h3>
                {isPainCompany && (
                  <span style={{ 
                    fontSize: '0.72rem', 
                    padding: '0.15rem 0.5rem', 
                    borderRadius: '6px', 
                    background: 'rgba(245, 158, 11, 0.15)', 
                    color: '#fbbf24', 
                    fontWeight: 600,
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    <Shield size={11} /> PAIN
                  </span>
                )}
              </div>
              <button className="btn-icon" onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs when user can create Super Admin */}
            {canCreateSuperAdmin && (
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setModalMode('create')}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    background: modalMode === 'create' ? 'rgba(255,255,255,0.06)' : 'transparent',
                    border: 'none',
                    borderBottom: modalMode === 'create' ? '2px solid var(--primary-orange)' : '2px solid transparent',
                    color: modalMode === 'create' ? '#fff' : 'var(--text-muted)',
                    fontWeight: modalMode === 'create' ? 600 : 400,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <UserPlus size={15} /> Crear Nuevo
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode('promote')}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    background: modalMode === 'promote' ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                    border: 'none',
                    borderBottom: modalMode === 'promote' ? '2px solid #fbbf24' : '2px solid transparent',
                    color: modalMode === 'promote' ? '#fbbf24' : 'var(--text-muted)',
                    fontWeight: modalMode === 'promote' ? 600 : 400,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <ShieldCheck size={15} /> Ascender Existente ({promotableAdmins.length})
                </button>
              </div>
            )}

            {modalMode === 'promote' ? (
              /* Promote Existing Admin View */
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, margin: 0 }}>
                <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
                  <div style={{ marginBottom: '1.25rem', padding: '0.85rem 1rem', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '10px', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <ShieldCheck size={20} style={{ color: '#fbbf24', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '0.8rem', color: '#e4e4e7', lineHeight: '1.4' }}>
                      <strong style={{ color: '#fbbf24' }}>Ascenso a Super Administrador (PAIN):</strong>
                      <div style={{ color: '#d4d4d8', marginTop: '0.25rem' }}>
                        Selecciona a un administrador registrado para ascenderlo a Super Administrador con acceso global a todas las empresas del SaaS.
                      </div>
                    </div>
                  </div>

                  {promotableAdmins.length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      <Shield size={32} style={{ color: '#71717a', margin: '0 auto 0.75rem auto' }} />
                      <p style={{ margin: 0 }}>No hay administradores disponibles para ascender.</p>
                      <p style={{ fontSize: '0.78rem', color: '#71717a', marginTop: '0.25rem' }}>Todos los administradores actuales ya son Super Administradores.</p>
                    </div>
                  ) : (
                    <>
                      <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                        <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                          Seleccionar Administrador a Ascender *
                        </label>
                        <select
                          className="auth-input"
                          style={{
                            width: '100%',
                            padding: '0.7rem 0.85rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'rgba(30,30,30,0.95)',
                            color: 'var(--text-main)',
                            fontSize: '0.88rem'
                          }}
                          value={selectedAdminToPromote}
                          onChange={e => setSelectedAdminToPromote(e.target.value)}
                        >
                          <option value="">-- Elige un administrador ({promotableAdmins.length} disponibles) --</option>
                          {promotableAdmins.map(admin => (
                            <option key={admin.id} value={admin.id}>
                              {admin.name} ({admin.email}) — Rol: {admin.role}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedAdminToPromote && (() => {
                        const selectedAdmin = promotableAdmins.find(a => a.id === selectedAdminToPromote);
                        if (!selectedAdmin) return null;
                        return (
                          <div style={{
                            padding: '1rem',
                            borderRadius: '10px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--border-color)',
                            marginBottom: '1rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                              <Shield size={16} style={{ color: '#fbbf24' }} />
                              <strong style={{ color: '#fff', fontSize: '0.88rem' }}>Resumen del Administrador Seleccionado</strong>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.82rem' }}>
                              <div>
                                <span style={{ color: '#a1a1aa' }}>Nombre:</span>
                                <div style={{ color: '#fff', fontWeight: 500, marginTop: '2px' }}>{selectedAdmin.name}</div>
                              </div>
                              <div>
                                <span style={{ color: '#a1a1aa' }}>Correo:</span>
                                <div style={{ color: '#fff', marginTop: '2px' }}>{selectedAdmin.email}</div>
                              </div>
                              <div>
                                <span style={{ color: '#a1a1aa' }}>Rol Actual:</span>
                                <div style={{ marginTop: '2px' }}>
                                  <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', fontSize: '0.75rem', fontWeight: 600 }}>
                                    {selectedAdmin.role}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <span style={{ color: '#a1a1aa' }}>Nuevo Rol Asignado:</span>
                                <div style={{ marginTop: '2px' }}>
                                  <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                    SUPER_ADMIN (PAIN)
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div style={{ marginTop: '0.85rem', padding: '0.65rem 0.85rem', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.75rem', color: '#d4d4d8', lineHeight: '1.4' }}>
                              <span style={{ color: '#fbbf24', fontWeight: 600 }}>Efecto inmediato:</span> Al ascenderlo, este usuario tendrá control completo del sistema, exención del cupo de empleados de asistencia y permisos multi-empresa.
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>

                {/* Footer for Promote */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', background: 'rgba(24, 24, 27, 0.95)', flexShrink: 0 }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)} disabled={promoteLoading} style={{ fontSize: '0.85rem', padding: '0.55rem 1.1rem' }}>
                    Cancelar
                  </button>
                  <button 
                    type="button" 
                    className="btn-primary" 
                    disabled={!selectedAdminToPromote || promoteLoading}
                    onClick={() => handlePromoteAdmin(selectedAdminToPromote)}
                    style={{
                      fontSize: '0.85rem',
                      padding: '0.55rem 1.25rem',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      borderColor: '#f59e0b',
                      color: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      opacity: (!selectedAdminToPromote || promoteLoading) ? 0.6 : 1,
                      cursor: (!selectedAdminToPromote || promoteLoading) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <ShieldCheck size={16} />
                    {promoteLoading ? 'Ascendiendo...' : 'Ascender a Super Administrador'}
                  </button>
                </div>
              </div>
            ) : (
            /* Form with Scrollable Body & Fixed Footer */
            <form onSubmit={handleAddAdmin} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, margin: 0 }}>
              <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
                {/* Informative banner according to role */}
                {formData.role === 'SUPER_ADMIN' ? (
                  <div style={{ marginBottom: '1rem', padding: '0.75rem 0.9rem', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                    <Shield size={18} style={{ color: '#fbbf24', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '0.78rem', color: '#e4e4e7', lineHeight: '1.35' }}>
                      <strong style={{ color: '#fbbf24' }}>Privilegios de Super Administrador (PAIN):</strong>
                      <div style={{ color: '#d4d4d8', marginTop: '0.2rem' }}>
                        Acceso total SaaS y gestión de empresas. Exento de cupo de personal y enrolamiento facial.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: '1rem', padding: '0.75rem 0.9rem', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.25)', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                    <UserCheck size={18} style={{ color: 'var(--primary-orange)', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '0.78rem', color: '#e4e4e7', lineHeight: '1.35' }}>
                      <strong style={{ color: '#fff' }}>Registro en Personal:</strong> Puede sincronizarse como empleado para checar asistencia y enrolar su rostro.
                    </div>
                  </div>
                )}

                {/* Role selector */}
                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    <span>Rol Asignado *</span>
                    {formData.role === 'SUPER_ADMIN' && (
                      <span style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Shield size={12} /> Exclusivo Empresa PAIN
                      </span>
                    )}
                  </label>
                  <select
                    className="auth-input"
                    style={{ 
                      width: '100%', 
                      padding: '0.65rem 0.75rem', 
                      borderRadius: '8px', 
                      border: formData.role === 'SUPER_ADMIN' ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid var(--border-color)', 
                      backgroundColor: 'rgba(30,30,30,0.95)', 
                      color: formData.role === 'SUPER_ADMIN' ? '#fbbf24' : 'var(--text-main)',
                      fontWeight: formData.role === 'SUPER_ADMIN' ? 600 : 400,
                      fontSize: '0.88rem'
                    }}
                    value={formData.role}
                    onChange={e => {
                      const newRole = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        role: newRole,
                        syncEmployee: newRole === 'SUPER_ADMIN' ? false : prev.syncEmployee
                      }));
                    }}
                  >
                    <option value="ADMIN">Administrador de Empresa (Estándar)</option>
                    {canCreateSuperAdmin && (
                      <option value="SUPER_ADMIN">
                        Super Administrador (Acceso Global SaaS - PAIN)
                      </option>
                    )}
                    <option value="SUPERVISOR">Supervisor (Control de Asistencia)</option>
                    <option value="VIEWER">Visor (Solo Lectura)</option>
                  </select>
                  {!canCreateSuperAdmin && user?.role === 'SUPER_ADMIN' && (
                    <p style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: '0.25rem' }}>
                      ℹ️ El rol de Super Administrador solo puede generarse en la empresa raíz PAIN.
                    </p>
                  )}
                </div>

                {/* Grid: Nombre Completo y Correo Electrónico */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Nombre Completo *</label>
                    <input 
                      type="text" 
                      className="auth-input" 
                      style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', fontSize: '0.88rem' }}
                      placeholder="Ej. Carlos Mendoza"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Correo Electrónico *</label>
                    <input 
                      type="email" 
                      className="auth-input" 
                      style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', fontSize: '0.88rem' }}
                      placeholder="admin@empresa.com"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      required
                    />
                  </div>
                </div>

                {/* Grid: Departamento & Identificador (solo para administradores estándar) */}
                {formData.role !== 'SUPER_ADMIN' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Departamento</label>
                      <select
                        className="auth-input"
                        style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(30,30,30,0.95)', color: 'var(--text-main)', fontSize: '0.88rem' }}
                        value={formData.departmentId}
                        onChange={e => setFormData({...formData, departmentId: e.target.value})}
                      >
                        <option value="">ADMINISTRACION (Por defecto)</option>
                        {Array.isArray(departments) && departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Identificador / DNI</label>
                      <input 
                        type="text" 
                        className="auth-input" 
                        style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', fontSize: '0.88rem' }}
                        placeholder="Automático (ADM-...)"
                        value={formData.identifier}
                        onChange={e => setFormData({...formData, identifier: e.target.value})}
                      />
                    </div>
                  </div>
                )}

                {/* Grid: Contraseña & Confirmar Contraseña */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Contraseña *</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showPassword ? "text" : "password"} 
                        className="auth-input" 
                        style={{ width: '100%', padding: '0.65rem 2.2rem 0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', fontSize: '0.88rem' }}
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        minLength={8}
                        placeholder="Mín. 8 caracteres"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '0.6rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'rgba(255, 255, 255, 0.5)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0
                        }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Confirmar Contraseña *</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showConfirmPassword ? "text" : "password"} 
                        className="auth-input" 
                        style={{ width: '100%', padding: '0.65rem 2.2rem 0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', fontSize: '0.88rem' }}
                        value={formData.confirmPassword}
                        onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                        minLength={8}
                        placeholder="Repetir contraseña"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{
                          position: 'absolute',
                          right: '0.6rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'rgba(255, 255, 255, 0.5)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0
                        }}
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Super Admin note or Employee Checkbox */}
                {formData.role === 'SUPER_ADMIN' ? (
                  <div style={{ padding: '0.6rem 0.85rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.78rem', color: '#d4d4d8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Shield size={14} style={{ color: '#fbbf24', flexShrink: 0 }} />
                    <span>Super Administradores de PAIN exentos de registro y checado de personal.</span>
                  </div>
                ) : (
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.25rem 0' }}>
                    <input
                      type="checkbox"
                      id="syncEmployeeCheckbox"
                      checked={formData.syncEmployee}
                      onChange={e => setFormData({ ...formData, syncEmployee: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#f97316', cursor: 'pointer' }}
                    />
                    <label htmlFor="syncEmployeeCheckbox" style={{ color: 'var(--text-main)', fontSize: '0.82rem', cursor: 'pointer' }}>
                      Crear automáticamente registro de empleado (para checar asistencia)
                    </label>
                  </div>
                )}
              </div>

              {/* Fixed Footer with Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', background: 'rgba(24, 24, 27, 0.95)', flexShrink: 0 }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)} disabled={formLoading} style={{ fontSize: '0.85rem', padding: '0.55rem 1.1rem' }}>
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  disabled={formLoading}
                  style={{
                    fontSize: '0.85rem',
                    padding: '0.55rem 1.25rem',
                    ...(formData.role === 'SUPER_ADMIN' ? {
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      borderColor: '#f59e0b',
                      color: '#fff'
                    } : {})
                  }}
                >
                  {formLoading 
                    ? 'Guardando...' 
                    : (formData.role === 'SUPER_ADMIN' ? 'Generar Super Administrador' : 'Crear Administrador')}
                </button>
              </div>
            </form>
            )}
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

      {/* Promote Confirmation Modal */}
      {showPromoteConfirm && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !promoteLoading) setShowPromoteConfirm(null); }}>
          <div className="modal-content page-glow" style={{ maxWidth: '440px' }}>
            <div className="modal-header" style={{ borderBottom: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#fbbf24' }}>
                <ShieldCheck size={24} />
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)' }}>Confirmar Ascenso</h3>
              </div>
              <button className="btn-icon" onClick={() => setShowPromoteConfirm(null)} disabled={promoteLoading}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ margin: '1rem 0' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
                ¿Estás seguro de que deseas ascender al administrador <strong style={{ color: '#fff' }}>{showPromoteConfirm.name}</strong> (<span style={{ color: '#a1a1aa' }}>{showPromoteConfirm.email}</span>) a <strong style={{ color: '#fbbf24' }}>Super Administrador</strong> de la plataforma PAIN?
              </p>
              <div style={{ marginTop: '1rem', padding: '0.75rem 0.9rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', fontSize: '0.78rem', color: '#d4d4d8' }}>
                <span style={{ color: '#fbbf24', fontWeight: 600 }}>Nota de Seguridad:</span> Esta cuenta obtendrá control SaaS total y acceso a todas las empresas del sistema.
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button className="btn-secondary" onClick={() => setShowPromoteConfirm(null)} disabled={promoteLoading}>
                Cancelar
              </button>
              <button 
                className="btn-primary" 
                style={{ 
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', 
                  borderColor: '#f59e0b',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }} 
                disabled={promoteLoading}
                onClick={() => handlePromoteAdmin(showPromoteConfirm.id)}
              >
                <ShieldCheck size={16} />
                {promoteLoading ? 'Ascendiendo...' : 'Sí, Ascender a Super Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManager;
