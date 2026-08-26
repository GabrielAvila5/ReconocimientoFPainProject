import React from 'react';
import { LogIn, LogOut, Coffee, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

const ActionSelector = ({ context, onAction, onCancel }) => {
  const { hasEntrada, hasReceso, hasSalida, hasHorasExtra, availableShifts, currentShiftId } = context;

  const currentShift = availableShifts?.find(s => s.id === currentShiftId) || availableShifts?.[0];
  
  let isEarly = false;
  let timeRemainingStr = '';

  if (currentShift && currentShift.endTime) {
    const now = new Date();
    const [endH, endM] = currentShift.endTime.split(':').map(Number);
    const end = new Date();
    end.setHours(endH, endM, 0, 0);

    if (now < end) {
      isEarly = true;
      const diffMs = end - now;
      const diffMins = Math.floor(diffMs / 60000);
      const h = Math.floor(diffMins / 60);
      const m = diffMins % 60;
      timeRemainingStr = `Faltan ${h}h ${m}m`;
    }
  }

  // Botones a mostrar basados en contexto
  const getAvailableActions = () => {
    if (!hasEntrada) {
      return [
        { id: 'entrada', label: 'Entrar', icon: <LogIn size={48} />, color: '#16a34a', hoverColor: '#15803d' },
      ];
    }

    if (hasEntrada && !hasSalida) {
      const actions = [];
      
      if (!hasReceso) {
        actions.push({ id: 'recesoInicio', label: 'Iniciar Descanso', icon: <Coffee size={48} />, color: '#2563eb', hoverColor: '#1d4ed8' });
      } else {
        actions.push({ id: 'recesoFin', label: 'Fin de Descanso', icon: <Coffee size={48} />, color: '#4f46e5', hoverColor: '#4338ca' });
      }
      
      if (isEarly) {
        // actions.push({ id: 'salidaAnticipada', label: 'Salida Anticipada', subtitle: timeRemainingStr, icon: <AlertTriangle size={48} />, color: '#dc2626', hoverColor: '#b91c1c', payload: timeRemainingStr });
        // Por ahora, forzamos la salida normal incluso si es temprano, porque ya no hay salida anticipada en kiosko.
        actions.push({ id: 'salida', label: 'Salida', icon: <LogOut size={48} />, color: '#1f2937', hoverColor: '#111827' });
      } else {
        actions.push({ id: 'salida', label: 'Salida', icon: <LogOut size={48} />, color: '#1f2937', hoverColor: '#111827' });
      }
      
      return actions;
    }

    // Si ya tiene salida
    if (hasHorasExtra) {
      if (context.salidaTime && context.overtimeMinutes > 0) {
        const salida = new Date(context.salidaTime);
        const overtimeEnd = new Date(salida.getTime() + context.overtimeMinutes * 60000);
        const nowObj = new Date();

        if (nowObj < overtimeEnd) {
          const diffMs = overtimeEnd - nowObj;
          const diffMins = Math.floor(diffMs / 60000);
          const h = Math.floor(diffMins / 60);
          const m = diffMins % 60;
          const timeRemainingStr = `Faltan ${h}h ${m}m de extras`;

          return [
            { id: 'salidaAnticipada', label: 'Terminar Horas Extra', subtitle: timeRemainingStr, icon: <AlertTriangle size={48} />, color: '#dc2626', hoverColor: '#b91c1c', payload: timeRemainingStr }
          ];
        }
      }

      return [
        { id: 'completado', label: 'Turno Completado', icon: <CheckCircle2 size={48} />, color: '#16a34a', hoverColor: '#15803d' }
      ];
    }
    
    // Ocultado temporalmente por nuevo flujo de Eventos
    // return [
    //   { id: 'horasExtra', label: 'Registrar Horas Extra', icon: <Clock size={48} />, color: '#ca8a04', hoverColor: '#a16207' }
    // ];
    return [
      { id: 'completado', label: 'Turno Completado', icon: <CheckCircle2 size={48} />, color: '#16a34a', hoverColor: '#15803d' }
    ];
  };

  const actions = getAvailableActions();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '2rem' }}>¿Qué deseas registrar?</h2>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1.5rem', 
        width: '100%' 
      }}>
        {actions.map(action => (
          <button
            key={action.id}
            onClick={() => onAction(action.id, action.payload)}
            style={{
              backgroundColor: action.color,
              color: '#fff',
              border: 'none',
              borderRadius: '16px',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              minHeight: '180px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              transition: 'transform 0.2s, filter 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = action.hoverColor;
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = action.color;
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          >
            <div style={{ marginBottom: '1rem' }}>{action.icon}</div>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{action.label}</span>
            {action.subtitle && <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', marginTop: '0.5rem', fontWeight: 'normal' }}>{action.subtitle}</span>}
          </button>
        ))}
      </div>

      <button 
        onClick={onCancel}
        style={{
          marginTop: '3rem',
          padding: '1rem 2rem',
          backgroundColor: 'transparent',
          color: '#a1a1aa',
          border: '1px solid #3f3f46',
          borderRadius: '50px',
          fontSize: '1.1rem',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'background-color 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        Cancelar y volver
      </button>
    </div>
  );
};

export default ActionSelector;
