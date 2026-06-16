import React, { useState } from 'react';
import { X } from 'lucide-react';

const PREDEFINED_REASONS = [
  'Permiso médico / Cita',
  'Emergencia familiar',
  'Enfermedad',
  'Trámite personal',
  'Otro'
];

const EarlyExitModal = ({ onConfirm, onCancel }) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const handleConfirm = () => {
    const finalReason = selectedReason === 'Otro' ? customReason : selectedReason;
    if (finalReason.trim().length > 0) {
      onConfirm(finalReason.trim());
    }
  };

  const isFormValid = selectedReason && (selectedReason !== 'Otro' || customReason.trim().length > 2);

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
        
        <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '2rem', color: '#fff' }}>Salida Anticipada</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
          {PREDEFINED_REASONS.map(reason => (
            <button
              key={reason}
              onClick={() => setSelectedReason(reason)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '1rem 1.5rem',
                borderRadius: '12px',
                border: selectedReason === reason ? '2px solid #dc2626' : '2px solid #27272a',
                backgroundColor: selectedReason === reason ? 'rgba(220, 38, 38, 0.1)' : '#27272a',
                color: selectedReason === reason ? '#fca5a5' : '#e4e4e7',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                if (selectedReason !== reason) e.currentTarget.style.borderColor = '#3f3f46';
              }}
              onMouseOut={(e) => {
                if (selectedReason !== reason) e.currentTarget.style.borderColor = '#27272a';
              }}
            >
              {reason}
            </button>
          ))}
        </div>

        {selectedReason === 'Otro' && (
          <div style={{ marginBottom: '2rem', animation: 'fadeIn 0.3s ease-out' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', color: '#a1a1aa', marginBottom: '0.5rem' }}>Especificar motivo</label>
            <textarea 
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Describe brevemente el motivo..."
              style={{
                width: '100%',
                padding: '1rem',
                borderRadius: '12px',
                border: '2px solid #3f3f46',
                backgroundColor: '#27272a',
                color: '#fff',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#dc2626'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#3f3f46'}
              rows="3"
            />
          </div>
        )}

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
              backgroundColor: isFormValid ? '#dc2626' : '#52525b',
              color: isFormValid ? '#fff' : '#a1a1aa',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              cursor: isFormValid ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => isFormValid && (e.currentTarget.style.backgroundColor = '#b91c1c')}
            onMouseOut={(e) => isFormValid && (e.currentTarget.style.backgroundColor = '#dc2626')}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EarlyExitModal;
