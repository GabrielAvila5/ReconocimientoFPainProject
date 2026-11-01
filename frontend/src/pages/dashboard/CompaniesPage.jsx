import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Users, Monitor, Plus, RefreshCw, AlertCircle, 
  CheckCircle2, Copy, Check, Edit, Power, Search, Filter, 
  Clock, Globe, Shield, Sparkles, X, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

const PLAN_PRESETS = {
  STARTER: { maxEmployees: 50, maxDevices: 3, label: 'Starter', badgeColor: '#3b82f6', bgBadge: 'rgba(59, 130, 246, 0.15)' },
  PRO: { maxEmployees: 200, maxDevices: 10, label: 'Pro', badgeColor: '#f97316', bgBadge: 'rgba(249, 115, 22, 0.15)' },
  ENTERPRISE: { maxEmployees: 1000, maxDevices: 50, label: 'Enterprise', badgeColor: '#a855f7', bgBadge: 'rgba(168, 85, 247, 0.15)' }
};

const TIMEZONES = [
  'America/Mexico_City',
  'America/Monterrey',
  'America/Tijuana',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Madrid'
];

const CompaniesPage = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Modal Alta de Empresa
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [createdSummary, setCreatedSummary] = useState(null);

  // Formulario Alta
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    plan: 'STARTER',
    maxEmployees: 50,
    maxDevices: 3,
    timezone: 'America/Mexico_City',
    customDomain: '',
    adminName: '',
    adminEmail: '',
    adminPassword: ''
  });

  // Modal Edición de Cuotas
  const [editingCompany, setEditingCompany] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    plan: 'STARTER',
    maxEmployees: 50,
    maxDevices: 3,
    timezone: 'America/Mexico_City',
    customDomain: ''
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    const tenantId = localStorage.getItem('tenantId');
    return {
      'Authorization': `Bearer ${token}`,
      ...(tenantId ? { 'x-tenant-id': tenantId } : {})
    };
  };

  const fetchCompanies = async (manual = false) => {
    try {
      if (manual) setIsRefreshing(true);
      else setLoading(true);
      setError(null);

      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/v1/superadmin/companies`, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Error al consultar lista de empresas');
      }

      const data = await res.json();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching companies:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  // Generador automático de slug en base al nombre
  const handleNameChange = (name) => {
    const autoSlug = name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    setFormData(prev => ({
      ...prev,
      name,
      slug: prev.slug === '' || prev.slug === autoSlug.slice(0, -1) ? autoSlug : prev.slug
    }));
  };

  const handlePlanChange = (plan) => {
    const preset = PLAN_PRESETS[plan] || PLAN_PRESETS.STARTER;
    setFormData(prev => ({
      ...prev,
      plan,
      maxEmployees: preset.maxEmployees,
      maxDevices: preset.maxDevices
    }));
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, adminPassword: pass }));
  };

  // Enviar Alta de Empresa
  const handleCreateCompany = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/v1/superadmin/companies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Error al crear empresa');
      }

      toast.success(`Empresa "${formData.name}" dada de alta correctamente.`);
      setCreatedSummary({
        company: data.company,
        admin: data.admin,
        initialPassword: formData.adminPassword
      });
      fetchCompanies();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Alternar Estado Activo / Suspendido
  const handleToggleStatus = async (company) => {
    const willBeActive = !company.isActive;
    const actionText = willBeActive ? 'reactivar' : 'suspender';
    
    if (!window.confirm(`¿Estás seguro de ${actionText} a "${company.name}"?\n${willBeActive ? 'Se restaurará el acceso de sus administradores y kioskos.' : 'Se cerrarán las sesiones de sus administradores y sus kioskos no podrán checar asistencias.'}`)) {
      return;
    }

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/v1/superadmin/companies/${company.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({
          isActive: willBeActive,
          reason: willBeActive ? 'Empresa reactivada por Super Admin' : 'Empresa suspendida por falta de pago o solicitud'
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al actualizar estado');
      }

      toast.success(`Empresa ${willBeActive ? 'activada' : 'suspendida'} exitosamente`);
      fetchCompanies();
    } catch (err) {
      toast.error('Error:', { description: err.message });
    }
  };

  // Abrir Modal de Edición
  const openEditModal = (company) => {
    setEditingCompany(company);
    setEditFormData({
      name: company.name,
      plan: company.plan,
      maxEmployees: company.maxEmployees,
      maxDevices: company.maxDevices,
      timezone: company.timezone,
      customDomain: company.customDomain || ''
    });
  };

  const handleUpdateCompany = async (e) => {
    e.preventDefault();
    if (!editingCompany) return;

    try {
      setIsSubmitting(true);
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/v1/superadmin/companies/${editingCompany.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(editFormData)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al actualizar empresa');
      }

      toast.success('Empresa actualizada correctamente');
      setEditingCompany(null);
      fetchCompanies();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyCredentialsToClipboard = () => {
    if (!createdSummary) return;
    const text = `======================================
ACCESO AL SISTEMA DE ASISTENCIA FACIAL
======================================
Empresa: ${createdSummary.company.name}
Portal de Acceso: ${window.location.origin}/login
Usuario / Correo: ${createdSummary.admin.email}
Contraseña Inicial: ${createdSummary.initialPassword}
Plan Asignado: ${createdSummary.company.plan} (Máx: ${createdSummary.company.maxEmployees} empleados, ${createdSummary.company.maxDevices} kioskos)
======================================
Por seguridad, cambie su contraseña al ingresar.`;

    navigator.clipboard.writeText(text);
    setCopiedSuccess(true);
    toast.success('Credenciales copiadas al portapapeles');
    setTimeout(() => setCopiedSuccess(false), 3000);
  };

  // Filtrado de Empresas
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const matchSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.customDomain || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchPlan = selectedPlan === 'ALL' || c.plan === selectedPlan;
      const matchStatus = selectedStatus === 'ALL' || 
        (selectedStatus === 'ACTIVE' && c.isActive) ||
        (selectedStatus === 'SUSPENDED' && !c.isActive);

      return matchSearch && matchPlan && matchStatus;
    });
  }, [companies, searchTerm, selectedPlan, selectedStatus]);

  // Métricas
  const stats = useMemo(() => {
    const total = companies.length;
    const active = companies.filter(c => c.isActive).length;
    const suspended = total - active;
    const totalEmps = companies.reduce((acc, c) => acc + (c._count?.employees || 0), 0);
    const totalDevs = companies.reduce((acc, c) => acc + (c._count?.devices || 0), 0);
    return { total, active, suspended, totalEmps, totalDevs };
  }, [companies]);

  return (
    <div className="fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Building2 size={28} style={{ color: '#f97316' }} /> Empresas SaaS (Tenants)
          </h1>
          <p style={{ color: '#a1a1aa', margin: '0.4rem 0 0 0', fontSize: '0.95rem' }}>
            Gestión centralizada del ciclo de vida comercial, cuotas de plan y aprovisionamiento B2B.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={() => fetchCompanies(true)}
            style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            disabled={isRefreshing || loading}
          >
            <RefreshCw size={16} className={isRefreshing ? "spin" : ""} /> Actualizar
          </button>
          <button 
            onClick={() => {
              setFormData({
                name: '',
                slug: '',
                plan: 'STARTER',
                maxEmployees: 50,
                maxDevices: 3,
                timezone: 'America/Mexico_City',
                customDomain: '',
                adminName: '',
                adminEmail: '',
                adminPassword: ''
              });
              setCreatedSummary(null);
              setIsCreateModalOpen(true);
            }}
            style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={18} /> Dar de Alta Empresa
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="card card-glow" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#a1a1aa', fontSize: '0.85rem' }}>
            <span>Total Empresas</span>
            <Building2 size={18} style={{ color: '#3b82f6' }} />
          </div>
          <h2 style={{ fontSize: '2rem', margin: '0.5rem 0 0', color: '#fff' }}>{stats.total}</h2>
          <span style={{ fontSize: '0.75rem', color: '#10b981' }}>{stats.active} activas</span>
        </div>

        <div className="card card-glow" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#a1a1aa', fontSize: '0.85rem' }}>
            <span>Empresas Activas</span>
            <CheckCircle2 size={18} style={{ color: '#10b981' }} />
          </div>
          <h2 style={{ fontSize: '2rem', margin: '0.5rem 0 0', color: '#10b981' }}>{stats.active}</h2>
          <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>Operando normalmente</span>
        </div>

        <div className="card card-glow" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#a1a1aa', fontSize: '0.85rem' }}>
            <span>Suspendidas / Mora</span>
            <Power size={18} style={{ color: '#ef4444' }} />
          </div>
          <h2 style={{ fontSize: '2rem', margin: '0.5rem 0 0', color: stats.suspended > 0 ? '#ef4444' : '#a1a1aa' }}>{stats.suspended}</h2>
          <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>Sin acceso a kioscos</span>
        </div>

        <div className="card card-glow" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#a1a1aa', fontSize: '0.85rem' }}>
            <span>Total Empleados Enrolados</span>
            <Users size={18} style={{ color: '#f97316' }} />
          </div>
          <h2 style={{ fontSize: '2rem', margin: '0.5rem 0 0', color: '#f97316' }}>{stats.totalEmps}</h2>
          <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>En todos los tenants</span>
        </div>

        <div className="card card-glow" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#a1a1aa', fontSize: '0.85rem' }}>
            <span>Kioscos Conectados</span>
            <Monitor size={18} style={{ color: '#a855f7' }} />
          </div>
          <h2 style={{ fontSize: '2rem', margin: '0.5rem 0 0', color: '#a855f7' }}>{stats.totalDevs}</h2>
          <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>Nodos físicos activos</span>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
          <input 
            type="text" 
            placeholder="Buscar por nombre de empresa o slug..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.75rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <select 
            value={selectedPlan} 
            onChange={(e) => setSelectedPlan(e.target.value)}
            style={selectFilterStyle}
          >
            <option value="ALL">Todos los Planes</option>
            <option value="STARTER">Starter</option>
            <option value="PRO">Pro</option>
            <option value="ENTERPRISE">Enterprise</option>
          </select>

          <select 
            value={selectedStatus} 
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={selectFilterStyle}
          >
            <option value="ALL">Todos los Estados</option>
            <option value="ACTIVE">Activas</option>
            <option value="SUSPENDED">Suspendidas</option>
          </select>
        </div>
      </div>

      {/* Tabla de Empresas */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <RefreshCw className="spin" size={32} style={{ color: '#f97316', margin: '0 auto 1rem' }} />
          <p style={{ color: '#a1a1aa' }}>Cargando catálogo de empresas...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'center' }}>
          <AlertCircle size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.8 }} />
          <h3 style={{ margin: '0 0 0.5rem' }}>Error al cargar empresas</h3>
          <p style={{ margin: '0 0 1rem', color: '#fca5a5' }}>{error}</p>
          <button onClick={() => fetchCompanies(true)} style={btnPrimary}>Reintentar</button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={thStyle}>Empresa / Slug</th>
                  <th style={thStyle}>Plan Comercial</th>
                  <th style={thStyle}>Cuota de Empleados</th>
                  <th style={thStyle}>Cuota de Kioscos</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Zona Horaria</th>
                  <th style={thStyle}>Fecha de Alta</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: '#71717a' }}>
                      No se encontraron empresas con los filtros especificados.
                    </td>
                  </tr>
                ) : (
                  filteredCompanies.map(comp => {
                    const preset = PLAN_PRESETS[comp.plan] || PLAN_PRESETS.STARTER;
                    const empsCount = comp._count?.employees || 0;
                    const devsCount = comp._count?.devices || 0;
                    const empPct = Math.min(100, Math.round((empsCount / comp.maxEmployees) * 100));
                    const devPct = Math.min(100, Math.round((devsCount / comp.maxDevices) * 100));

                    return (
                      <tr key={comp.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s' }} className="table-row-hover">
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(249, 115, 22, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316', fontWeight: 700, fontSize: '1rem', border: '1px solid rgba(249, 115, 22, 0.25)' }}>
                              {comp.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{comp.name}</strong>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                                <code style={{ fontSize: '0.75rem', color: '#f97316', background: 'rgba(249, 115, 22, 0.08)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                  {comp.slug}
                                </code>
                                {comp.customDomain && (
                                  <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>· {comp.customDomain}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <span style={{ 
                            padding: '0.25rem 0.65rem', 
                            borderRadius: '99px', 
                            fontSize: '0.75rem', 
                            fontWeight: 700, 
                            color: preset.badgeColor, 
                            background: preset.bgBadge,
                            border: `1px solid ${preset.badgeColor}33`
                          }}>
                            {comp.plan}
                          </span>
                        </td>

                        <td style={tdStyle}>
                          <div style={{ minWidth: '120px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                              <span style={{ color: '#fff' }}>{empsCount}</span>
                              <span style={{ color: '#71717a' }}>/ {comp.maxEmployees}</span>
                            </div>
                            <div style={{ height: '4px', background: '#27272a', borderRadius: '99px', overflow: 'hidden' }}>
                              <div style={{ width: `${empPct}%`, height: '100%', background: empPct > 90 ? '#ef4444' : '#10b981' }} />
                            </div>
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <div style={{ minWidth: '100px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                              <span style={{ color: '#fff' }}>{devsCount}</span>
                              <span style={{ color: '#71717a' }}>/ {comp.maxDevices}</span>
                            </div>
                            <div style={{ height: '4px', background: '#27272a', borderRadius: '99px', overflow: 'hidden' }}>
                              <div style={{ width: `${devPct}%`, height: '100%', background: devPct > 90 ? '#ef4444' : '#3b82f6' }} />
                            </div>
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <span style={{
                            padding: '0.25rem 0.65rem',
                            borderRadius: '99px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            color: comp.isActive ? '#10b981' : '#ef4444',
                            background: comp.isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${comp.isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: comp.isActive ? '#10b981' : '#ef4444' }} />
                            {comp.isActive ? 'Activa' : 'Suspendida'}
                          </span>
                        </td>

                        <td style={tdStyle}>
                          <span style={{ color: '#a1a1aa', fontSize: '0.85rem' }}>{comp.timezone.replace('America/', '')}</span>
                        </td>

                        <td style={tdStyle}>
                          <span style={{ color: '#a1a1aa', fontSize: '0.85rem' }}>
                            {new Date(comp.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </td>

                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                            <button
                              onClick={() => openEditModal(comp)}
                              title="Modificar Plan y Cuotas"
                              style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', color: '#60a5fa', padding: '0.4rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(comp)}
                              title={comp.isActive ? "Suspender Empresa" : "Activar Empresa"}
                              style={{
                                background: comp.isActive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                border: `1px solid ${comp.isActive ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                                color: comp.isActive ? '#ef4444' : '#10b981',
                                padding: '0.4rem',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <Power size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Alta de Nueva Empresa (Onboarding) */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setIsCreateModalOpen(false)}>
          <div 
            className="modal-content page-glow" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px', width: '90%', borderRadius: '16px', background: '#141416', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {createdSummary ? (
              // Vista de Éxito con Credenciales para Entregar al Cliente
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                    <CheckCircle2 size={32} />
                  </div>
                  <h2 style={{ color: '#fff', margin: '0 0 0.5rem', fontSize: '1.4rem' }}>¡Empresa Aprovisionada Exitosamente!</h2>
                  <p style={{ color: '#a1a1aa', fontSize: '0.9rem', margin: 0 }}>
                    La empresa y su administrador han sido registrados. Copia las credenciales para entregarlas al cliente.
                  </p>
                </div>

                <div style={{ background: '#1c1c1f', border: '1px solid #2e2e33', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.75rem', fontSize: '0.9rem' }}>
                    <span style={{ color: '#a1a1aa' }}>Empresa:</span>
                    <strong style={{ color: '#fff' }}>{createdSummary.company.name}</strong>

                    <span style={{ color: '#a1a1aa' }}>Identificador:</span>
                    <code style={{ color: '#f97316' }}>{createdSummary.company.slug}</code>

                    <span style={{ color: '#a1a1aa' }}>Plan:</span>
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                      {createdSummary.company.plan} ({createdSummary.company.maxEmployees} emp, {createdSummary.company.maxDevices} kioscos)
                    </span>

                    <span style={{ color: '#a1a1aa' }}>Portal Web:</span>
                    <span style={{ color: '#fff', wordBreak: 'break-all' }}>{window.location.origin}/login</span>

                    <span style={{ color: '#a1a1aa' }}>Usuario Admin:</span>
                    <strong style={{ color: '#10b981' }}>{createdSummary.admin.email}</strong>

                    <span style={{ color: '#a1a1aa' }}>Contraseña:</span>
                    <code style={{ color: '#eab308', background: 'rgba(234, 179, 8, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                      {createdSummary.initialPassword}
                    </code>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={copyCredentialsToClipboard}
                    style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: '0.5rem', background: copiedSuccess ? '#10b981' : 'var(--primary-orange)' }}
                  >
                    {copiedSuccess ? <Check size={16} /> : <Copy size={16} />}
                    {copiedSuccess ? '¡Copiado!' : 'Copiar Credenciales para Cliente'}
                  </button>
                  <button 
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setCreatedSummary(null);
                    }}
                    style={btnSecondary}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              // Formulario de Alta
              <form onSubmit={handleCreateCompany}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(249, 115, 22, 0.15)', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Building2 size={22} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', fontWeight: 600 }}>Alta Manual de Nueva Empresa</h3>
                      <p style={{ margin: '0.2rem 0 0', color: '#a1a1aa', fontSize: '0.85rem' }}>Aprovisionamiento B2B transaccional</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setIsCreateModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>

                {/* Sección 1: Datos de la Empresa */}
                <h4 style={{ color: '#f97316', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                  1. Datos de la Organización & Plan
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={labelStyle}>Nombre de la Empresa *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ej. Corporativo Sigma S.A."
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Slug Identificador *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="ej. corporativo-sigma"
                      value={formData.slug}
                      onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                      style={inputStyle}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#71717a' }}>Letras minúsculas y guiones</span>
                  </div>

                  <div>
                    <label style={labelStyle}>Plan Comercial *</label>
                    <select 
                      value={formData.plan}
                      onChange={(e) => handlePlanChange(e.target.value)}
                      style={selectFilterStyle}
                    >
                      <option value="STARTER">Starter (50 emp / 3 kioscos)</option>
                      <option value="PRO">Pro (200 emp / 10 kioscos)</option>
                      <option value="ENTERPRISE">Enterprise (1000 emp / 50 kioscos)</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Límite de Empleados (Cuota)</label>
                    <input 
                      type="number" 
                      required
                      min="1"
                      value={formData.maxEmployees}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxEmployees: parseInt(e.target.value, 10) || 1 }))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Límite de Kioscos (Cuota)</label>
                    <input 
                      type="number" 
                      required
                      min="1"
                      value={formData.maxDevices}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxDevices: parseInt(e.target.value, 10) || 1 }))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Zona Horaria *</label>
                    <select 
                      value={formData.timezone}
                      onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                      style={selectFilterStyle}
                    >
                      {TIMEZONES.map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Dominio Personalizado (Opcional)</label>
                    <input 
                      type="text" 
                      placeholder="ej. asistencia.sigma.com"
                      value={formData.customDomain}
                      onChange={(e) => setFormData(prev => ({ ...prev, customDomain: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Sección 2: Administrador Inicial */}
                <h4 style={{ color: '#f97316', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '1.5rem 0 1rem' }}>
                  2. Administrador Inicial de la Empresa
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={labelStyle}>Nombre Completo del Administrador *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ej. Roberto Morales Sánchez"
                      value={formData.adminName}
                      onChange={(e) => setFormData(prev => ({ ...prev, adminName: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Correo Electrónico (Login) *</label>
                    <input 
                      type="email" 
                      required
                      placeholder="admin@empresa.com"
                      value={formData.adminEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, adminEmail: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={labelStyle}>Contraseña Inicial *</label>
                      <button 
                        type="button" 
                        onClick={generateRandomPassword}
                        style={{ background: 'transparent', border: 'none', color: '#f97316', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                      >
                        <Sparkles size={12} /> Generar
                      </button>
                    </div>
                    <input 
                      type="text" 
                      required
                      minLength="6"
                      placeholder="Mínimo 6 caracteres"
                      value={formData.adminPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, adminPassword: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.25rem' }}>
                  <button 
                    type="button" 
                    onClick={() => setIsCreateModalOpen(false)}
                    disabled={isSubmitting}
                    style={btnSecondary}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={16} className="spin" /> Aprovisionando Empresa...
                      </>
                    ) : (
                      <>
                        <Plus size={16} /> Dar de Alta Empresa
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Editar Cuotas y Plan */}
      {editingCompany && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setEditingCompany(null)}>
          <div 
            className="modal-content page-glow" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '500px', width: '90%', borderRadius: '16px', background: '#141416', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '2rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', fontWeight: 600 }}>Modificar Plan y Cuotas</h3>
                <p style={{ margin: '0.2rem 0 0', color: '#a1a1aa', fontSize: '0.85rem' }}>{editingCompany.name}</p>
              </div>
              <button type="button" onClick={() => setEditingCompany(null)} style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateCompany}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={labelStyle}>Nombre de la Empresa</label>
                  <input 
                    type="text" 
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Plan Comercial</label>
                  <select 
                    value={editFormData.plan}
                    onChange={(e) => {
                      const newPlan = e.target.value;
                      const preset = PLAN_PRESETS[newPlan] || PLAN_PRESETS.STARTER;
                      setEditFormData(prev => ({
                        ...prev,
                        plan: newPlan,
                        maxEmployees: preset.maxEmployees,
                        maxDevices: preset.maxDevices
                      }));
                    }}
                    style={selectFilterStyle}
                  >
                    <option value="STARTER">Starter</option>
                    <option value="PRO">Pro</option>
                    <option value="ENTERPRISE">Enterprise</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Máx. Empleados</label>
                    <input 
                      type="number" 
                      min="1"
                      required
                      value={editFormData.maxEmployees}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, maxEmployees: parseInt(e.target.value, 10) || 1 }))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Máx. Kioscos</label>
                    <input 
                      type="number" 
                      min="1"
                      required
                      value={editFormData.maxDevices}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, maxDevices: parseInt(e.target.value, 10) || 1 }))}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Zona Horaria</label>
                  <select 
                    value={editFormData.timezone}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, timezone: e.target.value }))}
                    style={selectFilterStyle}
                  >
                    {TIMEZONES.map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Dominio Personalizado</label>
                  <input 
                    type="text" 
                    placeholder="ej. asistencia.cliente.com"
                    value={editFormData.customDomain}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, customDomain: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.25rem' }}>
                <button type="button" onClick={() => setEditingCompany(null)} style={btnSecondary}>
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmitting} style={btnPrimary}>
                  {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Estilos ---
const thStyle = {
  padding: '1rem 1.25rem',
  color: '#a1a1aa',
  fontSize: '0.8rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const tdStyle = {
  padding: '1rem 1.25rem',
  verticalAlign: 'middle'
};

const labelStyle = {
  display: 'block',
  marginBottom: '0.35rem',
  color: '#d4d4d8',
  fontSize: '0.85rem',
  fontWeight: 500
};

const inputStyle = {
  width: '100%',
  padding: '0.65rem 0.85rem',
  background: '#18181b',
  border: '1px solid #27272a',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '0.9rem',
  outline: 'none',
  boxSizing: 'border-box'
};

const selectFilterStyle = {
  width: '100%',
  padding: '0.65rem 0.85rem',
  background: '#18181b',
  border: '1px solid #27272a',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '0.9rem',
  outline: 'none',
  cursor: 'pointer',
  boxSizing: 'border-box'
};

const btnPrimary = {
  padding: '0.65rem 1.25rem',
  background: 'var(--primary-orange, #f97316)',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.9rem'
};

const btnSecondary = {
  padding: '0.65rem 1.25rem',
  background: '#27272a',
  color: '#e4e4e7',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: '0.9rem'
};

export default CompaniesPage;
