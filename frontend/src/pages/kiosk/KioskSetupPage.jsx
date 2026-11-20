import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  MonitorSmartphone, ShieldCheck, ShieldAlert, Clock, RefreshCw, 
  CheckCircle2, AlertCircle, ArrowRight, Copy, Check, Building2 
} from 'lucide-react';

const SESSION_STORAGE_KEY = 'kiosk_pending_auth_request';

const KioskSetupPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRevoked = searchParams.get('revoked') === 'true';

  const [authData, setAuthData] = useState(null); // { requestId, pairingCode, expiresAt }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('waiting'); // 'waiting' | 'approved' | 'rejected' | 'expired'
  const [approvedDevice, setApprovedDevice] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [copied, setCopied] = useState(false);
  const [companySlugInput, setCompanySlugInput] = useState(searchParams.get('slug') || searchParams.get('company') || '');

  const socketRef = useRef(null);
  const timerRef = useRef(null);
  const isRequestingRef = useRef(false);

  // Obtener o generar un ID único persistente para este navegador/dispositivo
  const getOrCreateDeviceId = () => {
    let id = localStorage.getItem('kiosk_device_id');
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : 'kio_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('kiosk_device_id', id);
    }
    return id;
  };

  // Inicializar o restaurar solicitud
  const initRequest = async (forceNew = false) => {
    // Evitar llamadas simultáneas concurrentes (ej. React 18 StrictMode)
    if (isRequestingRef.current && !forceNew) return;
    isRequestingRef.current = true;

    setLoading(true);
    setError(null);
    setStatus('waiting');

    try {
      // 1. Revisar sessionStorage si no se forzó una nueva
      if (!forceNew) {
        const cached = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
              setAuthData(parsed);
              setLoading(false);
              isRequestingRef.current = false;
              return;
            } else {
              sessionStorage.removeItem(SESSION_STORAGE_KEY);
            }
          } catch (e) {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
          }
        }
      }

      // 2. Pedir solicitud al backend enviando el deviceId para deduplicación estricta
      const deviceId = getOrCreateDeviceId();
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const requestPayload = { deviceId, forceNew };
      if (companySlugInput.trim()) {
        requestPayload.companySlug = companySlugInput.trim();
      }

      const res = await fetch(`${baseUrl}/api/v1/devices/auth-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      if (!res.ok) {
        throw new Error('No se pudo generar la solicitud de emparejamiento');
      }

      const data = await res.json();
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
      setAuthData(data);
    } catch (err) {
      console.error('[KioskSetup] Error:', err);
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
      isRequestingRef.current = false;
    }
  };

  useEffect(() => {
    initRequest();
  }, []);

  // Manejo de Socket.io y Temporizador cuando authData está listo
  useEffect(() => {
    if (!authData?.requestId) return;

    const baseUrl = import.meta.env.VITE_API_URL || '';
    const socket = io(baseUrl, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[KioskSetup] Conectado a socket. ID:', socket.id);
      socket.emit('join_device_auth', authData.requestId);
    });

    socket.on('device_auth_approved', (payload) => {
      console.log('[KioskSetup] Solicitud aprobada:', payload);
      setStatus('approved');
      setApprovedDevice(payload);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.setItem('kiosk_device_token', payload.token);

      // Redirigir al Kiosko tras animación
      setTimeout(() => {
        navigate('/kiosk', { replace: true });
      }, 1800);
    });

    socket.on('device_auth_rejected', () => {
      setStatus('rejected');
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    });

    // Temporizador regresivo
    const updateCountdown = () => {
      const now = new Date().getTime();
      const expires = new Date(authData.expiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft('00:00');
        setStatus('expired');
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    updateCountdown();
    timerRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [authData]);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0a0b',
      backgroundImage: 'radial-gradient(ellipse at 50% 20%, rgba(249, 115, 22, 0.08) 0%, transparent 70%)',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Notificación de revocación previa si aplica */}
      {isRevoked && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444',
          padding: '0.85rem 1.5rem',
          borderRadius: '12px',
          marginBottom: '2rem',
          maxWidth: '540px',
          fontSize: '0.9rem'
        }}>
          <ShieldAlert size={20} style={{ flexShrink: 0 }} />
          <span>Acceso revocado: Este dispositivo fue desvinculado por el Administrador. Para reactivarlo, autorízalo nuevamente.</span>
        </div>
      )}

      {/* Tarjeta Principal de Configuración */}
      <div style={{
        width: '100%',
        maxWidth: '540px',
        backgroundColor: '#18181b',
        border: '1px solid #27272a',
        borderRadius: '24px',
        padding: 'clamp(1.25rem, 4vw, 2.5rem)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        textAlign: 'center',
        position: 'relative',
        boxSizing: 'border-box'
      }}>
        {/* Icono de Cabecera */}
        <div style={{
          width: '68px',
          height: '68px',
          margin: '0 auto 1.5rem auto',
          borderRadius: '20px',
          backgroundColor: status === 'approved' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(249, 115, 22, 0.12)',
          border: `1px solid ${status === 'approved' ? 'rgba(34, 197, 94, 0.4)' : 'rgba(249, 115, 22, 0.3)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: status === 'approved' ? '#22c55e' : '#f97316'
        }}>
          {status === 'approved' ? (
            <CheckCircle2 size={36} />
          ) : (
            <MonitorSmartphone size={34} />
          )}
        </div>

        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.6rem', fontWeight: 700 }}>
          {status === 'approved' ? '¡Dispositivo Autorizado!' : 'Autorización de Kiosko'}
        </h1>

        <p style={{ margin: '0 0 2rem 0', color: '#a1a1aa', fontSize: '0.95rem', lineHeight: '1.5' }}>
          {status === 'approved'
            ? `Vinculado exitosamente como "${approvedDevice?.name || 'Kiosko'}". Redirigiendo...`
            : status === 'rejected'
            ? 'La solicitud de vinculación fue rechazada por el Administrador.'
            : status === 'expired'
            ? 'El código de emparejamiento ha expirado por seguridad.'
            : 'Para habilitar este Kiosko, un Administrador o Super Administrador debe autorizar este código desde el Panel de Control.'}
        </p>

        {loading ? (
          <div style={{ padding: '3rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <RefreshCw size={32} className="spin-animation" color="#f97316" />
            <span style={{ color: '#71717a', fontSize: '0.9rem' }}>Generando código de emparejamiento...</span>
          </div>
        ) : error ? (
          <div style={{ padding: '1.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '1.5rem' }}>
            <AlertCircle size={28} color="#ef4444" style={{ margin: '0 auto 0.5rem auto' }} />
            <p style={{ margin: '0 0 1rem 0', color: '#fca5a5', fontSize: '0.9rem' }}>{error}</p>
            <button
              onClick={() => initRequest(true)}
              style={{
                padding: '0.6rem 1.2rem',
                backgroundColor: '#f97316',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Reintentar
            </button>
          </div>
        ) : status === 'approved' ? (
          <div style={{ padding: '2rem 0' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#22c55e',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              padding: '0.6rem 1.2rem',
              borderRadius: '99px',
              fontSize: '0.9rem',
              fontWeight: 600
            }}>
              <CheckCircle2 size={16} /> Acceso Concedido
            </div>
          </div>
        ) : status === 'rejected' || status === 'expired' ? (
          <div style={{ padding: '1rem 0' }}>
            <button
              onClick={() => initRequest(true)}
              style={{
                padding: '0.85rem 1.8rem',
                backgroundColor: '#f97316',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.95rem'
              }}
            >
              <RefreshCw size={18} /> Generar nuevo código
            </button>
          </div>
        ) : (
          /* Estado Normal: Esperando Aprobación */
          <div>
            {/* Caja de Código de Emparejamiento */}
            <div style={{
              backgroundColor: '#0e0e11',
              border: '2px dashed rgba(249, 115, 22, 0.4)',
              borderRadius: '16px',
              padding: '1.5rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ color: '#71717a', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Código de Emparejamiento
              </div>
              <div style={{
                fontSize: 'clamp(1.75rem, 6vw, 2.5rem)',
                fontWeight: 800,
                letterSpacing: 'clamp(0.06em, 2vw, 0.15em)',
                color: '#f97316',
                fontFamily: 'monospace'
              }}>
                {authData?.pairingCode}
              </div>

              {/* Botón Copiar Código */}
              <button
                type="button"
                onClick={() => {
                  if (authData?.pairingCode) {
                    navigator.clipboard.writeText(authData.pairingCode);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
                style={{
                  marginTop: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  backgroundColor: copied ? 'rgba(34, 197, 94, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                  border: `1px solid ${copied ? 'rgba(34, 197, 94, 0.3)' : 'rgba(249, 115, 22, 0.3)'}`,
                  color: copied ? '#22c55e' : '#f97316',
                  borderRadius: '8px',
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? '¡Código Copiado!' : 'Copiar Código'}
              </button>
            </div>

            {/* Temporizador y Pulso */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem 1.5rem',
              color: '#a1a1aa',
              fontSize: '0.85rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Clock size={16} color="#eab308" />
                <span>Expira en: <strong style={{ color: '#fff' }}>{timeLeft}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="pulse-dot" />
                <span>Esperando vinculación...</span>
              </div>
            </div>

            {/* Pasos para el Administrador */}
            <div style={{
              backgroundColor: '#121215',
              borderRadius: '12px',
              padding: '1.1rem 1.25rem',
              textAlign: 'left',
              border: '1px solid #27272a',
              fontSize: '0.85rem',
              color: '#d4d4d8'
            }}>
              <div style={{ fontWeight: 600, color: '#fff', marginBottom: '0.5rem' }}>Pasos para autorizar:</div>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: '#a1a1aa' }}>
                <li>Abre tu <strong>Dashboard de Administración</strong> (como Administrador de tu empresa o Super Admin).</li>
                <li>Ve a la sección <strong>Dispositivos</strong> y pulsa en <strong>Añadir Dispositivo</strong> o <strong>Vincular Kiosko</strong>.</li>
                <li>Ingresa el código <strong style={{ color: '#f97316' }}>{authData?.pairingCode}</strong> para asignarle nombre y activarlo.</li>
              </ol>

              {/* Opción de Pre-Vincular con Identificador de Empresa */}
              <div style={{ marginTop: '1rem', paddingTop: '0.9rem', borderTop: '1px solid #27272a' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Building2 size={13} /> Identificador de Empresa (Opcional)
                  </label>
                  {authData?.companyId && (
                    <span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 600 }}>Empresa pre-vinculada</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Ej. nexora-tech-puebla"
                    value={companySlugInput}
                    onChange={(e) => setCompanySlugInput(e.target.value)}
                    style={{
                      flex: 1,
                      backgroundColor: '#0e0e11',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      padding: '0.45rem 0.75rem',
                      color: '#fff',
                      fontSize: '0.82rem'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => initRequest(true)}
                    style={{
                      backgroundColor: '#27272a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.45rem 0.85rem',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Actualizar
                  </button>
                </div>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.72rem', color: '#71717a' }}>
                  Si indicas el identificador (slug) de tu empresa, aparecerá automáticamente en el banner de tu panel.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .spin-animation {
          animation: spin 1.2s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #22c55e;
          box-shadow: 0 0 0 rgba(34, 197, 94, 0.4);
          animation: pulse 1.8s infinite;
        }
        @keyframes pulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
          }
        }
      `}</style>
    </div>
  );
};

export default KioskSetupPage;
