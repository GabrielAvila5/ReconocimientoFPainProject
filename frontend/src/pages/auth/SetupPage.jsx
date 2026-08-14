import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { ShieldCheck, User, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';

const SetupPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth(); // Usaremos una lógica para recargar sesión si es necesario, o la respuesta nos logueará si creamos bien la api
  const navigate = useNavigate();

  // Validar si el setup es necesario. Si no, redirigir a login.
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await api.get('/auth/setup-status');
        if (!res.data.needsSetup) {
          navigate('/login', { replace: true });
        }
      } catch (err) {
        console.error('Error checking setup status', err);
      }
    };
    checkStatus();
  }, [navigate]);

  const handleSetup = async (e) => {
    e.preventDefault();
    setError('');

    // Validaciones frontend
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);

    try {
      // Llamada al endpoint de setup
      await api.post('/auth/setup', { name, email, password });
      
      // Forzamos un reload de página para que AuthContext vuelva a llamar a /auth/me y ver la cookie recién seteada.
      // O podríamos redirigir a /dashboard
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.response?.data?.error || 'Error al configurar el sistema. Inténtalo de nuevo.');
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card page-glow" style={{ maxWidth: '500px' }}>
        <div className="auth-header" style={{ position: 'relative', zIndex: 1, paddingBottom: '1rem' }}>
          <div className="auth-icon-wrapper" style={{ background: 'rgba(249, 115, 22, 0.1)', color: 'var(--primary-orange)' }}>
            <ShieldCheck size={36} />
          </div>
          <h2 className="auth-title">¡Bienvenido al Sistema!</h2>
          <p className="auth-subtitle">Crea el Administrador Principal para comenzar.</p>
        </div>

        {error && (
          <div className="auth-error" style={{ margin: '0 2rem 1.5rem', position: 'relative', zIndex: 1 }}>
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSetup} className="auth-form" style={{ position: 'relative', zIndex: 1 }}>
          <div className="auth-input-group">
            <label className="auth-label">Nombre Completo</label>
            <div className="auth-input-wrapper">
              <User size={18} className="auth-input-icon" />
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="auth-input"
                placeholder="Ej. Juan Pérez"
                required 
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label className="auth-label">Correo Electrónico (Usuario)</label>
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

          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="auth-input-group">
              <label className="auth-label">Contraseña</label>
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-input-icon" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input"
                  placeholder="Min. 8 caracteres"
                  required 
                  minLength={8}
                />
              </div>
            </div>

            <div className="auth-input-group">
              <label className="auth-label">Confirmar Contraseña</label>
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-input-icon" />
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="auth-input"
                  placeholder="Repetir contraseña"
                  required 
                  minLength={8}
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="auth-btn"
            style={{ marginTop: '1rem' }}
          >
            {isLoading ? 'Configurando...' : (
              <>
                <span>Crear Cuenta y Entrar</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer" style={{ position: 'relative', zIndex: 1 }}>
          <p>Esta cuenta tendrá privilegios de SUPER_ADMIN.</p>
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
