import React, { useState, useEffect, useRef } from 'react';
import { loadFaceApiModels, faceapi } from '../../utils/faceApiLoader';
import { parseDescriptor } from '../../utils/descriptorUtils';
import { RefreshCw, UserX, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { io } from 'socket.io-client';

import ActionSelector from '../../components/kiosk/ActionSelector';
import OvertimeModal from '../../components/kiosk/OvertimeModal';
import EarlyExitModal from '../../components/kiosk/EarlyExitModal';

const STAGES = {
  SCANNING: 'SCANNING',
  IDENTIFIED: 'IDENTIFIED',
  SELECT_SHIFT: 'SELECT_SHIFT',
  SELECT_ACTION: 'SELECT_ACTION',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
};

const FaceRecognitionPage = () => {
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
  
  const thresholdRef = useRef(0.49);
  
  const videoRef = useRef();
  const canvasRef = useRef();
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const matcherRef = useRef(null);
  const processingRef = useRef(false);

  const fetchDescriptors = async () => {
    try {
      const descRes = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/employees/descriptors`);
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
        const settingsRes = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/settings/public`).catch(() => null);
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
    const socket = io('');
    socket.on('cache_updated', () => {
      console.log('Cache biométrico actualizado, descargando...');
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
    } else if (stage === STAGES.SUCCESS) {
      timeout = setTimeout(() => resetFlow(), 4000);
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

  const fetchContext = async (empId) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/attendance/context/${empId}`, {
        headers: { 'x-api-key': 'kiosk-secret-key-123' }
      });
      if (res.ok) {
        const data = await res.json();
        setContext(data);
        // Si ya tiene entrada registrada, seleccionamos su turno actual para otras acciones
        if (data.hasEntrada && data.currentShiftId) {
          setSelectedShiftId(data.currentShiftId);
        }
      }
    } catch (error) {
      console.error('Error fetching context:', error);
    }
  };

  const resetFlow = () => {
    setStage(STAGES.SCANNING);
    setRecognizedEmployee(null);
    setContext(null);
    setSelectedShiftId(null);
    setActiveModal(null);
    setActionPayload(null);
    setStatusText('Buscando rostros...');
    processingRef.current = false;
    if (canvasRef.current) {
      canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    // No cancelamos animFrame ni volvemos a llamar a detect(). 
    // El ciclo detect() en idle (gracias a processingRef = false) retomará el escaneo automáticamente.
  };

  const handleConfirmIdentity = () => {
    if (!context) {
      setStage(STAGES.PROCESSING);
      setTimeout(() => {
        if (context) goToNextAfterIdentity();
        else resetFlow();
      }, 1500);
      return;
    }
    goToNextAfterIdentity();
  };

  const goToNextAfterIdentity = () => {
    // Si no tiene entrada, SIEMPRE mostrar selector de turno para confirmar
    if (!context.hasEntrada && context.availableShifts?.length >= 1 && !selectedShiftId) {
      setStage(STAGES.SELECT_SHIFT);
    } else {
      setStage(STAGES.SELECT_ACTION);
    }
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

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/attendance/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'kiosk-secret-key-123'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Error al registrar');
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
      toast.error('Hubo un error al registrar. Intenta de nuevo.');
      setStage(STAGES.SELECT_ACTION);
    }
  };

  const getInitials = (f, l) => `${(f || '').charAt(0)}${(l || '').charAt(0)}`.toUpperCase();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f0f0f' }}>
        <RefreshCw size={48} className="spin" style={{ color: '#f97316', marginBottom: '1rem' }} />
        <h2 style={{ color: '#fff' }}>{statusText}</h2>
      </div>
    );
  }

  if (employeesData.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f0f0f', color: '#e4e4e7' }}>
        <UserX size={64} style={{ color: '#ef4444', marginBottom: '1.5rem' }} />
        <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>No hay perfiles biométricos registrados</h2>
        <p style={{ color: '#a1a1aa' }}>Contacta al administrador para comenzar a enrolar empleados.</p>
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', width: '100vw', background: '#0f0f0f', padding: '2rem', boxSizing: 'border-box', overflowY: 'auto' }}>
      
      {/* HEADER SIEMPRE VISIBLE */}
      <div style={{ textAlign: 'center', marginBottom: '2rem', marginTop: stage !== STAGES.SCANNING && stage !== STAGES.IDENTIFIED ? '2rem' : '0' }}>
        <h1 style={{ color: '#fff', fontSize: '2.5rem', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '2px' }}>Kiosko de Asistencia</h1>
        <p style={{ color: '#a1a1aa', fontSize: '1.2rem', margin: 0 }}>
          {stage === STAGES.SCANNING ? statusText : stage === STAGES.PROCESSING ? 'Procesando...' : ''}
        </p>
      </div>

      {/* ETAPAS 1 Y 2: CAMARA Y RECONOCIMIENTO */}
      <div style={{ 
        display: (stage === STAGES.SCANNING || stage === STAGES.IDENTIFIED) ? 'block' : 'none',
        position: 'relative', width: '800px', height: '600px', borderRadius: '16px', overflow: 'hidden', border: `4px solid ${borderColor}`, transition: 'border-color 0.3s', backgroundColor: '#18181b', boxShadow: `0 0 30px ${borderColor}40` 
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
          bottom: stage === STAGES.IDENTIFIED ? 0 : '-150px', 
          left: 0, 
          width: '100%', 
          background: 'linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.8))', 
          padding: '1.5rem', 
          transition: 'bottom 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          borderTop: `2px solid ${borderColor}`
        }}>
          {recognizedEmployee && (
            <>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.2)', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.5rem', flexShrink: 0 }}>
                {getInitials(recognizedEmployee.name?.split(' ')[0], recognizedEmployee.name?.split(' ')[1] || recognizedEmployee.name?.split(' ')[0])}
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ color: '#fff', fontSize: '1.8rem', margin: '0 0 0.25rem 0' }}>{recognizedEmployee.name}</h2>
                <p style={{ color: '#a1a1aa', fontSize: '1.1rem', margin: 0 }}>{recognizedEmployee.department?.name || 'Sin departamento'} • {recognizedEmployee.position || 'Sin cargo'}</p>
              </div>
              <div style={{ textAlign: 'right', marginRight: '1rem' }}>
                <div style={{ color: '#a1a1aa', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Confianza</div>
                <div style={{ color: confColor, fontSize: '1.5rem', fontWeight: 'bold' }}>{confidence}%</div>
              </div>
              <div>
                <button 
                  onClick={handleConfirmIdentity}
                  style={{ background: '#f97316', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  Continuar <ArrowRight size={20} style={{ marginLeft: '0.5rem' }} />
                </button>
                <button 
                  onClick={resetFlow}
                  style={{ background: 'transparent', color: '#a1a1aa', border: 'none', fontSize: '0.9rem', marginTop: '0.5rem', cursor: 'pointer', textDecoration: 'underline', width: '100%' }}
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
        <div style={{ width: '100%', maxWidth: '600px', background: '#18181b', borderRadius: '16px', padding: '2rem', border: '1px solid #27272a' }}>
          <h2 style={{ fontSize: '1.8rem', color: '#fff', textAlign: 'center', marginBottom: '2rem' }}>Selecciona tu turno actual</h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {context.availableShifts.map(shift => (
              <button
                key={shift.id}
                onClick={() => handleSelectShift(shift.id)}
                style={{ background: '#27272a', border: '2px solid transparent', padding: '1.5rem', borderRadius: '12px', color: '#fff', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = '#f97316'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'transparent'}
              >
                <div>
                  <h3 style={{ fontSize: '1.3rem', margin: '0 0 0.5rem 0' }}>{shift.name}</h3>
                  <p style={{ color: '#a1a1aa', margin: 0 }}>{shift.startTime} - {shift.endTime}</p>
                </div>
                <ArrowRight color="#a1a1aa" />
              </button>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
             <button onClick={resetFlow} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', textDecoration: 'underline' }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ETAPA 4: SELECCION DE ACCION */}
      {stage === STAGES.SELECT_ACTION && context && (
        <div className="dark" style={{ width: '100%' }}>
          <ActionSelector 
            context={context} 
            onAction={handleActionSelected} 
            onCancel={resetFlow}
          />
        </div>
      )}

      {/* ETAPA 5: PROCESANDO */}
      {stage === STAGES.PROCESSING && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#f97316' }}>
          <Loader2 size={64} className="spin" style={{ marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '2rem' }}>Procesando...</h2>
        </div>
      )}

      {/* ETAPA 6: EXITO */}
      {stage === STAGES.SUCCESS && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(16, 185, 129, 0.1)', padding: '3rem', borderRadius: '24px', border: '4px solid #10b981' }}>
          <CheckCircle2 size={96} color="#10b981" style={{ marginBottom: '1.5rem' }} />
          <h2 style={{ fontSize: '2.5rem', color: '#10b981', marginBottom: '0.5rem' }}>¡Listo!</h2>
          <p style={{ fontSize: '1.5rem', color: '#fff' }}>{successMessage}</p>
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
