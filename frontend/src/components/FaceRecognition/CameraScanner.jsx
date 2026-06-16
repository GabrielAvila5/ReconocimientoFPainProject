import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

const STATE_COLORS = {
  SCANNING: '#3b82f6', // blue
  SUCCESS: '#22c55e', // green
  UNKNOWN: '#eab308', // yellow
  NO_FACE: '#ef4444', // red
  ERROR: '#991b1b', // dark red
};

const CameraScanner = ({ onEmployeeIdentified, isActive = true }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const isScanningRef = useRef(false);
  const processingRef = useRef(false); // To prevent multiple API calls concurrently

  const visualStateRef = useRef({
    status: 'Cargando modelos...',
    color: STATE_COLORS.SCANNING
  });

  const [uiState, setUiState] = useState({ ...visualStateRef.current });

  const updateFeedback = (msg, color, autoReset = false) => {
    visualStateRef.current = { status: msg, color };
    setUiState({ ...visualStateRef.current });

    if (autoReset) {
      setTimeout(() => {
        if (visualStateRef.current.status === msg) {
          visualStateRef.current = { status: 'Escaneando...', color: STATE_COLORS.SCANNING };
          setUiState({ ...visualStateRef.current });
        }
      }, 3000);
    }
  };

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        updateFeedback('Modelos cargados. Iniciando cámara...', STATE_COLORS.SCANNING);
        startVideo();
      } catch (error) {
        console.error('Error cargando modelos:', error);
        updateFeedback('Error cargando modelos.', STATE_COLORS.ERROR);
      }
    };

    loadModels();
    
    return () => {
      isScanningRef.current = false;
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  const startVideo = () => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.error('Error accediendo a la cámara:', err);
        updateFeedback('Error de cámara. Revisa los permisos.', STATE_COLORS.ERROR);
      });
  };

  const handleVideoPlay = () => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    updateFeedback('Escaneando...', STATE_COLORS.SCANNING);

    const scanLoop = async () => {
      if (!videoRef.current || !canvasRef.current || !isScanningRef.current) return;

      if (!isActive || processingRef.current) {
        // Si no está activo o está procesando, limpiamos canvas y esperamos
        canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        setTimeout(scanLoop, 500);
        return;
      }

      try {
        const displaySize = { 
          width: videoRef.current.videoWidth, 
          height: videoRef.current.videoHeight 
        };
        faceapi.matchDimensions(canvasRef.current, displaySize);

        const detection = await faceapi
          .detectSingleFace(videoRef.current)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection && isActive) {
          const resizedDetections = faceapi.resizeResults(detection, displaySize);
          canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections);

          const descriptorArray = Array.from(detection.descriptor);

          try {
            processingRef.current = true;
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/attendance/validate`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'kiosk-secret-key-123'
              },
              body: JSON.stringify({ descriptor: descriptorArray })
            });

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.match && isActive) {
              updateFeedback(`¡Hola ${result.user}!`, STATE_COLORS.SUCCESS);
              if (onEmployeeIdentified) {
                onEmployeeIdentified(result.employee);
              }
              // Mantenemos el procesing en true para no re-escanear inmediatamente
              setTimeout(() => { processingRef.current = false; }, 4000);
            } else {
              updateFeedback('Rostro no reconocido', STATE_COLORS.UNKNOWN, true);
              processingRef.current = false;
            }
          } catch (fetchError) {
            console.error('Error enviando al backend:', fetchError);
            updateFeedback('Error de conexión', STATE_COLORS.ERROR, true);
            processingRef.current = false;
          }

        } else {
          canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          const currentStatus = visualStateRef.current.status;
          if (currentStatus !== 'Sin rostro detectado' && !currentStatus.includes('Cargando') && !currentStatus.includes('Error')) {
             updateFeedback('Sin rostro detectado', STATE_COLORS.NO_FACE);
          }
        }
      } catch (error) {
        console.error('Error en loop de cámara:', error);
        processingRef.current = false;
      } finally {
        if (isScanningRef.current) {
          setTimeout(scanLoop, 500);
        }
      }
    };

    scanLoop();
  };

  return (
    <div className="flex flex-col items-center">
      <h2 className="mb-4 text-xl font-bold" style={{ color: uiState.color }}>{uiState.status}</h2>
      <div 
        className={`relative rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 ${!isActive ? 'opacity-50 grayscale' : ''}`}
        style={{ border: `4px solid ${uiState.color}` }}
      >
        <video
          ref={videoRef}
          onPlay={handleVideoPlay}
          autoPlay
          muted
          className="w-full max-w-2xl h-auto object-cover"
          style={{ display: 'block' }}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full"
        />
      </div>
    </div>
  );
};

export default CameraScanner;
