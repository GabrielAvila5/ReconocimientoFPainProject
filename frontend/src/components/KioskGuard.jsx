import React, { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate, Outlet } from 'react-router-dom';
import { ShieldAlert, Loader2, Lock, Ban, RefreshCw } from 'lucide-react';
import { io } from 'socket.io-client';

const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos
const BLOCKED_POLL_INTERVAL_MS = 6 * 1000; // 6 segundos mientras esté bloqueado

const KioskGuard = ({ children }) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking'); // 'checking' | 'authorized' | 'blocked' | 'deactivated' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [deviceInfo, setDeviceInfo] = useState(null);
  
  const intervalRef = useRef(null);
  const blockedPollRef = useRef(null);
  const socketRef = useRef(null);
  const deviceIdRef = useRef(null);

  const token = localStorage.getItem('kiosk_device_token');

  const verifyToken = async (isInitial = false) => {
    const currentToken = localStorage.getItem('kiosk_device_token');
    if (!currentToken) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (blockedPollRef.current) clearInterval(blockedPollRef.current);
      navigate('/kiosk/setup', { replace: true });
      return;
    }

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const response = await fetch(`${baseUrl}/api/v1/devices/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: currentToken })
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        deviceIdRef.current = data.device?.id;
        setDeviceInfo(data.device);
        setStatus('authorized');
        setErrorMessage('');
        
        // Si estaba en polling de bloqueo, detenerlo
        if (blockedPollRef.current) {
          clearInterval(blockedPollRef.current);
          blockedPollRef.current = null;
        }

        // Unir socket a la sala del dispositivo
        if (socketRef.current && data.device?.id) {
          socketRef.current.emit('join_device', data.device.id);
        }
      } else if (response.status === 403) {
        // Bloqueado temporalmente o dado de baja
        if (data.blocked) {
          setStatus('blocked');
          setErrorMessage(data.error || 'Dispositivo bloqueado temporalmente por el administrador.');
          startBlockedPoll();
        } else if (data.deactivated) {
          setStatus('deactivated');
          setErrorMessage(data.error || 'Dispositivo dado de baja.');
          if (blockedPollRef.current) clearInterval(blockedPollRef.current);
        }
      } else if (response.status === 401) {
        // Dispositivo revocado permanentemente o token inválido
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (blockedPollRef.current) clearInterval(blockedPollRef.current);
        localStorage.removeItem('kiosk_device_token');
        navigate('/kiosk/setup?revoked=true', { replace: true });
      } else {
        if (isInitial) {
          setStatus('error');
          setErrorMessage(data.error || 'Error al conectar con el servidor central.');
        }
      }
    } catch (err) {
      console.warn('[KioskGuard] Fallo al verificar token:', err.message);
      if (isInitial && status !== 'authorized') {
        setStatus('error');
        setErrorMessage('No se pudo verificar la autorización del dispositivo. Comprueba la conexión de red.');
      }
    }
  };

  const startBlockedPoll = () => {
    if (blockedPollRef.current) return;
    blockedPollRef.current = setInterval(() => {
      verifyToken(false);
    }, BLOCKED_POLL_INTERVAL_MS);
  };

  useEffect(() => {
    if (!token) {
      navigate('/kiosk/setup', { replace: true });
      return;
    }

    // Inicializar conexión Socket.io para escuchar bloqueos y desbloqueos en tiempo real
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const socket = io(baseUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (deviceIdRef.current) {
        socket.emit('join_device', deviceIdRef.current);
      }
    });

    const handleStatusChanged = (payload) => {
      if (payload.deviceId && deviceIdRef.current && payload.deviceId !== deviceIdRef.current) {
        return; // Evento para otro dispositivo
      }

      if (payload.deleted) {
        localStorage.removeItem('kiosk_device_token');
        navigate('/kiosk/setup?revoked=true', { replace: true });
        return;
      }

      if (payload.isActive === false) {
        setStatus('deactivated');
        setErrorMessage(payload.reason || 'Este dispositivo ha sido dado de baja por el administrador.');
        return;
      }

      if (payload.isBlocked) {
        setStatus('blocked');
        setErrorMessage(payload.reason || 'Dispositivo bloqueado temporalmente por el administrador.');
        startBlockedPoll();
        return;
      }

      if (payload.isBlocked === false && payload.isActive !== false) {
        // Desbloqueado en tiempo real
        verifyToken(false);
      }
    };

    socket.on('device_status_changed', handleStatusChanged);
    socket.on('device_block_toggled', handleStatusChanged);

    // 1. Verificación inicial
    verifyToken(true);

    // 2. Heartbeat periódico
    intervalRef.current = setInterval(() => {
      verifyToken(false);
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (blockedPollRef.current) clearInterval(blockedPollRef.current);
      if (socket) socket.disconnect();
    };
  }, []);

  if (!token) {
    return <Navigate to="/kiosk/setup" replace />;
  }

  // Estado 1: Verificando al arrancar
  if (status === 'checking') {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0b',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          border: '1px solid rgba(249, 115, 22, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Loader2 size={28} color="#f97316" className="animate-spin" />
        </div>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Verificando autorización...</h3>
        <p style={{ margin: 0, color: '#71717a', fontSize: '0.9rem' }}>Validando credenciales del Kiosko</p>

        <style>{`
          .animate-spin { animation: spin 1s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // Estado 2: Bloqueado temporalmente
  if (status === 'blocked') {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#09090b',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow de fondo */}
        <div style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '320px',
          height: '320px',
          background: 'radial-gradient(circle, rgba(234, 179, 8, 0.15) 0%, rgba(0, 0, 0, 0) 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '24px',
          backgroundColor: 'rgba(234, 179, 8, 0.12)',
          border: '1px solid rgba(234, 179, 8, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
          boxShadow: '0 0 30px rgba(234, 179, 8, 0.2)'
        }}>
          <Lock size={38} color="#eab308" />
        </div>

        <span style={{
          display: 'inline-block',
          padding: '0.3rem 0.8rem',
          backgroundColor: 'rgba(234, 179, 8, 0.15)',
          color: '#fef08a',
          borderRadius: '99px',
          fontSize: '0.8rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: '0.75rem',
          border: '1px solid rgba(234, 179, 8, 0.3)'
        }}>
          Acceso Suspendido
        </span>

        <h1 style={{ margin: '0 0 0.75rem 0', fontSize: '1.8rem', fontWeight: 800 }}>
          Kiosko Bloqueado Temporalmente
        </h1>

        <p style={{ margin: '0 0 1.5rem 0', color: '#a1a1aa', maxWidth: '460px', fontSize: '0.95rem', lineHeight: '1.5' }}>
          {errorMessage || 'El administrador ha pausado las operaciones de este dispositivo.'}
        </p>

        {deviceInfo && (
          <div style={{
            background: '#18181b',
            border: '1px solid #27272a',
            padding: '0.75rem 1.25rem',
            borderRadius: '12px',
            marginBottom: '1.75rem',
            fontSize: '0.85rem',
            color: '#71717a'
          }}>
            Terminal: <strong style={{ color: '#fff' }}>{deviceInfo.name}</strong>
          </div>
        )}

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.6rem',
          color: '#eab308',
          fontSize: '0.85rem',
          background: 'rgba(234, 179, 8, 0.08)',
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          border: '1px solid rgba(234, 179, 8, 0.2)'
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#eab308',
            boxShadow: '0 0 8px #eab308',
            display: 'inline-block'
          }} />
          Esperando señal de reactivación en tiempo real...
        </div>

        <button
          onClick={() => verifyToken(false)}
          style={{
            marginTop: '1.5rem',
            padding: '0.6rem 1.2rem',
            background: 'transparent',
            border: '1px solid #3f3f46',
            color: '#d4d4d8',
            borderRadius: '8px',
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s'
          }}
        >
          <RefreshCw size={14} /> Comprobar estado ahora
        </button>
      </div>
    );
  }

  // Estado 3: Dado de baja
  if (status === 'deactivated') {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#09090b',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.25rem'
        }}>
          <Ban size={36} color="#ef4444" />
        </div>

        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.6rem', fontWeight: 800 }}>Dispositivo Dado de Baja</h2>
        <p style={{ margin: '0 0 1.5rem 0', color: '#a1a1aa', maxWidth: '440px', fontSize: '0.95rem', lineHeight: '1.5' }}>
          {errorMessage || 'Este kiosko fue retirado de servicio por el administrador central.'}
        </p>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => verifyToken(false)}
            style={{
              padding: '0.65rem 1.25rem',
              background: '#27272a',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Verificar nuevamente
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('kiosk_device_token');
              navigate('/kiosk/setup', { replace: true });
            }}
            style={{
              padding: '0.65rem 1.25rem',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Reconfigurar dispositivo
          </button>
        </div>
      </div>
    );
  }

  // Estado 4: Error de red
  if (status === 'error') {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0b',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1rem'
        }}>
          <ShieldAlert size={32} color="#ef4444" />
        </div>
        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>Fallo de Verificación</h2>
        <p style={{ margin: '0 0 1.5rem 0', color: '#a1a1aa', maxWidth: '400px', fontSize: '0.95rem' }}>{errorMessage}</p>
        <button
          onClick={() => {
            setStatus('checking');
            verifyToken(true);
          }}
          style={{
            padding: '0.75rem 1.5rem',
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
    );
  }

  return children ? children : <Outlet />;
};

export default KioskGuard;
