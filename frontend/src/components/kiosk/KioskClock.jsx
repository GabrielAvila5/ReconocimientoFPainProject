import React, { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';

const KioskClock = ({ variant = 'badge', showSeconds = true, style = {} }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Formato 12 horas con AM/PM
  const formatTime = (d) => {
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const base = `${String(displayH).padStart(2, '0')}:${m}`;
    return showSeconds ? `${base}:${s} ${ampm}` : `${base} ${ampm}`;
  };

  // Formato de fecha larga en español: "Viernes, 25 de septiembre de 2026"
  const formatDate = (d) => {
    const raw = d.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  if (variant === 'inline') {
    return (
      <div 
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.6rem',
          color: '#e4e4e7',
          fontSize: '0.95rem',
          ...style
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f97316' }}>
          <Clock size={16} />
          <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{formatTime(time)}</span>
        </div>
        <span style={{ opacity: 0.35 }}>•</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#93c5fd' }}>
          <Calendar size={15} />
          <span>{formatDate(time)}</span>
        </div>
      </div>
    );
  }

  if (variant === 'large') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(24, 24, 27, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(16px)',
          borderRadius: '24px',
          padding: '1.25rem 2.5rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          ...style
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
          <Clock size={28} color="#f97316" />
          <span
            style={{
              fontSize: '2.5rem',
              fontWeight: '800',
              letterSpacing: '2px',
              fontFamily: 'monospace',
              color: '#ffffff',
              textShadow: '0 0 20px rgba(249, 115, 22, 0.4)'
            }}
          >
            {formatTime(time)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '1.05rem', fontWeight: '500' }}>
          <Calendar size={18} color="#3b82f6" />
          <span>{formatDate(time)}</span>
        </div>
      </div>
    );
  }

  // Variant 'badge' por defecto: cápsula moderna y elegante
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.9rem',
        background: 'rgba(24, 24, 27, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        backdropFilter: 'blur(12px)',
        borderRadius: '50px',
        padding: '0.55rem 1.4rem',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
        transition: 'all 0.3s ease',
        ...style
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#f97316' }}>
        <Clock size={18} />
        <span
          style={{
            fontSize: '1.2rem',
            fontWeight: '700',
            letterSpacing: '1px',
            fontFamily: 'monospace',
            color: '#ffffff'
          }}
        >
          {formatTime(time)}
        </span>
      </div>

      <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.2)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#93c5fd', fontSize: '0.95rem', fontWeight: '500' }}>
        <Calendar size={16} />
        <span style={{ color: '#e4e4e7' }}>{formatDate(time)}</span>
      </div>
    </div>
  );
};

export default KioskClock;
