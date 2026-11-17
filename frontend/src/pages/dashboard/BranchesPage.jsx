import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Users, Monitor, Plus, RefreshCw, AlertCircle, 
  CheckCircle2, Copy, Check, Edit, Power, Search, Filter, 
  Clock, Globe, Shield, Sparkles, X, ChevronRight, Key,
  Trash2, Eye, AlertTriangle, ShieldCheck, Fingerprint, Calendar,
  ArrowUpRight, Info, LayoutGrid, List, UserCheck, Timer, BellRing,
  GitBranch, CheckSquare, ExternalLink, Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import api from '../../utils/api';

const TIMEZONE_GROUPS = [
  {
    id: 'America/Mexico_City',
    label: 'Tiempo del Centro (CDMX, Puebla, Veracruz, Oaxaca, Querétaro, Gdl, Monterrey...)',
    short: 'Centro (UTC-6)'
  },
  {
    id: 'America/Cancun',
    label: 'Tiempo del Sureste (Cancún, Playa del Carmen, Tulum - Quintana Roo)',
    short: 'Sureste (UTC-5)'
  },
  {
    id: 'America/Tijuana',
    label: 'Tiempo del Noroeste (Tijuana, Mexicali, Ensenada - Baja California)',
    short: 'Noroeste (UTC-8)'
  },
  {
    id: 'America/Hermosillo',
    label: 'Tiempo del Pacífico (Hermosillo, Nogales, Cd. Obregón - Sonora)',
    short: 'Sonora (UTC-7)'
  },
  {
    id: 'America/Mazatlan',
    label: 'Tiempo del Pacífico Sur (Mazatlán, Culiacán, La Paz, Los Cabos)',
    short: 'Pacífico (UTC-7)'
  },
  {
    id: 'America/Ciudad_Juarez',
    label: 'Tiempo Fronterizo Norte (Ciudad Juárez, Chihuahua)',
    short: 'Chihuahua Frontera (UTC-6)'
  },
  {
    id: 'America/Bogota',
    label: 'Colombia / Perú (Bogotá, Medellín, Cali, Lima)',
    short: 'Sudamérica (UTC-5)'
  },
  {
    id: 'America/Santiago',
    label: 'Chile (Santiago)',
    short: 'Chile (UTC-4 / UTC-3)'
  },
  {
    id: 'America/Buenos_Aires',
    label: 'Argentina (Buenos Aires, Córdoba, Rosario)',
    short: 'Argentina (UTC-3)'
  },
  {
    id: 'America/New_York',
    label: 'Estados Unidos - Este (Nueva York, Miami, Atlanta)',
    short: 'EE.UU. Este (UTC-5)'
  },
  {
    id: 'America/Los_Angeles',
    label: 'Estados Unidos - Pacífico (Los Ángeles, San Francisco, Seattle)',
    short: 'EE.UU. Pacífico (UTC-8)'
  },
  {
    id: 'Europe/Madrid',
    label: 'España (Madrid, Barcelona, Valencia)',
    short: 'España (UTC+1)'
  }
];

