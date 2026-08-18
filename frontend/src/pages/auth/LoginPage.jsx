import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LogIn, Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión. Verifica tus credenciales.');
    } finally {
      setIsLoading(false);
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
