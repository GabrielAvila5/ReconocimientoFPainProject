import React, { useState } from 'react';
import { X } from 'lucide-react';

const OvertimeModal = ({ onConfirm, onCancel }) => {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);

  const handleConfirm = () => {
    const totalMinutes = hours * 60 + minutes;
    if (totalMinutes > 0) {
      onConfirm(totalMinutes);
    }
  };

  const isFormValid = hours > 0 || minutes > 0;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: '1rem',
      backdropFilter: 'blur(5px)'
    }}>
      <div style={{
        backgroundColor: '#18181b',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        width: '100%',
        maxWidth: '500px',
        padding: '2.5rem',
        position: 'relative',
        border: '1px solid #27272a'
      }}>
        <button 
          onClick={onCancel} 
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            background: 'transparent',
            border: 'none',
            color: '#a1a1aa',
            cursor: 'pointer'
          }}
          onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
          onMouseOut={(e) => e.currentTarget.style.color = '#a1a1aa'}
        >
          <X size={32} />
        </button>
        
        <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '2rem', color: '#fff' }}>Registrar Horas Extra</h2>
        
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <label style={{ fontSize: '0.9rem', color: '#a1a1aa', marginBottom: '0.5rem' }}>Horas</label>
            <select 
              value={hours} 
              onChange={(e) => setHours(Number(e.target.value))}
              style={{
                fontSize: '2.5rem',
                fontWeight: 'bold',
                padding: '1rem',
                borderRadius: '12px',
                border: '2px solid #3f3f46',
                backgroundColor: '#27272a',
                color: '#fff',
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none',
                textAlign: 'center',
                minWidth: '100px'
              }}
            >
              {[...Array(9).keys()].map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
          <span style={{ fontSize: '3rem', fontWeight: 'bold', color: '#52525b', paddingBottom: '0.5rem' }}>:</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <label style={{ fontSize: '0.9rem', color: '#a1a1aa', marginBottom: '0.5rem' }}>Minutos</label>
            <select 
              value={minutes} 
              onChange={(e) => setMinutes(Number(e.target.value))}
              style={{
                fontSize: '2.5rem',
                fontWeight: 'bold',
                padding: '1rem',
                borderRadius: '12px',
                border: '2px solid #3f3f46',
                backgroundColor: '#27272a',
                color: '#fff',
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none',
                textAlign: 'center',
                minWidth: '100px'
              }}
            >
              {[0, 15, 30, 45].map(m => (
                <option key={m} value={m}>{m === 0 ? '00' : m}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <p style={{ fontSize: '1.2rem', color: '#d4d4d8' }}>
            Total: <span style={{ fontWeight: 'bold', color: '#eab308' }}>{hours > 0 ? `${hours} hora(s) ` : ''}{minutes} minutos</span>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '1rem',
              backgroundColor: '#27272a',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
          >
            Cancelar
          </button>
          <button 
            onClick={handleConfirm}
            disabled={!isFormValid}
            style={{
              flex: 1,
              padding: '1rem',
              backgroundColor: isFormValid ? '#ca8a04' : '#52525b',
              color: isFormValid ? '#fff' : '#a1a1aa',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              cursor: isFormValid ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => isFormValid && (e.currentTarget.style.backgroundColor = '#a16207')}
            onMouseOut={(e) => isFormValid && (e.currentTarget.style.backgroundColor = '#ca8a04')}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default OvertimeModal;
