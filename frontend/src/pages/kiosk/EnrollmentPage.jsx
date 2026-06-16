import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadFaceApiModels, faceapi } from '../../utils/faceApiLoader';
import { averageDescriptors, serializeDescriptor } from '../../utils/descriptorUtils';
import { ArrowLeft, Camera, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const ENROLLMENT_STEPS = [
  { id: 'left', instruction: 'Gira lentamente hacia la izquierda', icon: '←', hint: 'Mantén el rostro visible para la cámara' },
  { id: 'right', instruction: 'Gira lentamente hacia la derecha', icon: '→', hint: 'Mantén el rostro visible para la cámara' },
  { id: 'up', instruction: 'Inclina el rostro hacia arriba', icon: '↑', hint: 'Levanta ligeramente la barbilla' },
  { id: 'down', instruction: 'Inclina el rostro hacia abajo', icon: '↓', hint: 'Baja ligeramente la barbilla' },
  { id: 'center', instruction: 'Mira al frente y sonríe', icon: '😊', hint: 'Posición central — última captura' },
];

const EnrollmentPage = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [phase, setPhase] = useState('preparation'); // preparation | capture | success | error
  const [errorMessage, setErrorMessage] = useState('');
  
  const [currentStepIndexState, setCurrentStepIndexState] = useState(0);
  const currentStepIndexRef = useRef(0);
  const setCurrentStepIndex = (val) => {
    const newVal = typeof val === 'function' ? val(currentStepIndexRef.current) : val;
    currentStepIndexRef.current = newVal;
    setCurrentStepIndexState(newVal);
  };
  const currentStepIndex = currentStepIndexState;

  const [countdown, setCountdown] = useState(3);
  const [capturedDescriptors, setCapturedDescriptors] = useState([]);
  
  const [captureStatusState, setCaptureStatusState] = useState('idle'); // idle | countdown | validating | processing | success | fail
  const captureStatusRef = useRef('idle');
  const setCaptureStatus = (val) => {
    captureStatusRef.current = val;
    setCaptureStatusState(val);
  };
  const captureStatus = captureStatusState;
  
  const videoRef = useRef();
  const canvasRef = useRef();
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const validFramesCounterRef = useRef(0);

  const [initError, setInitError] = useState(false);

  // Cargar datos del empleado y modelos
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        // Load employee
        const token = localStorage.getItem('token') || 'dev-token';
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/employees/${employeeId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error al cargar datos del empleado');
        const empData = await res.json();
        setEmployee(empData);

        // Load models
        await loadFaceApiModels();
        setModelsLoaded(true);
      } catch (err) {
        console.error(err);
        setInitError(true);
        toast.error('Error inicializando enrolamiento');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [employeeId]);

  // Cargar datos del empleado y modelos
  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Asignar el stream al video cuando se monta en la fase capture
  useEffect(() => {
    if (phase === 'capture' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [phase]);

  const stopCamera = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setPhase('capture');
      startCountdownForStep();
    } catch (err) {
      console.error(err);
      toast.error('No se pudo acceder a la cámara');
    }
  };

  const startCountdownForStep = () => {
    setCaptureStatus('countdown');
    setCountdown(3);
    validFramesCounterRef.current = 0;
    
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          setCaptureStatus('validating');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const getDistance = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

  const handleCapture = (detection) => {
    setCaptureStatus('success');
    const newDescriptors = [...capturedDescriptors, detection.descriptor];
    setCapturedDescriptors(newDescriptors);
    
    setTimeout(() => {
      if (currentStepIndexRef.current < ENROLLMENT_STEPS.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
        startCountdownForStep();
      } else {
        finishEnrollment(newDescriptors);
      }
    }, 1000);
  };

  const finishEnrollment = async (descriptors) => {
    stopCamera();
    setPhase('saving');
    try {
      const avgDescriptor = averageDescriptors(descriptors);
      const serialized = serializeDescriptor(avgDescriptor);

      const token = localStorage.getItem('token') || 'dev-token';
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/employees/${employeeId}/descriptor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ descriptor: serialized })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al guardar en el servidor');
      }
      
      setPhase('success');
      setTimeout(() => {
        navigate('/dashboard/employees');
      }, 3000);
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'Hubo un problema al guardar el perfil.');
      setPhase('error');
      toast.error('Error al guardar el perfil biométrico');
    }
  };

  const getInitials = (f, l) => `${(f || '').charAt(0)}${(l || '').charAt(0)}`.toUpperCase();

  if (initError) {
    return (
      <div style={{ ...pageStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <AlertCircle size={80} style={{ color: '#ef4444', marginBottom: '1.5rem' }} />
        <h1 style={{ color: '#fff', fontSize: '2.5rem', marginBottom: '1rem' }}>Error de Conexión</h1>
        <p style={{ color: '#a1a1aa', fontSize: '1.2rem', marginBottom: '2.5rem' }}>No se pudo cargar la información del empleado o inicializar los modelos.</p>
        <button onClick={() => navigate('/dashboard/employees')} style={{ ...btnSecondary, fontSize: '1.1rem', padding: '0.75rem 2rem' }}>
          Volver a empleados
        </button>
      </div>
    );
  }

  if (loading || !modelsLoaded) {
    return (
      <div style={{ ...pageStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <RefreshCw size={48} className="spin" style={{ color: '#f97316', marginBottom: '1rem' }} />
        <h2 style={{ color: '#fff' }}>Cargando modelos de IA...</h2>
      </div>
    );
  }

  if (phase === 'saving') {
    return (
      <div style={{ ...pageStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <RefreshCw size={48} className="spin" style={{ color: '#f97316', marginBottom: '1rem' }} />
        <h2 style={{ color: '#fff' }}>Procesando perfil biométrico...</h2>
        <p style={{ color: '#a1a1aa', fontSize: '1.1rem' }}>Asegurando la información en el sistema.</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div style={{ ...pageStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <AlertCircle size={80} style={{ color: '#ef4444', marginBottom: '1.5rem' }} />
        <h1 style={{ color: '#fff', fontSize: '2.5rem', marginBottom: '1rem' }}>Error en el Enrolamiento</h1>
        <p style={{ color: '#a1a1aa', fontSize: '1.2rem', marginBottom: '1rem' }}>{errorMessage}</p>
        <button onClick={() => setPhase('preparation')} style={{ ...btnPrimary, fontSize: '1.1rem', padding: '0.75rem 2rem', marginBottom: '1rem' }}>
          Intentar de nuevo
        </button>
        <button onClick={() => navigate('/dashboard/employees')} style={{ ...btnSecondary, fontSize: '1.1rem', padding: '0.75rem 2rem' }}>
          Volver a empleados
        </button>
      </div>
    );
  }

  if (phase === 'preparation') {
    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', paddingTop: '4rem' }}>
          <button onClick={() => navigate('/dashboard/employees')} style={{ ...btnSecondary, position: 'absolute', top: '2rem', left: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={18} /> Volver a empleados
          </button>
          
          <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.2)', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '2.5rem', margin: '0 auto 1.5rem' }}>
            {getInitials(employee?.firstName, employee?.lastName)}
          </div>
          <h1 style={{ color: '#fff', fontSize: '2rem', marginBottom: '0.5rem' }}>{employee?.firstName} {employee?.lastName}</h1>
          <p style={{ color: '#a1a1aa', fontSize: '1.1rem', marginBottom: '2rem' }}>{employee?.department?.name} • {employee?.position || 'Sin cargo'}</p>

          {employee?.faceDescriptor && (
            <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', color: '#eab308', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left' }}>
              <AlertCircle size={24} style={{ flexShrink: 0 }} />
              <span>Este empleado ya tiene un perfil biométrico registrado. Continuar reemplazará el perfil existente.</span>
            </div>
          )}

          <button onClick={startCamera} style={{ ...btnPrimary, fontSize: '1.2rem', padding: '1rem 2rem', display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
            <Camera size={24} /> Comenzar enrolamiento
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'success') {
    return (
      <div style={{ ...pageStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <CheckCircle size={80} style={{ color: '#10b981', marginBottom: '1.5rem' }} />
        <h1 style={{ color: '#fff', fontSize: '2.5rem', marginBottom: '1rem' }}>¡Enrolamiento Exitoso!</h1>
        <p style={{ color: '#a1a1aa', fontSize: '1.2rem', marginBottom: '2.5rem' }}>El perfil biométrico de {employee?.firstName} ha sido registrado correctamente.</p>
        <button onClick={() => navigate('/dashboard/employees')} style={{ ...btnPrimary, fontSize: '1.1rem', padding: '0.75rem 2rem' }}>
          Volver a empleados
        </button>
      </div>
    );
  }

  // Phase Capture
  const step = ENROLLMENT_STEPS[currentStepIndex];
  let borderColor = '#f97316';
  if (captureStatus === 'success') borderColor = '#10b981';
  if (captureStatus === 'fail') borderColor = '#ef4444';

  return (
    <div style={{ ...pageStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '2rem' }}>
      <button onClick={() => { stopCamera(); navigate('/dashboard/employees'); }} style={{ ...btnSecondary, position: 'absolute', top: '2rem', left: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', zIndex: 10 }}>
        <ArrowLeft size={18} /> Cancelar
      </button>

      {/* Progress Indicator */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        {ENROLLMENT_STEPS.map((s, idx) => (
          <div key={s.id} style={{
            width: '32px', height: '32px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: idx < currentStepIndex ? '#10b981' : (idx === currentStepIndex ? '#f97316' : '#3f3f46'),
            color: '#fff', fontWeight: 'bold'
          }}>
            {idx < currentStepIndex ? <CheckCircle size={18} /> : (idx + 1)}
          </div>
        ))}
      </div>

      <div style={{ position: 'relative', width: '640px', height: '480px', borderRadius: '16px', overflow: 'hidden', border: `4px solid ${borderColor}`, transition: 'border-color 0.3s' }}>
        <video 
          ref={videoRef}
          autoPlay 
          muted 
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
          onPlay={async () => {
            const drawLoop = async () => {
              if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
              try {
                if (videoRef.current.videoWidth > 0 && canvasRef.current) {
                  const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
                  if (canvasRef.current.width !== displaySize.width) {
                    faceapi.matchDimensions(canvasRef.current, displaySize);
                  }
                  const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
                  const ctx = canvasRef.current.getContext('2d');
                  ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                  if (detection) {
                    const resized = faceapi.resizeResults(detection, displaySize);
                    faceapi.draw.drawFaceLandmarks(canvasRef.current, resized);
                    
                    if (captureStatusRef.current === 'validating') {
                      const stepId = ENROLLMENT_STEPS[currentStepIndexRef.current].id;
                      let isValid = true;
                      
                      if (stepId === 'left' || stepId === 'right') {
                        const leftEye = detection.landmarks.getLeftEye()[0];
                        const rightEye = detection.landmarks.getRightEye()[3];
                        const nose = detection.landmarks.getNose()[0];
                        
                        const dLeft = getDistance(leftEye, nose);
                        const dRight = getDistance(rightEye, nose);
                        const ratio = dLeft / (dRight || 1);
                        
                        // faceapi getLeftEye() es el ojo derecho de la persona (izquierdo en la imagen).
                        // Cuando la persona mira hacia su IZQUIERDA, su mejilla derecha es visible, 
                        // por lo que el ojo izquierdo (derecho en la imagen, dRight) está más lejos de la nariz.
                        // dLeft será PEQUEÑO, dRight será GRANDE -> Ratio < 1
                        if (stepId === 'left') isValid = ratio > 1.4;
                        if (stepId === 'right') isValid = ratio < 0.7;
                      }
                      
                      if (isValid) {
                        validFramesCounterRef.current++;
                        if (validFramesCounterRef.current >= 4) {
                          setCaptureStatus('processing');
                          handleCapture(detection);
                        }
                      } else {
                        validFramesCounterRef.current = 0;
                      }
                    }
                  }
                }
              } catch (e) {}
              animFrameRef.current = requestAnimationFrame(drawLoop);
            };
            drawLoop();
          }}
        />
        <canvas 
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: 'scaleX(-1)' }}
        />
        
        {/* Overlay Instructions */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
          {captureStatus === 'fail' ? (
            <h2 style={{ color: '#ef4444', fontSize: '2rem', textAlign: 'center', background: 'rgba(0,0,0,0.7)', padding: '1rem 2rem', borderRadius: '12px' }}>
              No se detectó ningún rostro.<br/>Intenta de nuevo.
            </h2>
          ) : captureStatus === 'success' ? (
            <div style={{ background: 'rgba(16, 185, 129, 0.8)', padding: '2rem', borderRadius: '50%', animation: 'pop 0.3s ease-out' }}>
              <CheckCircle size={64} style={{ color: '#fff' }} />
            </div>
          ) : (
            <>
              {step && (
                <>
                  <div style={{ fontSize: '4rem', marginBottom: '1rem', animation: 'bounce 2s infinite' }}>{step.icon}</div>
                  <h2 style={{ color: '#fff', fontSize: '2.5rem', textAlign: 'center', textShadow: '0 2px 10px rgba(0,0,0,0.5)', margin: '0 0 0.5rem 0' }}>{step.instruction}</h2>
                  <p style={{ color: '#e4e4e7', fontSize: '1.2rem', textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>{step.hint}</p>
                </>
              )}
              
              {captureStatus === 'countdown' && (
                <div style={{ fontSize: '5rem', color: '#f97316', fontWeight: 'bold', marginTop: '2rem', textShadow: '0 0 20px rgba(249, 115, 22, 0.5)' }}>
                  {countdown > 0 ? countdown : ''}
                </div>
              )}
              {captureStatus === 'validating' && (
                <div style={{ fontSize: '1.5rem', color: '#f97316', fontWeight: 'bold', marginTop: '2rem', animation: 'bounce 1s infinite' }}>
                  Ajusta tu posición...
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes pop {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
};

const pageStyle = {
  background: '#0f0f0f',
  minHeight: '100vh',
  width: '100%',
  fontFamily: 'Inter, system-ui, sans-serif'
};

const btnPrimary = {
  padding: '0.75rem 1.5rem',
  background: 'var(--primary-orange, #f97316)',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 600,
  transition: 'opacity 0.2s'
};

const btnSecondary = {
  padding: '0.5rem 1rem',
  background: '#1e1e1e',
  color: '#e4e4e7',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 500,
  transition: 'background 0.2s'
};

export default EnrollmentPage;
