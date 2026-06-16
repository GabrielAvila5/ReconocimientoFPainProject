import React, { useState, useEffect } from 'react';
import CameraScanner from '../../components/FaceRecognition/CameraScanner';
import ActionSelector from '../../components/kiosk/ActionSelector';
import OvertimeModal from '../../components/kiosk/OvertimeModal';
import EarlyExitModal from '../../components/kiosk/EarlyExitModal';
import { CheckCircle2, UserCircle2, Loader2, ArrowRight } from 'lucide-react';

const STAGES = {
  IDLE: 'IDLE',
  IDENTIFIED: 'IDENTIFIED',
  SELECT_SHIFT: 'SELECT_SHIFT',
  SELECT_ACTION: 'SELECT_ACTION',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
};

const KioskFlowPage = () => {
  const [stage, setStage] = useState(STAGES.IDLE);
  const [employee, setEmployee] = useState(null);
  const [context, setContext] = useState(null);
  const [selectedShiftId, setSelectedShiftId] = useState(null);
  const [activeModal, setActiveModal] = useState(null); // 'overtime' | 'earlyExit' | null
  const [actionPayload, setActionPayload] = useState(null); // Para guardar accion en proceso
  const [successMessage, setSuccessMessage] = useState('');

  // Auto-reset timeout
  useEffect(() => {
    let timeout;
    if (stage === STAGES.IDENTIFIED) {
      timeout = setTimeout(() => resetFlow(), 8000); // 8 segs para confirmar si es él
    } else if (stage === STAGES.SUCCESS) {
      timeout = setTimeout(() => resetFlow(), 4000);
    }
    return () => clearTimeout(timeout);
  }, [stage]);

  const resetFlow = () => {
    setStage(STAGES.IDLE);
    setEmployee(null);
    setContext(null);
    setSelectedShiftId(null);
    setActiveModal(null);
    setActionPayload(null);
  };

  const handleEmployeeIdentified = async (empData) => {
    setEmployee(empData);
    setStage(STAGES.IDENTIFIED);
    
    // Inmediatamente pedimos su contexto para tenerlo listo
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/attendance/context/${empData.id}`, {
        headers: { 'x-api-key': 'kiosk-secret-key-123' }
      });
      if (res.ok) {
        const data = await res.json();
        setContext(data);
        
        // Pre-seleccionar turno si solo hay uno
        if (data.availableShifts && data.availableShifts.length === 1) {
          setSelectedShiftId(data.availableShifts[0].id);
        } else if (data.currentShiftId) {
          setSelectedShiftId(data.currentShiftId);
        }
      }
    } catch (error) {
      console.error('Error fetching context:', error);
    }
  };

  const handleConfirmIdentity = () => {
    if (!context) {
      // Si el contexto aún no carga, esperamos en PROCESSING un poco (caso raro de red lenta)
      setStage(STAGES.PROCESSING);
      setTimeout(() => {
        if (context) goToNextAfterIdentity();
        else resetFlow(); // Error fallback
      }, 1500);
      return;
    }
    goToNextAfterIdentity();
  };

  const goToNextAfterIdentity = () => {
    // Si no tiene entrada y tiene múltiples turnos disponibles, elegir turno
    if (!context.hasEntrada && context.availableShifts?.length > 1 && !selectedShiftId) {
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
      executeRegister({ action });
    }
  };

  const executeRegister = async (payload) => {
    setStage(STAGES.PROCESSING);
    setActiveModal(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/attendance/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'kiosk-secret-key-123'
        },
        body: JSON.stringify({
          employeeId: employee.id,
          shiftId: selectedShiftId,
          ...payload
        })
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
      alert('Hubo un error al registrar. Intenta de nuevo.');
      setStage(STAGES.SELECT_ACTION);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col relative overflow-hidden transition-colors duration-300">
      
      {/* Background Decorator */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-600 to-transparent opacity-20 dark:opacity-40"></div>

      {/* Header */}
      <header className="p-6 relative z-10 text-center">
        <h1 className="text-4xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight">Kiosko PAIN</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">Sistema de Control de Asistencia</p>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 relative z-10">
        
        {stage === STAGES.IDLE && (
          <div className="animate-fade-in w-full max-w-3xl">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-2xl">
              <CameraScanner 
                isActive={true} 
                onEmployeeIdentified={handleEmployeeIdentified} 
              />
              <div className="mt-8 text-center text-gray-500 dark:text-gray-400">
                <p>Por favor, mira a la cámara para iniciar tu registro</p>
              </div>
            </div>
          </div>
        )}

        {stage === STAGES.IDENTIFIED && employee && (
          <div className="animate-fade-in flex flex-col items-center bg-white dark:bg-gray-800 p-10 rounded-3xl shadow-2xl max-w-md w-full">
            <div className="w-32 h-32 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-6 text-blue-600 dark:text-blue-300">
              <UserCircle2 size={80} />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2 text-center">
              {employee.firstName} {employee.lastName}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8">{employee.identifier}</p>
            
            <button 
              onClick={handleConfirmIdentity}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xl shadow-lg transition-transform transform hover:scale-105 flex items-center justify-center"
            >
              Sí, soy yo <ArrowRight className="ml-2" />
            </button>
            <button 
              onClick={resetFlow}
              className="mt-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
            >
              No soy yo, volver a intentar
            </button>
          </div>
        )}

        {stage === STAGES.SELECT_SHIFT && context && (
          <div className="animate-fade-in w-full max-w-2xl bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-center mb-8 text-gray-800 dark:text-white">Selecciona tu turno actual</h2>
            <div className="grid gap-4">
              {context.availableShifts.map(shift => (
                <button
                  key={shift.id}
                  onClick={() => handleSelectShift(shift.id)}
                  className="p-6 border-2 border-gray-200 dark:border-gray-700 rounded-2xl hover:border-blue-500 dark:hover:border-blue-500 text-left transition-all hover:shadow-md group flex items-center justify-between"
                >
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">{shift.name}</h3>
                    <p className="text-gray-500 dark:text-gray-400">{shift.startTime} - {shift.endTime}</p>
                  </div>
                  <ArrowRight className="text-gray-300 group-hover:text-blue-500" />
                </button>
              ))}
            </div>
            <div className="mt-8 text-center">
               <button onClick={resetFlow} className="text-gray-500 underline">Cancelar</button>
            </div>
          </div>
        )}

        {stage === STAGES.SELECT_ACTION && context && (
          <ActionSelector 
            context={context} 
            onAction={handleActionSelected} 
            onCancel={resetFlow}
          />
        )}

        {stage === STAGES.PROCESSING && (
          <div className="flex flex-col items-center justify-center text-blue-600 dark:text-blue-400">
            <Loader2 size={64} className="animate-spin mb-4" />
            <h2 className="text-2xl font-semibold">Procesando...</h2>
          </div>
        )}

        {stage === STAGES.SUCCESS && (
          <div className="animate-scale-up flex flex-col items-center justify-center bg-green-50 dark:bg-green-900/30 p-12 rounded-3xl border-4 border-green-500 shadow-2xl max-w-lg text-center">
            <CheckCircle2 size={96} className="text-green-500 mb-6" />
            <h2 className="text-3xl font-bold text-green-700 dark:text-green-400 mb-2">¡Listo!</h2>
            <p className="text-xl text-green-600 dark:text-green-300">{successMessage}</p>
          </div>
        )}

      </main>

      {/* Modals */}
      {activeModal === 'overtime' && (
        <OvertimeModal 
          onConfirm={(mins) => executeRegister({ ...actionPayload, overtime: mins })}
          onCancel={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'earlyExit' && (
        <EarlyExitModal 
          onConfirm={(reason) => executeRegister({ ...actionPayload, reason })}
          onCancel={() => setActiveModal(null)}
        />
      )}

      {/* CSS Animaciones Inline para el Kiosko */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-scale-up {
          animation: scaleUp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}} />
    </div>
  );
};

export default KioskFlowPage;
