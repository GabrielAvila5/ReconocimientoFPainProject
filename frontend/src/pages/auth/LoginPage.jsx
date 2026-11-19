import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LogIn, Lock, Mail, AlertCircle, Eye, EyeOff, UserCheck, ArrowRight } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    try {
      console.log('[LoginPage] Iniciando sesión para:', cleanEmail);
      await login(cleanEmail, cleanPassword);
      console.log('[LoginPage] Sesión iniciada con éxito. Redirigiendo a /dashboard...');
      navigate('/dashboard');
    } catch (err) {
      console.error('[LoginPage] Error en login:', err.response?.data || err.message);
      const serverError = (err.response?.data?.error || err.response?.data?.message || '').toString();
      
      if (
        serverError.toLowerCase().includes('credenciales') ||
        serverError.toLowerCase().includes('invalid') ||
        err.response?.status === 401
      ) {
        if (!cleanEmail.includes('@')) {
          setError('Credenciales inválidas. Recuerda ingresar tu correo electrónico oficial (ej. admin@empresa.com), no el identificador o slug de la empresa.');
        } else {
          setError('Credenciales inválidas. Verifica que el correo registrado y la contraseña sean correctos (sin espacios accidentales).');
        }
      } else if (serverError === 'COMPANY_SUSPENDED' || err.response?.status === 403) {
        setError('La empresa asociada a este usuario se encuentra suspendida. Contacta a soporte técnico.');
      } else if (serverError === 'TOO_MANY_LOGIN_ATTEMPTS' || err.response?.status === 429) {
        setError('Demasiados intentos fallidos. Por seguridad, espera unos minutos antes de intentar de nuevo.');
      } else {
        setError(serverError || 'Error al iniciar sesión. Verifica tus credenciales o el estado de tu conexión.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoutPrevious = async () => {
    try {
      await logout();
      setError('');
    } catch (err) {
      console.error('Error cerrando sesión previa:', err);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card page-glow">
        <div className="auth-header" style={{ position: 'relative', zIndex: 1 }}>
          <div className="auth-icon-wrapper">
            <Lock size={32} />
          </div>
          <h2 className="auth-title">Acceso Restringido</h2>
          <p className="auth-subtitle">Panel de Administración Facial</p>
        </div>

        {/* Notificación de sesión previa activa si el usuario ya tiene sesión iniciada */}
        {user && (
          <div style={{
            margin: '0 2rem 1.25rem',
            padding: '0.85rem 1rem',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '8px',
            fontSize: '0.82rem',
            color: '#93c5fd',
            position: 'relative',
            zIndex: 1
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 600 }}>
              <UserCheck size={16} />
              <span>Sesión activa detectada ({user.role})</span>
            </div>
            <p style={{ margin: '0 0 0.65rem', color: '#cbd5e1', fontSize: '0.78rem' }}>
              Tienes una sesión iniciada con <strong>{user.email}</strong>. Si deseas probar las credenciales de un administrador de empresa, cierra la sesión previa o usa una ventana de incógnito.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleLogoutPrevious}
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cerrar Sesión Activa
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                Ir a mi Dashboard <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="auth-error" style={{ margin: '0 2rem 1.5rem', position: 'relative', zIndex: 1 }}>
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="auth-form" style={{ position: 'relative', zIndex: 1 }}>
          <div className="auth-input-group">
            <label className="auth-label">Correo Electrónico</label>
            <div className="auth-input-wrapper">
              <Mail size={18} className="auth-input-icon" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                placeholder="admin@empresa.com"
                required 
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label className="auth-label">Contraseña</label>
            <div className="auth-input-wrapper" style={{ position: 'relative' }}>
              <Lock size={18} className="auth-input-icon" />
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                placeholder="••••••••"
                style={{ paddingRight: '2.5rem' }}
                required 
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '1rem',
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
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="auth-btn"
            style={{ marginTop: '1rem' }}
          >
            {isLoading ? 'Autenticando...' : (
              <>
                <span>Iniciar Sesión</span>
                <LogIn size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer" style={{ position: 'relative', zIndex: 1 }}>
          <p>Módulo de Administración Segura &copy; {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
