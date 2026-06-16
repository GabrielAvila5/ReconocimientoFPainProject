import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const FaceRegistration = ({ onComplete }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ firstName: '', lastName: '', identifier: '', email: '', department: '', position: '' });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const submitRegistration = async () => {
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token') || 'dev-token';
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/employees`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error guardando empleado');
      }

      const employee = await response.json();
      toast.success('¡Empleado guardado! Iniciando captura biométrica...');
      
      // Navigate to the guided enrollment flow
      onComplete(); // close modal/view in Dashboard
      navigate(`/kiosk/enroll/${employee.id}`);

    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Error al registrar empleado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', background: '#1e1e1e', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', color: '#fff', border: '1px solid #333' }}>
      <h3 style={{ marginBottom: '1.5rem', color: '#fff', fontSize: '1.5rem' }}>Registrar Nuevo Empleado</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label style={labelStyle}>Nombre</label>
          <input name="firstName" value={formData.firstName} onChange={handleInputChange} style={inputStyle} required />
        </div>
        <div>
          <label style={labelStyle}>Apellido</label>
          <input name="lastName" value={formData.lastName} onChange={handleInputChange} style={inputStyle} required />
        </div>
        <div>
          <label style={labelStyle}>Identificador (DNI / Número)</label>
          <input name="identifier" value={formData.identifier} onChange={handleInputChange} style={inputStyle} required />
        </div>
        <div>
          <label style={labelStyle}>Correo Electrónico</label>
          <input name="email" type="email" value={formData.email} onChange={handleInputChange} style={inputStyle} required />
        </div>
        <div>
          <label style={labelStyle}>Departamento</label>
          <input name="department" value={formData.department} onChange={handleInputChange} style={inputStyle} required />
        </div>
        <div>
          <label style={labelStyle}>Cargo</label>
          <input name="position" value={formData.position} onChange={handleInputChange} style={inputStyle} required />
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
        <button onClick={onComplete} style={btnSecondary} disabled={loading}>Cancelar</button>
        <button 
          onClick={submitRegistration} 
          disabled={loading || !formData.firstName || !formData.lastName || !formData.identifier || !formData.department || !formData.position}
          style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Guardando...' : 'Guardar y Continuar a Captura Biométrica'}
        </button>
      </div>
    </div>
  );
};

const labelStyle = {
  display: 'block',
  marginBottom: '0.5rem',
  fontWeight: 500,
  color: '#a1a1aa',
  fontSize: '0.9rem'
};

const inputStyle = {
  width: '100%',
  padding: '0.75rem',
  background: '#121212',
  color: '#fff',
  border: '1px solid #3f3f46',
  borderRadius: '6px',
  outline: 'none',
  boxSizing: 'border-box'
};

const btnPrimary = {
  padding: '0.75rem 1.5rem',
  background: 'var(--primary-orange, #f97316)',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 600,
  transition: 'opacity 0.2s'
};

const btnSecondary = {
  padding: '0.75rem 1.5rem',
  background: 'transparent',
  color: '#a1a1aa',
  border: '1px solid #3f3f46',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 600
};

export default FaceRegistration;
