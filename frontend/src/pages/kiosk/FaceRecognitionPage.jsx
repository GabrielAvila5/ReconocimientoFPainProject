import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadFaceApiModels, faceapi } from '../../utils/faceApiLoader';
import { parseDescriptor } from '../../utils/descriptorUtils';
import { RefreshCw, UserX, CheckCircle2, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { io } from 'socket.io-client';

import ActionSelector from '../../components/kiosk/ActionSelector';
import OvertimeModal from '../../components/kiosk/OvertimeModal';
import EarlyExitModal from '../../components/kiosk/EarlyExitModal';
import KioskClock from '../../components/kiosk/KioskClock';

const STAGES = {
  SCANNING: 'SCANNING',
  IDENTIFIED: 'IDENTIFIED',
  SELECT_SHIFT: 'SELECT_SHIFT',
  SELECT_ACTION: 'SELECT_ACTION',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
};

const FaceRecognitionPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState('Cargando modelos de IA...');
  const [recognizedEmployee, setRecognizedEmployee] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [employeesData, setEmployeesData] = useState([]);
  
  // States for flow
  const [stage, setStage] = useState(STAGES.SCANNING);
  const stageRef = useRef(stage);
  useEffect(() => { stageRef.current = stage; }, [stage]);

  const [context, setContext] = useState(null);
  const [selectedShiftId, setSelectedShiftId] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [actionPayload, setActionPayload] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  const thresholdRef = useRef(0.49);
  
  const videoRef = useRef();
  const canvasRef = useRef();
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const matcherRef = useRef(null);
  const processingRef = useRef(false);

  const fetchDescriptors = async () => {
    try {
      const deviceToken = localStorage.getItem('kiosk_device_token') || '';
      const descRes = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/v1/employees/descriptors`, {
        headers: {
          'x-device-token': deviceToken
        }
      });
      if (descRes.status === 401) {
        localStorage.removeItem('kiosk_device_token');
        navigate('/kiosk/setup?revoked=true', { replace: true });
        return;
      }
      if (!descRes.ok) throw new Error('Error al cargar descriptores');
      
      const employees = await descRes.json();
      setEmployeesData(employees);
      
      if (employees.length > 0) {
        const labeledDescriptors = employees.map(emp => {
          const descriptor = parseDescriptor(emp.faceDescriptor);
          return new faceapi.LabeledFaceDescriptors(emp.id.toString(), [descriptor]);
        });
        matcherRef.current = new faceapi.FaceMatcher(labeledDescriptors, thresholdRef.current);
      } else {
        matcherRef.current = null;
      }
    } catch (error) {
      console.error('Error fetching descriptors:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setStatusText('Cargando modelos de IA...');
        await loadFaceApiModels();
        
        setStatusText('Descargando perfiles biométricos...');
        const settingsRes = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/v1/settings/public`).catch(() => null);
        if (settingsRes && settingsRes.ok) {
          const settings = await settingsRes.json();
          if (settings.faceConfidenceThreshold) {
            thresholdRef.current = 1 - (settings.faceConfidenceThreshold * 0.6);
          }
        }

        await fetchDescriptors();
        startCamera();
      } catch (err) {
        console.error(err);
        toast.error('Error inicializando kiosko');
        setStatusText('Error de inicialización');
      } finally {
        setLoading(false);
      }
    };
    
    init();

    // Conectar a Socket.io para escuchar actualizaciones de caché (Delta o Completa)
    const deviceToken = localStorage.getItem('kiosk_device_token') || '';
    const companyId = localStorage.getItem('kiosk_company_id') || '';
    const socket = io(import.meta.env.VITE_API_URL || '', {
      auth: { deviceToken, companyId },
      reconnection: true
    });
    socket.on('cache_updated', () => {
      console.log('Cache biométrico actualizado, descargando...');
      fetchDescriptors();
    });
    socket.on('descriptors_invalidated', () => {
      console.log('Descriptores invalidados, re-sincronizando...');
      fetchDescriptors();
    });

    return () => {
      socket.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Auto-reset timeout
  useEffect(() => {
    let timeout;
    if (stage === STAGES.IDENTIFIED) {
      timeout = setTimeout(() => resetFlow(), 6000); 
    } else if (stage === STAGES.SUCCESS || stage === STAGES.ERROR) {
      timeout = setTimeout(() => resetFlow(), 5000);
    }
    return () => clearTimeout(timeout);
  }, [stage]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStatusText('Iniciando cámara...');
    } catch (err) {
      console.error(err);
      toast.error('No se pudo acceder a la cámara');
      setStatusText('Cámara no disponible');
    }
  };

  const handleVideoPlay = () => {
    setStatusText('Buscando rostros...');
    detect();
  };

  const detect = async () => {
    if (!videoRef.current || videoRef.current.paused || !matcherRef.current || processingRef.current) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(detect);
      return;
    }
    
    try {
      const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
      
      // Validación Post-Promesa: Si se canceló durante el await, ignorar resultados
      if (processingRef.current || stageRef.current !== STAGES.SCANNING) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }
      
      if (detection) {
        setStatusText('Rostro detectado — analizando...');
        const match = matcherRef.current.findBestMatch(detection.descriptor);
        
        if (match.label !== 'unknown') {
          // Utilizar estado actual desde state (o ref si es necesario, pero setRecognizedEmployee usa el state de React)
          const employee = employeesData.find(e => e.id.toString() === match.label);
          
          if (stageRef.current === STAGES.SCANNING) {
            setRecognizedEmployee(employee);
            setConfidence(((1 - match.distance) * 100).toFixed(1));
            setStatusText('Rostro reconocido');
            setStage(STAGES.IDENTIFIED);
            processingRef.current = true; // Pausa el escaneo continuo
            
            // Pre-cargar contexto
            fetchContext(employee.id);
          }
        } else if (stageRef.current === STAGES.SCANNING) {
          setRecognizedEmployee(null);
          setStatusText('Rostro no reconocido');
        }
        
        // Dibujar landmarks
        if (canvasRef.current && stageRef.current === STAGES.SCANNING) {
          const dims = faceapi.matchDimensions(canvasRef.current, videoRef.current, true);
          const resized = faceapi.resizeResults(detection, dims);
          canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          faceapi.draw.drawFaceLandmarks(canvasRef.current, resized);
        }
      } else {
        if (stageRef.current === STAGES.SCANNING) {
          setRecognizedEmployee(null);
          setStatusText('Buscando rostros...');
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        }
      }
    } catch (e) {
      // Ignorar errores esporádicos del canvas
    }
    
    if (stageRef.current === STAGES.SCANNING || stageRef.current === STAGES.IDENTIFIED) {
       animFrameRef.current = requestAnimationFrame(detect);
    }
  };

  const fetchContextPromiseRef = useRef(null);

  const getFallbackContext = () => ({
    hasEntrada: false,
    hasReceso: false,
    hasSalida: false,
    hasHorasExtra: false,
    salidaTime: null,
    overtimeMinutes: 0,
    availableShifts: [{
      id: -1,
      name: 'Horario Global',
      startTime: '08:00',
      endTime: '17:00',
      tolerance: 15
    }],
    currentShiftId: null
  });

  const fetchContext = (empId) => {
    const promise = (async () => {
      try {
        const deviceToken = localStorage.getItem('kiosk_device_token') || '';
        const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/v1/attendance/context/${empId}`, {
          headers: { 'x-device-token': deviceToken }
        });

        if (res.status === 401) {
          localStorage.removeItem('kiosk_device_token');
          navigate('/kiosk/setup?revoked=true', { replace: true });
          return null;
        }

        if (res.ok) {
          const data = await res.json();
          setContext(data);
          contextRef.current = data;
          if (data.hasEntrada && data.currentShiftId) {
            setSelectedShiftId(data.currentShiftId);
          } else if (data.availableShifts && data.availableShifts.length > 0) {
            setSelectedShiftId(data.availableShifts[0].id);
          }
          return data;
        } else {
          console.warn('[fetchContext] Respuesta no exitosa del backend:', res.status);
          const fallback = getFallbackContext();
          setContext(fallback);
          contextRef.current = fallback;
          setSelectedShiftId(-1);
          return fallback;
        }
      } catch (error) {
        console.error('Error fetching context:', error);
        const fallback = getFallbackContext();
        setContext(fallback);
        contextRef.current = fallback;
        setSelectedShiftId(-1);
        return fallback;
      }
    })();

    fetchContextPromiseRef.current = promise;
    return promise;
  };

  const resetFlow = () => {
    setStage(STAGES.SCANNING);
    setRecognizedEmployee(null);
    setContext(null);
    contextRef.current = null;
    fetchContextPromiseRef.current = null;
    setSelectedShiftId(null);
    setActiveModal(null);
    setActionPayload(null);
    setErrorMessage('');
    setStatusText('Buscando rostros...');
    processingRef.current = false;
    if (canvasRef.current) {
      canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const contextRef = useRef(null);
  useEffect(() => { contextRef.current = context; }, [context]);

  const handleConfirmIdentity = async () => {
    let currentCtx = contextRef.current;

    // Si el contexto aún está resolviéndose en red, esperar activamente su promesa
    if (!currentCtx && fetchContextPromiseRef.current) {
      setStage(STAGES.PROCESSING);
      try {
        currentCtx = await Promise.race([
          fetchContextPromiseRef.current,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
        ]);
      } catch (e) {
        console.warn('[Kiosk] Tiempo de espera de contexto agotado, usando fallback base');
      }
    }

    // Si por red o retraso no se obtuvo, usar el contexto fallback seguro para nunca bloquear al usuario
    if (!currentCtx) {
      currentCtx = getFallbackContext();
      setContext(currentCtx);
      contextRef.current = currentCtx;
      setSelectedShiftId(-1);
    }

    goToNextAfterIdentity(currentCtx);
  };

  const goToNextAfterIdentity = (currentCtx = contextRef.current) => {
    setStage(STAGES.SELECT_ACTION);
  };

  const handleSelectShift = (shiftId) => {
    setSelectedShiftId(shiftId);
    setStage(STAGES.SELECT_ACTION);
  };

  const handleActionSelected = (action) => {
    if (action === 'salidaAnticipada') {
      setActiveModal('earlyExit');
      setActionPayload({ action });
    } else if (action === 'horasExtra') {
      setActiveModal('overtime');
      setActionPayload({ action });
    } else {
      sendRegistration(action);
    }
  };

  const sendRegistration = async (action, overrideShiftId = null, extraPayload = {}) => {
    try {
      setStage(STAGES.PROCESSING);
      setActiveModal(null);
      const shiftId = overrideShiftId || selectedShiftId;
      
      const payload = {
        employeeId: recognizedEmployee.id,
        action,
        shiftId,
        ...extraPayload
      };

      const deviceToken = localStorage.getItem('kiosk_device_token') || '';
      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/v1/attendance/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-token': deviceToken
        },
        body: JSON.stringify({ ...payload, deviceToken })
      });

      if (response.status === 401) {
        localStorage.removeItem('kiosk_device_token');
        navigate('/kiosk/setup?revoked=true', { replace: true });
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al registrar');
      }

      let msg = 'Registro exitoso';
      if (payload.action === 'entrada') msg = '¡Entrada registrada, que tengas un buen día!';
      if (payload.action === 'salida') msg = '¡Salida registrada, buen descanso!';
      if (payload.action === 'recesoInicio') msg = 'Descanso iniciado. ¡Buen provecho!';
      if (payload.action === 'recesoFin') msg = 'Fin de descanso registrado.';
      if (payload.action === 'horasExtra') msg = 'Horas extra registradas. Gracias por tu esfuerzo.';
      if (payload.action === 'salidaAnticipada') msg = 'Salida anticipada registrada.';

      setSuccessMessage(msg);
      setStage(STAGES.SUCCESS);
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || 'Hubo un error al registrar. Intenta de nuevo.');
      setStage(STAGES.ERROR);
    }
  };

  const [syncingDescriptors, setSyncingDescriptors] = useState(false);

  const handleManualSync = async () => {
    try {
      setSyncingDescriptors(true);
      toast.info('Consultando perfiles biométricos...');
      await fetchDescriptors();
      toast.success('Búsqueda completada');
    } catch (err) {
      toast.error('Error al actualizar perfiles biométricos');
    } finally {
      setSyncingDescriptors(false);
    }
  };

  const getInitials = (f, l) => `${(f || '').charAt(0)}${(l || '').charAt(0)}`.toUpperCase();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        width: '100%',
        maxWidth: '100vw',
        background: '#0a0a0b',
        color: '#fff',
        padding: '2rem',
        boxSizing: 'border-box'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          border: '1px solid rgba(249, 115, 22, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.25rem'
        }}>
          <RefreshCw size={28} className="spin" style={{ color: '#f97316' }} />
        </div>
        <h2 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>{statusText}</h2>
        <p style={{ color: '#71717a', fontSize: '0.85rem', margin: 0 }}>Inicializando motor de visión biométrica</p>
      </div>
    );
  }

  if (employeesData.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        width: '100%',
        maxWidth: '100vw',
        background: '#0a0a0b',
        color: '#e4e4e7',
        padding: '2rem 1rem',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow sutil de fondo */}
        <div style={{
          position: 'absolute',
          top: '35%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '380px',
          height: '380px',
          background: 'radial-gradient(circle, rgba(249, 115, 22, 0.12) 0%, rgba(0, 0, 0, 0) 70%)',
          pointerEvents: 'none'
        }} />

        {/* Encabezado superior Kiosko */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem', width: '100%', maxWidth: '540px', position: 'relative', zIndex: 1 }}>
          <h1 style={{
            color: '#fff',
            fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
            margin: '0 0 0.5rem 0',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            fontWeight: 800
          }}>
            Kiosko de Asistencia
          </h1>
          <KioskClock variant="badge" style={{ marginBottom: '0.5rem' }} />
        </div>

        {/* Tarjeta Card central */}
        <div style={{
          width: '100%',
          maxWidth: '520px',
          background: '#141416',
          border: '1px solid #27272a',
          borderRadius: '24px',
          padding: 'clamp(2rem, 5vw, 2.75rem) clamp(1.5rem, 4vw, 2.25rem)',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '24px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem',
            boxShadow: '0 0 30px rgba(239, 68, 68, 0.18)'
          }}>
            <UserX size={42} color="#ef4444" />
          </div>

          <span style={{
            display: 'inline-block',
            padding: '0.3rem 0.85rem',
            backgroundColor: 'rgba(234, 179, 8, 0.12)',
            color: '#facc15',
            borderRadius: '99px',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginBottom: '1rem',
            border: '1px solid rgba(234, 179, 8, 0.25)'
          }}>
            Configuración Pendiente
          </span>

          <h2 style={{
            fontSize: 'clamp(1.25rem, 3.5vw, 1.55rem)',
            fontWeight: 800,
            color: '#fff',
            margin: '0 0 0.75rem 0',
            lineHeight: 1.3
          }}>
            No hay perfiles biométricos registrados
          </h2>

          <p style={{
            color: '#a1a1aa',
            fontSize: '0.92rem',
            lineHeight: 1.55,
            margin: '0 0 1.75rem 0',
            maxWidth: '430px'
          }}>
            Para comenzar a registrar entradas y salidas con reconocimiento facial, es necesario que el administrador registre y enrole el rostro del personal en la sección de Empleados.
          </p>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            width: '100%'
          }}>
            <button
              onClick={handleManualSync}
              disabled={syncingDescriptors}
              style={{
                width: '100%',
                padding: '0.85rem 1.25rem',
                backgroundColor: '#f97316',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: syncingDescriptors ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                transition: 'background 0.2s, transform 0.1s',
                boxShadow: '0 4px 18px rgba(249, 115, 22, 0.35)'
              }}
            >
              <RefreshCw size={18} className={syncingDescriptors ? 'spin' : ''} />
              {syncingDescriptors ? 'Comprobando sincronización...' : 'Comprobar perfiles ahora'}
            </button>

            <button
              onClick={() => {
                if (window.opener) {
                  window.close();
                } else {
                  window.location.href = '/dashboard/employees';
                }
              }}
              style={{
                width: '100%',
                padding: '0.8rem 1.25rem',
                backgroundColor: 'transparent',
                color: '#d4d4d8',
                border: '1px solid #3f3f46',
                borderRadius: '12px',
                fontWeight: 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.55rem',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = '#71717a'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = '#3f3f46'; e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <ArrowLeft size={16} />
              Regresar a Gestión de Personal
            </button>
          </div>

          <div style={{
            marginTop: '1.5rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8rem',
            color: '#71717a'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 8px #10b981',
              display: 'inline-block'
            }} />
            Dispositivo conectado y escuchando actualizaciones en tiempo real
          </div>
        </div>
      </div>
    );
  }

  let borderColor = '#f97316';
  if (statusText === 'Rostro reconocido') borderColor = '#10b981';
  if (statusText === 'Rostro no reconocido') borderColor = '#ef4444';

  let confColor = '#10b981';
  if (confidence < 80) confColor = '#eab308';
  if (confidence < 60) confColor = '#ef4444';

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100dvh', 
      width: '100%', 
      maxWidth: '100vw',
      background: '#0f0f0f', 
      padding: 'clamp(1rem, 3vw, 2rem)', 
      boxSizing: 'border-box', 
      overflowY: 'auto',
      overflowX: 'hidden'
    }}>
      
      {/* HEADER SIEMPRE VISIBLE */}
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '1.25rem', 
        marginTop: stage !== STAGES.SCANNING && stage !== STAGES.IDENTIFIED ? '1rem' : '0', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        width: '100%',
        maxWidth: '800px'
      }}>
        <h1 style={{ 
          color: '#fff', 
          fontSize: 'clamp(1.6rem, 5vw, 2.5rem)', 
          margin: '0 0 0.6rem 0', 
          textTransform: 'uppercase', 
          letterSpacing: '2px',
          fontWeight: 800
        }}>
          Kiosko de Asistencia
        </h1>
        
        {/* RELOJ Y FECHA EN VIVO */}
        <KioskClock variant="badge" style={{ marginBottom: '0.85rem' }} />

        <p style={{ color: '#a1a1aa', fontSize: 'clamp(0.95rem, 2.5vw, 1.15rem)', margin: 0, fontWeight: 500 }}>
          {stage === STAGES.SCANNING ? statusText : stage === STAGES.PROCESSING ? 'Procesando...' : ''}
        </p>
      </div>

      {/* ETAPAS 1 Y 2: CAMARA Y RECONOCIMIENTO */}
      <div style={{ 
        display: (stage === STAGES.SCANNING || stage === STAGES.IDENTIFIED) ? 'block' : 'none',
        position: 'relative', 
        width: '100%', 
        maxWidth: '800px', 
        aspectRatio: '4 / 3',
        maxHeight: '65vh',
        borderRadius: '16px', 
        overflow: 'hidden', 
        border: `4px solid ${borderColor}`, 
        transition: 'border-color 0.3s', 
        backgroundColor: '#18181b', 
        boxShadow: `0 0 30px ${borderColor}40` 
      }}>
        <video 
          ref={videoRef}
          autoPlay 
          muted 
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
          onPlay={handleVideoPlay}
        />
        <canvas 
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: 'scaleX(-1)' }}
        />
        
        {/* Panel Inferior: Reconocimiento */}
        <div style={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          width: '100%', 
          background: 'linear-gradient(to top, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.85) 75%, rgba(0,0,0,0) 100%)', 
          padding: 'clamp(0.85rem, 2.5vw, 1.5rem)', 
          transform: stage === STAGES.IDENTIFIED ? 'translateY(0)' : 'translateY(105%)',
          transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          display: 'flex',
          alignItems: 'center',
          gap: 'clamp(0.75rem, 2vw, 1.5rem)',
          flexWrap: 'wrap',
          borderTop: `2px solid ${borderColor}`,
          boxSizing: 'border-box'
        }}>
          {recognizedEmployee && (
            <>
              <div style={{ 
                width: 'clamp(48px, 8vw, 64px)', 
                height: 'clamp(48px, 8vw, 64px)', 
                borderRadius: '50%', 
                background: 'rgba(249, 115, 22, 0.2)', 
                color: '#f97316', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontWeight: 'bold', 
                fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)', 
                flexShrink: 0 
              }}>
                {getInitials(recognizedEmployee.name?.split(' ')[0], recognizedEmployee.name?.split(' ')[1] || recognizedEmployee.name?.split(' ')[0])}
              </div>
              <div style={{ flex: '1 1 200px', minWidth: '160px' }}>
                <h2 style={{ color: '#fff', fontSize: 'clamp(1.2rem, 3.5vw, 1.8rem)', margin: '0 0 0.25rem 0', lineHeight: 1.2 }}>{recognizedEmployee.name}</h2>
                <p style={{ color: '#a1a1aa', fontSize: 'clamp(0.85rem, 2vw, 1.1rem)', margin: 0 }}>{recognizedEmployee.department?.name || 'Sin departamento'} • {recognizedEmployee.position || 'Sin cargo'}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ color: '#a1a1aa', fontSize: '0.85rem', marginBottom: '0.2rem' }}>Confianza</div>
                <div style={{ color: confColor, fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', fontWeight: 'bold' }}>{confidence}%</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0, minWidth: '120px' }}>
                <button 
                  onClick={handleConfirmIdentity}
                  style={{ 
                    background: '#f97316', 
                    color: '#fff', 
                    border: 'none', 
                    padding: 'clamp(0.6rem, 1.8vw, 0.75rem) clamp(1rem, 2.5vw, 1.5rem)', 
                    borderRadius: '8px', 
                    fontSize: 'clamp(0.95rem, 2vw, 1.1rem)', 
                    fontWeight: 'bold', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center',
                    justifyContent: 'center' 
                  }}
                >
                  Continuar <ArrowRight size={18} style={{ marginLeft: '0.5rem' }} />
                </button>
                <button 
                  onClick={resetFlow}
                  style={{ background: 'transparent', color: '#a1a1aa', border: 'none', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline', width: '100%', textAlign: 'center' }}
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ETAPA 3: SELECCION DE TURNO */}
      {stage === STAGES.SELECT_SHIFT && context && (
        <div style={{ width: '100%', maxWidth: '600px', background: '#18181b', borderRadius: '16px', padding: 'clamp(1.25rem, 3vw, 2rem)', border: '1px solid #27272a', boxSizing: 'border-box' }}>
          <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 1.8rem)', color: '#fff', textAlign: 'center', marginBottom: '1.5rem' }}>Selecciona tu turno actual</h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {context.availableShifts.map(shift => (
              <button
                key={shift.id}
                onClick={() => handleSelectShift(shift.id)}
                style={{ background: '#27272a', border: '2px solid transparent', padding: 'clamp(1rem, 2.5vw, 1.5rem)', borderRadius: '12px', color: '#fff', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = '#f97316'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'transparent'}
              >
                <div>
                  <h3 style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.3rem)', margin: '0 0 0.5rem 0' }}>{shift.name}</h3>
                  <p style={{ color: '#a1a1aa', margin: 0, fontSize: 'clamp(0.85rem, 2vw, 0.95rem)' }}>{shift.startTime} - {shift.endTime}</p>
                </div>
                <ArrowRight color="#a1a1aa" />
              </button>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
             <button onClick={resetFlow} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', textDecoration: 'underline' }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ETAPA 4: SELECCION DE ACCION */}
      {stage === STAGES.SELECT_ACTION && context && (
        <div className="dark" style={{ width: '100%' }}>
          <ActionSelector 
            context={context} 
            employeeName={recognizedEmployee?.name}
            onAction={handleActionSelected} 
            onCancel={resetFlow}
          />
        </div>
      )}

      {/* ETAPA 5: PROCESANDO */}
      {stage === STAGES.PROCESSING && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#f97316' }}>
          <Loader2 size={64} className="spin" style={{ marginBottom: '1rem' }} />
          <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)' }}>Procesando...</h2>
        </div>
      )}

      {/* ETAPA 6: EXITO */}
      {stage === STAGES.SUCCESS && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(16, 185, 129, 0.1)', padding: 'clamp(1.5rem, 4vw, 3rem)', borderRadius: '24px', border: '4px solid #10b981', maxWidth: '600px', width: '100%', textAlign: 'center', boxSizing: 'border-box' }}>
          <CheckCircle2 color="#10b981" style={{ width: 'clamp(64px, 12vw, 96px)', height: 'clamp(64px, 12vw, 96px)', marginBottom: '1rem' }} />
          <h2 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', color: '#10b981', marginBottom: '0.5rem' }}>¡Listo!</h2>
          <p style={{ fontSize: 'clamp(1.1rem, 3vw, 1.5rem)', color: '#fff', marginBottom: '1.25rem' }}>{successMessage}</p>
          <KioskClock variant="inline" style={{ background: 'rgba(0,0,0,0.4)', padding: '0.6rem 1.4rem', borderRadius: '50px', border: '1px solid rgba(16, 185, 129, 0.3)' }} />
        </div>
      )}

      {/* ETAPA 7: ERROR */}
      {stage === STAGES.ERROR && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: 'clamp(1.5rem, 4vw, 3rem)', borderRadius: '24px', border: '4px solid #ef4444', maxWidth: '600px', width: '100%', boxSizing: 'border-box' }}>
          <UserX color="#ef4444" style={{ width: 'clamp(64px, 12vw, 96px)', height: 'clamp(64px, 12vw, 96px)', marginBottom: '1rem' }} />
          <h2 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', color: '#ef4444', marginBottom: '0.5rem' }}>Denegado</h2>
          <p style={{ fontSize: 'clamp(1.1rem, 3vw, 1.5rem)', color: '#fff', textAlign: 'center', maxWidth: '600px' }}>{errorMessage}</p>
        </div>
      )}

      {/* MODALES DE EXCEPCION */}
      <div className="dark">
        {activeModal === 'overtime' && (
          <OvertimeModal 
            onConfirm={(mins) => sendRegistration(actionPayload?.action || 'horasExtra', null, { overtime: mins })}
            onCancel={() => setActiveModal(null)}
          />
        )}
        {activeModal === 'earlyExit' && (
          <EarlyExitModal 
            onConfirm={(reason) => sendRegistration(actionPayload?.action || 'salidaAnticipada', null, { reason })}
            onCancel={() => setActiveModal(null)}
          />
        )}
      </div>

    </div>
  );
};

export default FaceRecognitionPage;
