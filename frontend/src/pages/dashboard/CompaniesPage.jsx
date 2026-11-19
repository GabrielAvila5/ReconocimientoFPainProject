import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Building2, Users, Monitor, Plus, RefreshCw, AlertCircle, 
  CheckCircle2, Copy, Check, Edit, Power, Search, Filter, 
  Clock, Globe, Shield, Sparkles, X, ChevronRight, Key,
  Trash2, Eye, AlertTriangle, ShieldCheck, Fingerprint, Calendar,
  ArrowUpRight, Info, LayoutGrid, List, UserCheck, Timer, BellRing, CalendarPlus,
  CreditCard, Mail, Phone, Send, MessageSquare, DollarSign, ExternalLink, CheckCheck
} from 'lucide-react';
import { toast } from 'sonner';

const PLAN_PRESETS = {
  STARTER: { maxEmployees: 50, maxDevices: 3, maxBranches: 1, label: 'Starter', badgeColor: '#3b82f6', bgBadge: 'rgba(59, 130, 246, 0.15)' },
  PRO: { maxEmployees: 200, maxDevices: 10, maxBranches: 1, label: 'Pro', badgeColor: '#f97316', bgBadge: 'rgba(249, 115, 22, 0.15)' },
  ENTERPRISE: { maxEmployees: 1000, maxDevices: 50, maxBranches: 1, label: 'Enterprise', badgeColor: '#a855f7', bgBadge: 'rgba(168, 85, 247, 0.15)' },
  CUSTOM: { maxEmployees: 1000, maxDevices: 50, maxBranches: 150, label: 'Personalizado', badgeColor: '#10b981', bgBadge: 'rgba(16, 185, 129, 0.15)' }
};

const BILLING_CYCLES = {
  MENSUAL: {
    key: 'MENSUAL',
    label: 'Mensual',
    periodText: '1 mes',
    badgeColor: '#60a5fa',
    bgBadge: 'rgba(59, 130, 246, 0.15)',
    borderBadge: 'rgba(59, 130, 246, 0.3)',
    description: 'Renovación y cobro cada 30 días'
  },
  TRIMESTRAL: {
    key: 'TRIMESTRAL',
    label: 'Trimestral',
    periodText: '3 meses',
    badgeColor: '#34d399',
    bgBadge: 'rgba(52, 211, 153, 0.15)',
    borderBadge: 'rgba(52, 211, 153, 0.3)',
    description: 'Renovación trimestral (cada 3 meses)'
  },
  SEMESTRAL: {
    key: 'SEMESTRAL',
    label: 'Semestral',
    periodText: '6 meses',
    badgeColor: '#fbbf24',
    bgBadge: 'rgba(251, 191, 36, 0.15)',
    borderBadge: 'rgba(251, 191, 36, 0.3)',
    description: 'Renovación semestral (cada 6 meses)'
  },
  ANUAL: {
    key: 'ANUAL',
    label: 'Anual',
    periodText: '1 año',
    badgeColor: '#c084fc',
    bgBadge: 'rgba(192, 132, 252, 0.15)',
    borderBadge: 'rgba(192, 132, 252, 0.3)',
    description: 'Licencia anual con renovación cada 12 meses'
  }
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

const FIELD_EXPLANATIONS = {
  name: {
    title: '¿Qué es el Nombre Comercial?',
    text: 'Es la marca o nombre público de la empresa cliente (ej: "Grupo Industrial Acme", "Hospital San Javier"). Aparecerá en el encabezado de los paneles, en los reportes de nómina y en la pantalla principal de los kioscos biométricos.'
  },
  slug: {
    title: '¿Para qué sirve el Identificador Slug?',
    text: 'El "slug" es la clave técnica única en minúsculas y sin espacios de la empresa (ej: "grupo-acme"). Se utiliza internamente para: 1) URLs y subdominios personalizados, 2) Emparejamiento instantáneo de kioscos y cámaras, 3) Segmentación estricta de base de datos multi-tenant, y 4) Prefijo automático de todas las sucursales si adquiere el plan Holding.'
  },
  plan: {
    title: '¿Cómo funcionan los Planes y Cuotas?',
    text: 'Define el paquete contratado: Starter (hasta 50 empleados / 3 kioscos), Pro (200 / 10), Enterprise (1,000 / 50) o Personalizado (Holding multi-sucursal a la medida). Si la empresa supera su límite de empleados, el sistema bloqueará nuevos enrolamientos hasta ampliar el plan.'
  },
  maxEmployees: {
    title: '¿Qué es el Límite de Empleados?',
    text: 'Tope máximo de colaboradores que la empresa puede tener registrados. Al llegar al 100%, el sistema impedirá nuevos registros o enrolamientos de rostros.'
  },
  maxDevices: {
    title: '¿Qué es el Límite de Kioscos?',
    text: 'Cantidad de tabletas, pantallas o cámaras físicas que la empresa puede tener enlazadas simultáneamente para el registro de asistencia en sus accesos.'
  },
  maxBranches: {
    title: '¿Qué es el Límite de Sucursales (Holding)?',
    text: 'Aplica en el Plan Personalizado. Define cuántas sucursales o plantas independientes podrá crear esta empresa matriz en el país, cada una con su propio personal y kioscos.'
  },
  customPrice: {
    title: '¿Para qué sirve el Precio Personalizado?',
    text: 'Importe acordado con clientes corporativos o holding que no se rigen por la tarifa estándar. Queda asentado en la ficha para control y seguimiento de cobranza recurrente.'
  },
  billingCycle: {
    title: '¿Qué es el Plan de Pago de Licencia?',
    text: 'Define la frecuencia periódica de renovación del software contratado por la empresa: Mensual, Trimestral, Semestral o Anual. Ayuda a planificar cobranza y proyectar renovaciones de servicio.'
  },
  licenseStartDate: {
    title: '¿Qué es la Fecha de Inicio de Licencia?',
    text: 'Día exacto en que entra en vigor el licenciamiento activo del cliente en la plataforma para el cómputo de su periodo inicial.'
  },
  nextBillingDate: {
    title: '¿Para qué sirve la Fecha del Próximo Pago?',
    text: 'Indica el día exacto en que vence el periodo pagado de la licencia. Si llega esta fecha y no se liquida la renovación, la empresa aparecerá con aviso de pago pendiente o vencido para gestión de cobranza.'
  },
  timezone: {
    title: '¿Por qué es indispensable la Zona Horaria?',
    text: 'Garantiza que el cálculo de retardos, asistencias a tiempo, horas extra y corte nocturno se efectúe según la hora legal de la ciudad donde opera el cliente.'
  },
  adminName: {
    title: '¿Quién es el Administrador Inicial?',
    text: 'Nombre de la persona responsable del cliente (RRHH o TI). Se le asignarán las credenciales maestras para configurar la cuenta, turnos y personal.'
  },
  adminEmail: {
    title: '¿Para qué se usa este Correo?',
    text: 'Es el usuario oficial con el que el administrador iniciará sesión. También recibirá las alertas urgentes del sistema (como kioscos desconectados o avisos de suspensión).'
  },
  adminPassword: {
    title: '¿Cómo se maneja la Contraseña Inicial?',
    text: 'Contraseña de primer acceso almacenada bajo algoritmo hash bcrypt con salting. Podrás copiarla y compartirla con el cliente al finalizar el registro.'
  },
  isExempt: {
    title: '¿Qué es Empresa Exenta de Pago?',
    text: 'Identifica empresas propietarias, matrices o de cortesía interna (como PAIN Matriz). Cuenta con licencia vitalicia permanente, sin cobros periódicos, sin fechas de vencimiento y sin bloqueos por cuotas.'
  },
  billingEmail: {
    title: '¿Para qué sirve el Correo de Cobranza?',
    text: 'Dirección oficial del área de facturación, compras o tesorería del cliente. Los avisos de vencimiento de licencia y datos de transferencia se dirigirán a este correo en lugar de al administrador técnico.'
  },
  billingPhone: {
    title: '¿Cómo funciona el Teléfono de Cobranza?',
    text: 'Número de WhatsApp o teléfono directo del encargado de pagos de la empresa. Habilita el envío de recordatorios y comprobantes en un solo click.'
  },
  billingContactName: {
    title: '¿Quién es el Contacto de Cobranza?',
    text: 'Nombre de la persona o puesto a quien se dirigen formalmente los recordatorios y estados de cuenta (ej. "Lic. Roberto Pérez - Tesorería").'
  },
  billingNoticeDays: {
    title: '¿Qué es la Anticipación de Aviso de Pago?',
    text: 'Cantidad de días de margen previos a la fecha de corte en los que el sistema activará los avisos en amarillo ("Por vencer pronto") y habilitará el envío preventivo de recordatorios de pago.'
  }
};

const isCompanyExempt = (comp) => {
  if (!comp) return false;
  return Boolean(
    comp.isExempt || 
    comp.id === 'default-company-pain' || 
    comp.slug === 'pain' || 
    (comp.billingCycle || '').toUpperCase() === 'EXENTO'
  );
};

const parseLocalDate = (dateInput) => {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;
  if (typeof dateInput === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [year, month, day] = dateInput.split('-').map(Number);
      return new Date(year, month - 1, day, 12, 0, 0);
    }
    const parsed = new Date(dateInput);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const calculateNextLicenseDate = (startDateStr, cycle) => {
  const base = parseLocalDate(startDateStr) || new Date();
  const d = new Date(base.getTime());
  
  switch ((cycle || 'MENSUAL').toUpperCase()) {
    case 'TRIMESTRAL':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'SEMESTRAL':
      d.setMonth(d.getMonth() + 6);
      break;
    case 'ANUAL':
      d.setFullYear(d.getFullYear() + 1);
      break;
    case 'MENSUAL':
    default:
      d.setMonth(d.getMonth() + 1);
      break;
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatLicenseDate = (dateInput) => {
  const d = parseLocalDate(dateInput);
  if (!d) return 'No programada';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatFullLicenseDate = (dateInput) => {
  const d = parseLocalDate(dateInput);
  if (!d) return 'No programada';
  const dayName = d.toLocaleDateString('es-MX', { weekday: 'long' });
  const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  const fullDate = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${capitalizedDay}, ${fullDate}`;
};

const getLicenseStatus = (nextBillingDate, isExempt = false, noticeDays = 15) => {
  if (isExempt) {
    return {
      status: 'exempt',
      diffDays: null,
      badgeText: 'Vitalicia / Exenta',
      label: 'Licencia Matriz / Exenta de Pago (Sin cuotas)',
      color: '#38bdf8',
      bg: 'rgba(56, 189, 248, 0.15)',
      borderColor: 'rgba(56, 189, 248, 0.4)'
    };
  }
  const d = parseLocalDate(nextBillingDate);
  if (!d) return {
    status: 'exempt',
    diffDays: null,
    badgeText: 'Sin Cobro',
    label: 'Sin cobro programado',
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.12)',
    borderColor: 'rgba(148, 163, 184, 0.25)'
  };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    return {
      status: 'expired',
      diffDays,
      badgeText: `Vencido (${absDays}d)`,
      label: `Venció hace ${absDays} ${absDays === 1 ? 'día' : 'días'}`,
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.15)',
      borderColor: 'rgba(239, 68, 68, 0.35)'
    };
  }
  if (diffDays === 0) {
    return {
      status: 'due_today',
      diffDays,
      badgeText: 'Vence Hoy',
      label: 'El pago vence el día de hoy',
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.15)',
      borderColor: 'rgba(245, 158, 11, 0.35)'
    };
  }
  const threshold = (Number.isInteger(Number(noticeDays)) && Number(noticeDays) > 0) ? Number(noticeDays) : 15;
  if (diffDays <= threshold) {
    return {
      status: 'due_soon',
      diffDays,
      badgeText: `Vence en ${diffDays}d`,
      label: `Vence en ${diffDays} ${diffDays === 1 ? 'día' : 'días'} (Aviso activo)`,
      color: '#fbbf24',
      bg: 'rgba(251, 191, 36, 0.15)',
      borderColor: 'rgba(251, 191, 36, 0.35)'
    };
  }
  return {
    status: 'current',
    diffDays,
    badgeText: `En ${diffDays} días`,
    label: `Al corriente (quedan ${diffDays} días)`,
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.25)'
  };
};

const formatTimeAgo = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `Hace ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `Hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
  }
  const years = Math.floor(diffDays / 365);
  return `Hace ${years} ${years === 1 ? 'año' : 'años'}`;
};

const formatFullDate = (dateString) => {
  if (!dateString) return 'No registrada';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Fecha inválida';
  const dayName = d.toLocaleDateString('es-MX', { weekday: 'long' });
  const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  const fullDate = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${capitalizedDay}, ${fullDate} a las ${time}`;
};

const FieldHelpButton = ({ fieldKey, activeHelp, setActiveHelp }) => {
  const info = FIELD_EXPLANATIONS[fieldKey];
  if (!info) return null;
  const isOpen = activeHelp === fieldKey;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setActiveHelp(isOpen ? null : fieldKey);
        }}
        title={`Lupita de ayuda: Click para saber qué significa y para qué sirve "${info.title}"`}
        style={{
          background: isOpen ? 'rgba(249, 115, 22, 0.25)' : 'rgba(255, 255, 255, 0.08)',
          border: `1px solid ${isOpen ? '#f97316' : 'rgba(255, 255, 255, 0.2)'}`,
          color: isOpen ? '#f97316' : '#d4d4d8',
          borderRadius: '50%',
          width: '18px',
          height: '18px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          marginLeft: '0.4rem',
          verticalAlign: 'middle',
          transition: 'all 0.15s ease'
        }}
      >
        <Search size={10} />
      </button>
    </span>
  );
};

const FieldHelpCallout = ({ fieldKey, activeHelp }) => {
  if (activeHelp !== fieldKey) return null;
  const info = FIELD_EXPLANATIONS[fieldKey];
  if (!info) return null;

  return (
    <div style={{
      background: 'rgba(249, 115, 22, 0.08)',
      border: '1px solid rgba(249, 115, 22, 0.35)',
      borderRadius: '8px',
      padding: '0.65rem 0.85rem',
      marginTop: '0.35rem',
      marginBottom: '0.6rem',
      fontSize: '0.78rem',
      color: '#ffedd5',
      lineHeight: 1.45,
      boxShadow: '0 4px 14px rgba(0,0,0,0.25)'
    }}>
      <div style={{ fontWeight: 700, color: '#f97316', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <Info size={12} /> {info.title}
      </div>
      <div>{info.text}</div>
    </div>
  );
};

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

const formatGraceTimer = (comp) => {
  if (!comp || comp.isActive) return null;
  const graceDays = comp.suspensionGraceDays || 30;
  const suspendedAt = comp.suspendedAt ? new Date(comp.suspendedAt) : null;
  const expiresAt = comp.suspensionExpiresAt 
    ? new Date(comp.suspensionExpiresAt) 
    : (suspendedAt ? new Date(suspendedAt.getTime() + (graceDays * 24 * 60 * 60 * 1000)) : null);

  if (!expiresAt || isNaN(expiresAt.getTime())) return null;

  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  const isExpired = diffMs <= 0 || !!comp.isGraceExpired;

  const totalDurationMs = suspendedAt && !isNaN(suspendedAt.getTime())
    ? Math.max(1, expiresAt.getTime() - suspendedAt.getTime()) 
    : (graceDays * 24 * 60 * 60 * 1000);
  const elapsedMs = suspendedAt && !isNaN(suspendedAt.getTime())
    ? Math.max(0, now.getTime() - suspendedAt.getTime()) 
    : Math.max(0, totalDurationMs - diffMs);
  const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedMs / totalDurationMs) * 100)));

  const absDiffDays = Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
  const absDiffHours = Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60));

  let label = '';
  let badgeText = '';
  let urgency = 'ok'; // 'ok' | 'warning' | 'danger'

  if (isExpired) {
    label = `Plazo vencido hace ${absDiffDays} ${absDiffDays === 1 ? 'día' : 'días'}`;
    badgeText = `Vencido (${absDiffDays}d)`;
    urgency = 'danger';
  } else if (absDiffDays <= 3) {
    label = `Vence en ${absDiffHours} horas (Crítico)`;
    badgeText = `${absDiffDays}d restantes`;
    urgency = 'warning';
  } else {
    label = `Quedan ${absDiffDays} días de gracia`;
    badgeText = `${absDiffDays}d restantes`;
    urgency = 'ok';
  }

  const formattedExpires = expiresAt.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return {
    isExpired,
    graceDays,
    expiresAt,
    formattedExpires,
    label,
    badgeText,
    urgency,
    absDiffDays,
    progressPercent
  };
};

