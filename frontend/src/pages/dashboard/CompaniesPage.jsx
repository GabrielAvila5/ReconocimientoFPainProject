import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Users, Monitor, Plus, RefreshCw, AlertCircle, 
  CheckCircle2, Copy, Check, Edit, Power, Search, Filter, 
  Clock, Globe, Shield, Sparkles, X, ChevronRight, Key,
  Trash2, Eye, AlertTriangle, ShieldCheck, Fingerprint, Calendar,
  ArrowUpRight, Info, LayoutGrid, List, UserCheck
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

const formatSuspensionDetails = (dateString) => {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return null;

  const dayName = d.toLocaleDateString('es-MX', { weekday: 'long' });
  const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  const fullDate = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  const shortDate = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const shortTime = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });

  return {
    capitalizedDay,
    fullDate,
    shortDate,
    time,
    shortTime,
    fullFormatted: `${capitalizedDay}, ${fullDate} a las ${time}`
  };
};

const CompaniesPage = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modo de visualización: 'table' (compacta) o 'grid' (tarjetas)
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('companies_view_mode') || 'table';
  });

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('companies_view_mode', mode);
  };

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

  // Modal de Ver Ficha Completa (Detalles de Empresa)
  const [detailCompany, setDetailCompany] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState('overview'); // 'overview' | 'admins' | 'devices' | 'structure'

  // Modal de Credenciales / Copiar Acceso
  const [credentialCompany, setCredentialCompany] = useState(null);
  const [credResetLoading, setCredResetLoading] = useState(false);
  const [credGeneratedPassword, setCredGeneratedPassword] = useState('');
  const [credCopied, setCredCopied] = useState(false);

  // Modal de Suspensión / Reactivación con Estilos
  const [suspendModalCompany, setSuspendModalCompany] = useState(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [isSuspending, setIsSuspending] = useState(false);

  // Modal de Baja Definitiva (Derecho ARCO)
  const [deleteModalCompany, setDeleteModalCompany] = useState(null);
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Generador de slug
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

  // Crear Empresa
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

  // Detalle de Empresa
  const openCompanyDetails = async (company) => {
    setDetailCompany(company);
    setDetailData(null);
    setDetailLoading(true);
    setDetailTab('overview');
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/v1/superadmin/companies/${company.id}`, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const fullData = await res.json();
        setDetailData(fullData);
        setDetailCompany(fullData);
      } else {
        setDetailData(company);
      }
    } catch (err) {
      console.error('Error fetching detail:', err);
      setDetailData(company);
    } finally {
      setDetailLoading(false);
    }
  };

  // Modal de Credenciales / Copiar Acceso
  const openCredentialModal = (company) => {
    setCredentialCompany(company);
    setCredGeneratedPassword('');
    setCredCopied(false);
  };

  // Generar / Restablecer Contraseña de Admin
  const handleResetAdminPassword = async () => {
    if (!credentialCompany) return;
    try {
      setCredResetLoading(true);
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/v1/superadmin/companies/${credentialCompany.id}/reset-admin-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({})
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Error al restablecer contraseña');
      }

      setCredGeneratedPassword(data.newPassword);
      toast.success('Nueva contraseña generada y actualizada en base de datos.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCredResetLoading(false);
    }
  };

  // Copiar plantilla completa de credenciales
  const copyFullCredentials = (comp, customPassword = '') => {
    const adminEmail = comp.adminUsers?.[0]?.email || 'admin@empresa.com';
    const pwdText = customPassword ? `Contraseña Temporal: ${customPassword}` : '(Contraseña configurada por el cliente)';
    const text = `======================================
ACCESO AL SISTEMA DE ASISTENCIA FACIAL
======================================
Empresa: ${comp.name}
Portal de Acceso: ${window.location.origin}/login
Identificador (Slug): ${comp.slug}
Usuario Administrador: ${adminEmail}
${pwdText}
Plan: ${comp.plan} (Máx: ${comp.maxEmployees} empleados, ${comp.maxDevices} kioscos)
======================================
Por seguridad, ingrese al portal y configure sus credenciales.`;

    navigator.clipboard.writeText(text);
    setCredCopied(true);
    toast.success('Datos de acceso copiados al portapapeles');
    setTimeout(() => setCredCopied(false), 3000);
  };

  // Modal de Suspensión con Estilos
  const openSuspendModal = (company) => {
    setSuspendModalCompany(company);
    setSuspendReason(company.isActive ? 'Falta de pago o mora comercial' : 'Reactivación por regularización de pago');
  };

  const handleConfirmSuspend = async () => {
    if (!suspendModalCompany) return;
    const willBeActive = !suspendModalCompany.isActive;
    try {
      setIsSuspending(true);
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/v1/superadmin/companies/${suspendModalCompany.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({
          isActive: willBeActive,
          reason: suspendReason || (willBeActive ? 'Reactivación por Super Admin' : 'Suspensión de servicio')
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al cambiar estado de la empresa');
      }

      toast.success(willBeActive ? `Empresa "${suspendModalCompany.name}" reactivada con éxito.` : `Empresa "${suspendModalCompany.name}" suspendida. Kioscos desconectados.`);
      setSuspendModalCompany(null);
      fetchCompanies();
      if (detailCompany?.id === suspendModalCompany.id) {
        if (data.company) {
          openCompanyDetails({ ...detailCompany, ...data.company });
        } else {
          openCompanyDetails({ ...detailCompany, isActive: willBeActive });
        }
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSuspending(false);
    }
  };

  // Modal de Baja Definitiva (ARCO)
  const openDeleteModal = (company) => {
    setDeleteModalCompany(company);
    setDeleteConfirmSlug('');
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalCompany) return;
    if (deleteConfirmSlug !== deleteModalCompany.slug) {
      toast.error('El identificador (slug) ingresado no coincide.');
      return;
    }

    try {
      setIsDeleting(true);
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/v1/superadmin/companies/${deleteModalCompany.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Error al eliminar empresa');
      }

      toast.success(data.message || `Empresa "${deleteModalCompany.name}" eliminada por completo.`);
      setDeleteModalCompany(null);
      if (detailCompany?.id === deleteModalCompany.id) {
        setDetailCompany(null);
      }
      fetchCompanies();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Edición de Plan y Cuotas
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
      if (detailCompany?.id === editingCompany.id) {
        openCompanyDetails({ ...detailCompany, ...editFormData });
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtrado de Empresas
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const matchSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.customDomain || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.adminUsers?.[0]?.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchPlan = selectedPlan === 'ALL' || c.plan === selectedPlan;
      const matchStatus = selectedStatus === 'ALL' || 
        (selectedStatus === 'ACTIVE' && c.isActive) ||
        (selectedStatus === 'SUSPENDED' && !c.isActive);

      return matchSearch && matchPlan && matchStatus;
    });
  }, [companies, searchTerm, selectedPlan, selectedStatus]);

  // Métricas Globales
  const stats = useMemo(() => {
    const total = companies.length;
    const active = companies.filter(c => c.isActive).length;
    const suspended = total - active;
    const totalEmps = companies.reduce((acc, c) => acc + (c._count?.employees || 0), 0);
    const totalEnrolled = companies.reduce((acc, c) => acc + (c._count?.enrolledEmployees || 0), 0);
    const totalDevs = companies.reduce((acc, c) => acc + (c._count?.devices || 0), 0);
    return { total, active, suspended, totalEmps, totalEnrolled, totalDevs };
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
            Gestión centralizada del ciclo de vida comercial, credenciales, monitoreo en tiempo real y cuotas B2B.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Selector de Vista: Tabla Compacta vs Tarjetas */}
          <div style={{ display: 'flex', background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '0.2rem' }}>
            <button
              type="button"
              onClick={() => handleViewModeChange('table')}
              title="Vista de Tabla Compacta (Sin scroll horizontal)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'table' ? 'var(--primary-orange, #f97316)' : 'transparent',
                color: viewMode === 'table' ? '#fff' : '#a1a1aa',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600,
                transition: 'all 0.15s'
              }}
            >
              <List size={15} /> Tabla
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange('grid')}
              title="Vista de Cuadrícula / Tarjetas"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'grid' ? 'var(--primary-orange, #f97316)' : 'transparent',
                color: viewMode === 'grid' ? '#fff' : '#a1a1aa',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600,
                transition: 'all 0.15s'
              }}
            >
              <LayoutGrid size={15} /> Tarjetas
            </button>
          </div>

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
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
          <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>Kioscos desconectados</span>
        </div>

        <div className="card card-glow" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#a1a1aa', fontSize: '0.85rem' }}>
            <span>Empleados Totales</span>
            <Users size={18} style={{ color: '#f97316' }} />
          </div>
          <h2 style={{ fontSize: '2rem', margin: '0.5rem 0 0', color: '#f97316' }}>{stats.totalEmps}</h2>
          <span style={{ fontSize: '0.75rem', color: '#10b981' }}>{stats.totalEnrolled} con rostro (AES-256)</span>
        </div>

        <div className="card card-glow" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#a1a1aa', fontSize: '0.85rem' }}>
            <span>Kioscos Autorizados</span>
            <Monitor size={18} style={{ color: '#a855f7' }} />
          </div>
          <h2 style={{ fontSize: '2rem', margin: '0.5rem 0 0', color: '#a855f7' }}>{stats.totalDevs}</h2>
          <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>Nodos físicos operando</span>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
          <input 
            type="text" 
            placeholder="Buscar por nombre, slug, dominio o correo de admin..."
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

      {/* Contenido Principal: Tabla Compacta O Cuadrícula de Tarjetas */}
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
      ) : filteredCompanies.length === 0 ? (
        <div className="card" style={{ padding: '3.5rem', textAlign: 'center', color: '#71717a' }}>
          <Building2 size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: '0.95rem' }}>No se encontraron empresas con los filtros especificados.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* ========================================================= */
        /* VISTA 1: TABLA COMPACTA (100% SIN SCROLL HORIZONTAL)      */
        /* ========================================================= */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ ...thCompact, width: '30%' }}>Empresa / Plan</th>
                <th style={{ ...thCompact, width: '24%' }}>Administrador</th>
                <th style={{ ...thCompact, width: '22%' }}>Cuotas (Uso Real)</th>
                <th style={{ ...thCompact, width: '10%' }}>Estado</th>
                <th style={{ ...thCompact, width: '14%', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.map(comp => {
                const preset = PLAN_PRESETS[comp.plan] || PLAN_PRESETS.STARTER;
                const empsCount = comp._count?.employees || 0;
                const enrolledCount = comp._count?.enrolledEmployees || 0;
                const devsCount = comp._count?.devices || 0;
                const empPct = Math.min(100, Math.round((empsCount / comp.maxEmployees) * 100));
                const devPct = Math.min(100, Math.round((devsCount / comp.maxDevices) * 100));
                const mainAdmin = comp.adminUsers?.[0];
                const isProtected = comp.id === 'default-company-pain';

                return (
                  <tr key={comp.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s' }} className="table-row-hover">
                    {/* 1. Empresa + Slug + Plan */}
                    <td style={tdCompact}>
                      <div 
                        style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}
                        onClick={() => openCompanyDetails(comp)}
                        title="Click para ver ficha integral"
                      >
                        <div style={{ width: '34px', height: '34px', minWidth: '34px', borderRadius: '8px', background: 'rgba(249, 115, 22, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316', fontWeight: 700, fontSize: '0.92rem', border: '1px solid rgba(249, 115, 22, 0.25)' }}>
                          {comp.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                          <strong style={{ color: '#fff', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {comp.name}
                            <Eye size={12} style={{ color: '#71717a', opacity: 0.7 }} />
                          </strong>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem', flexWrap: 'wrap' }}>
                            <code style={{ fontSize: '0.72rem', color: '#f97316', background: 'rgba(249, 115, 22, 0.08)', padding: '0.05rem 0.35rem', borderRadius: '4px' }}>
                              {comp.slug}
                            </code>
                            <span style={{ 
                              padding: '0.1rem 0.45rem', 
                              borderRadius: '4px', 
                              fontSize: '0.7rem', 
                              fontWeight: 700, 
                              color: preset.badgeColor, 
                              background: preset.bgBadge,
                              border: `1px solid ${preset.badgeColor}33`
                            }}>
                              {comp.plan}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Administrador */}
                    <td style={tdCompact}>
                      {mainAdmin ? (
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {mainAdmin.name}
                          </div>
                          <div style={{ color: '#a1a1aa', fontSize: '0.75rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {mainAdmin.email}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#71717a', fontSize: '0.78rem' }}>Sin administrador</span>
                      )}
                    </td>

                    {/* 3. Cuotas de Plan (Empleados & Kioscos Unificados) */}
                    <td style={tdCompact}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {/* Empleados */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#d4d4d8', marginBottom: '0.15rem' }}>
                            <span>👥 {empsCount} / {comp.maxEmployees} <span style={{ color: '#10b981', fontSize: '0.7rem' }}>({enrolledCount} 👤)</span></span>
                            <span style={{ color: '#71717a' }}>{empPct}%</span>
                          </div>
                          <div style={{ height: '3px', background: '#27272a', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{ width: `${empPct}%`, height: '100%', background: empPct > 90 ? '#ef4444' : '#10b981' }} />
                          </div>
                        </div>

                        {/* Kioscos */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#d4d4d8', marginBottom: '0.15rem' }}>
                            <span>💻 {devsCount} / {comp.maxDevices} kioscos</span>
                            <span style={{ color: '#71717a' }}>{devPct}%</span>
                          </div>
                          <div style={{ height: '3px', background: '#27272a', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{ width: `${devPct}%`, height: '100%', background: devPct > 90 ? '#ef4444' : '#3b82f6' }} />
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 4. Estado */}
                    <td style={tdCompact}>
                      <span style={{
                        padding: '0.2rem 0.55rem',
                        borderRadius: '99px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        color: comp.isActive ? '#10b981' : '#ef4444',
                        background: comp.isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${comp.isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                      }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: comp.isActive ? '#10b981' : '#ef4444' }} />
                        {comp.isActive ? 'Activa' : 'Suspendida'}
                      </span>
                      {!comp.isActive && comp.suspendedAt && (
                        <div 
                          style={{ fontSize: '0.7rem', color: '#f87171', marginTop: '0.3rem', lineHeight: '1.25' }}
                          title={`Suspendida el ${formatSuspensionDetails(comp.suspendedAt)?.fullFormatted} por ${comp.suspendedByName || 'Super Admin'}`}
                        >
                          <div style={{ fontWeight: 600 }}>{formatSuspensionDetails(comp.suspendedAt)?.capitalizedDay} {formatSuspensionDetails(comp.suspendedAt)?.shortDate}</div>
                          <div style={{ color: '#d4d4d8' }}>{formatSuspensionDetails(comp.suspendedAt)?.shortTime}</div>
                          <div style={{ color: '#a1a1aa', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Por: {comp.suspendedByName ? comp.suspendedByName.split(' ')[0] : 'Admin'}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* 5. Acciones */}
                    <td style={{ ...tdCompact, textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                        {/* Ficha Completa */}
                        <button
                          onClick={() => openCompanyDetails(comp)}
                          title="Ficha Integral y Métricas"
                          style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#d4d4d8', padding: '0.35rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <Eye size={14} />
                        </button>

                        {/* Credenciales */}
                        <button
                          onClick={() => openCredentialModal(comp)}
                          title="Copiar Credenciales de Acceso"
                          style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#10b981', padding: '0.35rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <Key size={14} />
                        </button>

                        {/* Modificar Plan */}
                        <button
                          onClick={() => openEditModal(comp)}
                          title="Modificar Plan y Cuotas"
                          style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', color: '#60a5fa', padding: '0.35rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <Edit size={14} />
                        </button>

                        {/* Suspender / Activar */}
                        <button
                          onClick={() => openSuspendModal(comp)}
                          title={comp.isActive ? "Suspender Servicio" : "Reactivar Servicio"}
                          style={{
                            background: comp.isActive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            border: `1px solid ${comp.isActive ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                            color: comp.isActive ? '#ef4444' : '#10b981',
                            padding: '0.35rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Power size={14} />
                        </button>

                        {/* Baja Definitiva (ARCO) */}
                        <button
                          onClick={() => !isProtected && openDeleteModal(comp)}
                          disabled={isProtected}
                          title={isProtected ? "Empresa principal protegida" : "Dar de baja por completo (ARCO)"}
                          style={{
                            background: isProtected ? 'rgba(255, 255, 255, 0.02)' : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${isProtected ? 'rgba(255, 255, 255, 0.05)' : 'rgba(239, 68, 68, 0.25)'}`,
                            color: isProtected ? '#52525b' : '#f87171',
                            padding: '0.35rem',
                            borderRadius: '6px',
                            cursor: isProtected ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ========================================================= */
        /* VISTA 2: CUADRÍCULA DE TARJETAS (CARDS GRID EJECUTIVAS)   */
        /* ========================================================= */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {filteredCompanies.map(comp => {
            const preset = PLAN_PRESETS[comp.plan] || PLAN_PRESETS.STARTER;
            const empsCount = comp._count?.employees || 0;
            const enrolledCount = comp._count?.enrolledEmployees || 0;
            const devsCount = comp._count?.devices || 0;
            const empPct = Math.min(100, Math.round((empsCount / comp.maxEmployees) * 100));
            const devPct = Math.min(100, Math.round((devsCount / comp.maxDevices) * 100));
            const mainAdmin = comp.adminUsers?.[0];
            const isProtected = comp.id === 'default-company-pain';

            return (
              <div 
                key={comp.id} 
                className="card card-glow"
                style={{ 
                  padding: '1.25rem', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  borderRadius: '14px',
                  border: '1px solid #27272a',
                  background: '#141416',
                  transition: 'transform 0.15s, border-color 0.15s'
                }}
              >
                {/* Cabecera Tarjeta */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(249, 115, 22, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316', fontWeight: 800, fontSize: '1.1rem', border: '1px solid rgba(249, 115, 22, 0.3)' }}>
                        {comp.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 
                          onClick={() => openCompanyDetails(comp)}
                          style={{ margin: 0, fontSize: '1.05rem', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          {comp.name}
                          <Eye size={13} style={{ color: '#71717a' }} />
                        </h3>
                        <code style={{ fontSize: '0.75rem', color: '#f97316' }}>{comp.slug}</code>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                      <span style={{ 
                        padding: '0.15rem 0.55rem', 
                        borderRadius: '99px', 
                        fontSize: '0.7rem', 
                        fontWeight: 700, 
                        color: preset.badgeColor, 
                        background: preset.bgBadge,
                        border: `1px solid ${preset.badgeColor}33`
                      }}>
                        {comp.plan}
                      </span>
                      <span style={{
                        padding: '0.1rem 0.45rem',
                        borderRadius: '99px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        color: comp.isActive ? '#10b981' : '#ef4444',
                        background: comp.isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'
                      }}>
                        {comp.isActive ? '● Activa' : '● Suspendida'}
                      </span>
                    </div>
                  </div>

                  {/* Administrador */}
                  <div style={{ background: '#18181b', borderRadius: '8px', padding: '0.65rem 0.85rem', marginBottom: '0.85rem', border: '1px solid #27272a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', color: '#fff', fontWeight: 500 }}>
                      <UserCheck size={14} style={{ color: '#10b981' }} />
                      <span>{mainAdmin?.name || 'Sin administrador asignado'}</span>
                    </div>
                    {mainAdmin?.email && (
                      <div style={{ fontSize: '0.74rem', color: '#a1a1aa', marginTop: '0.15rem', paddingLeft: '1.35rem' }}>
                        {mainAdmin.email}
                      </div>
                    )}
                  </div>

                  {/* Auditoría de Suspensión (si no está activa) */}
                  {!comp.isActive && comp.suspendedAt && (
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: '8px',
                      padding: '0.6rem 0.75rem',
                      marginBottom: '1rem',
                      fontSize: '0.76rem',
                      color: '#fca5a5'
                    }}>
                      <div style={{ fontWeight: 600, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Power size={13} /> Suspendida el {formatSuspensionDetails(comp.suspendedAt)?.capitalizedDay}, {formatSuspensionDetails(comp.suspendedAt)?.shortDate}
                      </div>
                      <div style={{ marginTop: '0.2rem', color: '#d4d4d8' }}>
                        Hora: <strong>{formatSuspensionDetails(comp.suspendedAt)?.shortTime}</strong> · Por: <strong>{comp.suspendedByName || 'Super Admin'}</strong>
                      </div>
                      {comp.suspensionReason && (
                        <div style={{ color: '#a1a1aa', fontSize: '0.72rem', marginTop: '0.2rem', fontStyle: 'italic' }}>
                          "{comp.suspensionReason}"
                        </div>
                      )}
                    </div>
                  )}

                  {/* Barras de Consumo */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
                    {/* Empleados */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: '#d4d4d8' }}>Empleados: <strong>{empsCount}</strong> / {comp.maxEmployees}</span>
                        <span style={{ color: '#10b981', fontSize: '0.72rem' }}>{enrolledCount} con rostro</span>
                      </div>
                      <div style={{ height: '4px', background: '#27272a', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ width: `${empPct}%`, height: '100%', background: empPct > 90 ? '#ef4444' : '#10b981' }} />
                      </div>
                    </div>

                    {/* Kioscos */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: '#d4d4d8' }}>Kioscos: <strong>{devsCount}</strong> / {comp.maxDevices}</span>
                        <span style={{ color: '#71717a' }}>{devPct}% cupo</span>
                      </div>
                      <div style={{ height: '4px', background: '#27272a', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ width: `${devPct}%`, height: '100%', background: devPct > 90 ? '#ef4444' : '#3b82f6' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pie de Tarjeta / Botones de Acción */}
                <div style={{ borderTop: '1px solid #27272a', paddingTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={() => openCompanyDetails(comp)}
                    style={{ ...btnSecondary, padding: '0.35rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Eye size={13} /> Ficha
                  </button>

                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      onClick={() => openCredentialModal(comp)}
                      title="Copiar Credenciales de Acceso"
                      style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#10b981', padding: '0.35rem 0.55rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <Key size={14} />
                    </button>

                    <button
                      onClick={() => openEditModal(comp)}
                      title="Modificar Plan y Cuotas"
                      style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', color: '#60a5fa', padding: '0.35rem 0.55rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <Edit size={14} />
                    </button>

                    <button
                      onClick={() => openSuspendModal(comp)}
                      title={comp.isActive ? "Suspender Servicio" : "Reactivar Servicio"}
                      style={{
                        background: comp.isActive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        border: `1px solid ${comp.isActive ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                        color: comp.isActive ? '#ef4444' : '#10b981',
                        padding: '0.35rem 0.55rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <Power size={14} />
                    </button>

                    <button
                      onClick={() => !isProtected && openDeleteModal(comp)}
                      disabled={isProtected}
                      title={isProtected ? "Empresa principal protegida" : "Dar de baja por completo (ARCO)"}
                      style={{
                        background: isProtected ? 'rgba(255, 255, 255, 0.02)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${isProtected ? 'rgba(255, 255, 255, 0.05)' : 'rgba(239, 68, 68, 0.25)'}`,
                        color: isProtected ? '#52525b' : '#f87171',
                        padding: '0.35rem 0.55rem',
                        borderRadius: '6px',
                        cursor: isProtected ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: ALTA DE NUEVA EMPRESA                            */}
      {/* ========================================================= */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setIsCreateModalOpen(false)}>
          <div 
            className="modal-content page-glow" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px', width: '90%', borderRadius: '16px', background: '#141416', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {createdSummary ? (
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

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    onClick={() => copyFullCredentials(createdSummary.company, createdSummary.initialPassword)}
                    style={{ ...btnPrimary, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    {copiedSuccess ? <Check size={18} /> : <Copy size={18} />}
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
              <form onSubmit={handleCreateCompany}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
                  <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={20} style={{ color: '#f97316' }} /> Alta de Nueva Empresa (Cliente B2B)
                  </h2>
                  <button type="button" onClick={() => setIsCreateModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#f97316', margin: '0 0 0.75rem', letterSpacing: '0.05em' }}>
                      1. Datos de la Empresa
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={labelStyle}>Nombre Comercial *</label>
                        <input 
                          type="text" 
                          required
                          placeholder="ej. Grupo Industrial Acme"
                          value={formData.name}
                          onChange={(e) => handleNameChange(e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Identificador Slug *</label>
                        <input 
                          type="text" 
                          required
                          placeholder="ej. grupo-acme"
                          value={formData.slug}
                          onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#3b82f6', margin: '0 0 0.75rem', letterSpacing: '0.05em' }}>
                      2. Plan Comercial y Cuotas
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                      {Object.keys(PLAN_PRESETS).map(planKey => {
                        const isSelected = formData.plan === planKey;
                        const p = PLAN_PRESETS[planKey];
                        return (
                          <div
                            key={planKey}
                            onClick={() => handlePlanChange(planKey)}
                            style={{
                              border: isSelected ? `2px solid ${p.badgeColor}` : '1px solid #27272a',
                              background: isSelected ? p.bgBadge : '#18181b',
                              borderRadius: '10px',
                              padding: '0.75rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            <div style={{ fontWeight: 700, color: isSelected ? p.badgeColor : '#fff', fontSize: '0.9rem' }}>{p.label}</div>
                            <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '0.25rem' }}>
                              {p.maxEmployees} empleados<br/>{p.maxDevices} kioscos
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={labelStyle}>Máx. Empleados Permitidos</label>
                        <input 
                          type="number" 
                          min="1"
                          required
                          value={formData.maxEmployees}
                          onChange={(e) => setFormData(prev => ({ ...prev, maxEmployees: parseInt(e.target.value, 10) || 1 }))}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Máx. Kioscos Físicos</label>
                        <input 
                          type="number" 
                          min="1"
                          required
                          value={formData.maxDevices}
                          onChange={(e) => setFormData(prev => ({ ...prev, maxDevices: parseInt(e.target.value, 10) || 1 }))}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#10b981', margin: '0 0 0.75rem', letterSpacing: '0.05em' }}>
                      3. Primer Usuario Administrador
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={labelStyle}>Nombre Completo *</label>
                        <input 
                          type="text" 
                          required
                          placeholder="ej. Lic. Roberto Gómez"
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
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <label style={{ ...labelStyle, margin: 0 }}>Contraseña Inicial *</label>
                        <button 
                          type="button" 
                          onClick={generateRandomPassword}
                          style={{ background: 'none', border: 'none', color: '#f97316', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <Sparkles size={12} /> Generar Segura
                        </button>
                      </div>
                      <input 
                        type="text" 
                        required
                        placeholder="Mínimo 6 caracteres"
                        value={formData.adminPassword}
                        onChange={(e) => setFormData(prev => ({ ...prev, adminPassword: e.target.value }))}
                        style={{ ...inputStyle, fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.25rem' }}>
                  <button type="button" onClick={() => setIsCreateModalOpen(false)} style={btnSecondary}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={isSubmitting} style={btnPrimary}>
                    {isSubmitting ? 'Registrando en BD...' : 'Aprovisionar Empresa'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: VER FICHA COMPLETA (DETALLES INTEGRALES DE TENANT)*/}
      {/* ========================================================= */}
      {detailCompany && (
        <div className="modal-overlay" onClick={() => setDetailCompany(null)}>
          <div 
            className="modal-content page-glow" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '800px', width: '92%', borderRadius: '16px', background: '#141416', border: '1px solid rgba(255, 255, 255, 0.12)', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Cabecera Ficha */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(249, 115, 22, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316', fontWeight: 800, fontSize: '1.3rem', border: '1px solid rgba(249, 115, 22, 0.3)' }}>
                  {detailCompany.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#fff' }}>{detailCompany.name}</h2>
                    <span style={{
                      padding: '0.2rem 0.6rem',
                      borderRadius: '99px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: detailCompany.isActive ? '#10b981' : '#ef4444',
                      background: detailCompany.isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      border: `1px solid ${detailCompany.isActive ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
                    }}>
                      {detailCompany.isActive ? 'Activa' : 'Suspendida'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.25rem', fontSize: '0.82rem', color: '#a1a1aa' }}>
                    <code>slug: {detailCompany.slug}</code>
                    <span>·</span>
                    <span>Zona: {detailCompany.timezone}</span>
                    <span>·</span>
                    <span>Alta: {new Date(detailCompany.createdAt).toLocaleDateString('es-MX')}</span>
                  </div>
                </div>
              </div>

              <button onClick={() => setDetailCompany(null)} style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>

            {/* Métricas Principales */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
              {/* Empleados */}
              <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: '0.78rem' }}>
                  <span>Empleados</span>
                  <Users size={16} style={{ color: '#f97316' }} />
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: '0.3rem 0' }}>
                  {detailData?._count?.employees ?? detailCompany._count?.employees ?? 0}
                  <span style={{ fontSize: '0.85rem', color: '#71717a', fontWeight: 400 }}> / {detailCompany.maxEmployees}</span>
                </div>
                <div style={{ height: '4px', background: '#27272a', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, Math.round(((detailData?._count?.employees ?? detailCompany._count?.employees ?? 0) / detailCompany.maxEmployees) * 100))}%`,
                    height: '100%',
                    background: '#f97316'
                  }} />
                </div>
              </div>

              {/* Cobertura Biométrica */}
              <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: '0.78rem' }}>
                  <span>Rostros Enrolados</span>
                  <Fingerprint size={16} style={{ color: '#10b981' }} />
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981', margin: '0.3rem 0' }}>
                  {detailData?._count?.enrolledEmployees ?? detailCompany._count?.enrolledEmployees ?? 0}
                  <span style={{ fontSize: '0.85rem', color: '#71717a', fontWeight: 400 }}>
                    {' '}({Math.round(((detailData?._count?.enrolledEmployees ?? detailCompany._count?.enrolledEmployees ?? 0) / Math.max(1, (detailData?._count?.employees ?? detailCompany._count?.employees ?? 1))) * 100)}%)
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>Cifrados con AES-256-GCM</span>
              </div>

              {/* Kioscos */}
              <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: '0.78rem' }}>
                  <span>Kioscos Físicos</span>
                  <Monitor size={16} style={{ color: '#3b82f6' }} />
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: '0.3rem 0' }}>
                  {detailData?._count?.devices ?? detailCompany._count?.devices ?? 0}
                  <span style={{ fontSize: '0.85rem', color: '#71717a', fontWeight: 400 }}> / {detailCompany.maxDevices}</span>
                </div>
                <div style={{ height: '4px', background: '#27272a', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, Math.round(((detailData?._count?.devices ?? detailCompany._count?.devices ?? 0) / detailCompany.maxDevices) * 100))}%`,
                    height: '100%',
                    background: '#3b82f6'
                  }} />
                </div>
              </div>

              {/* Asistencias Históricas */}
              <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: '0.78rem' }}>
                  <span>Asistencias Totales</span>
                  <Clock size={16} style={{ color: '#a855f7' }} />
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#a855f7', margin: '0.3rem 0' }}>
                  {detailData?._count?.attendances ?? 0}
                </div>
                <span style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>Registros auditados</span>
              </div>
            </div>

            {/* Banner de Empresa Suspendida con Auditoría (Día, Fecha, Hora y Administrador) */}
            {!detailCompany.isActive && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '12px',
                padding: '1.1rem 1.25rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1rem'
              }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  flexShrink: 0
                }}>
                  <AlertTriangle size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                    <strong style={{ color: '#ef4444', fontSize: '0.95rem' }}>Empresa Actualmente Suspendida</strong>
                    <span style={{ fontSize: '0.72rem', color: '#fca5a5', background: 'rgba(239, 68, 68, 0.2)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                      Acceso bloqueado en portal y kioscos
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem', marginTop: '0.65rem', fontSize: '0.83rem', color: '#d4d4d8' }}>
                    <div>
                      <span style={{ color: '#a1a1aa' }}>Día y Fecha: </span>
                      <strong style={{ color: '#fff' }}>
                        {formatSuspensionDetails(detailCompany.suspendedAt)?.capitalizedDay
                          ? `${formatSuspensionDetails(detailCompany.suspendedAt).capitalizedDay}, ${formatSuspensionDetails(detailCompany.suspendedAt).fullDate}`
                          : 'No registrada'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#a1a1aa' }}>Hora de Suspensión: </span>
                      <strong style={{ color: '#fca5a5' }}>
                        {formatSuspensionDetails(detailCompany.suspendedAt)?.time || 'No registrada'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#a1a1aa' }}>Suspendido por: </span>
                      <strong style={{ color: '#60a5fa' }}>
                        {detailCompany.suspendedByName || 'Super Administrador'}
                      </strong>
                    </div>
                    {detailCompany.suspensionReason && (
                      <div style={{ gridColumn: '1 / -1', marginTop: '0.2rem' }}>
                        <span style={{ color: '#a1a1aa' }}>Motivo / Justificación: </span>
                        <span style={{ color: '#fed7aa', fontStyle: 'italic' }}>
                          "{detailCompany.suspensionReason}"
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Pestañas de la Ficha */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #27272a', marginBottom: '1.25rem' }}>
              <button
                onClick={() => setDetailTab('overview')}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: detailTab === 'overview' ? '2px solid #f97316' : '2px solid transparent',
                  color: detailTab === 'overview' ? '#fff' : '#a1a1aa',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Resumen de Contrato
              </button>
              <button
                onClick={() => setDetailTab('admins')}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: detailTab === 'admins' ? '2px solid #f97316' : '2px solid transparent',
                  color: detailTab === 'admins' ? '#fff' : '#a1a1aa',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Administradores ({detailData?.adminUsers?.length ?? detailCompany.adminUsers?.length ?? 1})
              </button>
              <button
                onClick={() => setDetailTab('devices')}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: detailTab === 'devices' ? '2px solid #f97316' : '2px solid transparent',
                  color: detailTab === 'devices' ? '#fff' : '#a1a1aa',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Kioscos ({detailData?.devices?.length ?? 0})
              </button>
              <button
                onClick={() => setDetailTab('structure')}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: detailTab === 'structure' ? '2px solid #f97316' : '2px solid transparent',
                  color: detailTab === 'structure' ? '#fff' : '#a1a1aa',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Departamentos y Turnos
              </button>
            </div>

            {/* Contenido según pestaña */}
            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <RefreshCw className="spin" size={24} style={{ color: '#f97316', margin: '0 auto 0.5rem' }} />
                <p style={{ color: '#a1a1aa', fontSize: '0.85rem' }}>Cargando datos completos del cliente...</p>
              </div>
            ) : detailTab === 'overview' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.88rem' }}>
                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 1rem', color: '#f97316', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Shield size={16} /> Parámetros del Plan
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#a1a1aa' }}>Plan Contratado:</span>
                      <strong style={{ color: '#fff' }}>{detailCompany.plan}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#a1a1aa' }}>Límite Empleados:</span>
                      <span style={{ color: '#fff' }}>{detailCompany.maxEmployees}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#a1a1aa' }}>Límite Kioscos:</span>
                      <span style={{ color: '#fff' }}>{detailCompany.maxDevices}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#a1a1aa' }}>Dominio Dedicado:</span>
                      <span style={{ color: '#38bdf8' }}>{detailCompany.customDomain || 'No configurado (Usa app.dominio.com)'}</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 1rem', color: detailCompany.isActive ? '#10b981' : '#ef4444', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Info size={16} /> Estado del Servicio
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#a1a1aa' }}>Estado Operativo:</span>
                      <strong style={{ color: detailCompany.isActive ? '#10b981' : '#ef4444' }}>
                        {detailCompany.isActive ? 'Activo (En servicio)' : 'Suspendido (Bloqueado)'}
                      </strong>
                    </div>
                    {!detailCompany.isActive && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#a1a1aa' }}>Día de Suspensión:</span>
                          <span style={{ color: '#fff', fontWeight: 600 }}>{formatSuspensionDetails(detailCompany.suspendedAt)?.capitalizedDay || 'N/A'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#a1a1aa' }}>Fecha de Suspensión:</span>
                          <span style={{ color: '#fff' }}>{formatSuspensionDetails(detailCompany.suspendedAt)?.fullDate || 'N/A'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#a1a1aa' }}>Hora de Suspensión:</span>
                          <span style={{ color: '#ef4444', fontWeight: 600 }}>{formatSuspensionDetails(detailCompany.suspendedAt)?.time || 'N/A'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#a1a1aa' }}>Administrador:</span>
                          <span style={{ color: '#60a5fa', fontWeight: 500 }}>{detailCompany.suspendedByName || 'Super Administrador'}</span>
                        </div>
                        {detailCompany.suspensionReason && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#a1a1aa' }}>Motivo:</span>
                            <span style={{ color: '#fed7aa', fontSize: '0.82rem', textAlign: 'right', maxWidth: '60%' }}>{detailCompany.suspensionReason}</span>
                          </div>
                        )}
                      </>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#a1a1aa' }}>Zona Horaria:</span>
                      <span style={{ color: '#fff' }}>{detailCompany.timezone}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#a1a1aa' }}>Portal Web:</span>
                      <span style={{ color: '#fff' }}>{window.location.origin}/login</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#a1a1aa' }}>Versión Descriptores:</span>
                      <span style={{ color: '#eab308' }}>v{detailCompany.descriptorsVersion || 1} (128 floats)</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : detailTab === 'admins' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(detailData?.adminUsers ?? detailCompany.adminUsers ?? []).map(admin => (
                  <div key={admin.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '1rem' }}>
                    <div>
                      <strong style={{ color: '#fff', fontSize: '0.92rem' }}>{admin.name}</strong>
                      <div style={{ color: '#10b981', fontSize: '0.82rem', marginTop: '0.15rem' }}>{admin.email}</div>
                      <span style={{ color: '#71717a', fontSize: '0.75rem' }}>Alta: {new Date(admin.createdAt).toLocaleDateString('es-MX')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                        {admin.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : detailTab === 'devices' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(!detailData?.devices || detailData.devices.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#71717a' }}>
                    La empresa aún no tiene kioscos físicos autorizados. Se emparejan desde /kiosk/setup con código de 8 caracteres.
                  </div>
                ) : (
                  detailData.devices.map(dev => (
                    <div key={dev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '1rem' }}>
                      <div>
                        <strong style={{ color: '#fff', fontSize: '0.92rem' }}>{dev.name}</strong>
                        <div style={{ color: '#a1a1aa', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                          IP: <code>{dev.ipAddress || 'Dinámica'}</code> · Tipo: {dev.type || 'KIOSK'}
                        </div>
                        {dev.lastSeenAt && (
                          <span style={{ color: '#71717a', fontSize: '0.75rem' }}>
                            Última conexión: {new Date(dev.lastSeenAt).toLocaleString('es-MX')}
                          </span>
                        )}
                      </div>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '99px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: dev.isActive ? '#10b981' : '#ef4444',
                        background: dev.isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'
                      }}>
                        {dev.isActive ? 'En línea' : 'Inactivo'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 1rem', color: '#fff', fontSize: '0.9rem' }}>
                    Departamentos ({detailData?.departments?.length ?? 0})
                  </h4>
                  {(!detailData?.departments || detailData.departments.length === 0) ? (
                    <span style={{ color: '#71717a', fontSize: '0.82rem' }}>Sin departamentos creados aún.</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {detailData.departments.map(dept => (
                        <div key={dept.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: '#d4d4d8' }}>{dept.name}</span>
                          <span style={{ color: '#f97316', fontWeight: 600 }}>{dept._count?.employees || 0} emp</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 1rem', color: '#fff', fontSize: '0.9rem' }}>
                    Turnos ({detailData?.shifts?.length ?? 0})
                  </h4>
                  {(!detailData?.shifts || detailData.shifts.length === 0) ? (
                    <span style={{ color: '#71717a', fontSize: '0.82rem' }}>Sin turnos configurados aún.</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {detailData.shifts.map(shift => (
                        <div key={shift.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: '#d4d4d8' }}>{shift.name}</span>
                          <code style={{ color: '#38bdf8' }}>{shift.startTime} - {shift.endTime}</code>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Barra de Acciones de la Ficha */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.5rem', marginTop: '1.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => openCredentialModal(detailCompany)}
                  style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                >
                  <Key size={15} /> Credenciales de Acceso
                </button>
                <button
                  onClick={() => openEditModal(detailCompany)}
                  style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#60a5fa', borderColor: 'rgba(59, 130, 246, 0.3)' }}
                >
                  <Edit size={15} /> Modificar Cuotas
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => openSuspendModal(detailCompany)}
                  style={{
                    ...btnSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    color: detailCompany.isActive ? '#ef4444' : '#10b981',
                    borderColor: detailCompany.isActive ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <Power size={15} /> {detailCompany.isActive ? 'Suspender Servicio' : 'Reactivar Servicio'}
                </button>
                {detailCompany.id !== 'default-company-pain' && (
                  <button
                    onClick={() => openDeleteModal(detailCompany)}
                    style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                  >
                    <Trash2 size={15} /> Dar de Baja
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: CREDENCIALES DE ACCESO Y COPIADO EN 1 CLIC        */}
      {/* ========================================================= */}
      {credentialCompany && (
        <div className="modal-overlay" onClick={() => setCredentialCompany(null)}>
          <div 
            className="modal-content page-glow" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '560px', width: '90%', borderRadius: '16px', background: '#141416', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '2rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={20} style={{ color: '#10b981' }} /> Credenciales de Acceso
              </h2>
              <button onClick={() => setCredentialCompany(null)} style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ color: '#a1a1aa', fontSize: '0.88rem', margin: '0 0 1.25rem' }}>
              Copia los datos de acceso para entregárselos al cliente o genera una nueva contraseña temporal si la olvidó.
            </p>

            <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#a1a1aa' }}>Empresa:</span>
                <strong style={{ color: '#fff' }}>{credentialCompany.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#a1a1aa' }}>Identificador (Slug):</span>
                <code style={{ color: '#f97316' }}>{credentialCompany.slug}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#a1a1aa' }}>Portal Web:</span>
                <span style={{ color: '#fff' }}>{window.location.origin}/login</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#a1a1aa' }}>Usuario Admin:</span>
                <strong style={{ color: '#10b981' }}>{credentialCompany.adminUsers?.[0]?.email || 'Sin admin asignado'}</strong>
              </div>

              {credGeneratedPassword && (
                <div style={{ borderTop: '1px solid #27272a', paddingTop: '0.75rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#eab308', fontWeight: 600 }}>Nueva Clave Temporal:</span>
                  <code style={{ fontSize: '1rem', color: '#eab308', background: 'rgba(234, 179, 8, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                    {credGeneratedPassword}
                  </code>
                </div>
              )}
            </div>

            {/* Restablecer Contraseña */}
            <div style={{ background: 'rgba(234, 179, 8, 0.05)', border: '1px solid rgba(234, 179, 8, 0.15)', borderRadius: '10px', padding: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#eab308', fontWeight: 600, fontSize: '0.85rem' }}>¿El cliente olvidó su contraseña?</div>
                  <div style={{ color: '#a1a1aa', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                    Genera una contraseña nueva y segura en 1 clic directamente en la base de datos.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetAdminPassword}
                  disabled={credResetLoading}
                  style={{ ...btnSecondary, padding: '0.45rem 0.85rem', fontSize: '0.8rem', color: '#eab308', borderColor: 'rgba(234, 179, 8, 0.3)', whiteSpace: 'nowrap' }}
                >
                  {credResetLoading ? 'Generando...' : 'Generar Nueva Clave'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => copyFullCredentials(credentialCompany, credGeneratedPassword)}
                style={{ ...btnPrimary, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {credCopied ? <Check size={18} /> : <Copy size={18} />}
                {credCopied ? '¡Credenciales Copiadas!' : 'Copiar Plantilla de Acceso'}
              </button>
              <button onClick={() => setCredentialCompany(null)} style={btnSecondary}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: SUSPENSIÓN / REACTIVACIÓN CON ESTILOS RICOS     */}
      {/* ========================================================= */}
      {suspendModalCompany && (
        <div className="modal-overlay" onClick={() => !isSuspending && setSuspendModalCompany(null)}>
          <div 
            className="modal-content page-glow" 
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '520px',
              width: '90%',
              borderRadius: '16px',
              background: '#141416',
              border: `1px solid ${suspendModalCompany.isActive ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
              padding: '2rem'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: suspendModalCompany.isActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: suspendModalCompany.isActive ? '#ef4444' : '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                border: `1px solid ${suspendModalCompany.isActive ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
              }}>
                <Power size={30} />
              </div>
              <h2 style={{ color: '#fff', margin: '0 0 0.5rem', fontSize: '1.35rem' }}>
                {suspendModalCompany.isActive ? `¿Suspender servicio de "${suspendModalCompany.name}"?` : `¿Reactivar servicio de "${suspendModalCompany.name}"?`}
              </h2>
              <p style={{ color: '#a1a1aa', fontSize: '0.88rem', margin: 0 }}>
                {suspendModalCompany.isActive
                  ? 'Al suspender, los administradores perderán acceso al portal y los kioscos físicos se desconectarán de inmediato.'
                  : 'Al reactivar, se restaurará el acceso de sus usuarios y los kioscos podrán volver a checar asistencias.'
                }
              </p>
            </div>

            {!suspendModalCompany.isActive && suspendModalCompany.suspendedAt && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem',
                fontSize: '0.82rem',
                textAlign: 'left'
              }}>
                <div style={{ color: '#fca5a5', fontWeight: 600, marginBottom: '0.25rem' }}>Registro de Suspensión Previa:</div>
                <div style={{ color: '#d4d4d8' }}>
                  <strong>Día y Fecha:</strong> {formatSuspensionDetails(suspendModalCompany.suspendedAt)?.capitalizedDay}, {formatSuspensionDetails(suspendModalCompany.suspendedAt)?.fullDate} a las {formatSuspensionDetails(suspendModalCompany.suspendedAt)?.time}
                </div>
                <div style={{ color: '#d4d4d8', marginTop: '0.2rem' }}>
                  <strong>Suspendido por:</strong> <span style={{ color: '#60a5fa' }}>{suspendModalCompany.suspendedByName || 'Super Administrador'}</span>
                </div>
                {suspendModalCompany.suspensionReason && (
                  <div style={{ color: '#fed7aa', marginTop: '0.2rem', fontStyle: 'italic' }}>
                    <strong>Motivo:</strong> "{suspendModalCompany.suspensionReason}"
                  </div>
                )}
              </div>
            )}

            <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div style={{ color: '#d4d4d8', fontWeight: 600, marginBottom: '0.4rem' }}>Consecuencias operativas:</div>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#a1a1aa' }}>
                {suspendModalCompany.isActive ? (
                  <>
                    <li>Peticiones HTTP retornarán <code style={{ color: '#ef4444' }}>HTTP 403 COMPANY_SUSPENDED</code>.</li>
                    <li>WebSockets de kioscos físicos se desconectarán forzosamente en tiempo real.</li>
                    <li>No se registrarán nuevas asistencias en sucursal.</li>
                  </>
                ) : (
                  <>
                    <li>Administradores podrán iniciar sesión nuevamente en el portal.</li>
                    <li>Kioscos autorizados podrán reanudar checadas biométricas faciales.</li>
                  </>
                )}
              </ul>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>Motivo / Justificación de la acción:</label>
              <input 
                type="text" 
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="ej. Retraso en pago de mensualidad o solicitud comercial"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => setSuspendModalCompany(null)} 
                disabled={isSuspending}
                style={btnSecondary}
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleConfirmSuspend}
                disabled={isSuspending}
                style={{
                  ...btnPrimary,
                  background: suspendModalCompany.isActive ? '#ef4444' : '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {isSuspending ? 'Actualizando estado...' : (suspendModalCompany.isActive ? 'Confirmar Suspensión' : 'Confirmar Reactivación')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: DAR DE BAJA DEFINITIVA (DERECHO ARCO / PURGA)     */}
      {/* ========================================================= */}
      {deleteModalCompany && (
        <div className="modal-overlay" onClick={() => !isDeleting && setDeleteModalCompany(null)}>
          <div 
            className="modal-content page-glow" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '540px', width: '90%', borderRadius: '16px', background: '#141416', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '2rem' }}
          >
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <AlertTriangle size={32} />
              </div>
              <h2 style={{ color: '#fff', margin: '0 0 0.5rem', fontSize: '1.35rem' }}>
                Baja Definitiva y Purga Total (ARCO)
              </h2>
              <p style={{ color: '#fca5a5', fontSize: '0.88rem', margin: 0 }}>
                Esta acción es <strong>irreversible</strong>. Se eliminará la empresa "{deleteModalCompany.name}" y todos sus datos en MariaDB.
              </p>
            </div>

            <div style={{ background: '#1c1515', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div style={{ color: '#ef4444', fontWeight: 700, marginBottom: '0.4rem' }}>Datos que serán destruidos permanentemente:</div>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#d4d4d8' }}>
                <li>Todos los perfiles de empleados y vectores faciales cifrados (AES-256).</li>
                <li>La totalidad de asistencias y eventos registrados.</li>
                <li>Desconexión y revocación definitiva de todos sus kioscos físicos.</li>
                <li>Departamentos, turnos, administradores y configuraciones.</li>
              </ul>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ ...labelStyle, color: '#fca5a5' }}>
                Para confirmar la purga definitiva, escribe el slug de la empresa: <code style={{ color: '#fff', fontWeight: 700 }}>{deleteModalCompany.slug}</code>
              </label>
              <input 
                type="text" 
                value={deleteConfirmSlug}
                onChange={(e) => setDeleteConfirmSlug(e.target.value)}
                placeholder={deleteModalCompany.slug}
                style={{ ...inputStyle, borderColor: deleteConfirmSlug === deleteModalCompany.slug ? '#ef4444' : '#27272a' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => setDeleteModalCompany(null)} 
                disabled={isDeleting}
                style={btnSecondary}
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting || deleteConfirmSlug !== deleteModalCompany.slug}
                style={{
                  ...btnPrimary,
                  background: '#ef4444',
                  cursor: (isDeleting || deleteConfirmSlug !== deleteModalCompany.slug) ? 'not-allowed' : 'pointer',
                  opacity: deleteConfirmSlug === deleteModalCompany.slug ? 1 : 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {isDeleting ? 'Purgando datos de MariaDB...' : 'Eliminar Empresa Definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 6: EDICIÓN DE CUOTAS Y PLAN                         */}
      {/* ========================================================= */}
      {editingCompany && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setEditingCompany(null)}>
          <div 
            className="modal-content page-glow" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px', width: '90%', borderRadius: '16px', background: '#141416', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '2rem' }}
          >
            <form onSubmit={handleUpdateCompany}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Edit size={18} style={{ color: '#3b82f6' }} /> Modificar Plan y Cuotas: {editingCompany.name}
                </h2>
                <button type="button" onClick={() => setEditingCompany(null)} style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={labelStyle}>Nombre Comercial</label>
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

// --- Estilos de Apoyo (Compactos) ---
const thCompact = {
  padding: '0.85rem 0.85rem',
  color: '#a1a1aa',
  fontSize: '0.78rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em'
};

const tdCompact = {
  padding: '0.75rem 0.85rem',
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
