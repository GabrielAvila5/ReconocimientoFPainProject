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
        className="kiosk-clock-inline"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '0.65rem',
          color: '#e4e4e7',
          fontSize: 'clamp(1.05rem, 2.6vw, 1.3rem)',
          ...style
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#f97316' }}>
          <Clock size={20} />
          <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 'clamp(1.15rem, 2.8vw, 1.45rem)' }}>{formatTime(time)}</span>
        </div>
        <span style={{ opacity: 0.35 }}>•</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#93c5fd' }}>
          <Calendar size={18} />
          <span style={{ fontWeight: 500 }}>{formatDate(time)}</span>
        </div>
      </div>
    );
  }

  if (variant === 'large') {
    return (
      <div
        className="kiosk-clock-large"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(24, 24, 27, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '24px',
          padding: 'clamp(1.25rem, 3.5vw, 2.2rem) clamp(1.5rem, 5vw, 3.5rem)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), 0 0 1px rgba(249, 115, 22, 0.3)',
          maxWidth: '100%',
          ...style
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Clock size={36} color="#f97316" />
          <span
            style={{
              fontSize: 'clamp(2.5rem, 7vw, 4.2rem)',
              fontWeight: '800',
              letterSpacing: '2px',
              fontFamily: 'monospace',
              color: '#ffffff',
              textShadow: '0 0 24px rgba(249, 115, 22, 0.45)',
              lineHeight: 1.1
            }}
          >
            {formatTime(time)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#94a3b8', fontSize: 'clamp(1.15rem, 3vw, 1.55rem)', fontWeight: '600', textAlign: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Calendar size={22} color="#3b82f6" />
          <span style={{ color: '#f1f5f9' }}>{formatDate(time)}</span>
        </div>
      </div>
    );
  }

  // Variant 'badge' por defecto: cápsula moderna, amplia y visible a distancia
  return (
    <div
      className="kiosk-clock-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem 1.25rem',
        background: 'rgba(24, 24, 27, 0.88)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderRadius: '50px',
        padding: '0.7rem 1.8rem',
        boxShadow: '0 8px 28px rgba(0, 0, 0, 0.45), 0 0 1px rgba(249, 115, 22, 0.3)',
        transition: 'all 0.3s ease',
        maxWidth: '100%',
        ...style
      }}
    >
      <div className="kiosk-clock-time" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#f97316' }}>
        <Clock size={24} style={{ flexShrink: 0 }} />
        <span
          className="kiosk-clock-time-text"
          style={{
            fontSize: 'clamp(1.5rem, 4.5vw, 2.25rem)',
            fontWeight: '800',
            letterSpacing: '1.5px',
            fontFamily: 'monospace',
            color: '#ffffff',
            textShadow: '0 0 18px rgba(249, 115, 22, 0.35)',
            lineHeight: 1.2,
            whiteSpace: 'nowrap'
          }}
        >
          {formatTime(time)}
        </span>
      </div>

      <div className="kiosk-clock-divider" style={{ width: '2px', height: '24px', background: 'rgba(255, 255, 255, 0.22)', borderRadius: '1px' }} />

      <div className="kiosk-clock-date" style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: '#93c5fd', fontSize: 'clamp(1.05rem, 2.8vw, 1.35rem)', fontWeight: '600' }}>
        <Calendar size={20} style={{ flexShrink: 0 }} />
        <span className="kiosk-clock-date-text" style={{ color: '#f8fafc', whiteSpace: 'nowrap' }}>{formatDate(time)}</span>
      </div>
    </div>
  );
};

export default KioskClock;
