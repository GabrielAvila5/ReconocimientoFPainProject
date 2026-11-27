import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { User, Clock, Shield, Plus, ArrowRight, Save, X, Phone, Calendar, Briefcase, Check } from 'lucide-react';

const CONTRACT_TYPES = [
  { value: 'TIEMPO_COMPLETO', label: 'Tiempo Completo' },
  { value: 'MEDIO_TIEMPO', label: 'Medio Tiempo' },
  { value: 'PRACTICAS', label: 'Prácticas / Becario' },
  { value: 'HONORARIOS', label: 'Honorarios / Freelance' }
];

const DAYS_OF_WEEK = [
  { id: '1', label: 'Lun' },
  { id: '2', label: 'Mar' },
  { id: '3', label: 'Mié' },
  { id: '4', label: 'Jue' },
  { id: '5', label: 'Vie' },
  { id: '6', label: 'Sáb' },
  { id: '7', label: 'Dom' }
];

const FaceRegistration = ({ onComplete }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'horario' | 'seguridad'
  
  // Datos del formulario
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    identifier: '',
    email: '',
    phone: '',
    departmentId: '',
    position: '',
    contractType: 'TIEMPO_COMPLETO',
    hireDate: '',
    birthDate: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    customTolerance: '15'
  });

  // Modalidad de Turno: 'inherit' | 'predefined' | 'custom'
  const [scheduleMode, setScheduleMode] = useState('inherit');
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [customShift, setCustomShift] = useState({
    startTime: '09:00',
    endTime: '18:00',
    breakStartTime: '14:00',
    breakEndTime: '15:00',
    selectedDays: ['1', '2', '3', '4', '5'] // Lunes a Viernes por defecto
  });

  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [shifts, setShifts] = useState([]);

  // Creación rápida de departamento en línea
  const [showQuickDept, setShowQuickDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [creatingDept, setCreatingDept] = useState(false);

  // Cargar departamentos y turnos de la empresa activa
  useEffect(() => {
    const fetchData = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        const token = localStorage.getItem('token');
        const tenantId = localStorage.getItem('tenantId');
        const headers = {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(tenantId ? { 'x-tenant-id': tenantId } : {})
        };

        const [resDept, resShift] = await Promise.all([
          fetch(`${baseUrl}/api/v1/departments`, { headers, credentials: 'include' }),
          fetch(`${baseUrl}/api/v1/shifts`, { headers, credentials: 'include' })
        ]);

        if (resDept.ok) {
          const deptData = await resDept.json();
          setDepartments(Array.isArray(deptData) ? deptData : []);
        }
        if (resShift.ok) {
          const shiftData = await resShift.json();
          setShifts(Array.isArray(shiftData) ? shiftData : []);
        }
      } catch (e) {
        console.error('Error fetching departments/shifts:', e);
      }
    };
    fetchData();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDayToggle = (dayId) => {
    setCustomShift(prev => {
      const exists = prev.selectedDays.includes(dayId);
      const newDays = exists 
        ? prev.selectedDays.filter(d => d !== dayId)
        : [...prev.selectedDays, dayId].sort();
      return { ...prev, selectedDays: newDays };
    });
  };

  const handleCreateDepartment = async () => {
    if (!newDeptName.trim()) return;
    try {
      setCreatingDept(true);
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const token = localStorage.getItem('token');
      const tenantId = localStorage.getItem('tenantId');
      const res = await fetch(`${baseUrl}/api/v1/departments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(tenantId ? { 'x-tenant-id': tenantId } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ name: newDeptName.trim() })
      });

      if (res.ok) {
        const created = await res.json();
        setDepartments(prev => [...prev, created]);
        setFormData(prev => ({ ...prev, departmentId: created.id }));
        setNewDeptName('');
        setShowQuickDept(false);
        toast.success(`Departamento "${created.name}" creado y asignado.`);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Error al crear departamento.');
      }
    } catch (e) {
      toast.error('Error de conexión al crear departamento.');
    } finally {
      setCreatingDept(false);
    }
  };

  const submitRegistration = async (enrollImmediately = true) => {
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.identifier.trim()) {
      toast.error('Nombre, apellido e identificador (DNI/Nº Empleado) son requeridos.');
      setActiveTab('general');
      return;
    }

    setLoading(true);
    
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const token = localStorage.getItem('token') || '';
      const tenantId = localStorage.getItem('tenantId');

      // Preparar payload
      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        identifier: formData.identifier.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        departmentId: formData.departmentId || null,
        position: formData.position.trim() || null,
        contractType: formData.contractType,
        hireDate: formData.hireDate || null,
        birthDate: formData.birthDate || null,
        emergencyContactName: formData.emergencyContactName.trim() || null,
        emergencyContactPhone: formData.emergencyContactPhone.trim() || null,
        customTolerance: formData.customTolerance ? parseInt(formData.customTolerance, 10) : null
      };

      if (scheduleMode === 'predefined' && selectedShiftId) {
        payload.shiftId = selectedShiftId;
      } else if (scheduleMode === 'custom' && customShift.startTime && customShift.endTime) {
        // Construir scheduleByDay para los días seleccionados
        const scheduleObj = {};
        DAYS_OF_WEEK.forEach(day => {
          const isEnabled = customShift.selectedDays.includes(day.id);
          scheduleObj[day.id] = {
            enabled: isEnabled,
            startTime: customShift.startTime,
            endTime: customShift.endTime
          };
        });

        payload.customShift = {
          startTime: customShift.startTime,
          endTime: customShift.endTime,
          tolerance: payload.customTolerance || 15,
          breakStartTime: customShift.breakStartTime || null,
          breakEndTime: customShift.breakEndTime || null,
          scheduleByDay: scheduleObj
        };
      }

      const response = await fetch(`${baseUrl}/api/v1/employees`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(tenantId ? { 'x-tenant-id': tenantId } : {})
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Error guardando empleado');
      }

      const employee = await response.json();
      
      if (enrollImmediately) {
        toast.success('¡Empleado guardado! Iniciando captura biométrica...');
        if (onComplete) onComplete();
        navigate(`/kiosk/enroll/${employee.id}`);
      } else {
        toast.success(`Empleado ${employee.firstName} ${employee.lastName} registrado exitosamente.`);
        if (onComplete) onComplete();
      }

    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Error al registrar empleado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#18181b', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', color: '#fff', border: '1px solid #27272a', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.35rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <User style={{ color: '#f97316' }} size={24} /> Registrar Nuevo Empleado
          </h3>
          <p style={{ margin: '0.35rem 0 0 0', color: '#a1a1aa', fontSize: '0.85rem' }}>
            Completa la información laboral, configuración de horario y datos de contacto.
          </p>
        </div>

        {/* Tabs de Navegación */}
        <div style={{ display: 'flex', background: '#09090b', padding: '0.3rem', borderRadius: '10px', border: '1px solid #27272a', gap: '0.25rem' }}>
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'general' ? '#27272a' : 'transparent',
              color: activeTab === 'general' ? '#fff' : '#a1a1aa',
              fontWeight: 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s'
            }}
          >
            <Briefcase size={16} /> Datos Principales
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('horario')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'horario' ? '#27272a' : 'transparent',
              color: activeTab === 'horario' ? '#fff' : '#a1a1aa',
              fontWeight: 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s'
            }}
          >
            <Clock size={16} /> Horarios y Turno
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('seguridad')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'seguridad' ? '#27272a' : 'transparent',
              color: activeTab === 'seguridad' ? '#fff' : '#a1a1aa',
              fontWeight: 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s'
            }}
          >
            <Shield size={16} /> Contacto y RRHH
          </button>
        </div>
      </div>

      {/* Body del Formulario */}
      <div style={{ padding: '2rem' }}>
        {/* TAB 1: DATOS GENERALES */}
        {activeTab === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Nombre(s) <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  name="firstName" 
                  value={formData.firstName} 
                  onChange={handleInputChange} 
                  style={inputStyle} 
                  placeholder="Ej. Gabriel"
                  required 
                />
              </div>

              <div>
                <label style={labelStyle}>Apellidos <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  name="lastName" 
                  value={formData.lastName} 
                  onChange={handleInputChange} 
                  style={inputStyle} 
                  placeholder="Ej. Morales Ávila"
                  required 
                />
              </div>

              <div>
                <label style={labelStyle}>Identificador / DNI / Matrícula <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  name="identifier" 
                  value={formData.identifier} 
                  onChange={handleInputChange} 
                  style={inputStyle} 
                  placeholder="Ej. EMP-0042 o DNI"
                  required 
                />
              </div>

              <div>
                <label style={labelStyle}>Cargo o Puesto</label>
                <input 
                  name="position" 
                  value={formData.position} 
                  onChange={handleInputChange} 
                  style={inputStyle} 
                  placeholder="Ej. Desarrollador Frontend" 
                />
              </div>

              <div>
                <label style={labelStyle}>Correo Electrónico (Opcional)</label>
                <input 
                  name="email" 
                  type="email" 
                  value={formData.email} 
                  onChange={handleInputChange} 
                  style={inputStyle} 
                  placeholder="ejemplo@empresa.com" 
                />
              </div>

              <div>
                <label style={labelStyle}>Teléfono Celular / WhatsApp</label>
                <input 
                  name="phone" 
                  type="tel" 
                  value={formData.phone} 
                  onChange={handleInputChange} 
                  style={inputStyle} 
                  placeholder="Ej. +52 55 1234 5678" 
                />
              </div>

              <div>
                <label style={labelStyle}>Tipo de Jornada / Contrato</label>
                <select 
                  name="contractType" 
                  value={formData.contractType} 
                  onChange={handleInputChange} 
                  style={inputStyle}
                >
                  {CONTRACT_TYPES.map(ct => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
              </div>

              {/* Selector de Departamento con Botón + Rápido */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Departamento (Opcional)</label>
                  {!showQuickDept && (
                    <button
                      type="button"
                      onClick={() => setShowQuickDept(true)}
                      style={{ background: 'transparent', border: 'none', color: '#f97316', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                    >
                      <Plus size={14} /> Crear Nuevo
                    </button>
                  )}
                </div>

                {showQuickDept ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Nombre del nuevo departamento..."
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      style={{ ...inputStyle, flex: 1 }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCreateDepartment}
                      disabled={creatingDept || !newDeptName.trim()}
                      style={{ padding: '0.75rem 1rem', background: '#f97316', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      {creatingDept ? '...' : 'Crear'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowQuickDept(false); setNewDeptName(''); }}
                      style={{ background: '#27272a', color: '#a1a1aa', border: 'none', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <select 
                    name="departmentId" 
                    value={formData.departmentId} 
                    onChange={handleInputChange} 
                    style={inputStyle}
                  >
                    <option value="">(Sin departamento asignado / General)</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: HORARIOS Y ASISTENCIA */}
        {activeTab === 'horario' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ ...labelStyle, fontSize: '0.95rem', color: '#fff', fontWeight: 600, marginBottom: '0.75rem' }}>
                Modalidad de Asignación de Horario
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div 
                  onClick={() => setScheduleMode('inherit')}
                  style={{
                    padding: '1rem',
                    borderRadius: '10px',
                    border: scheduleMode === 'inherit' ? '2px solid #f97316' : '1px solid #3f3f46',
                    background: scheduleMode === 'inherit' ? 'rgba(249, 115, 22, 0.08)' : '#121212',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: scheduleMode === 'inherit' ? '#f97316' : '#e4e4e7' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid', borderColor: scheduleMode === 'inherit' ? '#f97316' : '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {scheduleMode === 'inherit' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316' }} />}
                    </div>
                    Heredar Horario
                  </div>
                  <p style={{ margin: '0.4rem 0 0 1.5rem', color: '#a1a1aa', fontSize: '0.8rem' }}>
                    Usa automáticamente el horario de su departamento o el horario global de la empresa.
                  </p>
                </div>

                <div 
                  onClick={() => setScheduleMode('predefined')}
                  style={{
                    padding: '1rem',
                    borderRadius: '10px',
                    border: scheduleMode === 'predefined' ? '2px solid #f97316' : '1px solid #3f3f46',
                    background: scheduleMode === 'predefined' ? 'rgba(249, 115, 22, 0.08)' : '#121212',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: scheduleMode === 'predefined' ? '#f97316' : '#e4e4e7' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid', borderColor: scheduleMode === 'predefined' ? '#f97316' : '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {scheduleMode === 'predefined' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316' }} />}
                    </div>
                    Turno Predefinido
                  </div>
                  <p style={{ margin: '0.4rem 0 0 1.5rem', color: '#a1a1aa', fontSize: '0.8rem' }}>
                    Asignar un turno ya configurado en el catálogo de turnos de la empresa.
                  </p>
                </div>

                <div 
                  onClick={() => setScheduleMode('custom')}
                  style={{
                    padding: '1rem',
                    borderRadius: '10px',
                    border: scheduleMode === 'custom' ? '2px solid #f97316' : '1px solid #3f3f46',
                    background: scheduleMode === 'custom' ? 'rgba(249, 115, 22, 0.08)' : '#121212',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: scheduleMode === 'custom' ? '#f97316' : '#e4e4e7' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid', borderColor: scheduleMode === 'custom' ? '#f97316' : '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {scheduleMode === 'custom' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316' }} />}
                    </div>
                    Horario Personalizado
                  </div>
                  <p style={{ margin: '0.4rem 0 0 1.5rem', color: '#a1a1aa', fontSize: '0.8rem' }}>
                    Definir horas de entrada y salida únicas exclusivamente para este empleado.
                  </p>
                </div>
              </div>
            </div>

            {/* Configuración si eligió Turno Predefinido */}
            {scheduleMode === 'predefined' && (
              <div style={{ padding: '1.25rem', background: '#121212', borderRadius: '12px', border: '1px solid #27272a' }}>
                <label style={labelStyle}>Seleccionar Turno</label>
                {shifts.length === 0 ? (
                  <p style={{ color: '#a1a1aa', fontSize: '0.85rem' }}>No hay turnos registrados en la empresa aún. Puedes usar la opción de Horario Personalizado.</p>
                ) : (
                  <select 
                    value={selectedShiftId} 
                    onChange={e => setSelectedShiftId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Seleccione un turno de la lista...</option>
                    {shifts.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.startTime} - {s.endTime}) {s.tolerance ? `• Tol: ${s.tolerance}m` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Configuración si eligió Horario Personalizado */}
            {scheduleMode === 'custom' && (
              <div style={{ padding: '1.5rem', background: '#121212', borderRadius: '12px', border: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h4 style={{ margin: 0, color: '#f97316', fontSize: '1rem', fontWeight: 600 }}>Parámetros de Horario Personalizado</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Hora de Entrada</label>
                    <input 
                      type="time" 
                      value={customShift.startTime} 
                      onChange={e => setCustomShift({ ...customShift, startTime: e.target.value })} 
                      style={inputStyle} 
                      required 
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Hora de Salida</label>
                    <input 
                      type="time" 
                      value={customShift.endTime} 
                      onChange={e => setCustomShift({ ...customShift, endTime: e.target.value })} 
                      style={inputStyle} 
                      required 
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Tolerancia de Retardo (Minutos)</label>
                    <input 
                      type="number" 
                      min="0"
                      max="120"
                      value={formData.customTolerance} 
                      onChange={e => setFormData({ ...formData, customTolerance: e.target.value })} 
                      style={inputStyle} 
                      placeholder="15" 
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Inicio de Receso / Comida (Opcional)</label>
                    <input 
                      type="time" 
                      value={customShift.breakStartTime} 
                      onChange={e => setCustomShift({ ...customShift, breakStartTime: e.target.value })} 
                      style={inputStyle} 
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Fin de Receso / Comida (Opcional)</label>
                    <input 
                      type="time" 
                      value={customShift.breakEndTime} 
                      onChange={e => setCustomShift({ ...customShift, breakEndTime: e.target.value })} 
                      style={inputStyle} 
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Días Laborales Activos</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {DAYS_OF_WEEK.map(d => {
                      const isSelected = customShift.selectedDays.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => handleDayToggle(d.id)}
                          style={{
                            padding: '0.6rem 1rem',
                            borderRadius: '8px',
                            border: isSelected ? '1px solid #f97316' : '1px solid #3f3f46',
                            background: isSelected ? 'rgba(249, 115, 22, 0.2)' : '#18181b',
                            color: isSelected ? '#f97316' : '#a1a1aa',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ margin: '0.5rem 0 0 0', color: '#71717a', fontSize: '0.78rem' }}>
                    Los días no seleccionados se considerarán días de descanso y no generarán faltas en el reporte.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CONTACTO Y RRHH */}
        {activeTab === 'seguridad' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Fecha de Ingreso / Contratación</label>
                <input 
                  type="date"
                  name="hireDate"
                  value={formData.hireDate}
                  onChange={handleInputChange}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Fecha de Nacimiento</label>
                <input 
                  type="date"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleInputChange}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Nombre del Contacto de Emergencia</label>
                <input 
                  name="emergencyContactName"
                  value={formData.emergencyContactName}
                  onChange={handleInputChange}
                  style={inputStyle}
                  placeholder="Ej. Carmen Rodríguez (Esposa)"
                />
              </div>

              <div>
                <label style={labelStyle}>Teléfono de Emergencia</label>
                <input 
                  name="emergencyContactPhone"
                  type="tel"
                  value={formData.emergencyContactPhone}
                  onChange={handleInputChange}
                  style={inputStyle}
                  placeholder="Ej. +52 55 9876 5432"
                />
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer de Acciones */}
      <div style={{ padding: '1.25rem 2rem', background: '#09090b', borderTop: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <button 
          type="button" 
          onClick={onComplete} 
          style={btnSecondary} 
          disabled={loading}
        >
          Cancelar
        </button>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            onClick={() => submitRegistration(false)} 
            disabled={loading || !formData.firstName.trim() || !formData.lastName.trim() || !formData.identifier.trim()}
            style={{ ...btnOutline, opacity: (loading || !formData.firstName.trim() || !formData.lastName.trim() || !formData.identifier.trim()) ? 0.5 : 1 }}
          >
            <Save size={16} /> {loading ? 'Guardando...' : 'Guardar Empleado'}
          </button>

          <button 
            type="button" 
            onClick={() => submitRegistration(true)} 
            disabled={loading || !formData.firstName.trim() || !formData.lastName.trim() || !formData.identifier.trim()}
            style={{ ...btnPrimary, opacity: (loading || !formData.firstName.trim() || !formData.lastName.trim() || !formData.identifier.trim()) ? 0.5 : 1 }}
          >
            {loading ? 'Guardando...' : (
              <>
                Guardar y Enrolar Rostro <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const labelStyle = {
  display: 'block',
  marginBottom: '0.45rem',
  fontWeight: 500,
  color: '#d4d4d8',
  fontSize: '0.85rem'
};

const inputStyle = {
  width: '100%',
  padding: '0.75rem 0.9rem',
  background: '#121212',
  color: '#fff',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  outline: 'none',
  fontSize: '0.9rem',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s'
};

const btnPrimary = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.5rem',
  background: 'var(--primary-orange, #f97316)',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.9rem',
  transition: 'opacity 0.2s'
};

const btnOutline = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.25rem',
  background: '#27272a',
  color: '#e4e4e7',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.9rem',
  transition: 'background 0.2s'
};

const btnSecondary = {
  padding: '0.75rem 1.25rem',
  background: 'transparent',
  color: '#a1a1aa',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: '0.9rem'
};

export default FaceRegistration;
