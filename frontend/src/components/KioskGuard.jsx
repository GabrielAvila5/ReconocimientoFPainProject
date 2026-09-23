import React, { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate, Outlet } from 'react-router-dom';
import { ShieldAlert, Loader2, WifiOff } from 'lucide-react';

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

const KioskGuard = ({ children }) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking'); // 'checking' | 'authorized' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const intervalRef = useRef(null);

  const token = localStorage.getItem('kiosk_device_token');

  const verifyToken = async (isInitial = false) => {
    const currentToken = localStorage.getItem('kiosk_device_token');
    if (!currentToken) {
      if (intervalRef.current) clearInterval(intervalRef.current);
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

      if (response.ok) {
        if (isInitial) {
          setStatus('authorized');
        }
      } else if (response.status === 401) {
        // Dispositivo revocado o token inválido
        if (intervalRef.current) clearInterval(intervalRef.current);
        localStorage.removeItem('kiosk_device_token');
        navigate('/kiosk/setup?revoked=true', { replace: true });
      } else {
        if (isInitial) {
          setStatus('error');
          setErrorMessage('Error al conectar con el servidor de licencias.');
        }
      }
    } catch (err) {
      console.warn('[KioskGuard] Fallo al verificar token en segundo plano:', err.message);
      if (isInitial) {
        // En arranque inicial, permitir reintento si no hay red
        setStatus('error');
        setErrorMessage('No se pudo verificar la autorización del dispositivo. Comprueba la conexión de red.');
      }
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/kiosk/setup', { replace: true });
      return;
    }

    // 1. Verificación inicial al montar
    verifyToken(true);

    // 2. Heartbeat periódico en segundo plano
    intervalRef.current = setInterval(() => {
      verifyToken(false);
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!token) {
    return <Navigate to="/kiosk/setup" replace />;
  }

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
          .animate-spin {
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

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