export default function BranchesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [holdingMetrics, setHoldingMetrics] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filtros y Vista
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, INACTIVE
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('branches_view_mode') || 'grid');

  // Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isCredentialsSummaryOpen, setIsCredentialsSummaryOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Formulario Alta Sucursal
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    timezone: 'America/Mexico_City',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    adminRole: 'ADMIN'
  });

  // Formulario Edición Sucursal
  const [editForm, setEditForm] = useState({
    name: '',
    timezone: 'America/Mexico_City'
  });

  // Resumen de credenciales creadas o reseteadas
  const [credentialsSummary, setCredentialsSummary] = useState(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('');

  const fetchBranches = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    setError(null);
    try {
      const res = await api.get('/branches');
      if (res.data.success) {
        setHoldingMetrics(res.data.holding);
        setBranches(res.data.branches || []);
      }
    } catch (err) {
      console.error('Error al cargar sucursales:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || 'No se pudieron cargar las sucursales.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      if (showRefreshIndicator) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('branches_view_mode', mode);
  };

  // Filtrado de sucursales
  const filteredBranches = useMemo(() => {
    return branches.filter((branch) => {
      const matchesSearch = 
        branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (branch.adminUsers && branch.adminUsers.some(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.email.toLowerCase().includes(searchTerm.toLowerCase())));

      const matchesStatus = 
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && branch.isActive) ||
        (statusFilter === 'INACTIVE' && !branch.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [branches, searchTerm, statusFilter]);

  // Generar contraseña segura de 12 caracteres
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  // Auto-slug al escribir el nombre
  const handleNameChange = (e) => {
    const val = e.target.value;
    const generatedSlug = val.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setCreateForm(prev => ({
      ...prev,
      name: val,
      slug: prev.slug === '' || prev.slug === generatedSlug.slice(0, -1) ? generatedSlug : prev.slug
    }));
  };

  // Submit Alta Sucursal
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.name || createForm.name.trim().length < 2) {
      toast.error('El nombre de la sucursal es obligatorio (mínimo 2 caracteres).');
      return;
    }

    if (holdingMetrics && holdingMetrics.remainingBranches <= 0) {
      toast.error('Límite de sucursales alcanzado. Contacte a PAIN para ampliar su plan.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: createForm.name.trim(),
        slug: createForm.slug.trim(),
        timezone: createForm.timezone,
        ...(createForm.adminEmail ? {
          adminName: createForm.adminName.trim() || `Admin ${createForm.name.trim()}`,
          adminEmail: createForm.adminEmail.trim().toLowerCase(),
          adminPassword: createForm.adminPassword || generateRandomPassword(),
          adminRole: createForm.adminRole
        } : {})
      };

      const res = await api.post('/branches', payload);
      if (res.data.success) {
        toast.success(`Sucursal "${res.data.branch.name}" creada con éxito.`);
        setIsCreateOpen(false);
        fetchBranches();

        if (res.data.admin) {
          setCredentialsSummary({
            branchName: res.data.branch.name,
            slug: res.data.branch.slug,
            adminName: res.data.admin.name,
            adminEmail: res.data.admin.email,
            adminRole: res.data.admin.role,
            password: payload.adminPassword,
            isNew: true
          });
          setIsCredentialsSummaryOpen(true);
        }

        // Reset form
        setCreateForm({
          name: '',
          slug: '',
          timezone: 'America/Mexico_City',
          adminName: '',
          adminEmail: '',
          adminPassword: '',
          adminRole: 'ADMIN'
        });
      }
    } catch (err) {
      console.error('Error al crear sucursal:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Error al crear sucursal.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Alternar Activo/Pausa de Sucursal
  const handleToggleActive = async (branch) => {
    try {
      const newStatus = !branch.isActive;
      const res = await api.patch(`/branches/${branch.id}`, { isActive: newStatus });
      if (res.data.success) {
        toast.success(newStatus ? `Sucursal "${branch.name}" reactivada.` : `Sucursal "${branch.name}" pausada.`);
        fetchBranches();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al actualizar estado de la sucursal.');
    }
  };

  // Entrar a una sucursal específica (Impersonación de Sucursal)
  const handleEnterBranch = (branch) => {
    localStorage.setItem('activeBranchId', branch.id);
    localStorage.setItem('activeBranchName', branch.name);
    window.dispatchEvent(new Event('branch:changed'));
    toast.success(`Cambiando a la vista de: ${branch.name}`);
    navigate('/dashboard');
  };

  // Regresar a la vista global de todo el Holding
  const handleSwitchToHolding = () => {
    localStorage.removeItem('activeBranchId');
    localStorage.removeItem('activeBranchName');
    window.dispatchEvent(new Event('branch:changed'));
    toast.info('Vista consolidada: Toda la red de sucursales');
    navigate('/dashboard');
  };

  // Submit Edición Sucursal
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.name || editForm.name.trim().length < 2) {
      toast.error('El nombre de la sucursal es obligatorio.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.patch(`/branches/${selectedBranch.id}`, {
        name: editForm.name.trim(),
        timezone: editForm.timezone
      });
      if (res.data.success) {
        toast.success('Sucursal actualizada con éxito.');
        setIsEditOpen(false);
        fetchBranches();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al actualizar sucursal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Restablecer contraseña de administrador de sucursal
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.post(`/branches/${selectedBranch.id}/reset-admin-password`, {
        password: resetPasswordInput.trim() || undefined
      });
      if (res.data.success) {
        toast.success('Contraseña restablecida correctamente.');
        setIsResetPasswordOpen(false);
        setCredentialsSummary({
          branchName: selectedBranch.name,
          adminEmail: res.data.email,
          adminRole: res.data.role,
          password: res.data.newPassword,
          isReset: true
        });
        setIsCredentialsSummaryOpen(true);
        setResetPasswordInput('');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Error al restablecer contraseña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copiar al portapapeles
  const handleCopyCredentials = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedSuccess(true);
    toast.success('Copiado al portapapeles');
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  // Porcentaje de cuota de sucursales
  const branchUsagePercent = holdingMetrics 
    ? Math.min(100, Math.round(((holdingMetrics.currentBranches || 0) / (holdingMetrics.maxBranches || 1)) * 100))
    : 0;

  const isLimitReached = holdingMetrics && holdingMetrics.remainingBranches <= 0;

  return (
    <div style={{ padding: '1.5rem', color: 'var(--text-main)', minHeight: '100%' }}>
      {/* Encabezado Principal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: 'rgba(249, 115, 22, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-orange)' }}>
              <Building2 size={20} />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>Mis Sucursales</h1>
            <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.2rem 0.6rem', borderRadius: '99px', fontWeight: '600' }}>
              Red Holding
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Administre las sucursales, plantas y ubicaciones independientes de su organización.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => fetchBranches(true)}
            disabled={isRefreshing}
            style={{
              padding: '0.6rem 0.9rem',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-main)',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem'
            }}
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            Actualizar
          </button>

          <button
            onClick={() => {
              if (isLimitReached) {
                toast.error(`Ha alcanzado el tope de ${holdingMetrics?.maxBranches} sucursales contratadas.`);
                return;
              }
              setCreateForm({
                name: '',
                slug: '',
                timezone: 'America/Mexico_City',
                adminName: '',
                adminEmail: '',
                adminPassword: generateRandomPassword(),
                adminRole: 'ADMIN'
              });
              setIsCreateOpen(true);
            }}
            disabled={isLimitReached}
            style={{
              padding: '0.6rem 1.1rem',
              backgroundColor: isLimitReached ? 'rgba(255, 255, 255, 0.1)' : 'var(--primary-orange)',
              border: 'none',
              borderRadius: '8px',
              color: isLimitReached ? 'var(--text-muted)' : 'white',
              fontWeight: '600',
              cursor: isLimitReached ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              boxShadow: isLimitReached ? 'none' : '0 4px 12px rgba(249, 115, 22, 0.3)'
            }}
          >
            <Plus size={16} />
            Nueva Sucursal
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas de Cuota del Holding */}
      {holdingMetrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Tarjeta 1: Cuota de Sucursales */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.2rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Cupo de Sucursales
              </span>
              <Building2 size={18} style={{ color: isLimitReached ? '#ef4444' : 'var(--primary-orange)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{holdingMetrics.currentBranches}</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ {holdingMetrics.maxBranches} contratadas</span>
            </div>
            {/* Barra de Progreso */}
            <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden', marginBottom: '0.5rem' }}>
              <div 
                style={{ 
                  width: `${branchUsagePercent}%`, 
                  height: '100%', 
                  backgroundColor: isLimitReached ? '#ef4444' : branchUsagePercent > 80 ? '#f59e0b' : '#10b981',
                  transition: 'width 0.4s ease'
                }} 
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>{branchUsagePercent}% utilizado</span>
              <span style={{ color: isLimitReached ? '#ef4444' : '#10b981', fontWeight: '600' }}>
                {isLimitReached ? 'Límite alcanzado' : `${holdingMetrics.remainingBranches} cupos libres`}
              </span>
            </div>
          </div>

          {/* Tarjeta 2: Bolsa de Empleados */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Empleados en la Red
              </span>
              <Users size={18} style={{ color: '#3b82f6' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{holdingMetrics.totalEmployees}</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>colaboradores</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Bolsa global asignada a la matriz: <strong style={{ color: 'var(--text-main)' }}>{holdingMetrics.maxEmployees} máx.</strong>
            </p>
          </div>

          {/* Tarjeta 3: Kioscos Vinculados */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Kioscos Activos
              </span>
              <Monitor size={18} style={{ color: '#a855f7' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{holdingMetrics.totalDevices}</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>tablets / cámaras</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Límite de terminales en red: <strong style={{ color: 'var(--text-main)' }}>{holdingMetrics.maxDevices} kioscos</strong>
            </p>
          </div>

          {/* Tarjeta 4: Switch a Vista Nacional */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
                  Vista Operativa
                </span>
                <Globe size={18} style={{ color: '#10b981' }} />
              </div>
              <p style={{ margin: '0 0 0.8rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {localStorage.getItem('activeBranchName') 
                  ? `Viendo: ${localStorage.getItem('activeBranchName')}`
                  : 'Viendo: Toda la Red Nacional'}
              </p>
            </div>
            {localStorage.getItem('activeBranchId') ? (
              <button
                onClick={handleSwitchToHolding}
                style={{
                  padding: '0.4rem 0.8rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '6px',
                  color: '#60a5fa',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.3rem'
                }}
              >
                <Globe size={14} /> Volver a Vista Nacional
              </button>
            ) : (
              <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <CheckCircle2 size={14} /> Dashboard Consolidado Activo
              </span>
            )}
          </div>
        </div>
      )}

      {/* Alerta de Límite de Cupo si está lleno */}
      {isLimitReached && (
        <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#fca5a5', fontSize: '0.85rem' }}>
          <AlertCircle size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#ef4444' }}>Límite de sucursales alcanzado:</strong> Ha utilizado las {holdingMetrics?.maxBranches} sucursales permitidas para su plan. Si necesita aperturar nuevas ubicaciones o centros de trabajo, contacte al equipo de soporte de PAIN para ampliar su paquete.
          </div>
        </div>
      )}

      {/* Barra de Filtros y Modo de Vista */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '240px' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar por nombre, slug o administrador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.8rem 0.55rem 2.4rem',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              onClick={() => setStatusFilter('ALL')}
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: statusFilter === 'ALL' ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                color: statusFilter === 'ALL' ? 'var(--primary-orange)' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: statusFilter === 'ALL' ? '600' : 'normal',
                cursor: 'pointer'
              }}
            >
              Todas ({branches.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: statusFilter === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                color: statusFilter === 'ACTIVE' ? '#10b981' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: statusFilter === 'ACTIVE' ? '600' : 'normal',
                cursor: 'pointer'
              }}
            >
              Activas ({branches.filter(b => b.isActive).length})
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: statusFilter === 'INACTIVE' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                color: statusFilter === 'INACTIVE' ? '#ef4444' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: statusFilter === 'INACTIVE' ? '600' : 'normal',
                cursor: 'pointer'
              }}
            >
              Pausadas ({branches.filter(b => !b.isActive).length})
            </button>
          </div>
        </div>

        {/* Selector de Modo de Vista */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: 'rgba(255, 255, 255, 0.04)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => handleViewModeChange('grid')}
            title="Vista de Tarjetas"
            style={{
              padding: '0.4rem',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: viewMode === 'grid' ? 'var(--primary-orange)' : 'transparent',
              color: viewMode === 'grid' ? 'white' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => handleViewModeChange('table')}
            title="Vista de Lista"
            style={{
              padding: '0.4rem',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: viewMode === 'table' ? 'var(--primary-orange)' : 'transparent',
              color: viewMode === 'table' ? 'white' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Contenido: Grid o Tabla */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 1rem', color: 'var(--primary-orange)' }} />
          <p>Cargando red de sucursales...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <AlertCircle size={36} style={{ color: '#ef4444', margin: '0 auto 0.8rem' }} />
          <h3 style={{ margin: '0 0 0.5rem', color: '#ef4444' }}>Error al cargar</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>{error}</p>
          <button onClick={() => fetchBranches()} style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--primary-orange)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: '600' }}>
            Reintentar
          </button>
        </div>
      ) : filteredBranches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
          <Building2 size={42} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>No se encontraron sucursales</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto 1.2rem' }}>
            {searchTerm || statusFilter !== 'ALL'
              ? 'No hay sucursales que coincidan con los filtros de búsqueda aplicados.'
              : 'Aún no ha dado de alta sucursales para su empresa. Registre la primera para comenzar a desplegar kioscos y personal.'}
          </p>
          {!isLimitReached && (
            <button
              onClick={() => {
                setCreateForm({
                  name: '',
                  slug: '',
                  timezone: 'America/Mexico_City',
                  adminName: '',
                  adminEmail: '',
                  adminPassword: generateRandomPassword(),
                  adminRole: 'ADMIN'
                });
                setIsCreateOpen(true);
              }}
              style={{
                padding: '0.6rem 1.2rem',
                backgroundColor: 'var(--primary-orange)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem'
              }}
            >
              <Plus size={16} /> Crear Primera Sucursal
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* VISTA DE TARJETAS (GRID) */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.2rem' }}>
          {filteredBranches.map((branch) => {
            const isCurrentlySelected = localStorage.getItem('activeBranchId') === branch.id;
            const primaryAdmin = branch.adminUsers?.[0];

            return (
              <div 
                key={branch.id} 
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: isCurrentlySelected ? '1px solid var(--primary-orange)' : '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: isCurrentlySelected ? '0 0 16px rgba(249, 115, 22, 0.15)' : 'none',
                  transition: 'transform 0.2s ease, border-color 0.2s ease'
                }}
              >
                <div>
                  {/* Encabezado de Tarjeta */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {branch.name}
                        </h3>
                        {isCurrentlySelected && (
                          <span style={{ fontSize: '0.65rem', backgroundColor: 'var(--primary-orange)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '99px', fontWeight: 'bold' }}>
                            Activa
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {branch.slug}
                      </span>
                    </div>

                    <span 
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '99px',
                        fontWeight: '600',
                        backgroundColor: branch.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: branch.isActive ? '#10b981' : '#ef4444',
                        flexShrink: 0
                      }}
                    >
                      {branch.isActive ? 'Operando' : 'Pausada'}
                    </span>
                  </div>

                  {/* Badges de Métricas */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 0.4rem', marginBottom: '1rem', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                        {branch._count?.employees || 0}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}>
                        <Users size={11} /> Personal
                      </div>
                    </div>
                    <div style={{ borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#a855f7' }}>
                        {branch._count?.devices || 0}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}>
                        <Monitor size={11} /> Kioscos
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#3b82f6' }}>
                        {branch._count?.branchAccesses || 0}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}>
                        <CheckSquare size={11} /> Accesos
                      </div>
                    </div>
                  </div>

                  {/* Datos del Responsable / Admin */}
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Clock size={13} style={{ flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {branch.timezone}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ShieldCheck size={13} style={{ flexShrink: 0, color: primaryAdmin ? '#10b981' : 'var(--text-muted)' }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {primaryAdmin ? `${primaryAdmin.name} (${primaryAdmin.email})` : 'Sin administrador asignado'}
                    </span>
                  </div>
                </div>

                {/* Botones de Acción */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem', display: 'flex', gap: '0.5rem' }}>
                  {isCurrentlySelected ? (
                    <button
                      onClick={handleSwitchToHolding}
                      style={{
                        flex: 1,
                        padding: '0.55rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        color: 'var(--text-main)',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Globe size={14} /> Salir a Nacional
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEnterBranch(branch)}
                      style={{
                        flex: 1,
                        padding: '0.55rem',
                        backgroundColor: 'var(--primary-orange)',
                        border: 'none',
                        borderRadius: '6px',
                        color: 'white',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <ExternalLink size={14} /> Entrar a Sucursal
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setSelectedBranch(branch);
                      setEditForm({ name: branch.name, timezone: branch.timezone });
                      setIsEditOpen(true);
                    }}
                    title="Editar Sucursal"
                    style={{
                      padding: '0.55rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: 'var(--text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    <Edit size={14} />
                  </button>

                  <button
                    onClick={() => {
                      setSelectedBranch(branch);
                      setIsResetPasswordOpen(true);
                    }}
                    title="Restablecer Contraseña del Administrador Local"
                    style={{
                      padding: '0.55rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: '#fbbf24',
                      cursor: 'pointer'
                    }}
                  >
                    <Key size={14} />
                  </button>

                  <button
                    onClick={() => handleToggleActive(branch)}
                    title={branch.isActive ? 'Pausar Sucursal' : 'Reactivar Sucursal'}
                    style={{
                      padding: '0.55rem',
                      backgroundColor: branch.isActive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      border: branch.isActive ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
                      borderRadius: '6px',
                      color: branch.isActive ? '#ef4444' : '#10b981',
                      cursor: 'pointer'
                    }}
                  >
                    <Power size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA DE LISTA (TABLA) */
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.8rem 1rem' }}>Sucursal</th>
                  <th style={{ padding: '0.8rem 1rem' }}>Identificador</th>
                  <th style={{ padding: '0.8rem 1rem' }}>Personal</th>
                  <th style={{ padding: '0.8rem 1rem' }}>Kioscos</th>
                  <th style={{ padding: '0.8rem 1rem' }}>Zona Horaria</th>
                  <th style={{ padding: '0.8rem 1rem' }}>Estado</th>
                  <th style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredBranches.map((branch) => {
                  const isCurrentlySelected = localStorage.getItem('activeBranchId') === branch.id;

                  return (
                    <tr 
                      key={branch.id} 
                      style={{ 
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: isCurrentlySelected ? 'rgba(249, 115, 22, 0.05)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '0.8rem 1rem', fontWeight: 'bold' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>{branch.name}</span>
                          {isCurrentlySelected && (
                            <span style={{ fontSize: '0.65rem', backgroundColor: 'var(--primary-orange)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '99px' }}>
                              Activa
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.8rem 1rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {branch.slug}
                      </td>
                      <td style={{ padding: '0.8rem 1rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: '600' }}>
                          <Users size={13} style={{ color: 'var(--primary-orange)' }} /> {branch._count?.employees || 0}
                        </span>
                      </td>
                      <td style={{ padding: '0.8rem 1rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: '600' }}>
                          <Monitor size={13} style={{ color: '#a855f7' }} /> {branch._count?.devices || 0}
                        </span>
                      </td>
                      <td style={{ padding: '0.8rem 1rem', color: 'var(--text-muted)' }}>
                        {branch.timezone}
                      </td>
                      <td style={{ padding: '0.8rem 1rem' }}>
                        <span 
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '99px',
                            fontWeight: '600',
                            backgroundColor: branch.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: branch.isActive ? '#10b981' : '#ef4444'
                          }}
                        >
                          {branch.isActive ? 'Operando' : 'Pausada'}
                        </span>
                      </td>
                      <td style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                          <button
                            onClick={() => isCurrentlySelected ? handleSwitchToHolding() : handleEnterBranch(branch)}
                            style={{
                              padding: '0.35rem 0.65rem',
                              backgroundColor: isCurrentlySelected ? 'rgba(255, 255, 255, 0.08)' : 'var(--primary-orange)',
                              border: 'none',
                              borderRadius: '6px',
                              color: 'white',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            {isCurrentlySelected ? 'Salir' : 'Entrar'}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedBranch(branch);
                              setEditForm({ name: branch.name, timezone: branch.timezone });
                              setIsEditOpen(true);
                            }}
                            title="Editar"
                            style={{ padding: '0.35rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer' }}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedBranch(branch);
                              setIsResetPasswordOpen(true);
                            }}
                            title="Restablecer Contraseña"
                            style={{ padding: '0.35rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fbbf24', cursor: 'pointer' }}
                          >
                            <Key size={14} />
                          </button>
                          <button
                            onClick={() => handleToggleActive(branch)}
                            title={branch.isActive ? 'Pausar' : 'Activar'}
                            style={{ padding: '0.35rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: branch.isActive ? '#ef4444' : '#10b981', cursor: 'pointer' }}
                          >
                            <Power size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ALTA DE NUEVA SUCURSAL */}
      {isCreateOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#18181b', border: '1px solid var(--border-color)', borderRadius: '14px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={20} style={{ color: 'var(--primary-orange)' }} />
                <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', margin: 0 }}>Registrar Nueva Sucursal</h2>
              </div>
              <button onClick={() => setIsCreateOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Nombre Comercial de la Sucursal *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Sucursal Puebla Angelópolis, Sucursal Veracruz Puerto..."
                  value={createForm.name}
                  onChange={handleNameChange}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Identificador Corto (Slug) *
                </label>
                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 0.8rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--primary-orange)', fontFamily: 'monospace', fontWeight: '600', userSelect: 'none' }}>
                    {holdingMetrics?.holdingSlug ? `${holdingMetrics.holdingSlug}-` : ''}
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="puebla-angelopolis"
                    value={createForm.slug}
                    onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '') })}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.2rem',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: 'var(--text-main)',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                      outline: 'none'
                    }}
                  />
                </div>
                <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <span>Clave única generada:</span>
                  <span style={{ fontFamily: 'monospace', color: '#10b981', fontWeight: 'bold', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                    {holdingMetrics?.holdingSlug ? `${holdingMetrics.holdingSlug}-${createForm.slug || 'nombre-sucursal'}` : createForm.slug || 'nombre-sucursal'}
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Zona Horaria de Operación *
                </label>
                <select
                  value={createForm.timezone}
                  onChange={(e) => setCreateForm({ ...createForm, timezone: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem'
                  }}
                >
                  {TIMEZONE_GROUPS.map((tz) => (
                    <option key={tz.id} value={tz.id} style={{ backgroundColor: '#18181b' }}>
                      {tz.label}
                    </option>
                  ))}
                </select>

                <div style={{ marginTop: '0.45rem', padding: '0.5rem 0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '6px', fontSize: '0.73rem', color: '#93c5fd', display: 'flex', alignItems: 'flex-start', gap: '0.4rem', lineHeight: '1.4' }}>
                  <Info size={14} style={{ flexShrink: 0, marginTop: '2px', color: '#60a5fa' }} />
                  <span>
                    <strong>Cobertura horaria:</strong> Puebla, Veracruz, Oaxaca, Querétaro, CDMX, Guadalajara y la gran mayoría del país operan bajo la misma hora legal oficial: <strong>Tiempo del Centro (America/Mexico_City)</strong>.
                  </span>
                </div>
              </div>

              {/* Sección Administrador / Supervisor Local */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginBottom: '1.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                  <ShieldCheck size={16} style={{ color: '#10b981' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                    Responsable / Administrador Local (Opcional)
                  </span>
                </div>
                <p style={{ margin: '0 0 0.8rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Si asigna un responsable, se creará su cuenta de acceso para coordinar el personal de esta sucursal.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Nombre Completo</label>
                    <input
                      type="text"
                      placeholder="Ej: Laura Méndez"
                      value={createForm.adminName}
                      onChange={(e) => setCreateForm({ ...createForm, adminName: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--text-main)',
                        fontSize: '0.8rem'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Rol Asignado</label>
                    <select
                      value={createForm.adminRole}
                      onChange={(e) => setCreateForm({ ...createForm, adminRole: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--text-main)',
                        fontSize: '0.8rem'
                      }}
                    >
                      <option value="ADMIN" style={{ backgroundColor: '#18181b' }}>Administrador de Sucursal</option>
                      <option value="SUPERVISOR" style={{ backgroundColor: '#18181b' }}>Supervisor Operativo</option>
                    </select>
                  </div>
                </div>

                {/* Explicación en vivo del Rol seleccionado */}
                <div style={{ marginBottom: '0.8rem', padding: '0.5rem 0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.73rem', lineHeight: '1.4' }}>
                  {createForm.adminRole === 'ADMIN' ? (
                    <span>
                      <strong style={{ color: 'var(--primary-orange)' }}>👑 Administrador de Sucursal:</strong> Control administrativo total sobre esta sucursal (gestión y baja de personal, vinculación de kioscos físicos, turnos locales y configuración).
                    </span>
                  ) : (
                    <span>
                      <strong style={{ color: '#10b981' }}>📋 Supervisor Operativo:</strong> Control operativo de piso (asistencia diaria en tiempo real, registro de justificaciones/incapacidades, horas extra y asignación de turnos preexistentes).
                    </span>
                  )}
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Correo Electrónico Oficial</label>
                  <input
                    type="email"
                    placeholder="laura.mendez@nexoratech.com"
                    value={createForm.adminEmail}
                    onChange={(e) => setCreateForm({ ...createForm, adminEmail: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-main)',
                      fontSize: '0.8rem'
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Contraseña de Acceso</label>
                    <button
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, adminPassword: generateRandomPassword() })}
                      style={{ background: 'transparent', border: 'none', color: 'var(--primary-orange)', fontSize: '0.7rem', cursor: 'pointer', padding: 0 }}
                    >
                      Generar aleatoria
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Mínimo 8 caracteres"
                    value={createForm.adminPassword}
                    onChange={(e) => setCreateForm({ ...createForm, adminPassword: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-main)',
                      fontSize: '0.8rem',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
              </div>

              {/* Botones de acción */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  style={{
                    padding: '0.6rem 1rem',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '0.6rem 1.2rem',
                    backgroundColor: 'var(--primary-orange)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: '600',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.85rem'
                  }}
                >
                  {isSubmitting ? <RefreshCw size={15} className="animate-spin" /> : <Plus size={15} />}
                  {isSubmitting ? 'Creando...' : 'Crear Sucursal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CREDENCIALES GENERADAS */}
      {isCredentialsSummaryOpen && credentialsSummary && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#18181b', border: '1px solid var(--border-color)', borderRadius: '14px', width: '100%', maxWidth: '460px', padding: '1.5rem', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.8rem' }}>
                <CheckCircle2 size={26} />
              </div>
              <h3 style={{ margin: '0 0 0.3rem', fontSize: '1.15rem', fontWeight: 'bold' }}>
                {credentialsSummary.isNew ? '¡Sucursal Creada con Éxito!' : 'Contraseña Actualizada'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {credentialsSummary.branchName}
              </p>
            </div>

            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', marginBottom: '1.2rem', fontSize: '0.85rem' }}>
              <div style={{ marginBottom: '0.6rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Usuario / Correo:</span>
                <strong style={{ color: 'var(--text-main)', fontFamily: 'monospace' }}>{credentialsSummary.adminEmail}</strong>
              </div>
              <div style={{ marginBottom: '0.6rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Rol Asignado:</span>
                <span style={{ color: '#10b981', fontWeight: '600' }}>{credentialsSummary.adminRole}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Contraseña:</span>
                <span style={{ color: '#fbbf24', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                  {credentialsSummary.password}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => handleCopyCredentials(`Sucursal: ${credentialsSummary.branchName}\nUsuario: ${credentialsSummary.adminEmail}\nContraseña: ${credentialsSummary.password}`)}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  backgroundColor: copiedSuccess ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem'
                }}
              >
                {copiedSuccess ? <Check size={16} /> : <Copy size={16} />}
                {copiedSuccess ? 'Copiado' : 'Copiar Credenciales'}
              </button>
              <button
                onClick={() => setIsCredentialsSummaryOpen(false)}
                style={{
                  padding: '0.65rem 1.2rem',
                  backgroundColor: 'var(--primary-orange)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EDITAR SUCURSAL */}
      {isEditOpen && selectedBranch && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#18181b', border: '1px solid var(--border-color)', borderRadius: '14px', width: '100%', maxWidth: '480px', padding: '1.5rem', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.8rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>Editar Sucursal</h3>
              <button onClick={() => setIsEditOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Nombre de Sucursal</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Zona Horaria</label>
                <select
                  value={editForm.timezone}
                  onChange={(e) => setEditForm({ ...editForm, timezone: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem'
                  }}
                >
                  {TIMEZONE_GROUPS.map((tz) => (
                    <option key={tz.id} value={tz.id} style={{ backgroundColor: '#18181b' }}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  style={{ padding: '0.55rem 1rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: '0.55rem 1.2rem', backgroundColor: 'var(--primary-orange)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '600', cursor: 'pointer' }}
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RESTABLECER CONTRASEÑA */}
      {isResetPasswordOpen && selectedBranch && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#18181b', border: '1px solid var(--border-color)', borderRadius: '14px', width: '100%', maxWidth: '440px', padding: '1.5rem', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={18} style={{ color: '#fbbf24' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>Restablecer Contraseña</h3>
              </div>
              <button onClick={() => setIsResetPasswordOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Genera una nueva contraseña para el administrador asignado a la sucursal <strong>{selectedBranch.name}</strong>.
            </p>

            <form onSubmit={handleResetPasswordSubmit}>
              <div style={{ marginBottom: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nueva Contraseña (Opcional)</label>
                  <button
                    type="button"
                    onClick={() => setResetPasswordInput(generateRandomPassword())}
                    style={{ background: 'transparent', border: 'none', color: 'var(--primary-orange)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                  >
                    Generar segura
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Dejar vacío para generar automáticamente"
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsResetPasswordOpen(false)}
                  style={{ padding: '0.55rem 1rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: '0.55rem 1.2rem', backgroundColor: '#fbbf24', border: 'none', borderRadius: '8px', color: '#18181b', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {isSubmitting ? 'Actualizando...' : 'Restablecer Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

