import React, { useState, useEffect, useMemo } from 'react';
import { Save, AlertCircle, RefreshCw, Lock, AlertTriangle, X, Clock, Plus, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../utils/api';
import AdminManager from '../../components/AdminManager';
import ChangePassword from '../../components/ChangePassword';
import EmployeeSearchSelect from '../../components/EmployeeSearchSelect';

const TAB_FIELDS = {
  perfil: [],
  general: ['companyName', 'timezone', 'maintenanceMode', 'defaultExportFormat'],
  asistencia: ['workdayStartHour', 'workdayStartMinute', 'workdayEndHour', 'workdayEndMinute', 'latenessToleranceMin', 'breakStartTime', 'breakEndTime'],
  reconocimiento: ['faceConfidenceThreshold', 'captureMode'],
  notificaciones: ['alertEmail', 'notifyOnDeviceOffline', 'notifyOnUnknownFace', 'notifyOnLatenessMin'],
  privacidad: ['photoRetentionDays', 'showConsentOnKiosk'],
  seguridad: []
};

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const [originalSettings, setOriginalSettings] = useState(null);
  const [settings, setSettings] = useState({
    companyName: '',
    timezone: 'America/Mexico_City',
    workdayStartHour: 8,
    workdayStartMinute: 0,
    latenessToleranceMin: 15,
    workdayEndHour: 17,
    workdayEndMinute: 0,
    faceConfidenceThreshold: 0.85,
    captureMode: 'AUTO',
    alertEmail: '',
    notifyOnDeviceOffline: true,
    notifyOnUnknownFace: true,
    notifyOnLatenessMin: 30,
    photoRetentionDays: 30,
    showConsentOnKiosk: true,
    maintenanceMode: false,
    defaultExportFormat: 'CSV',
    breakStartTime: '13:00',
    breakEndTime: '14:00'
  });

  const [departments, setDepartments] = useState([]);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [deptLoading, setDeptLoading] = useState(false);

  const [employees, setEmployees] = useState([]);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [empLoading, setEmpLoading] = useState(false);
  const [selectedEmpForShift, setSelectedEmpForShift] = useState(null);
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/settings');
      
      if (res.status !== 200) throw new Error('Error al obtener configuraciones');
      
      const data = res.data;
      setSettings(data);
      setOriginalSettings(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchDepartments();
    fetchEmployees();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees');
      setEmployees(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateDepartment = async () => {
    const name = window.prompt('Ingrese el nombre del nuevo departamento:');
    if (!name) return;
    try {
      await api.post('/departments', { name });
      toast.success('Departamento creado exitosamente');
      fetchDepartments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear departamento');
    }
  };

  const handleDeleteDepartment = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este departamento?')) return;
    try {
      await api.delete(`/departments/${id}`);
      toast.success('Departamento eliminado exitosamente');
      fetchDepartments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar departamento');
    }
  };

  const handleSaveDepartment = async () => {
    try {
      setDeptLoading(true);
      await api.put(`/departments/${editingDepartment.id}/shift`, {
        useCustom: editingDepartment.useCustom,
        startTime: editingDepartment.shift?.startTime || '09:00',
        endTime: editingDepartment.shift?.endTime || '18:00',
        tolerance: editingDepartment.shift?.tolerance !== undefined ? editingDepartment.shift.tolerance : 15,
        breakStartTime: editingDepartment.shift?.breakStartTime || '13:00',
        breakEndTime: editingDepartment.shift?.breakEndTime || '14:00',
      });
      fetchDepartments();
      setEditingDepartment(null);
      toast.success('Horario del departamento actualizado');
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar horario');
    } finally {
      setDeptLoading(false);
    }
  };

  const handleSaveEmployee = async () => {
    try {
      setEmpLoading(true);
      await api.put(`/employees/${editingEmployee.id}/shift`, {
        useCustom: editingEmployee.useCustom,
        startTime: editingEmployee.shift?.startTime || '09:00',
        endTime: editingEmployee.shift?.endTime || '18:00',
        tolerance: editingEmployee.shift?.tolerance !== undefined ? editingEmployee.shift.tolerance : 15,
        breakStartTime: editingEmployee.shift?.breakStartTime || '13:00',
        breakEndTime: editingEmployee.shift?.breakEndTime || '14:00',
      });
      fetchEmployees();
      setEditingEmployee(null);
      toast.success('Horario del empleado actualizado');
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar horario del empleado');
    } finally {
      setEmpLoading(false);
    }
  };

  const handleRemoveEmployeeShift = async (id) => {
    if (!window.confirm('¿Está seguro de desactivar el turno personalizado para este empleado?')) return;
    try {
      await api.put(`/employees/${id}/shift`, { useCustom: false });
      toast.success('Excepción desactivada');
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al desactivar excepción');
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await api.put('/settings', settings);
      const data = res.data;
      setOriginalSettings(data);
      setSettings(data);
      toast.success('Configuración guardada');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const hasUnsavedChanges = (tabName) => {
    if (!originalSettings) return false;
    const fields = TAB_FIELDS[tabName];
    return fields.some(field => settings[field] !== originalSettings[field]);
  };

  // Helper para el select de horas (0-23) y minutos (0,15,30,45)
  const hoursOptions = Array.from({ length: 24 }, (_, i) => i);
  const minutesOptions = [0, 15, 30, 45];
  // Helper para timezone
  const timezones = ['America/Mexico_City', 'America/Tijuana', 'America/Monterrey', 'America/Cancun', 'UTC'];

  const renderTabContent = () => {
    if (loading) {
      return (
        <div style={{ padding: '2rem' }}>
          <Skeleton height="32px" width="40%" style={{ marginBottom: '2rem' }} />
          <Skeleton height="48px" width="100%" style={{ marginBottom: '1rem' }} />
          <Skeleton height="48px" width="100%" style={{ marginBottom: '1rem' }} />
          <Skeleton height="48px" width="100%" style={{ marginBottom: '1rem' }} />
        </div>
      );
    }

    if (error) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
          <AlertCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.8 }} />
          <h3 style={{ margin: '0 0 1rem 0' }}>Error al cargar</h3>
          <p style={{ color: '#fca5a5', marginBottom: '1.5rem' }}>{error}</p>
          <button onClick={fetchSettings} style={btnPrimary}>
            <RefreshCw size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            Reintentar
          </button>
        </div>
      );
    }

    return (
      <div style={{ padding: '2rem', position: 'relative' }}>
        {activeTab === 'general' && (
          <div className="fade-in">
            <h3 style={{ margin: '0 0 1.5rem 0', color: '#fff', fontSize: '1.2rem' }}>Configuración General</h3>
            
            {settings.maintenanceMode && (
              <div style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid #f97316', color: '#f97316', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <AlertTriangle size={20} />
                <span>El sistema está en modo mantenimiento. Los kioscos no registrarán asistencia.</span>
              </div>
            )}

            <div style={formGroup}>
              <label style={labelStyle}>Nombre de la empresa</label>
              <input 
                type="text" 
                maxLength={100}
                value={settings.companyName} 
                onChange={e => handleChange('companyName', e.target.value)} 
                style={inputStyle}
              />
            </div>

            <div style={formGroup}>
              <label style={labelStyle}>Zona horaria</label>
              <select 
                value={settings.timezone} 
                onChange={e => handleChange('timezone', e.target.value)}
                style={inputStyle}
              >
                {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>

            <div style={formGroup}>
              <label style={labelStyle}>Formato de exportación por defecto</label>
              <select 
                value={settings.defaultExportFormat} 
                onChange={e => handleChange('defaultExportFormat', e.target.value)}
                style={inputStyle}
              >
                <option value="CSV">CSV</option>
                <option value="PDF">PDF</option>
              </select>
            </div>

            <div style={{ ...formGroup, marginTop: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <label style={labelStyle}>Modo mantenimiento</label>
                  <p style={helpTextStyle}>Desactiva las funciones públicas y muestra pantalla de mantenimiento en kioscos.</p>
                </div>
                <Toggle 
                  checked={settings.maintenanceMode} 
                  onChange={v => handleChange('maintenanceMode', v)} 
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'asistencia' && (
          <div className="fade-in">
            <h3 style={{ margin: '0 0 1.5rem 0', color: '#fff', fontSize: '1.2rem' }}>Horarios y Tolerancia</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={labelStyle}>Hora de entrada</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select value={settings.workdayStartHour} onChange={e => handleChange('workdayStartHour', parseInt(e.target.value))} style={inputStyle}>
                    {hoursOptions.map(h => <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>)}
                  </select>
                  <span style={{ color: '#a1a1aa', alignSelf: 'center' }}>:</span>
                  <select value={settings.workdayStartMinute} onChange={e => handleChange('workdayStartMinute', parseInt(e.target.value))} style={inputStyle}>
                    {minutesOptions.map(m => <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>)}
                  </select>
                </div>
              </div>
              
              <div>
                <label style={labelStyle}>Hora de salida esperada</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select value={settings.workdayEndHour} onChange={e => handleChange('workdayEndHour', parseInt(e.target.value))} style={inputStyle}>
                    {hoursOptions.map(h => <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>)}
                  </select>
                  <span style={{ color: '#a1a1aa', alignSelf: 'center' }}>:</span>
                  <select value={settings.workdayEndMinute} onChange={e => handleChange('workdayEndMinute', parseInt(e.target.value))} style={inputStyle}>
                    {minutesOptions.map(m => <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={labelStyle}>Inicio de Descanso</label>
                <input 
                  type="time" 
                  value={settings.breakStartTime} 
                  onChange={e => handleChange('breakStartTime', e.target.value)} 
                  style={inputStyle} 
                />
              </div>
              
              <div>
                <label style={labelStyle}>Fin de Descanso</label>
                <input 
                  type="time" 
                  value={settings.breakEndTime} 
                  onChange={e => handleChange('breakEndTime', e.target.value)} 
                  style={inputStyle} 
                />
              </div>
            </div>

            <div style={{ ...formGroup, marginTop: '2.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label style={labelStyle}>Tolerancia de retardo (minutos)</label>
                <input 
                  type="number" 
                  min="0" max="60" 
                  value={settings.latenessToleranceMin} 
                  onChange={e => handleChange('latenessToleranceMin', parseInt(e.target.value) || 0)}
                  style={{ ...inputStyle, width: '80px', padding: '0.25rem 0.5rem', textAlign: 'center' }}
                />
              </div>
              <input 
                type="range" 
                min="0" max="60" 
                value={settings.latenessToleranceMin}
                onChange={e => handleChange('latenessToleranceMin', parseInt(e.target.value))}
                style={{ width: '100%', marginTop: '1rem', accentColor: '#f97316' }}
              />
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#18181b', borderRadius: '8px', border: '1px solid #333' }}>
                {(() => {
                  let totalMinutes = (settings.workdayStartHour * 60) + settings.workdayStartMinute + settings.latenessToleranceMin;
                  const limitHour = Math.floor(totalMinutes / 60) % 24;
                  const limitMinute = totalMinutes % 60;
                  return (
                    <p style={{ margin: 0, color: '#e4e4e7', fontSize: '0.9rem' }}>
                      Con la configuración actual, un empleado que llegue después de las <strong style={{ color: '#f97316' }}>{`${limitHour.toString().padStart(2, '0')}:${limitMinute.toString().padStart(2, '0')}`}</strong> será marcado como tardanza.
                    </p>
                  );
                })()}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3rem', marginBottom: '1.5rem', borderTop: '1px solid #333', paddingTop: '2rem' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>Excepciones por Departamento</h3>
              <button onClick={handleCreateDepartment} style={{ ...btnPrimary, padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                <Plus size={16} /> Nuevo Depto
              </button>
            </div>
            
            <div style={{ overflowX: 'auto', marginBottom: '3rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#18181b', borderRadius: '8px', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#27272a', color: '#a1a1aa', textAlign: 'left', fontSize: '0.9rem' }}>
                    <th style={{ padding: '1rem' }}>Departamento</th>
                    <th style={{ padding: '1rem' }}>Horario Actual</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ padding: '2rem', textAlign: 'center', color: '#a1a1aa' }}>No hay departamentos registrados.</td>
                    </tr>
                  ) : (
                    departments.map(dept => (
                      <tr key={dept.id} style={{ borderTop: '1px solid #333' }}>
                        <td style={{ padding: '1rem', color: '#fff', fontWeight: 500 }}>{dept.name}</td>
                        <td style={{ padding: '1rem', color: '#a1a1aa' }}>
                          {dept.useCustom ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316' }}></span>
                              <span style={{ color: '#f97316' }}>Personalizado</span>
                              <span style={{ fontSize: '0.85em', opacity: 0.8 }}>({dept.shift?.startTime} - {dept.shift?.endTime})</span>
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#52525b' }}></span>
                              <span>Global</span>
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button 
                            onClick={() => setEditingDepartment(JSON.parse(JSON.stringify(dept)))} 
                            style={{ background: 'transparent', border: '1px solid #3f3f46', color: '#e4e4e7', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s', fontFamily: 'inherit' }}
                            onMouseOver={e => e.currentTarget.style.borderColor = '#f97316'}
                            onMouseOut={e => e.currentTarget.style.borderColor = '#3f3f46'}
                          >
                            Editar
                          </button>
                          <button 
                            onClick={() => handleDeleteDepartment(dept.id)}
                            style={{ background: 'transparent', border: '1px solid #3f3f46', color: '#ef4444', padding: '0.4rem 0.5rem', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseOver={e => e.currentTarget.style.borderColor = '#ef4444'}
                            onMouseOut={e => e.currentTarget.style.borderColor = '#3f3f46'}
                            title="Eliminar Departamento"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderTop: '1px solid #333', paddingTop: '2rem' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>Excepciones por Empleado</h3>
              <button onClick={() => setIsEmpModalOpen(true)} style={{ ...btnPrimary, padding: '0.5rem 1rem', fontSize: '0.85rem', background: '#3b82f6' }}>
                <UserPlus size={16} /> Agregar Excepción
              </button>
            </div>
            
            <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#18181b', borderRadius: '8px', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#27272a', color: '#a1a1aa', textAlign: 'left', fontSize: '0.9rem' }}>
                    <th style={{ padding: '1rem' }}>Empleado</th>
                    <th style={{ padding: '1rem' }}>Horario Actual</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.filter(e => e.shifts && e.shifts.length > 0).length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ padding: '2rem', textAlign: 'center', color: '#a1a1aa' }}>No hay empleados con horario personalizado.</td>
                    </tr>
                  ) : (
                    employees.filter(e => e.shifts && e.shifts.length > 0).map(emp => {
                      const shift = emp.shifts[0].shift;
                      return (
                        <tr key={emp.id} style={{ borderTop: '1px solid #333' }}>
                          <td style={{ padding: '1rem', color: '#fff', fontWeight: 500 }}>
                            {emp.firstName} {emp.lastName} <span style={{ color: '#a1a1aa', fontSize: '0.85rem', marginLeft: '0.5rem' }}>({emp.identifier})</span>
                          </td>
                          <td style={{ padding: '1rem', color: '#a1a1aa' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }}></span>
                              <span style={{ color: '#3b82f6' }}>Personalizado</span>
                              <span style={{ fontSize: '0.85em', opacity: 0.8 }}>({shift.startTime} - {shift.endTime})</span>
                            </span>
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button 
                              onClick={() => {
                                const editable = JSON.parse(JSON.stringify(emp));
                                editable.useCustom = true;
                                editable.shift = shift;
                                setEditingEmployee(editable);
                              }} 
                              style={{ background: 'transparent', border: '1px solid #3f3f46', color: '#e4e4e7', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s', fontFamily: 'inherit' }}
                              onMouseOver={e => e.currentTarget.style.borderColor = '#3b82f6'}
                              onMouseOut={e => e.currentTarget.style.borderColor = '#3f3f46'}
                            >
                              Editar
                            </button>
                            <button 
                              onClick={() => handleRemoveEmployeeShift(emp.id)}
                              style={{ background: 'transparent', border: '1px solid #3f3f46', color: '#ef4444', padding: '0.4rem 0.5rem', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}
                              onMouseOver={e => e.currentTarget.style.borderColor = '#ef4444'}
                              onMouseOut={e => e.currentTarget.style.borderColor = '#3f3f46'}
                              title="Desactivar Excepción"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reconocimiento' && (
          <div className="fade-in">
            <h3 style={{ margin: '0 0 1.5rem 0', color: '#fff', fontSize: '1.2rem' }}>Reconocimiento e Inteligencia Artificial</h3>
            
            <div style={formGroup}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label style={labelStyle}>Umbral de confianza facial</label>
                <span style={{ color: '#f97316', fontWeight: 'bold' }}>{Math.round(settings.faceConfidenceThreshold * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="50" max="100" 
                value={Math.round(settings.faceConfidenceThreshold * 100)}
                onChange={e => handleChange('faceConfidenceThreshold', parseInt(e.target.value) / 100)}
                style={{ width: '100%', marginTop: '1rem', accentColor: '#f97316' }}
              />
              <p style={{ ...helpTextStyle, marginTop: '0.5rem' }}>
                El sistema aceptará rostros con al menos {Math.round(settings.faceConfidenceThreshold * 100)}% de coincidencia con el perfil registrado.
              </p>
            </div>

            <div style={{ ...formGroup, marginTop: '2.5rem' }}>
              <label style={labelStyle}>Modo de captura</label>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="captureMode" 
                    value="AUTO" 
                    checked={settings.captureMode === 'AUTO'}
                    onChange={() => handleChange('captureMode', 'AUTO')}
                    style={{ marginTop: '0.25rem', accentColor: '#f97316' }}
                  />
                  <div>
                    <div style={{ color: '#e4e4e7', fontWeight: 500 }}>Automático</div>
                    <div style={helpTextStyle}>El kiosko registra la asistencia en cuanto detecta un rostro conocido.</div>
                  </div>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="captureMode" 
                    value="MANUAL" 
                    checked={settings.captureMode === 'MANUAL'}
                    onChange={() => handleChange('captureMode', 'MANUAL')}
                    style={{ marginTop: '0.25rem', accentColor: '#f97316' }}
                  />
                  <div>
                    <div style={{ color: '#e4e4e7', fontWeight: 500 }}>Manual</div>
                    <div style={helpTextStyle}>El empleado debe presionar un botón en el kiosko para confirmar el registro.</div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notificaciones' && (
          <div className="fade-in">
            <h3 style={{ margin: '0 0 1.5rem 0', color: '#fff', fontSize: '1.2rem' }}>Alertas y Notificaciones</h3>
            
            <div style={formGroup}>
              <label style={labelStyle}>Email de alertas del sistema</label>
              <input 
                type="email" 
                value={settings.alertEmail} 
                onChange={e => handleChange('alertEmail', e.target.value)} 
                style={inputStyle}
                placeholder="admin@empresa.com"
              />
            </div>

            <div style={{ ...formGroup, marginTop: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div>
                  <label style={labelStyle}>Notificar cuando un dispositivo se desconecte</label>
                  <p style={helpTextStyle}>Genera una notificación de tipo ERROR en el centro de notificaciones.</p>
                </div>
                <Toggle checked={settings.notifyOnDeviceOffline} onChange={v => handleChange('notifyOnDeviceOffline', v)} />
              </div>
            </div>

            <div style={{ ...formGroup, marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div>
                  <label style={labelStyle}>Notificar cuando se detecte un rostro desconocido</label>
                  <p style={helpTextStyle}>Genera una notificación de tipo WARNING de categoría SECURITY.</p>
                </div>
                <Toggle checked={settings.notifyOnUnknownFace} onChange={v => handleChange('notifyOnUnknownFace', v)} />
              </div>
            </div>

            <div style={{ ...formGroup, marginTop: '2rem' }}>
              <label style={labelStyle}>Notificar si un empleado lleva más de X minutos sin registrar salida</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                <input 
                  type="number" 
                  min="0" max="480" 
                  value={settings.notifyOnLatenessMin} 
                  onChange={e => handleChange('notifyOnLatenessMin', parseInt(e.target.value) || 0)}
                  style={{ ...inputStyle, width: '100px' }}
                />
                <span style={helpTextStyle}>(0 = desactivado, máx 480)</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'privacidad' && (
          <div className="fade-in">
            <h3 style={{ margin: '0 0 1.5rem 0', color: '#fff', fontSize: '1.2rem' }}>Privacidad y Retención de Datos</h3>
            
            <div style={formGroup}>
              <label style={labelStyle}>Retención de registros fotográficos</label>
              <select 
                value={settings.photoRetentionDays} 
                onChange={e => handleChange('photoRetentionDays', parseInt(e.target.value))}
                style={inputStyle}
              >
                <option value={0}>0 (No guardar)</option>
                <option value={7}>7 días</option>
                <option value={14}>14 días</option>
                <option value={30}>30 días</option>
                <option value={60}>60 días</option>
                <option value={90}>90 días</option>
                <option value={180}>180 días</option>
                <option value={365}>365 días</option>
              </select>
              
              {settings.photoRetentionDays === 0 && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', color: '#38bdf8', fontSize: '0.9rem' }}>
                  Las imágenes serán analizadas y descartadas inmediatamente. No se almacenará ningún rostro en la base de datos.
                </div>
              )}
            </div>

            <div style={{ ...formGroup, marginTop: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <label style={labelStyle}>Mostrar aviso de privacidad en los kioscos</label>
                  <p style={helpTextStyle}>El kiosko mostrará un mensaje de consentimiento antes de cada registro.</p>
                </div>
                <Toggle checked={settings.showConsentOnKiosk} onChange={v => handleChange('showConsentOnKiosk', v)} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'seguridad' && (
          <div className="fade-in mt-4">
            <AdminManager />
          </div>
        )}

        {activeTab === 'perfil' && (
          <div className="fade-in mt-4">
            <ChangePassword />
          </div>
        )}

        {/* Action Bar (Solo para tabs que se pueden guardar) */}
        {activeTab !== 'seguridad' && activeTab !== 'perfil' && (
          <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid #333', display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              onClick={handleSave} 
              disabled={saving}
              style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? <RefreshCw size={18} className="spin" /> : <Save size={18} />}
              Guardar cambios
            </button>
          </div>
        )}
      </div>
    );
  };

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'asistencia', label: 'Asistencia' },
    { id: 'reconocimiento', label: 'Reconocimiento' },
    { id: 'notificaciones', label: 'Notificaciones' },
    { id: 'privacidad', label: 'Privacidad' },
    { id: 'seguridad', label: 'Seguridad' },
    { id: 'perfil', label: 'Mi Perfil' },
  ];

  return (
    <div className="fade-in" style={{ paddingBottom: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ color: '#fff', margin: 0, fontSize: '1.8rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
          Configuración del Sistema
        </h2>
        <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0 0', fontSize: '0.95rem' }}>
          Administra las preferencias, políticas de asistencia y reglas del sistema.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '2rem', minHeight: '600px' }}>
        {/* Sidebar Tabs */}
        <div style={{ width: '200px', flexShrink: 0, borderRight: '1px solid #333', paddingRight: '1rem' }}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            const isUnsaved = hasUnsavedChanges(tab.id);
            
            return (
              <div 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '0.85rem 1rem',
                  marginBottom: '0.5rem',
                  borderRadius: '0 8px 8px 0',
                  cursor: 'pointer',
                  color: isActive ? '#f97316' : '#a1a1aa',
                  background: isActive ? 'rgba(249,115,22,0.15)' : 'transparent',
                  borderLeft: isActive ? '3px solid #f97316' : '3px solid transparent',
                  fontWeight: isActive ? 500 : 400,
                  transition: 'all 0.2s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
                className="hover-bg-opacity"
              >
                {tab.label}
                {isUnsaved && (
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316' }} title="Cambios sin guardar" />
                )}
              </div>
            );
          })}
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, background: '#18181b', borderRadius: '12px', border: '1px solid #333' }}>
          {renderTabContent()}
        </div>

        {/* Modal de Edición de Departamento */}
        {editingDepartment && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ background: '#18181b', border: '1px solid #333', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={20} style={{ color: '#f97316' }} />
                  Horario: {editingDepartment.name}
                </h3>
                <button onClick={() => setEditingDepartment(null)} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
                  <X size={24} />
                </button>
              </div>

              <div style={{ background: '#27272a', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Usar horario específico</label>
                  <p style={{ ...helpTextStyle, marginTop: '0.25rem' }}>Ignorar la configuración global</p>
                </div>
                <Toggle 
                  checked={editingDepartment.useCustom} 
                  onChange={v => setEditingDepartment(prev => ({ 
                    ...prev, 
                    useCustom: v,
                    shift: prev.shift || { startTime: '09:00', endTime: '18:00', tolerance: 15, breakStartTime: '13:00', breakEndTime: '14:00' }
                  }))} 
                />
              </div>

              {editingDepartment.useCustom && editingDepartment.shift && (
                <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={labelStyle}>Hora Entrada</label>
                      <input 
                        type="time" 
                        value={editingDepartment.shift.startTime} 
                        onChange={e => setEditingDepartment(prev => ({ ...prev, shift: { ...prev.shift, startTime: e.target.value } }))} 
                        style={inputStyle} 
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Hora Salida</label>
                      <input 
                        type="time" 
                        value={editingDepartment.shift.endTime} 
                        onChange={e => setEditingDepartment(prev => ({ ...prev, shift: { ...prev.shift, endTime: e.target.value } }))} 
                        style={inputStyle} 
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={labelStyle}>Inicio Descanso</label>
                      <input 
                        type="time" 
                        value={editingDepartment.shift.breakStartTime || ''} 
                        onChange={e => setEditingDepartment(prev => ({ ...prev, shift: { ...prev.shift, breakStartTime: e.target.value } }))} 
                        style={inputStyle} 
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Fin Descanso</label>
                      <input 
                        type="time" 
                        value={editingDepartment.shift.breakEndTime || ''} 
                        onChange={e => setEditingDepartment(prev => ({ ...prev, shift: { ...prev.shift, breakEndTime: e.target.value } }))} 
                        style={inputStyle} 
                      />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Tolerancia (minutos)</label>
                    <input 
                      type="number" 
                      min="0" max="60"
                      value={editingDepartment.shift.tolerance} 
                      onChange={e => setEditingDepartment(prev => ({ ...prev, shift: { ...prev.shift, tolerance: parseInt(e.target.value) || 0 } }))} 
                      style={inputStyle} 
                    />
                  </div>
                </div>
              )}

              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => setEditingDepartment(null)} style={{ ...btnSecondary }}>
                  Cancelar
                </button>
                <button onClick={handleSaveDepartment} disabled={deptLoading} style={{ ...btnPrimary, opacity: deptLoading ? 0.7 : 1 }}>
                  {deptLoading ? 'Guardando...' : 'Aplicar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Selección de Empleado para Excepción */}
        {isEmpModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ background: '#18181b', border: '1px solid #333', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UserPlus size={20} style={{ color: '#3b82f6' }} />
                  Agregar Excepción a Empleado
                </h3>
                <button onClick={() => { setIsEmpModalOpen(false); setSelectedEmpForShift(null); }} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
                  <X size={24} />
                </button>
              </div>
              <EmployeeSearchSelect 
                selectedEmp={selectedEmpForShift}
                onSelect={setSelectedEmpForShift}
              />
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => { setIsEmpModalOpen(false); setSelectedEmpForShift(null); }} style={{ ...btnSecondary }}>
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    if (!selectedEmpForShift) return toast.error('Debe seleccionar un empleado');
                    setIsEmpModalOpen(false);
                    // Pass selected emp to editing modal with default values
                    const editable = JSON.parse(JSON.stringify(selectedEmpForShift));
                    editable.useCustom = true;
                    // If employee already had a shift, use it, otherwise default
                    editable.shift = (editable.shifts && editable.shifts.length > 0) ? editable.shifts[0].shift : { startTime: '09:00', endTime: '18:00', tolerance: 15, breakStartTime: '13:00', breakEndTime: '14:00' };
                    setEditingEmployee(editable);
                    setSelectedEmpForShift(null);
                  }} 
                  style={{ ...btnPrimary, background: '#3b82f6' }}
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Edición de Excepción de Empleado */}
        {editingEmployee && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ background: '#18181b', border: '1px solid #333', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={20} style={{ color: '#3b82f6' }} />
                  Horario: {editingEmployee.firstName} {editingEmployee.lastName}
                </h3>
                <button onClick={() => setEditingEmployee(null)} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
                  <X size={24} />
                </button>
              </div>

              <div style={{ background: '#27272a', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Habilitar excepción</label>
                  <p style={{ ...helpTextStyle, marginTop: '0.25rem' }}>Ignorar horario de departamento y global</p>
                </div>
                <Toggle 
                  checked={editingEmployee.useCustom} 
                  onChange={v => setEditingEmployee(prev => ({ 
                    ...prev, 
                    useCustom: v,
                    shift: prev.shift || { startTime: '09:00', endTime: '18:00', tolerance: 15, breakStartTime: '13:00', breakEndTime: '14:00' }
                  }))} 
                />
              </div>

              {editingEmployee.useCustom && editingEmployee.shift && (
                <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={labelStyle}>Hora Entrada</label>
                      <input 
                        type="time" 
                        value={editingEmployee.shift.startTime} 
                        onChange={e => setEditingEmployee(prev => ({ ...prev, shift: { ...prev.shift, startTime: e.target.value } }))} 
                        style={inputStyle} 
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Hora Salida</label>
                      <input 
                        type="time" 
                        value={editingEmployee.shift.endTime} 
                        onChange={e => setEditingEmployee(prev => ({ ...prev, shift: { ...prev.shift, endTime: e.target.value } }))} 
                        style={inputStyle} 
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={labelStyle}>Inicio Descanso</label>
                      <input 
                        type="time" 
                        value={editingEmployee.shift.breakStartTime || ''} 
                        onChange={e => setEditingEmployee(prev => ({ ...prev, shift: { ...prev.shift, breakStartTime: e.target.value } }))} 
                        style={inputStyle} 
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Fin Descanso</label>
                      <input 
                        type="time" 
                        value={editingEmployee.shift.breakEndTime || ''} 
                        onChange={e => setEditingEmployee(prev => ({ ...prev, shift: { ...prev.shift, breakEndTime: e.target.value } }))} 
                        style={inputStyle} 
                      />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Tolerancia (minutos)</label>
                    <input 
                      type="number" 
                      min="0" max="60"
                      value={editingEmployee.shift.tolerance} 
                      onChange={e => setEditingEmployee(prev => ({ ...prev, shift: { ...prev.shift, tolerance: parseInt(e.target.value) || 0 } }))} 
                      style={inputStyle} 
                    />
                  </div>
                </div>
              )}

              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => setEditingEmployee(null)} style={{ ...btnSecondary }}>
                  Cancelar
                </button>
                <button onClick={handleSaveEmployee} disabled={empLoading} style={{ ...btnPrimary, background: '#3b82f6', opacity: empLoading ? 0.7 : 1 }}>
                  {empLoading ? 'Guardando...' : 'Aplicar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Subcomponents ---

const Toggle = ({ checked, onChange }) => (
  <div 
    onClick={() => onChange(!checked)}
    style={{
      width: '44px',
      height: '24px',
      background: checked ? '#f97316' : '#3f3f46',
      borderRadius: '12px',
      position: 'relative',
      cursor: 'pointer',
      transition: 'background 0.3s'
    }}
  >
    <div style={{
      width: '20px',
      height: '20px',
      background: '#fff',
      borderRadius: '50%',
      position: 'absolute',
      top: '2px',
      left: checked ? '22px' : '2px',
      transition: 'left 0.3s',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    }} />
  </div>
);

const Skeleton = ({ width, height, borderRadius = '4px', style = {} }) => (
  <div style={{ width, height, borderRadius, background: 'linear-gradient(90deg, #27272a 25%, #3f3f46 50%, #27272a 75%)', backgroundSize: '200% 100%', animation: 'skeleton-loading 1.5s infinite', ...style }} className="skeleton" />
);

// --- Styles ---

const formGroup = {
  marginBottom: '1.5rem'
};

const labelStyle = {
  display: 'block',
  color: '#e4e4e7',
  marginBottom: '0.5rem',
  fontWeight: 500,
  fontSize: '0.95rem'
};

const helpTextStyle = {
  color: '#a1a1aa',
  fontSize: '0.85rem',
  margin: 0
};

const inputStyle = {
  width: '100%',
  padding: '0.75rem 1rem',
  background: '#121212',
  color: '#fff',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s'
};

const btnSecondary = {
  padding: '0.75rem 1.5rem',
  background: 'transparent',
  color: '#e4e4e7',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 600,
  transition: 'all 0.2s',
  fontSize: '0.95rem'
};

const btnPrimary = {
  padding: '0.75rem 1.5rem',
  background: 'var(--primary-orange, #f97316)',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 600,
  transition: 'opacity 0.2s',
  fontSize: '0.95rem'
};

// Se requiere inyectar una clase para hover suave globalmente o usar css in js, 
// pero se usa style para compatibilidad con el resto del proyecto.

export default SettingsPage;