const CompaniesPage = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pestaña principal activa: 'catalog' (Catálogo de Empresas) o 'payments' (Próximos Pagos y Cobranza)
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeMainTab, setActiveMainTab] = useState(() => {
    return searchParams.get('tab') === 'payments' ? 'payments' : 'catalog';
  });

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'payments' && activeMainTab !== 'payments') {
      setActiveMainTab('payments');
    } else if (tabParam === 'catalog' && activeMainTab !== 'catalog') {
      setActiveMainTab('catalog');
    }
  }, [searchParams]);

  // Filtros del Módulo de Cobranza y Próximos Pagos
  const [paymentsFilter, setPaymentsFilter] = useState('ALL'); // 'ALL' | 'EXPIRED' | 'DUE_SOON' | 'CURRENT' | 'EXEMPT'
  const [paymentsSearch, setPaymentsSearch] = useState('');

  // Modal Recordatorio de Pago por Correo / WhatsApp
  const [reminderModalCompany, setReminderModalCompany] = useState(null);
  const [reminderSubject, setReminderSubject] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
  const [reminderBankDetails, setReminderBankDetails] = useState('');
  const [reminderSending, setReminderSending] = useState(false);
  const [reminderResult, setReminderResult] = useState(null);
  const [reminderCopied, setReminderCopied] = useState(false);

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
  const [selectedBillingCycle, setSelectedBillingCycle] = useState('ALL');
  const [selectedType, setSelectedType] = useState('MAIN_ONLY'); // 'MAIN_ONLY' | 'ALL' | 'BRANCHES_ONLY'

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
    maxBranches: 1,
    isHolding: false,
    customPrice: '',
    billingCycle: 'MENSUAL',
    licenseStartDate: new Date().toISOString().split('T')[0],
    nextBillingDate: calculateNextLicenseDate(new Date().toISOString().split('T')[0], 'MENSUAL'),
    timezone: 'America/Mexico_City',
    customDomain: '',
    isExempt: false,
    billingEmail: '',
    billingPhone: '',
    billingContactName: '',
    billingNoticeDays: 15,
    adminName: '',
    adminEmail: '',
    adminPassword: ''
  });

  const [activeHelpField, setActiveHelpField] = useState(null);

  // Modal Edición de Cuotas
  const [editingCompany, setEditingCompany] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    plan: 'STARTER',
    maxEmployees: 50,
    maxDevices: 3,
    maxBranches: 1,
    isHolding: false,
    customPrice: '',
    billingCycle: 'MENSUAL',
    licenseStartDate: '',
    nextBillingDate: '',
    timezone: 'America/Mexico_City',
    customDomain: '',
    isExempt: false,
    billingEmail: '',
    billingPhone: '',
    billingContactName: '',
    billingNoticeDays: 15
  });

  // Modal de Ver Ficha Completa (Detalles de Empresa)
  const [detailCompany, setDetailCompany] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState('overview'); // 'overview' | 'admins' | 'devices' | 'structure'
  const [isRenewingLicense, setIsRenewingLicense] = useState(false);

  // Modal de Credenciales / Copiar Acceso
  const [credentialCompany, setCredentialCompany] = useState(null);
  const [credResetLoading, setCredResetLoading] = useState(false);
  const [credGeneratedPassword, setCredGeneratedPassword] = useState('');
  const [credCustomInput, setCredCustomInput] = useState('');
  const [credCopied, setCredCopied] = useState(false);
  const [credSelectedAdminEmail, setCredSelectedAdminEmail] = useState('');
  const [credAdminCopied, setCredAdminCopied] = useState(false);
  const [credPasswordCopied, setCredPasswordCopied] = useState(false);

  // Modal de Suspensión / Reactivación con Estilos y Timer
  const [suspendModalCompany, setSuspendModalCompany] = useState(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendGraceDays, setSuspendGraceDays] = useState(30);
  const [isSuspending, setIsSuspending] = useState(false);

  // Modal para Extender Plazo de Gracia Temporal
  const [extendModalCompany, setExtendModalCompany] = useState(null);
  const [extendDaysToAdd, setExtendDaysToAdd] = useState(15);
  const [extendReason, setExtendReason] = useState('Prórroga comercial acordada');
  const [isExtending, setIsExtending] = useState(false);

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

      const baseUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${baseUrl}/api/v1/superadmin/companies`, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      if (!res.ok) {
        if (res.status === 401) {
          window.dispatchEvent(new Event('auth:unauthorized'));
        }
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Error al consultar lista de empresas');
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
      maxDevices: preset.maxDevices,
      maxBranches: preset.maxBranches || 1,
      isHolding: plan === 'CUSTOM'
    }));
  };

  const handleBillingCycleChange = (cycle) => {
    setFormData(prev => {
      const startDate = prev.licenseStartDate || new Date().toISOString().split('T')[0];
      const nextDate = calculateNextLicenseDate(startDate, cycle);
      return {
        ...prev,
        billingCycle: cycle,
        nextBillingDate: nextDate
      };
    });
  };

  const handleLicenseStartDateChange = (dateStr) => {
    setFormData(prev => {
      const nextDate = calculateNextLicenseDate(dateStr, prev.billingCycle || 'MENSUAL');
      return {
        ...prev,
        licenseStartDate: dateStr,
        nextBillingDate: nextDate
      };
    });
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
      const baseUrl = import.meta.env.VITE_API_URL || '';
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
      const baseUrl = import.meta.env.VITE_API_URL || '';
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
    setCredCustomInput('');
    setCredCopied(false);
    setCredAdminCopied(false);
    setCredPasswordCopied(false);
    const initialEmail = company?.adminUsers?.[0]?.email || company?.adminEmail || '';
    setCredSelectedAdminEmail(initialEmail);
  };

  // Generar / Restablecer Contraseña de Admin
  const handleResetAdminPassword = async () => {
    if (!credentialCompany) return;
    try {
      setCredResetLoading(true);
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const payload = {
        ...(credCustomInput.trim() ? { newPassword: credCustomInput.trim() } : {}),
        ...(credSelectedAdminEmail ? { adminEmail: credSelectedAdminEmail } : {})
      };
      const res = await fetch(`${baseUrl}/api/v1/superadmin/companies/${credentialCompany.id}/reset-admin-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Error al restablecer contraseña');
      }

      setCredGeneratedPassword(data.newPassword);
      if (data.adminEmail) {
        setCredSelectedAdminEmail(data.adminEmail);
        setCredentialCompany(prev => ({
          ...prev,
          adminEmail: data.adminEmail,
          adminUsers: (prev?.adminUsers && prev.adminUsers.length > 0)
            ? prev.adminUsers.map(u => u.email === data.adminEmail ? { ...u, name: data.adminName, role: data.adminRole } : u)
            : [{ email: data.adminEmail, name: data.adminName, role: data.adminRole }]
        }));
      }
      toast.success('Contraseña generada y actualizada exitosamente en base de datos.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCredResetLoading(false);
    }
  };

  // Copiar plantilla completa de credenciales
  const copyFullCredentials = (comp, customPassword = '', explicitAdminEmail = '') => {
    const adminEmail = explicitAdminEmail || credSelectedAdminEmail || comp?.admin?.email || comp?.adminUsers?.[0]?.email || comp?.adminEmail || 'admin@empresa.com';
    const pwdText = customPassword ? `Contraseña Temporal: ${customPassword}` : '(Contraseña configurada por el cliente)';
    const cycleText = comp?.billingCycle ? `Plan de Licencia: ${comp.billingCycle} (Próximo Vencimiento: ${formatLicenseDate(comp.nextBillingDate)})` : '';
    const text = `======================================
ACCESO AL SISTEMA DE ASISTENCIA FACIAL
======================================
Empresa: ${comp.name}
Portal de Acceso: ${window.location.origin}/login

DATOS PARA INICIAR SESIÓN EN EL PORTAL:
👉 Correo Electrónico: ${adminEmail}
👉 ${pwdText}

DETALLES DE LA CUENTA:
- Identificador Empresa (Slug): ${comp.slug}
- Plan: ${comp.plan} (Máx: ${comp.maxEmployees} empleados, ${comp.maxDevices} kioscos)${cycleText ? `\n- ${cycleText}` : ''}
======================================
IMPORTANTE: Para iniciar sesión debe ingresar en el campo "Correo Electrónico" el correo (${adminEmail}), NO use el identificador o nombre de la empresa como usuario.`;

    navigator.clipboard.writeText(text);
    setCredCopied(true);
    toast.success('Datos de acceso copiados al portapapeles');
    setTimeout(() => setCredCopied(false), 3000);
  };

  // Modal de Suspensión con Estilos y Timer
  const openSuspendModal = (company) => {
    setSuspendModalCompany(company);
    setSuspendReason(company.isActive ? 'Falta de pago de mensualidad o mora comercial' : 'Reactivación por regularización de pago');
    setSuspendGraceDays(company.suspensionGraceDays || 30);
  };

  const handleConfirmSuspend = async () => {
    if (!suspendModalCompany) return;
    const willBeActive = !suspendModalCompany.isActive;
    try {
      setIsSuspending(true);
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${baseUrl}/api/v1/superadmin/companies/${suspendModalCompany.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({
          isActive: willBeActive,
          reason: suspendReason || (willBeActive ? 'Reactivación por Super Admin' : 'Suspensión temporal por falta de pago'),
          graceDays: Number(suspendGraceDays) || 30
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al cambiar estado de la empresa');
      }

      toast.success(willBeActive 
        ? `Empresa "${suspendModalCompany.name}" reactivada con éxito.` 
        : `Empresa "${suspendModalCompany.name}" dada de baja temporal. Plazo de gracia: ${suspendGraceDays} días.`);
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

  // Modal de Prórroga / Extensión del Plazo de Gracia Temporal
  const openExtendModal = (company) => {
    setExtendModalCompany(company);
    setExtendDaysToAdd(15);
    setExtendReason('Prórroga comercial acordada con el cliente');
  };

  const handleConfirmExtend = async () => {
    if (!extendModalCompany) return;
    try {
      setIsExtending(true);
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${baseUrl}/api/v1/superadmin/companies/${extendModalCompany.id}/grace-period`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({
          additionalDays: Number(extendDaysToAdd) || 15,
          reason: extendReason
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al extender plazo de gracia');
      }

      toast.success(data.message || 'Plazo de gracia temporal extendido con éxito.');
      setExtendModalCompany(null);
      fetchCompanies();
      if (detailCompany?.id === extendModalCompany.id) {
        if (data.company) {
          openCompanyDetails({ ...detailCompany, ...data.company });
        } else {
          openCompanyDetails(detailCompany);
        }
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsExtending(false);
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
      const baseUrl = import.meta.env.VITE_API_URL || '';
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
    const startDateFormatted = company.licenseStartDate ? new Date(company.licenseStartDate).toISOString().split('T')[0] : '';
    const nextDateFormatted = company.nextBillingDate ? new Date(company.nextBillingDate).toISOString().split('T')[0] : '';
    setEditFormData({
      name: company.name,
      plan: company.plan,
      maxEmployees: company.maxEmployees,
      maxDevices: company.maxDevices,
      maxBranches: company.maxBranches || 1,
      isHolding: company.isHolding || false,
      customPrice: company.customPrice || '',
      billingCycle: company.billingCycle || 'MENSUAL',
      licenseStartDate: startDateFormatted,
      nextBillingDate: nextDateFormatted,
      timezone: company.timezone,
      customDomain: company.customDomain || '',
      isExempt: isCompanyExempt(company),
      billingEmail: company.billingEmail || '',
      billingPhone: company.billingPhone || '',
      billingContactName: company.billingContactName || '',
      billingNoticeDays: company.billingNoticeDays || 15
    });
  };

  // Abrir Modal de Recordatorio de Cobranza
  const openReminderModal = (company) => {
    setReminderModalCompany(company);
    setReminderResult(null);
    setReminderCopied(false);

    const now = new Date();
    const nextDate = company.nextBillingDate ? new Date(company.nextBillingDate) : null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    const target = nextDate ? new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate(), 12, 0, 0) : null;
    const diffDays = target ? Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    const recipientName = company.billingContactName || company.adminUsers?.[0]?.name || company.name;
    const cycle = company.billingCycle || 'MENSUAL';
    const formattedDate = nextDate ? formatFullLicenseDate(nextDate) : 'Fecha pendiente';

    const isExpired = diffDays < 0;
    const isDueToday = diffDays === 0;

    let defaultSub = '';
    if (isExpired) {
      defaultSub = `[URGENTE] Licencia Vencida - Sistema Biométrico PAIN (${company.name})`;
    } else if (isDueToday) {
      defaultSub = `[PAGO HOY] Aviso de Vencimiento de Licencia - ${company.name}`;
    } else {
      defaultSub = `Aviso de Próximo Pago de Licencia - ${company.name} (${diffDays} días restantes)`;
    }

    const defaultBank = `Datos para Transferencia (SPEI):
Banco: BBVA México
Beneficiario: PAIN Biometría y Sistemas S.A.P.I. de C.V.
CLABE: 012180001234567890
Referencia / Concepto: LIC-${company.slug.toUpperCase()}`;

    const defaultMsg = isExpired
      ? `Estimado(a) ${recipientName}:

Le informamos que la licencia de uso del Sistema de Asistencia Facial PAIN para la empresa "${company.name}" (Plan ${company.plan}) ha vencido el pasado ${formattedDate} (${Math.abs(diffDays)} días de mora).

Para mantener la operatividad ininterrumpida de sus kioscos biométricos y evitar la suspensión temporal del servicio, le solicitamos atentamente realizar la liquidación de su cuota ${cycle.toLowerCase()}.

${defaultBank}

Una vez realizado su pago, por favor comparta el comprobante respondiendo a este mensaje para aplicar la renovación inmediata.

Atentamente,
Departamento de Cobranza y Licenciamiento
PAIN - Sistema de Control y Asistencia Facial`
      : `Estimado(a) ${recipientName}:

Esperamos que se encuentre muy bien. Le enviamos un cordial recordatorio de que la licencia de uso del Sistema de Asistencia Facial PAIN para la empresa "${company.name}" (Plan ${company.plan} - ${cycle}) tiene programado su próximo pago el día:

Fecha límite de pago: ${formattedDate} (${diffDays === 0 ? 'HOY' : `en ${diffDays} días`})

Agradecemos programar su pago con anticipación para asegurar la continuidad de su servicio y sincronización biométrica sin interrupciones.

${defaultBank}

Una vez efectuada la transferencia, favor de enviar su comprobante por este medio.

Agradecemos su confianza.
Atentamente,
Departamento de Cobranza y Licenciamiento
PAIN - Sistema de Control y Asistencia Facial`;

    setReminderSubject(defaultSub);
    setReminderMessage(defaultMsg);
    setReminderBankDetails(defaultBank);
  };

  const handleSendPaymentReminder = async () => {
    if (!reminderModalCompany) return;
    try {
      setReminderSending(true);
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${baseUrl}/api/v1/superadmin/companies/${reminderModalCompany.id}/send-payment-reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({
          customSubject: reminderSubject,
          customMessage: reminderMessage,
          bankAccountInfo: reminderBankDetails
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar recordatorio de pago');
      }

      setReminderResult(data.reminder);
      toast.success(data.message || 'Recordatorio registrado exitosamente');
      fetchCompanies();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReminderSending(false);
    }
  };

  const handleRenewLicense = async (company) => {
    if (!company) return;
    try {
      setIsRenewingLicense(true);
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${baseUrl}/api/v1/superadmin/companies/${company.id}/renew-license`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Error al renovar licencia');
      }

      toast.success(data.message || 'Licencia renovada exitosamente.');
      fetchCompanies();
      if (detailCompany?.id === company.id) {
        setDetailCompany(prev => ({
          ...prev,
          ...data.company,
          nextBillingDate: data.nextBillingDate
        }));
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsRenewingLicense(false);
    }
  };

  const handleUpdateCompany = async (e) => {
    e.preventDefault();
    if (!editingCompany) return;
    try {
      setIsSubmitting(true);
      const baseUrl = import.meta.env.VITE_API_URL || '';
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
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'Error al actualizar empresa');
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
        (c.adminUsers?.[0]?.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.parentCompany?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchPlan = selectedPlan === 'ALL' || c.plan === selectedPlan;
      const matchStatus = selectedStatus === 'ALL' || 
        (selectedStatus === 'ACTIVE' && c.isActive) ||
        (selectedStatus === 'SUSPENDED' && !c.isActive);
      const matchBillingCycle = selectedBillingCycle === 'ALL' || (c.billingCycle || 'MENSUAL') === selectedBillingCycle;

      const matchType = 
        selectedType === 'ALL' ? true :
        selectedType === 'BRANCHES_ONLY' ? Boolean(c.parentCompanyId) :
        !c.parentCompanyId; // 'MAIN_ONLY' (por defecto: muestra empresas clientes y matrices principales)

      return matchSearch && matchPlan && matchStatus && matchBillingCycle && matchType;
    });
  }, [companies, searchTerm, selectedPlan, selectedStatus, selectedBillingCycle, selectedType]);

  // Empresas con Plazo de Gracia Vencido (Alerta de Prioridad Alta)
  const expiredCompanies = useMemo(() => {
    return companies.filter(c => {
      if (c.isActive) return false;
      if (c.isGraceExpired) return true;
      if (c.suspensionExpiresAt && new Date(c.suspensionExpiresAt) <= new Date()) return true;
      return false;
    });
  }, [companies]);

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

  // Métricas y Lista Consolidada de Cobranza y Próximos Pagos
  const paymentsData = useMemo(() => {
    const PRICING_ESTIMATES = {
      STARTER: 990,
      PRO: 2490,
      ENTERPRISE: 5990,
      CUSTOM: 9990
    };

    let countPastDue = 0;
    let countDueSoon = 0;
    let countCurrent = 0;
    let countExempt = 0;
    let totalProjectedMonthly = 0;

    const list = companies.map(comp => {
      const isExempt = isCompanyExempt(comp);
      const licStatus = getLicenseStatus(comp.nextBillingDate, isExempt, comp.billingNoticeDays);
      const diffDays = licStatus?.diffDays;

      let monthlyEstimate = 0;
      if (!isExempt) {
        const basePrice = (comp.customPrice !== null && comp.customPrice !== undefined && comp.customPrice !== '')
          ? Number(comp.customPrice)
          : (PRICING_ESTIMATES[comp.plan] || 990);

        const cycle = comp.billingCycle || 'MENSUAL';
        if (cycle === 'ANUAL') monthlyEstimate = Math.round(basePrice / 12);
        else if (cycle === 'SEMESTRAL') monthlyEstimate = Math.round(basePrice / 6);
        else if (cycle === 'TRIMESTRAL') monthlyEstimate = Math.round(basePrice / 3);
        else monthlyEstimate = basePrice;

        totalProjectedMonthly += monthlyEstimate;

        if (licStatus?.status === 'expired') countPastDue++;
        else if (licStatus?.status === 'due_today' || licStatus?.status === 'due_soon') countDueSoon++;
        else countCurrent++;
      } else {
        countExempt++;
      }

      return {
        ...comp,
        isExempt,
        licStatus,
        diffDays,
        monthlyEstimate
      };
    });

    const filtered = list.filter(item => {
      const q = (paymentsSearch || '').toLowerCase().trim();
      const matchSearch = !q ||
        (item.name || '').toLowerCase().includes(q) ||
        (item.slug || '').toLowerCase().includes(q) ||
        (item.billingContactName || '').toLowerCase().includes(q) ||
        (item.billingEmail || '').toLowerCase().includes(q) ||
        (item.billingPhone || '').toLowerCase().includes(q) ||
        (item.adminUsers?.[0]?.email || '').toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (paymentsFilter === 'EXPIRED') return item.licStatus?.status === 'expired';
      if (paymentsFilter === 'DUE_SOON') return item.licStatus?.status === 'due_today' || item.licStatus?.status === 'due_soon';
      if (paymentsFilter === 'CURRENT') return item.licStatus?.status === 'current';
      if (paymentsFilter === 'EXEMPT') return item.isExempt;
      return true;
    });

    return {
      list: filtered,
      allList: list,
      total: companies.length,
      countPastDue,
      countDueSoon,
      countCurrent,
      countExempt,
      totalProjectedMonthly,
      urgentCount: countPastDue + countDueSoon
    };
  }, [companies, paymentsSearch, paymentsFilter]);

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
              const todayStr = new Date().toISOString().split('T')[0];
              setFormData({
                name: '',
                slug: '',
                plan: 'STARTER',
                maxEmployees: 50,
                maxDevices: 3,
                maxBranches: 1,
                isHolding: false,
                customPrice: '',
                billingCycle: 'MENSUAL',
                licenseStartDate: todayStr,
                nextBillingDate: calculateNextLicenseDate(todayStr, 'MENSUAL'),
                timezone: 'America/Mexico_City',
                customDomain: '',
                isExempt: false,
                billingEmail: '',
                billingPhone: '',
                billingContactName: '',
                billingNoticeDays: 15,
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

      {/* Navegación por Pestañas Principales: Catálogo vs Próximos Pagos y Cobranza */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        borderBottom: '1px solid #27272a',
        marginBottom: '1.75rem',
        paddingBottom: '0.5rem',
        flexWrap: 'wrap'
      }}>
        <button
          type="button"
          onClick={() => setActiveMainTab('catalog')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.55rem',
            padding: '0.7rem 1.35rem',
            borderRadius: '10px',
            border: activeMainTab === 'catalog' ? '1px solid rgba(249, 115, 22, 0.5)' : '1px solid transparent',
            background: activeMainTab === 'catalog' ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
            color: activeMainTab === 'catalog' ? '#fff' : '#a1a1aa',
            fontWeight: activeMainTab === 'catalog' ? 700 : 500,
            fontSize: '0.92rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Building2 size={18} style={{ color: activeMainTab === 'catalog' ? '#f97316' : '#71717a' }} />
          <span>Catálogo de Empresas</span>
          <span style={{
            fontSize: '0.75rem',
            padding: '0.15rem 0.55rem',
            borderRadius: '99px',
            background: activeMainTab === 'catalog' ? '#f97316' : '#27272a',
            color: '#fff',
            fontWeight: 700
          }}>
            {companies.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('payments')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.55rem',
            padding: '0.7rem 1.35rem',
            borderRadius: '10px',
            border: activeMainTab === 'payments' ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent',
            background: activeMainTab === 'payments' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            color: activeMainTab === 'payments' ? '#fff' : '#a1a1aa',
            fontWeight: activeMainTab === 'payments' ? 700 : 500,
            fontSize: '0.92rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <CreditCard size={18} style={{ color: activeMainTab === 'payments' ? '#60a5fa' : '#71717a' }} />
          <span>Próximos Pagos y Cobranza</span>
          {paymentsData.urgentCount > 0 ? (
            <span style={{
              fontSize: '0.72rem',
              padding: '0.15rem 0.55rem',
              borderRadius: '99px',
              background: '#ef4444',
              color: '#fff',
              fontWeight: 800
            }}>
              {paymentsData.urgentCount} por atender
            </span>
          ) : (
            <span style={{
              fontSize: '0.72rem',
              padding: '0.15rem 0.55rem',
              borderRadius: '99px',
              background: '#27272a',
              color: '#a1a1aa',
              fontWeight: 600
            }}>
              Al día
            </span>
          )}
        </button>
      </div>

      {activeMainTab === 'payments' ? (
        <div className="fade-in">
          {/* Métricas Resumen de Cobranza */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            <div 
              onClick={() => setPaymentsFilter('EXPIRED')}
              className="card card-glow" 
              style={{ 
                padding: '1.25rem', 
                cursor: 'pointer', 
                border: paymentsFilter === 'EXPIRED' ? '1px solid #ef4444' : '1px solid #27272a',
                background: paymentsFilter === 'EXPIRED' ? 'rgba(239, 68, 68, 0.12)' : '#18181b',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#a1a1aa', fontSize: '0.85rem' }}>
                <span>Licencias Vencidas</span>
                <AlertCircle size={18} style={{ color: '#ef4444' }} />
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 700, margin: '0.4rem 0 0.2rem', color: '#ef4444' }}>
                {paymentsData.countPastDue}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#fca5a5' }}>
                {paymentsData.countPastDue === 0 ? 'Sin adeudos pendientes' : 'Requieren gestión inmediata'}
              </div>
            </div>

            <div 
              onClick={() => setPaymentsFilter('DUE_SOON')}
              className="card card-glow" 
              style={{ 
                padding: '1.25rem', 
                cursor: 'pointer',
                border: paymentsFilter === 'DUE_SOON' ? '1px solid #fbbf24' : '1px solid #27272a',
                background: paymentsFilter === 'DUE_SOON' ? 'rgba(251, 191, 36, 0.12)' : '#18181b',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#a1a1aa', fontSize: '0.85rem' }}>
                <span>Por Vencer Pronto</span>
                <Clock size={18} style={{ color: '#fbbf24' }} />
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 700, margin: '0.4rem 0 0.2rem', color: '#fbbf24' }}>
                {paymentsData.countDueSoon}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#fde68a' }}>
                Dentro de la regla de aviso preventivo
              </div>
            </div>

            <div 
              onClick={() => setPaymentsFilter('CURRENT')}
              className="card card-glow" 
              style={{ 
                padding: '1.25rem', 
                cursor: 'pointer',
                border: paymentsFilter === 'CURRENT' ? '1px solid #10b981' : '1px solid #27272a',
                background: paymentsFilter === 'CURRENT' ? 'rgba(16, 185, 129, 0.12)' : '#18181b',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#a1a1aa', fontSize: '0.85rem' }}>
                <span>Al Corriente</span>
                <CheckCircle2 size={18} style={{ color: '#10b981' }} />
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 700, margin: '0.4rem 0 0.2rem', color: '#10b981' }}>
                {paymentsData.countCurrent}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6ee7b7' }}>
                Sin cuotas por vencer en este periodo
              </div>
            </div>

            <div 
              onClick={() => setPaymentsFilter('EXEMPT')}
              className="card card-glow" 
              style={{ 
                padding: '1.25rem', 
                cursor: 'pointer',
                border: paymentsFilter === 'EXEMPT' ? '1px solid #38bdf8' : '1px solid #27272a',
                background: paymentsFilter === 'EXEMPT' ? 'rgba(56, 189, 248, 0.12)' : '#18181b',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#a1a1aa', fontSize: '0.85rem' }}>
                <span>Exentas (Matriz PAIN)</span>
                <ShieldCheck size={18} style={{ color: '#38bdf8' }} />
              </div>
              <div style={{ fontSize: '1.9rem', fontWeight: 700, margin: '0.4rem 0 0.2rem', color: '#38bdf8' }}>
                {paymentsData.countExempt}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#7dd3fc' }}>
                Licencia vitalicia de desarrollador
              </div>
            </div>

            <div className="card card-glow" style={{ padding: '1.25rem', background: '#18181b', border: '1px solid #27272a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#a1a1aa', fontSize: '0.85rem' }}>
                <span>Facturación Mensual Est.</span>
                <CreditCard size={18} style={{ color: '#c084fc' }} />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0.4rem 0 0.2rem', color: '#c084fc' }}>
                ${paymentsData.totalProjectedMonthly.toLocaleString('es-MX')}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#d8b4fe' }}>
                Proyección recurrente en MXN
              </div>
            </div>
          </div>

          {/* Filtros rápidos y Buscador de Cobranza */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[
                { key: 'ALL', label: 'Todas las Empresas', count: paymentsData.total, color: '#f97316' },
                { key: 'EXPIRED', label: 'Vencidas', count: paymentsData.countPastDue, color: '#ef4444' },
                { key: 'DUE_SOON', label: 'Por Vencer', count: paymentsData.countDueSoon, color: '#fbbf24' },
                { key: 'CURRENT', label: 'Al Corriente', count: paymentsData.countCurrent, color: '#10b981' },
                { key: 'EXEMPT', label: 'Exentas', count: paymentsData.countExempt, color: '#38bdf8' }
              ].map(filterBtn => {
                const isSelected = paymentsFilter === filterBtn.key;
                return (
                  <button
                    key={filterBtn.key}
                    type="button"
                    onClick={() => setPaymentsFilter(filterBtn.key)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.45rem 0.85rem',
                      borderRadius: '8px',
                      border: isSelected ? `1px solid ${filterBtn.color}` : '1px solid #27272a',
                      background: isSelected ? `${filterBtn.color}22` : '#18181b',
                      color: isSelected ? '#fff' : '#a1a1aa',
                      fontSize: '0.82rem',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{filterBtn.label}</span>
                    <span style={{
                      background: isSelected ? filterBtn.color : '#27272a',
                      color: '#fff',
                      fontSize: '0.72rem',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '99px',
                      fontWeight: 700
                    }}>
                      {filterBtn.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1, minWidth: '280px', maxWidth: '420px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
                <input
                  type="text"
                  placeholder="Buscar por empresa, correo o teléfono..."
                  value={paymentsSearch}
                  onChange={(e) => setPaymentsSearch(e.target.value)}
                  style={{
                    ...inputStyle,
                    paddingLeft: '2.3rem',
                    fontSize: '0.82rem',
                    width: '100%'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Tabla de Cobranza y Próximos Pagos */}
          <div style={{
            background: '#141416',
            border: '1px solid #27272a',
            borderRadius: '12px',
            overflowX: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#18181b', borderBottom: '1px solid #27272a', color: '#a1a1aa', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>Empresa / Tenant</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Plan y Cuota</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Próximo Pago & Estado</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Regla de Aviso</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Contacto de Cobranza</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Último Recordatorio</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paymentsData.list.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#71717a' }}>
                      <Clock size={32} style={{ margin: '0 auto 0.75rem', color: '#3f3f46', display: 'block' }} />
                      No se encontraron empresas con el criterio seleccionado.
                    </td>
                  </tr>
                ) : (
                  paymentsData.list.map(comp => {
                    const preset = PLAN_PRESETS[comp.plan] || PLAN_PRESETS.STARTER;
                    const cycleInfo = BILLING_CYCLES[comp.billingCycle] || BILLING_CYCLES.MENSUAL;
                    const isExempt = comp.isExempt;
                    const licStatus = comp.licStatus;
                    const billingEmail = comp.billingEmail || comp.adminUsers?.[0]?.email || null;
                    const billingPhone = comp.billingPhone || null;
                    const noticeDays = comp.billingNoticeDays || 15;

                    return (
                      <tr 
                        key={comp.id}
                        style={{ 
                          borderBottom: '1px solid #1f1f23',
                          background: isExempt 
                            ? 'rgba(56, 189, 248, 0.02)' 
                            : (licStatus?.status === 'expired' 
                                ? 'rgba(239, 68, 68, 0.04)' 
                                : (licStatus?.status === 'due_soon' 
                                    ? 'rgba(251, 191, 36, 0.04)' 
                                    : 'transparent')),
                          transition: 'background 0.15s ease'
                        }}
                      >
                        {/* Empresa */}
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '8px',
                              background: isExempt ? 'rgba(56, 189, 248, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                              border: isExempt ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(249, 115, 22, 0.35)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isExempt ? '#38bdf8' : '#f97316',
                              fontWeight: 700,
                              fontSize: '0.85rem'
                            }}>
                              {comp.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <strong style={{ color: '#fff', fontSize: '0.92rem' }}>{comp.name}</strong>
                                {isExempt && (
                                  <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    color: '#38bdf8',
                                    background: 'rgba(56, 189, 248, 0.2)',
                                    border: '1px solid rgba(56, 189, 248, 0.4)',
                                    borderRadius: '4px',
                                    padding: '0.05rem 0.35rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}>
                                    <ShieldCheck size={11} />
                                    <span>MATRIZ EXENTA</span>
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                                <code style={{ fontSize: '0.72rem', color: '#f97316' }}>{comp.slug}</code>
                                <span style={{ color: '#52525b' }}>·</span>
                                <span style={{
                                  fontSize: '0.7rem',
                                  color: preset.badgeColor,
                                  fontWeight: 600
                                }}>
                                  {preset.label}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Plan y Cuota */}
                        <td style={{ padding: '1rem' }}>
                          {isExempt ? (
                            <div>
                              <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.82rem' }}>Licencia Vitalicia</span>
                              <div style={{ color: '#71717a', fontSize: '0.74rem' }}>$0 MXN (Exenta)</div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <CreditCard size={13} style={{ color: cycleInfo.badgeColor }} />
                                <strong style={{ color: '#fff', fontSize: '0.82rem' }}>{cycleInfo.label}</strong>
                              </div>
                              <div style={{ color: '#a1a1aa', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                                ${comp.monthlyEstimate.toLocaleString('es-MX')} MXN / mes
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Próximo Pago & Estado */}
                        <td style={{ padding: '1rem' }}>
                          {isExempt ? (
                            <span style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#38bdf8',
                              background: 'rgba(56, 189, 248, 0.15)',
                              border: '1px solid rgba(56, 189, 248, 0.35)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}>
                              <ShieldCheck size={13} />
                              <span>Sin Cobros Programados</span>
                            </span>
                          ) : (
                            <div>
                              <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <Calendar size={13} style={{ color: '#60a5fa' }} />
                                <span>{formatLicenseDate(comp.nextBillingDate)}</span>
                              </div>
                              <div style={{ marginTop: '0.25rem' }}>
                                {licStatus && (
                                  <span style={{
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    color: licStatus.color,
                                    background: licStatus.bg,
                                    border: `1px solid ${licStatus.borderColor}`,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                  }}>
                                    <Clock size={11} /> {licStatus.badgeText}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Regla de Aviso */}
                        <td style={{ padding: '1rem' }}>
                          {isExempt ? (
                            <span style={{ color: '#71717a', fontSize: '0.78rem' }}>No aplica</span>
                          ) : (
                            <div>
                              <span style={{ color: '#d4d4d8', fontSize: '0.8rem', fontWeight: 600 }}>
                                {noticeDays} días antes
                              </span>
                              <div style={{ fontSize: '0.72rem', color: '#71717a' }}>
                                Margen preventivo
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Contacto de Cobranza */}
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {comp.billingContactName && (
                              <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.8rem' }}>
                                {comp.billingContactName}
                              </span>
                            )}
                            {billingEmail ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#93c5fd' }}>
                                <Mail size={12} style={{ color: '#60a5fa' }} />
                                <span>{billingEmail}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(billingEmail);
                                    toast.success('Correo de cobranza copiado');
                                  }}
                                  title="Copiar correo"
                                  style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: 0 }}
                                >
                                  <Copy size={11} />
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: '#71717a', fontSize: '0.72rem' }}>Sin correo configurado</span>
                            )}

                            {billingPhone && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#86efac' }}>
                                <Phone size={12} style={{ color: '#22c55e' }} />
                                <span>{billingPhone}</span>
                                <a
                                  href={`https://wa.me/${billingPhone.replace(/[^0-9]/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Abrir chat de WhatsApp"
                                  style={{ color: '#22c55e', display: 'inline-flex', alignItems: 'center' }}
                                >
                                  <ExternalLink size={11} />
                                </a>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Último Recordatorio */}
                        <td style={{ padding: '1rem' }}>
                          {isExempt ? (
                            <span style={{ color: '#71717a', fontSize: '0.75rem' }}>Exenta</span>
                          ) : comp.lastReminderSentAt ? (
                            <div>
                              <span style={{ color: '#fbbf24', fontSize: '0.78rem', fontWeight: 600 }}>
                                {formatTimeAgo(comp.lastReminderSentAt)}
                              </span>
                              <div style={{ fontSize: '0.7rem', color: '#71717a' }}>
                                {new Date(comp.lastReminderSentAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: '#71717a', fontSize: '0.75rem' }}>Nunca enviado</span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {!isExempt && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openReminderModal(comp)}
                                  title="Enviar recordatorio de pago (Correo, WhatsApp y Notificación)"
                                  style={{
                                    ...btnSecondary,
                                    padding: '0.35rem 0.65rem',
                                    fontSize: '0.75rem',
                                    color: '#60a5fa',
                                    borderColor: 'rgba(59, 130, 246, 0.4)',
                                    background: 'rgba(59, 130, 246, 0.1)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem'
                                  }}
                                >
                                  <Mail size={13} /> Recordar
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRenewLicense(comp)}
                                  disabled={isRenewingLicense}
                                  title="Renovar licencia (+1 ciclo completo)"
                                  style={{
                                    ...btnSecondary,
                                    padding: '0.35rem 0.65rem',
                                    fontSize: '0.75rem',
                                    color: '#34d399',
                                    borderColor: 'rgba(52, 211, 153, 0.4)',
                                    background: 'rgba(52, 211, 153, 0.1)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem'
                                  }}
                                >
                                  <RefreshCw size={13} className={isRenewingLicense ? "spin" : ""} /> Renovar
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => openEditModal(comp)}
                              title="Modificar cuotas, días de aviso y correos"
                              style={{
                                ...btnSecondary,
                                padding: '0.35rem 0.6rem',
                                fontSize: '0.75rem',
                                color: '#d4d4d8',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              <Edit size={13} />
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
      ) : (
        <div className="fade-in">
      {/* Banner de Alerta de Prioridad Alta: Empresas con Plazo de Gracia Vencido */}
      {expiredCompanies.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(185, 28, 28, 0.08) 100%)',
          border: '1px solid rgba(239, 68, 68, 0.55)',
          boxShadow: '0 0 25px rgba(239, 68, 68, 0.22)',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          marginBottom: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.25)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                flexShrink: 0
              }}>
                <BellRing size={22} className="spin-slow" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ color: '#ef4444', fontWeight: 800 }}>ALERTA DE PRIORIDAD ALTA:</span> 
                  <span>Plazo de Baja Temporal Vencido ({expiredCompanies.length} {expiredCompanies.length === 1 ? 'empresa' : 'empresas'})</span>
                </h3>
                <p style={{ margin: '0.25rem 0 0', color: '#fca5a5', fontSize: '0.85rem' }}>
                  El período de gracia por falta de pago ha concluido. Por protocolo de salvaguarda y derecho ARCO, <strong>la eliminación debe ser ejecutada manualmente por un Super Administrador</strong>.
                </p>
              </div>
            </div>
            <span style={{
              padding: '0.3rem 0.85rem',
              background: 'rgba(239, 68, 68, 0.3)',
              border: '1px solid #ef4444',
              borderRadius: '99px',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.5px'
            }}>
              ACCIÓN MANUAL REQUERIDA
            </span>
          </div>

          {/* Fila de empresas en alerta */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.75rem' }}>
            {expiredCompanies.map(comp => {
              const timer = formatGraceTimer(comp);
              return (
                <div 
                  key={comp.id}
                  style={{
                    background: '#141416',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '10px',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{comp.name}</strong>
                      <code style={{ fontSize: '0.72rem', color: '#f97316' }}>{comp.slug}</code>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#f87171', marginTop: '0.2rem' }}>
                      {timer?.label || 'Plazo agotado'} · Límite: {timer?.formattedExpires}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.45rem', flexShrink: 0 }}>
                    <button
                      onClick={() => openExtendModal(comp)}
                      style={{
                        ...btnSecondary,
                        padding: '0.35rem 0.7rem',
                        fontSize: '0.75rem',
                        color: '#fbbf24',
                        borderColor: 'rgba(251, 191, 36, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                      title="Dar días adicionales de gracia si el cliente promete regularizar"
                    >
                      <Clock size={13} /> Extender
                    </button>
                    <button
                      onClick={() => openDeleteModal(comp)}
                      style={{
                        ...btnSecondary,
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.75rem',
                        background: '#ef4444',
                        color: '#fff',
                        borderColor: '#ef4444',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                      title="Baja manual y purga total ARCO"
                    >
                      <Trash2 size={13} /> Baja Manual
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select 
            value={selectedType} 
            onChange={(e) => setSelectedType(e.target.value)}
            style={{ ...selectFilterStyle, borderColor: selectedType !== 'MAIN_ONLY' ? '#f97316' : '#27272a' }}
            title="Filtrar por tipo de cuenta (Matriz o Sucursal)"
          >
            <option value="MAIN_ONLY">Solo Clientes / Matrices</option>
            <option value="ALL">Todas (con Sucursales Hijas)</option>
            <option value="BRANCHES_ONLY">Solo Sucursales Hijas</option>
          </select>

          <select 
            value={selectedPlan} 
            onChange={(e) => setSelectedPlan(e.target.value)}
            style={selectFilterStyle}
          >
            <option value="ALL">Todos los Planes</option>
            <option value="STARTER">Starter</option>
            <option value="PRO">Pro</option>
            <option value="ENTERPRISE">Enterprise</option>
            <option value="CUSTOM">Personalizado</option>
          </select>

          <select 
            value={selectedBillingCycle} 
            onChange={(e) => setSelectedBillingCycle(e.target.value)}
            style={selectFilterStyle}
          >
            <option value="ALL">Todos los Ciclos</option>
            <option value="MENSUAL">Mensual (1m)</option>
            <option value="TRIMESTRAL">Trimestral (3m)</option>
            <option value="SEMESTRAL">Semestral (6m)</option>
            <option value="ANUAL">Anual (1 año)</option>
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
                            {(() => {
                              const cycleInfo = BILLING_CYCLES[comp.billingCycle] || BILLING_CYCLES.MENSUAL;
                              return (
                                <span style={{ 
                                  padding: '0.1rem 0.45rem', 
                                  borderRadius: '4px', 
                                  fontSize: '0.68rem', 
                                  fontWeight: 700, 
                                  color: cycleInfo.badgeColor, 
                                  background: cycleInfo.bgBadge,
                                  border: `1px solid ${cycleInfo.borderBadge}`,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem'
                                }}>
                                  <CreditCard size={10} />
                                  {cycleInfo.label}
                                </span>
                              );
                            })()}
                            {comp.isHolding && (
                              <span style={{ 
                                padding: '0.1rem 0.45rem', 
                                borderRadius: '4px', 
                                fontSize: '0.68rem', 
                                fontWeight: 700, 
                                color: '#10b981', 
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.3)'
                              }}>
                                Holding ({comp._count?.branches || 0} sucursales)
                              </span>
                            )}
                            {comp.parentCompanyId && (
                              <span style={{ 
                                padding: '0.1rem 0.45rem', 
                                borderRadius: '4px', 
                                fontSize: '0.68rem', 
                                fontWeight: 700, 
                                color: '#38bdf8', 
                                background: 'rgba(56, 189, 248, 0.15)',
                                border: '1px solid rgba(56, 189, 248, 0.3)'
                              }}>
                                Sucursal de: {comp.parentCompany?.name || 'Holding'}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem', fontSize: '0.72rem', color: '#a1a1aa', flexWrap: 'wrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Calendar size={11} style={{ color: '#f97316' }} />
                              Alta: <strong style={{ color: '#d4d4d8' }}>{new Date(comp.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                            </span>
                            <span>·</span>
                            <span style={{ color: '#71717a' }}>{formatTimeAgo(comp.createdAt)}</span>
                            {isCompanyExempt(comp) ? (
                              <>
                                <span>·</span>
                                <span 
                                  title="Empresa Propietaria / Desarrolladora del Sistema (Licencia Vitalicia Exenta de Pago)"
                                  style={{
                                    padding: '0.05rem 0.45rem',
                                    borderRadius: '4px',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    color: '#38bdf8',
                                    background: 'rgba(56, 189, 248, 0.15)',
                                    border: '1px solid rgba(56, 189, 248, 0.4)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                  }}
                                >
                                  <ShieldCheck size={11} />
                                  <span>Propietario (Licencia Vitalicia Exenta)</span>
                                </span>
                              </>
                            ) : comp.nextBillingDate ? (() => {
                              const licStatus = getLicenseStatus(comp.nextBillingDate, false, comp.billingNoticeDays);
                              return (
                                <>
                                  <span>·</span>
                                  <span 
                                    title={`Próximo pago: ${formatFullLicenseDate(comp.nextBillingDate)} (${licStatus?.label || ''})`}
                                    style={{
                                      padding: '0.05rem 0.35rem',
                                      borderRadius: '4px',
                                      fontSize: '0.68rem',
                                      fontWeight: 600,
                                      color: licStatus ? licStatus.color : '#a1a1aa',
                                      background: licStatus ? licStatus.bg : 'transparent',
                                      border: licStatus ? `1px solid ${licStatus.borderColor}` : 'none',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.2rem'
                                    }}
                                  >
                                    <Clock size={10} /> Cobro: {formatLicenseDate(comp.nextBillingDate)} ({licStatus?.badgeText})
                                  </span>
                                </>
                              );
                            })() : null}
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
                            <span>{empsCount} / {comp.maxEmployees} <span style={{ color: '#10b981', fontSize: '0.7rem' }}>({enrolledCount} enrolados)</span></span>
                            <span style={{ color: '#71717a' }}>{empPct}%</span>
                          </div>
                          <div style={{ height: '3px', background: '#27272a', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{ width: `${empPct}%`, height: '100%', background: empPct > 90 ? '#ef4444' : '#10b981' }} />
                          </div>
                        </div>

                        {/* Kioscos */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#d4d4d8', marginBottom: '0.15rem' }}>
                            <span>{devsCount} / {comp.maxDevices} kioscos</span>
                            <span style={{ color: '#71717a' }}>{devPct}%</span>
                          </div>
                          <div style={{ height: '3px', background: '#27272a', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{ width: `${devPct}%`, height: '100%', background: devPct > 90 ? '#ef4444' : '#3b82f6' }} />
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 4. Estado y Timer de Gracia */}
                    <td style={tdCompact}>
                      {(() => {
                        const timer = formatGraceTimer(comp);
                        return (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
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
                                {comp.isActive ? 'Activa' : 'Baja Temporal'}
                              </span>

                              {timer && (
                                <span style={{
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  fontSize: '0.67rem',
                                  fontWeight: 700,
                                  background: timer.isExpired ? 'rgba(239, 68, 68, 0.25)' : (timer.urgency === 'warning' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(59, 130, 246, 0.15)'),
                                  color: timer.isExpired ? '#fca5a5' : (timer.urgency === 'warning' ? '#fde047' : '#93c5fd'),
                                  border: `1px solid ${timer.isExpired ? 'rgba(239, 68, 68, 0.4)' : (timer.urgency === 'warning' ? 'rgba(234, 179, 8, 0.35)' : 'rgba(59, 130, 246, 0.3)')}`,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}>
                                  <Clock size={10} /> {timer.badgeText}
                                </span>
                              )}
                            </div>

                            {!comp.isActive && comp.suspendedAt && (
                              <div 
                                style={{ fontSize: '0.68rem', color: '#a1a1aa', marginTop: '0.3rem', lineHeight: '1.25' }}
                                title={`Suspendida el ${formatSuspensionDetails(comp.suspendedAt)?.fullFormatted} por ${comp.suspendedByName || 'Super Admin'}. Límite: ${timer?.formattedExpires}`}
                              >
                                <div>{formatSuspensionDetails(comp.suspendedAt)?.capitalizedDay} {formatSuspensionDetails(comp.suspendedAt)?.shortDate} · {formatSuspensionDetails(comp.suspendedAt)?.shortTime}</div>
                                <div style={{ color: timer?.isExpired ? '#f87171' : '#71717a' }}>
                                  {timer?.label || `Por: ${comp.suspendedByName ? comp.suspendedByName.split(' ')[0] : 'Admin'}`}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
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
                          title={comp.isActive ? "Baja Temporal / Suspender Servicio" : "Reactivar Servicio"}
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

                        {/* Extender Plazo de Gracia (si está en baja temporal) */}
                        {!comp.isActive && (
                          <button
                            onClick={() => openExtendModal(comp)}
                            title="Extender Plazo de Gracia Temporal (Prórroga)"
                            style={{
                              background: 'rgba(234, 179, 8, 0.12)',
                              border: '1px solid rgba(234, 179, 8, 0.3)',
                              color: '#fbbf24',
                              padding: '0.35rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <CalendarPlus size={14} />
                          </button>
                        )}

                        {/* Baja Definitiva (ARCO) */}
                        {(() => {
                          const timer = formatGraceTimer(comp);
                          return (
                            <button
                              onClick={() => !isProtected && openDeleteModal(comp)}
                              disabled={isProtected}
                              title={isProtected 
                                ? "Empresa principal protegida" 
                                : (timer?.isExpired ? "¡Alerta de Prioridad Alta! Plazo de gracia vencido: Proceder a baja manual definitiva" : "Dar de baja por completo (ARCO)")}
                              style={{
                                background: isProtected 
                                  ? 'rgba(255, 255, 255, 0.02)' 
                                  : (timer?.isExpired ? '#ef4444' : 'rgba(239, 68, 68, 0.1)'),
                                border: `1px solid ${isProtected 
                                  ? 'rgba(255, 255, 255, 0.05)' 
                                  : (timer?.isExpired ? '#f87171' : 'rgba(239, 68, 68, 0.25)')}`,
                                color: isProtected 
                                  ? '#52525b' 
                                  : (timer?.isExpired ? '#fff' : '#f87171'),
                                boxShadow: timer?.isExpired ? '0 0 10px rgba(239, 68, 68, 0.4)' : 'none',
                                padding: '0.35rem',
                                borderRadius: '6px',
                                cursor: isProtected ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          );
                        })()}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                          <code style={{ fontSize: '0.75rem', color: '#f97316' }}>{comp.slug}</code>
                          {comp.isHolding && (
                            <span style={{ fontSize: '0.68rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '0.05rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
                              Holding ({comp._count?.branches || 0} sucursales)
                            </span>
                          )}
                          {comp.parentCompanyId && (
                            <span style={{ fontSize: '0.68rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0.05rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
                              Sucursal de: {comp.parentCompany?.name || 'Holding'}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.3rem', fontSize: '0.72rem', color: '#a1a1aa' }}>
                          <Calendar size={11} style={{ color: '#f97316' }} />
                          <span>Alta: <strong style={{ color: '#d4d4d8' }}>{new Date(comp.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
                          <span>·</span>
                          <span style={{ color: '#71717a' }}>{formatTimeAgo(comp.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
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
                        {(() => {
                          const cycleInfo = BILLING_CYCLES[comp.billingCycle] || BILLING_CYCLES.MENSUAL;
                          return (
                            <span style={{ 
                              padding: '0.15rem 0.55rem', 
                              borderRadius: '99px', 
                              fontSize: '0.68rem', 
                              fontWeight: 700, 
                              color: cycleInfo.badgeColor, 
                              background: cycleInfo.bgBadge,
                              border: `1px solid ${cycleInfo.borderBadge}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem'
                            }}>
                              <CreditCard size={10} />
                              {cycleInfo.label}
                            </span>
                          );
                        })()}
                      </div>
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

                  {/* Plan de Pago y Próximo Cobro */}
                  {(() => {
                    const isExempt = isCompanyExempt(comp);
                    if (isExempt) {
                      return (
                        <div style={{ background: 'rgba(56, 189, 248, 0.08)', borderRadius: '8px', padding: '0.65rem 0.85rem', marginBottom: '0.85rem', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#38bdf8' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
                              <ShieldCheck size={14} style={{ color: '#38bdf8' }} />
                              <span>Licencia Propietaria (Exenta)</span>
                            </div>
                            <span style={{
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              color: '#38bdf8',
                              background: 'rgba(56, 189, 248, 0.2)',
                              border: '1px solid rgba(56, 189, 248, 0.4)'
                            }}>
                              Vitalicia
                            </span>
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '0.25rem', paddingLeft: '1.35rem' }}>
                            Empresa matriz desarrolladora · Sin cobros ni vencimientos
                          </div>
                        </div>
                      );
                    }

                    const cycleInfo = BILLING_CYCLES[comp.billingCycle] || BILLING_CYCLES.MENSUAL;
                    const licStatus = getLicenseStatus(comp.nextBillingDate, false, comp.billingNoticeDays);
                    return (
                      <div style={{ background: '#18181b', borderRadius: '8px', padding: '0.65rem 0.85rem', marginBottom: '0.85rem', border: '1px solid #27272a' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#fff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}>
                            <CreditCard size={14} style={{ color: cycleInfo.badgeColor }} />
                            <span>Plan {cycleInfo.label}</span>
                            <span style={{ fontSize: '0.72rem', color: '#71717a', fontWeight: 400 }}>({cycleInfo.periodText})</span>
                          </div>
                          {licStatus ? (
                            <span 
                              title={licStatus.label}
                              style={{
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: licStatus.color,
                                background: licStatus.bg,
                                border: `1px solid ${licStatus.borderColor}`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                            >
                              <Calendar size={11} /> {licStatus.badgeText}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: '#71717a' }}>Sin fecha</span>
                          )}
                        </div>
                        {comp.nextBillingDate && (
                          <div style={{ fontSize: '0.74rem', color: '#a1a1aa', marginTop: '0.3rem', paddingLeft: '1.35rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.25rem' }}>
                            <span>Próximo cobro: <strong style={{ color: '#d4d4d8' }}>{formatLicenseDate(comp.nextBillingDate)}</strong></span>
                            {licStatus && <span style={{ color: licStatus.color }}>{licStatus.label}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Auditoría de Suspensión y Timer de Gracia (si no está activa) */}
                  {!comp.isActive && (() => {
                    const timer = formatGraceTimer(comp);
                    return (
                      <div style={{
                        background: timer?.isExpired ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
                        border: `1px solid ${timer?.isExpired ? 'rgba(239, 68, 68, 0.55)' : 'rgba(239, 68, 68, 0.25)'}`,
                        borderRadius: '8px',
                        padding: '0.65rem 0.8rem',
                        marginBottom: '1rem',
                        fontSize: '0.76rem',
                        color: '#fca5a5'
                      }}>
                        <div style={{ fontWeight: 600, color: '#ef4444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Power size={13} /> {formatSuspensionDetails(comp.suspendedAt)?.capitalizedDay}, {formatSuspensionDetails(comp.suspendedAt)?.shortDate}
                          </span>
                          {timer && (
                            <span style={{
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              fontSize: '0.67rem',
                              fontWeight: 700,
                              background: timer.isExpired ? 'rgba(239, 68, 68, 0.3)' : 'rgba(234, 179, 8, 0.2)',
                              color: timer.isExpired ? '#fff' : '#fde047'
                            }}>
                              {timer.badgeText}
                            </span>
                          )}
                        </div>

                        <div style={{ marginTop: '0.2rem', color: '#d4d4d8' }}>
                          Hora: <strong>{formatSuspensionDetails(comp.suspendedAt)?.shortTime}</strong> · Por: <strong>{comp.suspendedByName || 'Super Admin'}</strong>
                        </div>

                        {timer && (
                          <div style={{ marginTop: '0.45rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.35rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: timer.isExpired ? '#fca5a5' : '#fde047' }}>
                              <span>{timer.label}</span>
                              <span>Límite: {timer.formattedExpires}</span>
                            </div>
                            <div style={{ height: '3px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '99px', marginTop: '0.3rem', overflow: 'hidden' }}>
                              <div style={{ width: `${timer.progressPercent}%`, height: '100%', background: timer.isExpired ? '#ef4444' : '#eab308' }} />
                            </div>
                          </div>
                        )}

                        {comp.suspensionReason && (
                          <div style={{ color: '#a1a1aa', fontSize: '0.72rem', marginTop: '0.3rem', fontStyle: 'italic' }}>
                            "{comp.suspensionReason}"
                          </div>
                        )}

                        <div style={{ marginTop: '0.55rem', display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => openExtendModal(comp)}
                            style={{
                              background: 'rgba(234, 179, 8, 0.15)',
                              border: '1px solid rgba(234, 179, 8, 0.3)',
                              color: '#fde047',
                              padding: '0.25rem 0.55rem',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            <CalendarPlus size={11} /> Extender Plazo
                          </button>
                          {timer?.isExpired && (
                            <button
                              onClick={() => openDeleteModal(comp)}
                              style={{
                                background: '#ef4444',
                                border: '1px solid #ef4444',
                                color: '#fff',
                                padding: '0.25rem 0.55rem',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              <Trash2 size={11} /> Baja Manual
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

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

                    <span style={{ color: '#a1a1aa' }}>Plan de Pago:</span>
                    {(() => {
                      const cycle = createdSummary.company.billingCycle || formData.billingCycle || 'MENSUAL';
                      const cycleInfo = BILLING_CYCLES[cycle] || BILLING_CYCLES.MENSUAL;
                      return (
                        <span style={{ color: cycleInfo.badgeColor, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <CreditCard size={13} /> {cycleInfo.label} ({cycleInfo.periodText})
                        </span>
                      );
                    })()}

                    <span style={{ color: '#a1a1aa' }}>Próximo Pago:</span>
                    <strong style={{ color: '#10b981' }}>
                      {formatFullLicenseDate(createdSummary.company.nextBillingDate || formData.nextBillingDate)}
                    </strong>

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
                    onClick={() => copyFullCredentials(createdSummary.company, createdSummary.initialPassword, createdSummary.admin?.email)}
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
                        <label style={labelStyle}>
                          Nombre Comercial *
                          <FieldHelpButton fieldKey="name" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                        </label>
                        <FieldHelpCallout fieldKey="name" activeHelp={activeHelpField} />
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
                        <label style={labelStyle}>
                          Identificador Slug *
                          <FieldHelpButton fieldKey="slug" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                        </label>
                        <FieldHelpCallout fieldKey="slug" activeHelp={activeHelpField} />
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
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#3b82f6', margin: 0, letterSpacing: '0.05em' }}>
                        2. Plan Comercial y Cuotas
                      </h3>
                      <FieldHelpButton fieldKey="plan" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                    </div>
                    <FieldHelpCallout fieldKey="plan" activeHelp={activeHelpField} />

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
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
                            <div style={{ fontWeight: 700, color: isSelected ? p.badgeColor : '#fff', fontSize: '0.88rem' }}>{p.label}</div>
                            {planKey === 'CUSTOM' ? (
                              <div style={{ fontSize: '0.74rem', color: '#a1a1aa', marginTop: '0.25rem', lineHeight: 1.45 }}>
                                +1,000 empleados<br/>
                                +50 kioscos<br/>
                                <span style={{ color: '#10b981', fontWeight: 600 }}>Sucursales</span>
                              </div>
                            ) : planKey === 'ENTERPRISE' ? (
                              <div style={{ fontSize: '0.74rem', color: '#a1a1aa', marginTop: '0.25rem', lineHeight: 1.45 }}>
                                1,000 empleados<br/>
                                50 kioscos
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.74rem', color: '#a1a1aa', marginTop: '0.25rem', lineHeight: 1.45 }}>
                                {p.maxEmployees} empleados<br/>
                                {p.maxDevices} kioscos
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={labelStyle}>
                          Máx. Empleados Permitidos
                          <FieldHelpButton fieldKey="maxEmployees" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                        </label>
                        <FieldHelpCallout fieldKey="maxEmployees" activeHelp={activeHelpField} />
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
                        <label style={labelStyle}>
                          Máx. Kioscos Físicos
                          <FieldHelpButton fieldKey="maxDevices" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                        </label>
                        <FieldHelpCallout fieldKey="maxDevices" activeHelp={activeHelpField} />
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

                    {formData.plan === 'CUSTOM' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', padding: '0.85rem', background: 'rgba(16, 185, 129, 0.07)', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                        <div>
                          <label style={{ ...labelStyle, color: '#10b981' }}>
                            Máx. Sucursales (Holding)
                            <FieldHelpButton fieldKey="maxBranches" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                          </label>
                          <FieldHelpCallout fieldKey="maxBranches" activeHelp={activeHelpField} />
                          <input 
                            type="number" 
                            min="1"
                            placeholder="ej. 150"
                            value={formData.maxBranches || 150}
                            onChange={(e) => setFormData(prev => ({ ...prev, maxBranches: parseInt(e.target.value, 10) || 1 }))}
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={{ ...labelStyle, color: '#10b981' }}>
                            Precio Negociado (MXN/mes)
                            <FieldHelpButton fieldKey="customPrice" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                          </label>
                          <FieldHelpCallout fieldKey="customPrice" activeHelp={activeHelpField} />
                          <input 
                            type="number" 
                            placeholder="ej. 18500"
                            value={formData.customPrice || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, customPrice: e.target.value }))}
                            style={inputStyle}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Plan de Pago, Anticipación y Cobranza */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#60a5fa', margin: 0, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <CreditCard size={14} /> 3. Plan de Pago, Anticipación y Cobranza
                      </h3>
                      <FieldHelpButton fieldKey="billingCycle" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                    </div>
                    <FieldHelpCallout fieldKey="billingCycle" activeHelp={activeHelpField} />

                    {/* Opción Empresa Exenta */}
                    <div 
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          isExempt: !prev.isExempt,
                          billingCycle: !prev.isExempt ? 'EXENTO' : 'MENSUAL',
                          nextBillingDate: !prev.isExempt ? '' : calculateNextLicenseDate(prev.licenseStartDate || new Date().toISOString().split('T')[0], 'MENSUAL')
                        }));
                      }}
                      style={{
                        background: formData.isExempt ? 'rgba(56, 189, 248, 0.1)' : '#18181b',
                        border: formData.isExempt ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid #27272a',
                        borderRadius: '10px',
                        padding: '0.85rem 1rem',
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <input
                          type="checkbox"
                          checked={formData.isExempt}
                          onChange={() => {}}
                          style={{ width: '18px', height: '18px', accentColor: '#38bdf8', cursor: 'pointer' }}
                        />
                        <div>
                          <strong style={{ color: formData.isExempt ? '#38bdf8' : '#fff', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <ShieldCheck size={16} style={{ color: '#38bdf8' }} />
                            <span>Empresa Exenta de Pago (Licencia Matriz PAIN / Interna / Cortesía)</span>
                          </strong>
                          <div style={{ fontSize: '0.74rem', color: '#a1a1aa', marginTop: '0.15rem' }}>
                            {formData.isExempt ? 'Activa: Licencia vitalicia sin cobros periódicos ni fechas de corte.' : 'Marcar si esta empresa no debe generar cuotas ni adeudos comerciales.'}
                          </div>
                        </div>
                      </div>
                      <FieldHelpButton fieldKey="isExempt" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                    </div>
                    <FieldHelpCallout fieldKey="isExempt" activeHelp={activeHelpField} />

                    {formData.isExempt ? (
                      <div style={{
                        background: 'rgba(56, 189, 248, 0.08)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        borderRadius: '8px',
                        padding: '0.85rem',
                        color: '#7dd3fc',
                        fontSize: '0.8rem',
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <ShieldCheck size={18} style={{ flexShrink: 0 }} />
                        <span>Esta empresa no generará cobros ni aparecerá en la lista de cuentas por cobrar. Podrás usarla indefinidamente sin avisos de pago.</span>
                      </div>
                    ) : (
                      <>
                        {/* Selector de Ciclo en Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                          {Object.keys(BILLING_CYCLES).map(cycleKey => {
                            const isSelected = (formData.billingCycle || 'MENSUAL') === cycleKey;
                            const b = BILLING_CYCLES[cycleKey];
                            return (
                              <div
                                key={cycleKey}
                                onClick={() => handleBillingCycleChange(cycleKey)}
                                style={{
                                  border: isSelected ? `2px solid ${b.badgeColor}` : '1px solid #27272a',
                                  background: isSelected ? b.bgBadge : '#18181b',
                                  borderRadius: '10px',
                                  padding: '0.75rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                              >
                                <div style={{ fontWeight: 700, color: isSelected ? b.badgeColor : '#fff', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span>{b.label}</span>
                                  {isSelected && <Check size={14} style={{ color: b.badgeColor }} />}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#a1a1aa', marginTop: '0.25rem', lineHeight: 1.45 }}>
                                  {b.periodText}<br/>
                                  <span style={{ color: '#71717a', fontSize: '0.7rem' }}>{b.description}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Fechas de Licencia */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                          <div>
                            <label style={labelStyle}>
                              Inicio de Licencia *
                              <FieldHelpButton fieldKey="licenseStartDate" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                            </label>
                            <FieldHelpCallout fieldKey="licenseStartDate" activeHelp={activeHelpField} />
                            <input 
                              type="date" 
                              required={!formData.isExempt}
                              value={formData.licenseStartDate}
                              onChange={(e) => handleLicenseStartDateChange(e.target.value)}
                              style={inputStyle}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>
                              Próximo Pago de Licencia *
                              <FieldHelpButton fieldKey="nextBillingDate" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                            </label>
                            <FieldHelpCallout fieldKey="nextBillingDate" activeHelp={activeHelpField} />
                            <input 
                              type="date" 
                              required={!formData.isExempt}
                              value={formData.nextBillingDate}
                              onChange={(e) => setFormData(prev => ({ ...prev, nextBillingDate: e.target.value }))}
                              style={inputStyle}
                            />
                          </div>
                        </div>

                        {/* Anticipación de Aviso de Pago */}
                        <div style={{ marginBottom: '0.75rem' }}>
                          <label style={labelStyle}>
                            Anticipación de Aviso de Pago (Días para Notificar)
                            <FieldHelpButton fieldKey="billingNoticeDays" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                          </label>
                          <FieldHelpCallout fieldKey="billingNoticeDays" activeHelp={activeHelpField} />
                          <select
                            value={formData.billingNoticeDays || 15}
                            onChange={(e) => setFormData(prev => ({ ...prev, billingNoticeDays: Number(e.target.value) || 15 }))}
                            style={selectFilterStyle}
                          >
                            <option value={5}>5 días antes del corte</option>
                            <option value={7}>7 días antes del corte (1 semana)</option>
                            <option value={10}>10 días antes del corte</option>
                            <option value={15}>15 días antes del corte (Recomendado por defecto)</option>
                            <option value={30}>30 días antes del corte (1 mes)</option>
                          </select>
                        </div>

                        {/* Banner Informativo en Vivo del Próximo Pago */}
                        {formData.nextBillingDate && (
                          <div style={{
                            background: 'rgba(59, 130, 246, 0.08)',
                            border: '1px solid rgba(59, 130, 246, 0.25)',
                            borderRadius: '8px',
                            padding: '0.65rem 0.85rem',
                            fontSize: '0.78rem',
                            color: '#93c5fd',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.5rem',
                            marginBottom: '0.75rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Calendar size={14} style={{ color: '#60a5fa' }} />
                              <span>
                                Próximo vencimiento programado: <strong style={{ color: '#fff' }}>{formatFullLicenseDate(formData.nextBillingDate)}</strong>
                              </span>
                            </div>
                            {(() => {
                              const status = getLicenseStatus(formData.nextBillingDate, false, formData.billingNoticeDays);
                              return status ? (
                                <span style={{
                                  padding: '0.1rem 0.45rem',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  color: status.color,
                                  background: status.bg,
                                  border: `1px solid ${status.borderColor}`
                                }}>
                                  {status.label}
                                </span>
                              ) : null;
                            })()}
                          </div>
                        )}
                      </>
                    )}

                    {/* Datos de Cobranza y Facturación (Separado del Login) */}
                    <div style={{
                      background: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '10px',
                      padding: '1rem',
                      marginBottom: '1rem'
                    }}>
                      <div style={{ color: '#93c5fd', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Mail size={14} /> Contacto de Cobranza y Facturación (Separado del Login)
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                        <div>
                          <label style={labelStyle}>
                            Correo de Facturación / Cobranza
                            <FieldHelpButton fieldKey="billingEmail" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                          </label>
                          <FieldHelpCallout fieldKey="billingEmail" activeHelp={activeHelpField} />
                          <input
                            type="email"
                            placeholder="ej. facturacion@empresa.com"
                            value={formData.billingEmail || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, billingEmail: e.target.value }))}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>
                            Teléfono / WhatsApp de Cobranza
                            <FieldHelpButton fieldKey="billingPhone" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                          </label>
                          <FieldHelpCallout fieldKey="billingPhone" activeHelp={activeHelpField} />
                          <input
                            type="text"
                            placeholder="ej. +52 55 1234 5678"
                            value={formData.billingPhone || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, billingPhone: e.target.value }))}
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={labelStyle}>
                          Nombre del Contacto de Pagos
                          <FieldHelpButton fieldKey="billingContactName" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                        </label>
                        <FieldHelpCallout fieldKey="billingContactName" activeHelp={activeHelpField} />
                        <input
                          type="text"
                          placeholder="ej. Lic. Ana Morales (Tesorería / Compras)"
                          value={formData.billingContactName || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, billingContactName: e.target.value }))}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#10b981', margin: '0 0 0.75rem', letterSpacing: '0.05em' }}>
                      4. Primer Usuario Administrador
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={labelStyle}>
                          Nombre Completo *
                          <FieldHelpButton fieldKey="adminName" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                        </label>
                        <FieldHelpCallout fieldKey="adminName" activeHelp={activeHelpField} />
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
                        <label style={labelStyle}>
                          Correo Electrónico (Login) *
                          <FieldHelpButton fieldKey="adminEmail" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                        </label>
                        <FieldHelpCallout fieldKey="adminEmail" activeHelp={activeHelpField} />
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
                        <label style={{ ...labelStyle, margin: 0 }}>
                          Contraseña Inicial *
                          <FieldHelpButton fieldKey="adminPassword" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                        </label>
                        <button 
                          type="button" 
                          onClick={generateRandomPassword}
                          style={{ background: 'none', border: 'none', color: '#f97316', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <Sparkles size={12} /> Generar Segura
                        </button>
                      </div>
                      <FieldHelpCallout fieldKey="adminPassword" activeHelp={activeHelpField} />
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.35rem', fontSize: '0.82rem', color: '#a1a1aa', flexWrap: 'wrap' }}>
                    <code style={{ color: '#f97316', background: 'rgba(249, 115, 22, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                      slug: {detailCompany.slug}
                    </code>
                    <span>·</span>
                    <span>Zona: {detailCompany.timezone}</span>
                    <span>·</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#d4d4d8' }}>
                      <Calendar size={13} style={{ color: '#f97316' }} />
                      Alta: <strong style={{ color: '#fff' }}>{formatFullDate(detailCompany.createdAt)}</strong> ({formatTimeAgo(detailCompany.createdAt)})
                    </span>
                    {detailCompany.isHolding && (
                      <span style={{ 
                        padding: '0.1rem 0.45rem', 
                        borderRadius: '4px', 
                        fontSize: '0.72rem', 
                        fontWeight: 700, 
                        color: '#10b981', 
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.3)'
                      }}>
                        Modalidad Holding
                      </span>
                    )}
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

            {/* Banner de Empresa Suspendida con Auditoría y Timer de Gracia */}
            {!detailCompany.isActive && (() => {
              const timer = formatGraceTimer(detailCompany);
              return (
                <div style={{
                  background: timer?.isExpired ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${timer?.isExpired ? 'rgba(239, 68, 68, 0.55)' : 'rgba(239, 68, 68, 0.35)'}`,
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
                    background: timer?.isExpired ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                    flexShrink: 0
                  }}>
                    <AlertTriangle size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <strong style={{ color: '#ef4444', fontSize: '0.95rem' }}>
                          {timer?.isExpired ? 'Alerta: Plazo de Baja Temporal Vencido' : 'Empresa en Baja Temporal (Suspendida)'}
                        </strong>
                        <span style={{ fontSize: '0.72rem', color: '#fca5a5', background: 'rgba(239, 68, 68, 0.2)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                          Acceso bloqueado en portal y kioscos
                        </span>
                      </div>
                      <button
                        onClick={() => openExtendModal(detailCompany)}
                        style={{
                          ...btnSecondary,
                          padding: '0.3rem 0.65rem',
                          fontSize: '0.75rem',
                          color: '#fbbf24',
                          borderColor: 'rgba(251, 191, 36, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <CalendarPlus size={12} /> Extender Plazo de Gracia
                      </button>
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
                      <div>
                        <span style={{ color: '#a1a1aa' }}>Timer de Gracia: </span>
                        <strong style={{ color: timer?.isExpired ? '#ef4444' : '#fbbf24' }}>
                          {timer ? `${timer.graceDays} días (${timer.label})` : `${detailCompany.suspensionGraceDays || 30} días`}
                        </strong>
                      </div>
                      {timer && (
                        <div>
                          <span style={{ color: '#a1a1aa' }}>Límite de Regularización: </span>
                          <span style={{ color: '#fff' }}>{timer.formattedExpires}</span>
                        </div>
                      )}
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
              );
            })()}

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
              <button
                onClick={() => setDetailTab('branches')}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: detailTab === 'branches' ? '2px solid #f97316' : '2px solid transparent',
                  color: detailTab === 'branches' ? '#fff' : '#a1a1aa',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Building2 size={15} />
                Sucursales ({detailData?.branches?.length ?? detailCompany._count?.branches ?? 0})
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

                {/* Tarjeta de Licenciamiento y Esquema de Cobro */}
                {(() => {
                  const isExempt = isCompanyExempt(detailCompany);
                  if (isExempt) {
                    return (
                      <div style={{ background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '10px', padding: '1.25rem', gridColumn: '1 / -1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                          <h4 style={{ margin: 0, color: '#38bdf8', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <ShieldCheck size={18} /> Licencia Propietaria y Matriz (Exenta de Pago)
                          </h4>
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '99px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            color: '#38bdf8',
                            background: 'rgba(56, 189, 248, 0.2)',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <ShieldCheck size={13} />
                            <span>Licencia Vitalicia Exenta</span>
                          </span>
                        </div>
                        <p style={{ margin: '0 0 1rem', color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.5 }}>
                          Esta empresa es la entidad matriz / desarrolladora de la plataforma PAIN. Cuenta con licenciamiento vitalicio permanente y se encuentra <strong>100% exenta de cuotas de software, fechas de vencimiento y cobros periódicos</strong>.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', borderTop: '1px solid rgba(56, 189, 248, 0.15)', paddingTop: '0.85rem' }}>
                          <div>
                            <span style={{ color: '#71717a', fontSize: '0.78rem', display: 'block' }}>Régimen de Licencia:</span>
                            <strong style={{ color: '#38bdf8', fontSize: '0.88rem' }}>Exenta de Facturación ($0 MXN)</strong>
                          </div>
                          <div>
                            <span style={{ color: '#71717a', fontSize: '0.78rem', display: 'block' }}>Vencimiento:</span>
                            <strong style={{ color: '#fff', fontSize: '0.88rem' }}>Ilimitado / Permanente</strong>
                          </div>
                          <div>
                            <span style={{ color: '#71717a', fontSize: '0.78rem', display: 'block' }}>Kioscos y Empleados:</span>
                            <span style={{ color: '#34d399', fontSize: '0.88rem', fontWeight: 600 }}>Sin bloqueos por mora comercial</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const cycle = detailCompany.billingCycle || 'MENSUAL';
                  const cycleInfo = BILLING_CYCLES[cycle] || BILLING_CYCLES.MENSUAL;
                  const licStatus = getLicenseStatus(detailCompany.nextBillingDate, false, detailCompany.billingNoticeDays);
                  return (
                    <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '1.25rem', gridColumn: '1 / -1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <h4 style={{ margin: 0, color: '#60a5fa', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <CreditCard size={17} /> Licenciamiento y Esquema de Cobro
                        </h4>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => openReminderModal(detailCompany)}
                            style={{
                              ...btnSecondary,
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              color: '#60a5fa',
                              borderColor: 'rgba(59, 130, 246, 0.4)'
                            }}
                          >
                            <Mail size={13} /> Enviar Recordatorio
                          </button>
                          <button
                            onClick={() => handleRenewLicense(detailCompany)}
                            disabled={isRenewingLicense}
                            style={{
                              ...btnPrimary,
                              padding: '0.35rem 0.85rem',
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              background: '#3b82f6'
                            }}
                            title="Avanza la fecha del próximo pago sumando un ciclo completo a la licencia"
                          >
                            <RefreshCw size={13} className={isRenewingLicense ? "spin" : ""} />
                            {isRenewingLicense ? 'Renovando...' : `Renovar Licencia (+1 Periodo ${cycleInfo.label})`}
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                          <span style={{ color: '#a1a1aa', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Frecuencia de Renovación:</span>
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '6px',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: cycleInfo.badgeColor,
                            background: cycleInfo.bgBadge,
                            border: `1px solid ${cycleInfo.borderBadge}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}>
                            <CreditCard size={13} /> Plan {cycleInfo.label} ({cycleInfo.periodText})
                          </span>
                        </div>

                        <div>
                          <span style={{ color: '#a1a1aa', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Inicio de Licencia:</span>
                          <strong style={{ color: '#fff', fontSize: '0.92rem' }}>
                            {formatFullLicenseDate(detailCompany.licenseStartDate || detailCompany.createdAt)}
                          </strong>
                        </div>

                        <div>
                          <span style={{ color: '#a1a1aa', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Próximo Pago Programado:</span>
                          <strong style={{ color: '#fff', fontSize: '0.92rem' }}>
                            {formatFullLicenseDate(detailCompany.nextBillingDate)}
                          </strong>
                        </div>

                        <div>
                          <span style={{ color: '#a1a1aa', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Estado de Licencia:</span>
                          {licStatus ? (
                            <span style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              color: licStatus.color,
                              background: licStatus.bg,
                              border: `1px solid ${licStatus.borderColor}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}>
                              <Clock size={12} /> {licStatus.label}
                            </span>
                          ) : (
                            <span style={{ color: '#71717a', fontSize: '0.82rem' }}>Sin fecha de próximo pago</span>
                          )}
                        </div>
                      </div>

                      {/* Datos de Cobranza configurados */}
                      <div style={{ marginTop: '1rem', borderTop: '1px solid #27272a', paddingTop: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', fontSize: '0.8rem' }}>
                        <div>
                          <span style={{ color: '#71717a', display: 'block' }}>Aviso preventivo:</span>
                          <strong style={{ color: '#d4d4d8' }}>{detailCompany.billingNoticeDays || 15} días antes del vencimiento</strong>
                        </div>
                        <div>
                          <span style={{ color: '#71717a', display: 'block' }}>Correo de Cobranza:</span>
                          <span style={{ color: '#93c5fd' }}>{detailCompany.billingEmail || detailCompany.adminUsers?.[0]?.email || 'No configurado'}</span>
                        </div>
                        <div>
                          <span style={{ color: '#71717a', display: 'block' }}>Teléfono / WhatsApp:</span>
                          <span style={{ color: '#86efac' }}>{detailCompany.billingPhone || 'No registrado'}</span>
                        </div>
                        <div>
                          <span style={{ color: '#71717a', display: 'block' }}>Último recordatorio enviado:</span>
                          <span style={{ color: detailCompany.lastReminderSentAt ? '#fbbf24' : '#71717a' }}>
                            {detailCompany.lastReminderSentAt ? formatTimeAgo(detailCompany.lastReminderSentAt) : 'Nunca'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Tarjeta de Registro y Trazabilidad Oficial */}
                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '1.25rem', gridColumn: '1 / -1' }}>
                  <h4 style={{ margin: '0 0 1rem', color: '#f97316', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={16} /> Registro y Trazabilidad Oficial
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                    <div>
                      <span style={{ color: '#a1a1aa', fontSize: '0.8rem', display: 'block', marginBottom: '0.2rem' }}>Fecha de Alta Oficial:</span>
                      <strong style={{ color: '#fff', fontSize: '0.92rem' }}>{formatFullDate(detailCompany.createdAt)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#a1a1aa', fontSize: '0.8rem', display: 'block', marginBottom: '0.2rem' }}>Antigüedad en la Plataforma:</span>
                      <strong style={{ color: '#10b981', fontSize: '0.92rem' }}>{formatTimeAgo(detailCompany.createdAt)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#a1a1aa', fontSize: '0.8rem', display: 'block', marginBottom: '0.2rem' }}>Identificador Técnico (Slug):</span>
                      <code style={{ color: '#f97316', fontSize: '0.82rem', background: 'rgba(249, 115, 22, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                        {detailCompany.slug}
                      </code>
                    </div>
                    <div>
                      <span style={{ color: '#a1a1aa', fontSize: '0.8rem', display: 'block', marginBottom: '0.2rem' }}>Modalidad Operativa:</span>
                      <span style={{ color: detailCompany.isHolding ? '#10b981' : '#38bdf8', fontWeight: 600 }}>
                        {detailCompany.isHolding ? 'Holding Matriz (Multi-Sucursal)' : 'Empresa Estándar'}
                      </span>
                    </div>
                    {detailCompany.isHolding && (
                      <div>
                        <span style={{ color: '#a1a1aa', fontSize: '0.8rem', display: 'block', marginBottom: '0.2rem' }}>Red de Sucursales:</span>
                        <strong style={{ color: '#fff' }}>
                          {detailCompany._count?.branches || detailData?.branches?.length || 0} de {detailCompany.maxBranches || 1} sucursales activas
                        </strong>
                      </div>
                    )}
                    {detailCompany.customPrice && (
                      <div>
                        <span style={{ color: '#a1a1aa', fontSize: '0.8rem', display: 'block', marginBottom: '0.2rem' }}>Tarifa Negociada:</span>
                        <strong style={{ color: '#10b981' }}>
                          ${Number(detailCompany.customPrice).toLocaleString('es-MX')} MXN/mes
                        </strong>
                      </div>
                    )}
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
            ) : detailTab === 'structure' ? (
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
            ) : detailTab === 'branches' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Banner de Estado / Jerarquía */}
                {detailCompany.parentCompanyId ? (
                  <div style={{
                    padding: '0.9rem 1.25rem',
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <Building2 size={20} style={{ color: '#38bdf8', flexShrink: 0 }} />
                      <div>
                        <div style={{ color: '#38bdf8', fontWeight: 600, fontSize: '0.88rem' }}>
                          Sucursal Dependiente de Holding
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                          Esta sucursal pertenece a la empresa matriz <strong>{detailCompany.parentCompany?.name || 'Holding'}</strong>.
                        </div>
                      </div>
                    </div>
                    {detailCompany.parentCompany && (
                      <button
                        type="button"
                        onClick={() => openCompanyDetails(detailCompany.parentCompany)}
                        style={{
                          background: 'rgba(56, 189, 248, 0.15)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          color: '#38bdf8',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Ver Empresa Matriz <ArrowUpRight size={14} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{
                    padding: '0.9rem 1.25rem',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <Building2 size={20} style={{ color: '#10b981', flexShrink: 0 }} />
                      <div>
                        <div style={{ color: '#10b981', fontWeight: 600, fontSize: '0.88rem' }}>
                          Red de Sucursales de {detailCompany.name}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                          {detailData?.branches?.length || 0} sucursal(es) registrada(s) de un cupo contratado de {detailCompany.maxBranches || 1} sucursales.
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{
                        padding: '0.25rem 0.65rem',
                        borderRadius: '99px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.3)'
                      }}>
                        Cupo: {detailData?.branches?.length || 0} / {detailCompany.maxBranches || 1}
                      </span>
                    </div>
                  </div>
                )}

                {/* Listado de Sucursales */}
                {(!detailData?.branches || detailData.branches.length === 0) ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '3rem 2rem',
                    background: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '10px',
                    color: '#71717a'
                  }}>
                    <Building2 size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3, color: '#f97316' }} />
                    <h4 style={{ margin: '0 0 0.4rem', color: '#d4d4d8', fontSize: '0.95rem' }}>
                      Sin sucursales registradas
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.82rem', maxWidth: '460px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.4' }}>
                      {detailCompany.isHolding || detailCompany.plan === 'CUSTOM'
                        ? 'Esta empresa matriz aún no ha dado de alta sucursales hijas. Su administrador corporativo puede crearlas desde el panel "Mis Sucursales".'
                        : `Esta empresa opera en modalidad mono-sucursal (Plan ${detailCompany.plan}). Las empresas con Plan Personalizado (CUSTOM) tienen habilitada la gestión multi-sucursal.`}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1rem' }}>
                    {detailData.branches.map(branch => {
                      const branchAdmin = branch.adminUsers?.[0];
                      return (
                        <div
                          key={branch.id}
                          style={{
                            background: '#18181b',
                            border: '1px solid #27272a',
                            borderRadius: '10px',
                            padding: '1.25rem',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '1rem'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem' }}>
                              <strong style={{ color: '#fff', fontSize: '0.95rem', wordBreak: 'break-word' }}>
                                {branch.name}
                              </strong>
                              <span style={{
                                padding: '0.15rem 0.5rem',
                                borderRadius: '99px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: branch.isActive ? '#10b981' : '#ef4444',
                                background: branch.isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                border: branch.isActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                                flexShrink: 0
                              }}>
                                {branch.isActive ? 'Activa' : 'Inactiva'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.75rem' }}>
                              <code style={{ fontSize: '0.75rem', color: '#f97316' }}>{branch.slug}</code>
                              <span style={{ color: '#52525b', fontSize: '0.75rem' }}>·</span>
                              <span style={{ color: '#71717a', fontSize: '0.72rem' }}>{branch.timezone || 'America/Mexico_City'}</span>
                            </div>

                            {/* Administrador Local */}
                            <div style={{
                              background: '#121214',
                              border: '1px solid #27272a',
                              borderRadius: '6px',
                              padding: '0.6rem 0.75rem',
                              marginBottom: '0.85rem'
                            }}>
                              <div style={{ color: '#71717a', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                                Admin Local Asignado
                              </div>
                              {branchAdmin ? (
                                <div>
                                  <div style={{ color: '#fff', fontSize: '0.82rem', fontWeight: 600 }}>{branchAdmin.name}</div>
                                  <div style={{ color: '#38bdf8', fontSize: '0.75rem' }}>{branchAdmin.email}</div>
                                </div>
                              ) : (
                                <span style={{ color: '#52525b', fontSize: '0.78rem', fontStyle: 'italic' }}>
                                  Sin administrador local registrado
                                </span>
                              )}
                            </div>

                            {/* Métricas de Sucursal */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.78rem' }}>
                              <div style={{ background: '#27272a33', padding: '0.4rem 0.6rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#d4d4d8' }}>
                                <Users size={14} style={{ color: '#f97316' }} />
                                <span><strong>{branch._count?.employees || 0}</strong> emp</span>
                              </div>
                              <div style={{ background: '#27272a33', padding: '0.4rem 0.6rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#a855f7' }}>
                                <Monitor size={14} style={{ color: '#a855f7' }} />
                                <span><strong>{branch._count?.devices || 0}</strong> kioscos</span>
                              </div>
                              <div style={{ background: '#27272a33', padding: '0.4rem 0.6rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#d4d4d8' }}>
                                <span style={{ color: '#10b981', fontWeight: 700 }}>D</span>
                                <span><strong>{branch._count?.departments || 0}</strong> depts</span>
                              </div>
                              <div style={{ background: '#27272a33', padding: '0.4rem 0.6rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#d4d4d8' }}>
                                <Clock size={14} style={{ color: '#38bdf8' }} />
                                <span><strong>{branch._count?.shifts || 0}</strong> turnos</span>
                              </div>
                            </div>
                          </div>

                          {/* Acciones de la sucursal */}
                          <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid #27272a', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                            <button
                              type="button"
                              onClick={() => openCompanyDetails(branch)}
                              style={{
                                flex: 1,
                                padding: '0.45rem',
                                background: 'rgba(249, 115, 22, 0.1)',
                                border: '1px solid rgba(249, 115, 22, 0.3)',
                                color: '#f97316',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              <Eye size={13} /> Ver Ficha
                            </button>
                            <button
                              type="button"
                              onClick={() => openCredentialModal(branch)}
                              style={{
                                padding: '0.45rem 0.65rem',
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                color: '#10b981',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                              title="Credenciales de esta sucursal"
                            >
                              <Key size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#a1a1aa' }}>Usuario Admin:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  {credentialCompany.adminUsers && credentialCompany.adminUsers.length > 1 ? (
                    <select
                      value={credSelectedAdminEmail}
                      onChange={(e) => setCredSelectedAdminEmail(e.target.value)}
                      style={{
                        background: '#18181b',
                        border: '1px solid #3f3f46',
                        color: '#10b981',
                        borderRadius: '6px',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.85rem',
                        fontWeight: 600
                      }}
                    >
                      {credentialCompany.adminUsers.map(a => (
                        <option key={a.email} value={a.email}>
                          {a.name ? `${a.name} (${a.email})` : a.email} - {a.role}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <strong style={{ color: '#10b981' }}>
                      {credSelectedAdminEmail || credentialCompany.adminUsers?.[0]?.email || credentialCompany.adminEmail || 'Sin admin asignado'}
                    </strong>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const emailToCopy = credSelectedAdminEmail || credentialCompany.adminUsers?.[0]?.email || credentialCompany.adminEmail;
                      if (emailToCopy) {
                        navigator.clipboard.writeText(emailToCopy);
                        setCredAdminCopied(true);
                        toast.success('Correo de usuario copiado al portapapeles');
                        setTimeout(() => setCredAdminCopied(false), 2500);
                      }
                    }}
                    title="Copiar correo de inicio de sesión"
                    style={{
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      color: '#10b981',
                      padding: '0.2rem 0.45rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.75rem'
                    }}
                  >
                    {credAdminCopied ? <Check size={12} /> : <Copy size={12} />}
                    {credAdminCopied ? 'Copiado' : 'Copiar'}
                  </button>

                  {(credentialCompany.adminUsers?.[0]?.role || credentialCompany.plan === 'CUSTOM') && (
                    <span style={{
                      padding: '0.1rem 0.45rem',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#60a5fa',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      border: '1px solid rgba(59, 130, 246, 0.3)'
                    }}>
                      {credentialCompany.adminUsers?.find(u => u.email === credSelectedAdminEmail)?.role || credentialCompany.adminUsers?.[0]?.role || (credentialCompany.plan === 'CUSTOM' ? 'CORPORATE_ADMIN' : 'ADMIN')}
                    </span>
                  )}
                </div>
              </div>

              {credGeneratedPassword && (
                <div style={{ borderTop: '1px solid #27272a', paddingTop: '0.75rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <span style={{ color: '#eab308', fontWeight: 600, display: 'block' }}>Contraseña Activa en BD:</span>
                    <span style={{ fontSize: '0.72rem', color: '#10b981' }}>● Guardada y lista para iniciar sesión en /login</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <code style={{ fontSize: '1rem', color: '#eab308', background: 'rgba(234, 179, 8, 0.12)', padding: '0.25rem 0.6rem', borderRadius: '6px', border: '1px solid rgba(234, 179, 8, 0.3)', fontWeight: 700 }}>
                      {credGeneratedPassword}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(credGeneratedPassword);
                        setCredPasswordCopied(true);
                        toast.success('Contraseña copiada al portapapeles');
                        setTimeout(() => setCredPasswordCopied(false), 2500);
                      }}
                      title="Copiar solo la contraseña"
                      style={{
                        background: 'rgba(234, 179, 8, 0.15)',
                        border: '1px solid rgba(234, 179, 8, 0.3)',
                        color: '#eab308',
                        padding: '0.3rem 0.6rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.8rem',
                        fontWeight: 600
                      }}
                    >
                      {credPasswordCopied ? <Check size={14} /> : <Copy size={14} />}
                      {credPasswordCopied ? '¡Copiada!' : 'Copiar Clave'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Aviso informativo de credencial de inicio de sesión */}
            <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.82rem', color: '#93c5fd', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                <strong>Atención:</strong> Para iniciar sesión en <code>/login</code>, el usuario debe ingresar en el campo <em>Correo Electrónico</em> el correo <strong>{credSelectedAdminEmail || credentialCompany.adminUsers?.[0]?.email || credentialCompany.adminEmail || 'admin@empresa.com'}</strong>. El <em>Identificador (Slug)</em> es de uso interno comercial y no sirve como nombre de usuario.
              </span>
            </div>

            {/* Restablecer / Generar Contraseña */}
            <div style={{ background: 'rgba(234, 179, 8, 0.05)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ color: '#eab308', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                Generar o Restablecer Contraseña
              </div>
              <p style={{ color: '#a1a1aa', fontSize: '0.8rem', margin: '0 0 0.85rem' }}>
                Ingresa una contraseña específica o déjala vacía para generar una aleatoria segura en la base de datos.
              </p>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Contraseña manual (o vacío para aleatoria)"
                  value={credCustomInput}
                  onChange={(e) => setCredCustomInput(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '220px',
                    padding: '0.55rem 0.75rem',
                    background: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace'
                  }}
                />
                <button
                  type="button"
                  onClick={handleResetAdminPassword}
                  disabled={credResetLoading}
                  style={{
                    ...btnPrimary,
                    padding: '0.55rem 1rem',
                    fontSize: '0.82rem',
                    whiteSpace: 'nowrap',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                  }}
                >
                  {credResetLoading ? 'Guardando en BD...' : credCustomInput.trim() ? 'Guardar Contraseña' : 'Generar Nueva Clave'}
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

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Motivo / Justificación de la acción:</label>
              <input 
                type="text" 
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="ej. Retraso en pago de mensualidad o mora comercial"
                style={inputStyle}
              />
            </div>

            {/* Selector de Timer de Gracia Temporal (solo al suspender) */}
            {suspendModalCompany.isActive && (
              <div style={{
                background: '#18181b',
                border: '1px solid rgba(249, 115, 22, 0.3)',
                borderRadius: '10px',
                padding: '1rem',
                marginBottom: '1.5rem'
              }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f97316' }}>
                  <Timer size={16} /> Timer de Gracia Temporal (Plazo antes de Alerta de Purga):
                </label>
                <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  {[7, 15, 30, 60].map(days => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setSuspendGraceDays(days)}
                      style={{
                        padding: '0.35rem 0.65rem',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: suspendGraceDays === days ? '#f97316' : '#27272a',
                        background: suspendGraceDays === days ? 'rgba(249, 115, 22, 0.2)' : '#141416',
                        color: suspendGraceDays === days ? '#fff' : '#a1a1aa',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {days} días {days === 30 ? '(Recomendado)' : ''}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={suspendGraceDays}
                    onChange={(e) => setSuspendGraceDays(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ ...inputStyle, width: '100px', textAlign: 'center', fontWeight: 700 }}
                  />
                  <span style={{ fontSize: '0.82rem', color: '#d4d4d8' }}>días de gracia otorgados</span>
                </div>
                <div style={{
                  fontSize: '0.76rem',
                  color: '#fbbf24',
                  background: 'rgba(234, 179, 8, 0.08)',
                  border: '1px solid rgba(234, 179, 8, 0.2)',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  marginTop: '0.75rem',
                  lineHeight: '1.4'
                }}>
                  <strong>Regla Operativa:</strong> Si la empresa no paga antes del <strong>{new Date(Date.now() + (suspendGraceDays * 24 * 60 * 60 * 1000)).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>, el sistema generará una <strong>Alerta de Prioridad Alta</strong> para que el Super Administrador ejecute manualmente la baja definitiva y purga total en MariaDB.
                </div>
              </div>
            )}

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
                {isSuspending ? 'Actualizando estado...' : (suspendModalCompany.isActive ? 'Confirmar Baja Temporal' : 'Confirmar Reactivación')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4.5: EXTENDER PLAZO DE GRACIA TEMPORAL (PRÓRROGA)    */}
      {/* ========================================================= */}
      {extendModalCompany && (
        <div className="modal-overlay" onClick={() => !isExtending && setExtendModalCompany(null)}>
          <div 
            className="modal-content page-glow" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '500px', width: '90%', borderRadius: '16px', background: '#141416', border: '1px solid rgba(234, 179, 8, 0.35)', padding: '2rem' }}
          >
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'rgba(234, 179, 8, 0.15)',
                color: '#eab308',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.75rem',
                border: '1px solid rgba(234, 179, 8, 0.3)'
              }}>
                <CalendarPlus size={26} />
              </div>
              <h2 style={{ color: '#fff', margin: '0 0 0.35rem', fontSize: '1.25rem' }}>
                Extender Plazo de Gracia Temporal
              </h2>
              <p style={{ color: '#a1a1aa', fontSize: '0.85rem', margin: 0 }}>
                Conceder prórroga a la empresa <strong style={{ color: '#fff' }}>"{extendModalCompany.name}"</strong>
              </p>
            </div>

            <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: '#a1a1aa' }}>Plazo de gracia configurado:</span>
                <strong style={{ color: '#fff' }}>{extendModalCompany.suspensionGraceDays || 30} días</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#a1a1aa' }}>Fecha de vencimiento previa:</span>
                <span style={{ color: '#f87171', fontWeight: 600 }}>
                  {extendModalCompany.suspensionExpiresAt 
                    ? new Date(extendModalCompany.suspensionExpiresAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'Sin fecha registrada'}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Días adicionales a conceder:</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
                {[7, 15, 30].map(days => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setExtendDaysToAdd(days)}
                    style={{
                      flex: 1,
                      padding: '0.45rem',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: extendDaysToAdd === days ? '#eab308' : '#27272a',
                      background: extendDaysToAdd === days ? 'rgba(234, 179, 8, 0.2)' : '#18181b',
                      color: extendDaysToAdd === days ? '#fff' : '#a1a1aa',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    +{days} días
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                max="180"
                value={extendDaysToAdd}
                onChange={(e) => setExtendDaysToAdd(Math.max(1, parseInt(e.target.value) || 1))}
                style={inputStyle}
                placeholder="Número de días"
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>Motivo / Justificación de la prórroga:</label>
              <input
                type="text"
                value={extendReason}
                onChange={(e) => setExtendReason(e.target.value)}
                placeholder="ej. El cliente solicitó prórroga para pagar el viernes"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setExtendModalCompany(null)}
                disabled={isExtending}
                style={btnSecondary}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmExtend}
                disabled={isExtending}
                style={{ ...btnPrimary, background: '#eab308', color: '#000', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
              >
                {isExtending ? 'Guardando prórroga...' : 'Confirmar Prórroga'}
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
                  <label style={labelStyle}>
                    Nombre Comercial
                    <FieldHelpButton fieldKey="name" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                  </label>
                  <FieldHelpCallout fieldKey="name" activeHelp={activeHelpField} />
                  <input 
                    type="text" 
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Plan Comercial
                    <FieldHelpButton fieldKey="plan" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                  </label>
                  <FieldHelpCallout fieldKey="plan" activeHelp={activeHelpField} />
                  <select 
                    value={editFormData.plan}
                    onChange={(e) => {
                      const newPlan = e.target.value;
                      const preset = PLAN_PRESETS[newPlan] || PLAN_PRESETS.STARTER;
                      setEditFormData(prev => ({
                        ...prev,
                        plan: newPlan,
                        maxEmployees: preset.maxEmployees,
                        maxDevices: preset.maxDevices,
                        maxBranches: preset.maxBranches || 1,
                        isHolding: newPlan === 'CUSTOM'
                      }));
                    }}
                    style={selectFilterStyle}
                  >
                    <option value="STARTER">Starter (50 empleados / 3 kioscos)</option>
                    <option value="PRO">Pro (200 empleados / 10 kioscos)</option>
                    <option value="ENTERPRISE">Enterprise (1,000 empleados / 50 kioscos)</option>
                    <option value="CUSTOM">Personalizado (Holding Multi-Sucursal)</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>
                      Máx. Empleados
                      <FieldHelpButton fieldKey="maxEmployees" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                    </label>
                    <FieldHelpCallout fieldKey="maxEmployees" activeHelp={activeHelpField} />
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
                    <label style={labelStyle}>
                      Máx. Kioscos
                      <FieldHelpButton fieldKey="maxDevices" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                    </label>
                    <FieldHelpCallout fieldKey="maxDevices" activeHelp={activeHelpField} />
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

                {editFormData.plan === 'CUSTOM' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '0.85rem', background: 'rgba(16, 185, 129, 0.07)', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                    <div>
                      <label style={{ ...labelStyle, color: '#10b981' }}>
                        Máx. Sucursales (Holding)
                        <FieldHelpButton fieldKey="maxBranches" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                      </label>
                      <FieldHelpCallout fieldKey="maxBranches" activeHelp={activeHelpField} />
                      <input 
                        type="number" 
                        min="1"
                        placeholder="ej. 150"
                        value={editFormData.maxBranches || 150}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, maxBranches: parseInt(e.target.value, 10) || 1 }))}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, color: '#10b981' }}>
                        Precio Negociado (MXN/mes)
                        <FieldHelpButton fieldKey="customPrice" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                      </label>
                      <FieldHelpCallout fieldKey="customPrice" activeHelp={activeHelpField} />
                      <input 
                        type="number" 
                        placeholder="ej. 18500"
                        value={editFormData.customPrice || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, customPrice: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                )}

                {/* Plan de Pago, Anticipación y Cobranza */}
                <div style={{ padding: '0.85rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  <div style={{ color: '#60a5fa', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CreditCard size={15} /> Licencia, Anticipación y Cobranza
                  </div>

                  {/* Toggle Exenta */}
                  <div 
                    onClick={() => {
                      setEditFormData(prev => ({
                        ...prev,
                        isExempt: !prev.isExempt,
                        billingCycle: !prev.isExempt ? 'EXENTO' : 'MENSUAL',
                        nextBillingDate: !prev.isExempt ? '' : calculateNextLicenseDate(prev.licenseStartDate || new Date().toISOString().split('T')[0], 'MENSUAL')
                      }));
                    }}
                    style={{
                      background: editFormData.isExempt ? 'rgba(56, 189, 248, 0.1)' : '#18181b',
                      border: editFormData.isExempt ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid #27272a',
                      borderRadius: '8px',
                      padding: '0.75rem 0.85rem',
                      marginBottom: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                      <input
                        type="checkbox"
                        checked={editFormData.isExempt}
                        onChange={() => {}}
                        style={{ width: '16px', height: '16px', accentColor: '#38bdf8', cursor: 'pointer' }}
                      />
                      <div>
                        <strong style={{ color: editFormData.isExempt ? '#38bdf8' : '#fff', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <ShieldCheck size={14} style={{ color: '#38bdf8' }} />
                          <span>Empresa Exenta de Pago (Licencia Vitalicia / Matriz PAIN)</span>
                        </strong>
                        <div style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>
                          {editFormData.isExempt ? 'Exenta activa: Sin cobros ni vencimientos.' : 'Marcar para exentar de pago'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {editFormData.isExempt ? (
                    <div style={{
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      borderRadius: '6px',
                      padding: '0.65rem 0.85rem',
                      color: '#7dd3fc',
                      fontSize: '0.76rem',
                      marginBottom: '0.75rem'
                    }}>
                      Esta empresa operará como entidad propietaria / de cortesía sin adeudos ni avisos de corte.
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                        <div>
                          <label style={labelStyle}>
                            Plan de Pago
                            <FieldHelpButton fieldKey="billingCycle" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                          </label>
                          <FieldHelpCallout fieldKey="billingCycle" activeHelp={activeHelpField} />
                          <select
                            value={editFormData.billingCycle || 'MENSUAL'}
                            onChange={(e) => {
                              const newCycle = e.target.value;
                              setEditFormData(prev => {
                                const startDate = prev.licenseStartDate || new Date().toISOString().split('T')[0];
                                const nextDate = calculateNextLicenseDate(startDate, newCycle);
                                return {
                                  ...prev,
                                  billingCycle: newCycle,
                                  nextBillingDate: nextDate
                                };
                              });
                            }}
                            style={selectFilterStyle}
                          >
                            <option value="MENSUAL">Mensual (1 mes)</option>
                            <option value="TRIMESTRAL">Trimestral (3 meses)</option>
                            <option value="SEMESTRAL">Semestral (6 meses)</option>
                            <option value="ANUAL">Anual (1 año)</option>
                          </select>
                        </div>

                        <div>
                          <label style={labelStyle}>
                            Próximo Pago de Licencia
                            <FieldHelpButton fieldKey="nextBillingDate" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                          </label>
                          <FieldHelpCallout fieldKey="nextBillingDate" activeHelp={activeHelpField} />
                          <input
                            type="date"
                            value={editFormData.nextBillingDate || ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, nextBillingDate: e.target.value }))}
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: '0.75rem' }}>
                        <label style={labelStyle}>
                          Anticipación de Aviso de Pago
                          <FieldHelpButton fieldKey="billingNoticeDays" activeHelp={activeHelpField} setActiveHelp={setActiveHelpField} />
                        </label>
                        <FieldHelpCallout fieldKey="billingNoticeDays" activeHelp={activeHelpField} />
                        <select
                          value={editFormData.billingNoticeDays || 15}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, billingNoticeDays: Number(e.target.value) || 15 }))}
                          style={selectFilterStyle}
                        >
                          <option value={5}>5 días antes del corte</option>
                          <option value={7}>7 días antes del corte (1 semana)</option>
                          <option value={10}>10 días antes del corte</option>
                          <option value={15}>15 días antes del corte (Recomendado por defecto)</option>
                          <option value={30}>30 días antes del corte (1 mes)</option>
                        </select>
                      </div>

                      {editFormData.nextBillingDate && (
                        <div style={{ fontSize: '0.75rem', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.75rem' }}>
                          <Calendar size={12} style={{ color: '#60a5fa' }} />
                          <span>Vencimiento programado: <strong>{formatFullLicenseDate(editFormData.nextBillingDate)}</strong></span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Datos de Contacto de Cobranza */}
                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                    <div style={{ color: '#93c5fd', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                      Datos de Contacto de Facturación / Cobranza
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <div>
                        <label style={{ ...labelStyle, fontSize: '0.75rem' }}>Correo Cobranza</label>
                        <input
                          type="email"
                          placeholder="cobranza@empresa.com"
                          value={editFormData.billingEmail || ''}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, billingEmail: e.target.value }))}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={{ ...labelStyle, fontSize: '0.75rem' }}>Teléfono / WhatsApp</label>
                        <input
                          type="text"
                          placeholder="+52 55 1234 5678"
                          value={editFormData.billingPhone || ''}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, billingPhone: e.target.value }))}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '0.75rem' }}>Contacto de Pagos</label>
                      <input
                        type="text"
                        placeholder="Lic. Ana Morales (Finanzas)"
                        value={editFormData.billingContactName || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, billingContactName: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
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

      {/* ========================================================= */}
      {/* MODAL 7: RECORDATORIO DE COBRANZA Y PAGO DE LICENCIA      */}
      {/* ========================================================= */}
      {reminderModalCompany && (
        <div className="modal-overlay" onClick={() => !reminderSending && setReminderModalCompany(null)}>
          <div
            className="modal-content page-glow"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '650px',
              width: '92%',
              borderRadius: '16px',
              background: '#141416',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              padding: '2rem',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#60a5fa'
                }}>
                  <Mail size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#fff' }}>
                    Recordatorio de Pago de Licencia
                  </h2>
                  <p style={{ margin: '0.2rem 0 0', color: '#a1a1aa', fontSize: '0.82rem' }}>
                    {reminderModalCompany.name} ({reminderModalCompany.slug})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReminderModalCompany(null)}
                style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Ficha Resumen Destinatario */}
            <div style={{ background: '#18181b', borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1.25rem', border: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#a1a1aa' }}>Destinatario de Cobranza:</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>
                  {reminderModalCompany.billingContactName || reminderModalCompany.adminUsers?.[0]?.name || 'Encargado de Pagos'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#a1a1aa' }}>Correo de Envío:</span>
                <strong style={{ color: '#60a5fa' }}>
                  {reminderModalCompany.billingEmail || reminderModalCompany.adminUsers?.[0]?.email || 'No configurado'}
                </strong>
              </div>
              {reminderModalCompany.billingPhone && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#a1a1aa' }}>Teléfono / WhatsApp:</span>
                  <span style={{ color: '#22c55e', fontWeight: 600 }}>{reminderModalCompany.billingPhone}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#a1a1aa' }}>Próximo Vencimiento:</span>
                <span style={{ color: '#fbbf24', fontWeight: 700 }}>
                  {formatFullLicenseDate(reminderModalCompany.nextBillingDate)}
                </span>
              </div>
            </div>

            {/* Asunto */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Asunto del Mensaje *</label>
              <input
                type="text"
                value={reminderSubject}
                onChange={(e) => setReminderSubject(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Cuerpo */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Cuerpo del Mensaje (Editable) *</label>
              <textarea
                rows={10}
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                style={{
                  ...inputStyle,
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  lineHeight: 1.5,
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Acciones de Envío y Notificación */}
            {(() => {
              const recipientEmail = reminderModalCompany.billingEmail || reminderModalCompany.adminUsers?.[0]?.email || '';
              const encodedEmail = encodeURIComponent(recipientEmail);
              const encodedSubject = encodeURIComponent(reminderSubject);
              const encodedBody = encodeURIComponent(reminderMessage);

              const gmailUrl = recipientEmail 
                ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedEmail}&su=${encodedSubject}&body=${encodedBody}`
                : null;

              const outlookUrl = recipientEmail
                ? `https://outlook.live.com/mail/0/deeplink/compose?to=${encodedEmail}&subject=${encodedSubject}&body=${encodedBody}`
                : null;

              const mailtoUrl = recipientEmail 
                ? `mailto:${encodedEmail}?subject=${encodedSubject}&body=${encodedBody}`
                : null;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {/* Encabezado de canales */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#a1a1aa', fontWeight: 600 }}>
                      Selecciona el canal para enviar el recordatorio:
                    </span>
                    <button
                      type="button"
                      onClick={handleSendPaymentReminder}
                      disabled={reminderSending}
                      style={{
                        ...btnPrimary,
                        fontSize: '0.82rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: '#3b82f6',
                        padding: '0.55rem 1rem'
                      }}
                    >
                      <Send size={14} />
                      <span>{reminderSending ? 'Emitiendo en sistema...' : 'Emitir Notificación en Sistema'}</span>
                    </button>
                  </div>

                  {/* Fila de opciones de Correo y WhatsApp */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '0.5rem' }}>
                    {/* 1. Gmail Web */}
                    <a
                      href={gmailUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (!recipientEmail) {
                          e.preventDefault();
                          toast.error('Esta empresa no tiene correo asignado. Agrega uno en Editar Cuotas.');
                        }
                      }}
                      style={{
                        ...btnSecondary,
                        fontSize: '0.78rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        color: '#f87171',
                        borderColor: 'rgba(239, 68, 68, 0.4)',
                        background: 'rgba(239, 68, 68, 0.08)',
                        textDecoration: 'none',
                        fontWeight: 600,
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px'
                      }}
                    >
                      <Mail size={14} />
                      <span>Gmail Web</span>
                    </a>

                    {/* 2. Outlook Web */}
                    <a
                      href={outlookUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (!recipientEmail) {
                          e.preventDefault();
                          toast.error('Esta empresa no tiene correo asignado. Agrega uno en Editar Cuotas.');
                        }
                      }}
                      style={{
                        ...btnSecondary,
                        fontSize: '0.78rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        color: '#60a5fa',
                        borderColor: 'rgba(59, 130, 246, 0.4)',
                        background: 'rgba(59, 130, 246, 0.08)',
                        textDecoration: 'none',
                        fontWeight: 600,
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px'
                      }}
                    >
                      <ExternalLink size={14} />
                      <span>Outlook Web</span>
                    </a>

                    {/* 3. App de Correo Local */}
                    <a
                      href={mailtoUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (!recipientEmail) {
                          e.preventDefault();
                          toast.error('Esta empresa no tiene correo asignado. Agrega uno en Editar Cuotas.');
                        }
                      }}
                      style={{
                        ...btnSecondary,
                        fontSize: '0.78rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        color: '#a1a1aa',
                        borderColor: '#3f3f46',
                        textDecoration: 'none',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px'
                      }}
                    >
                      <ExternalLink size={14} />
                      <span>App Correo</span>
                    </a>

                    {/* 4. WhatsApp Web / Móvil */}
                    {reminderModalCompany.billingPhone && (
                      <a
                        href={`https://wa.me/${reminderModalCompany.billingPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`${reminderSubject}\n\n${reminderMessage}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          ...btnSecondary,
                          fontSize: '0.78rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          color: '#34d399',
                          borderColor: 'rgba(52, 211, 153, 0.4)',
                          background: 'rgba(52, 211, 153, 0.08)',
                          textDecoration: 'none',
                          fontWeight: 600,
                          padding: '0.55rem 0.75rem',
                          borderRadius: '8px'
                        }}
                      >
                        <MessageSquare size={14} />
                        <span>WhatsApp</span>
                      </a>
                    )}

                    {/* 5. Copiar Texto Completo */}
                    <button
                      type="button"
                      onClick={() => {
                        const copyPayload = `Para: ${recipientEmail || 'Sin correo'}\nAsunto: ${reminderSubject}\n\n${reminderMessage}`;
                        navigator.clipboard.writeText(copyPayload);
                        setReminderCopied(true);
                        toast.success('Mensaje y datos copiados al portapapeles');
                        setTimeout(() => setReminderCopied(false), 2500);
                      }}
                      style={{
                        ...btnSecondary,
                        fontSize: '0.78rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px'
                      }}
                    >
                      {reminderCopied ? <Check size={14} style={{ color: '#22c55e' }} /> : <Copy size={14} />}
                      <span>{reminderCopied ? '¡Copiado!' : 'Copiar Todo'}</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {reminderResult && (
              <div style={{
                marginTop: '1.25rem',
                padding: '0.85rem 1rem',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                color: '#6ee7b7',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <CheckCircle2 size={16} />
                <span>Notificación emitida en el portal del cliente y registrada en auditoría.</span>
              </div>
            )}
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
