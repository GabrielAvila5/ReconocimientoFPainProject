import React, { useState, useEffect } from 'react';
import { Calendar, Search, Filter, Plus, Trash2, AlertCircle, RefreshCw, X, ClipboardList, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import api from '../../utils/api';
import EmployeeSearchSelect from '../../components/EmployeeSearchSelect';

const EventsPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Estado para modal estilizado de cancelación de evento
  const [eventToCancel, setEventToCancel] = useState(null);
  const [isCanceling, setIsCanceling] = useState(false);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/events');
      setEvents(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Error al obtener eventos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleConfirmCancel = async () => {
    if (!eventToCancel) return;
    try {
      setIsCanceling(true);
      await api.delete(`/events/${eventToCancel.id}`);
      toast.success('Evento cancelado exitosamente');
      setEventToCancel(null);
      fetchEvents();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cancelar evento');
    } finally {
      setIsCanceling(false);
    }
  };

  const filteredEvents = events.filter(evt => {
    const term = searchTerm.toLowerCase();
    const matchSearch = 
      evt.employee?.firstName.toLowerCase().includes(term) ||
      evt.employee?.lastName.toLowerCase().includes(term) ||
      evt.employee?.identifier.toLowerCase().includes(term);
    const matchType = selectedType ? evt.type === selectedType : true;
    return matchSearch && matchType;
  });

  return (
    <div className="fade-in" style={{ paddingBottom: '2rem' }}>
      <div className="flex-mobile-col" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
        <div>
          <h2 style={{ color: '#fff', margin: 0, fontSize: '1.8rem' }}>Eventos y Permisos</h2>
          <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0 0', fontSize: '0.95rem' }}>Administra horas extra, salidas anticipadas, faltas justificadas y vacaciones.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          style={btnPrimary}
          className="mobile-w-full justify-center"
        >
          <Plus size={18} /> Nuevo Evento
        </button>
      </div>

      {/* Cards Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card card-glow-blue" style={{ padding: '1.5rem' }}>
          <h3 style={{ color: '#3b82f6', fontSize: '2rem', margin: 0 }}>{events.filter(e => e.type === 'OVERTIME' && e.status === 'ACTIVE').length}</h3>
          <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0', fontSize: '0.9rem' }}>Horas Extra Activas</p>
        </div>
        <div className="card card-glow-yellow" style={{ padding: '1.5rem' }}>
          <h3 style={{ color: '#eab308', fontSize: '2rem', margin: 0 }}>{events.filter(e => e.type === 'EARLY_EXIT' && e.status === 'ACTIVE').length}</h3>
          <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0', fontSize: '0.9rem' }}>Salidas Anticipadas</p>
        </div>
        <div className="card card-glow-green" style={{ padding: '1.5rem' }}>
          <h3 style={{ color: '#10b981', fontSize: '2rem', margin: 0 }}>{events.filter(e => (e.type === 'VACATION' || e.type === 'JUSTIFIED_ABSENCE') && e.status === 'ACTIVE').length}</h3>
          <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0', fontSize: '0.9rem' }}>Ausencias Justificadas</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex-mobile-col" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="mobile-w-full" style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa' }} />
          <input 
            type="text" 
            placeholder="Buscar por empleado..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.5rem' }}
          />
        </div>
        
        <div className="mobile-w-full" style={{ position: 'relative' }}>
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            style={btnSecondary}
            className="mobile-w-full justify-center"
          >
            <Filter size={18} /> Filtrar Tipo
          </button>
          
          {isFilterOpen && (
            <div style={dropdownMenu}>
              <div style={dropdownItem} onClick={() => { setSelectedType(''); setIsFilterOpen(false); }}>Todos los tipos</div>
              <div style={dropdownItem} onClick={() => { setSelectedType('OVERTIME'); setIsFilterOpen(false); }}>Horas Extra</div>
              <div style={dropdownItem} onClick={() => { setSelectedType('EARLY_EXIT'); setIsFilterOpen(false); }}>Salida Anticipada</div>
              <div style={dropdownItem} onClick={() => { setSelectedType('JUSTIFIED_ABSENCE'); setIsFilterOpen(false); }}>Falta Justificada</div>
              <div style={dropdownItem} onClick={() => { setSelectedType('VACATION'); setIsFilterOpen(false); }}>Vacaciones</div>
              <div style={dropdownItem} onClick={() => { setSelectedType('LATE_ARRIVAL'); setIsFilterOpen(false); }}>Llegada Tardía</div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      {error ? (
        <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '12px', textAlign: 'center' }}>
          <AlertCircle size={40} style={{ margin: '0 auto 1rem auto' }} />
          <p>{error}</p>
          <button onClick={fetchEvents} style={{ ...btnPrimary, marginTop: '1rem' }}><RefreshCw size={16} /> Reintentar</button>
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}><RefreshCw className="spin" size={32} style={{ color: '#f97316' }} /></div>
      ) : (
        <div style={{ background: '#1e1e1e', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
          <div className="table-responsive-wrapper">
            <table style={tableStyle}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333', background: '#18181b' }}>
                  <th style={thStyle}>Empleado</th>
                  <th style={thStyle}>Tipo</th>
                  <th style={thStyle}>Fecha / Rango</th>
                  <th style={thStyle}>Detalles (Hora)</th>
                  <th style={thStyle}>Estado</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: '#a1a1aa' }}>No se encontraron eventos.</td></tr>
                ) : (
                  filteredEvents.map(evt => (
                    <tr key={evt.id} style={{ borderBottom: '1px solid #333' }} className="table-row-hover">
                      <td style={tdStyle}>
                        <div style={{ color: '#fff', fontWeight: 500 }}>{evt.employee?.firstName} {evt.employee?.lastName}</div>
                        <div style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>{evt.employee?.identifier}</div>
                      </td>
                      <td style={tdStyle}>
                        <EventTypeBadge type={evt.type} />
                      </td>
                      <td style={tdStyle}>
                        <div style={{ color: '#e4e4e7' }}>{new Date(evt.date).toLocaleDateString()}</div>
                        {evt.dateTo && <div style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>hasta {new Date(evt.dateTo).toLocaleDateString()}</div>}
                      </td>
                      <td style={tdStyle}>
                        {(evt.startTime || evt.endTime || evt.minutes) ? (
                          <div style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>
                            {evt.minutes ? (
                              <span>{evt.minutes / 60} hrs extra</span>
                            ) : null}
                            {evt.startTime && <span>Desde: {new Date(evt.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                            {evt.startTime && evt.endTime && <br/>}
                            {evt.endTime && <span>Hasta: {new Date(evt.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                          </div>
                        ) : 'Día completo'}
                      </td>
                      <td style={tdStyle}>
                        {evt.status === 'ACTIVE' 
                          ? <span style={{ color: '#10b981', fontSize: '0.85rem', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>Activo</span>
                          : <span style={{ color: '#ef4444', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>Cancelado</span>
                        }
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {evt.status === 'ACTIVE' && (
                          <button 
                            onClick={() => setEventToCancel(evt)}
                            style={{ 
                              background: 'transparent', 
                              border: 'none', 
                              color: '#ef4444', 
                              cursor: 'pointer', 
                              padding: '0.5rem',
                              borderRadius: '8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s'
                            }}
                            className="btn-trash-action"
                            title="Cancelar Evento"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Estilizado de Confirmación para Cancelar Evento */}
      {eventToCancel && (
        <CancelEventModal 
          event={eventToCancel}
          isCanceling={isCanceling}
          onClose={() => setEventToCancel(null)}
          onConfirm={handleConfirmCancel}
        />
      )}

      {isModalOpen && (
        <CreateEventModal 
          onClose={() => setIsModalOpen(false)} 
          onCreated={() => { setIsModalOpen(false); fetchEvents(); toast.success('Evento creado exitosamente'); }} 
        />
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .btn-trash-action:hover {
          background-color: rgba(239, 68, 68, 0.15) !important;
          transform: scale(1.1);
        }
        .fade-in-up {
          animation: fadeInUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
};

// Modal Estilizado para Cancelar Evento
const CancelEventModal = ({ event, isCanceling, onClose, onConfirm }) => {
  if (!event) return null;

  const eventDateFormatted = new Date(event.date).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const eventDateToFormatted = event.dateTo ? new Date(event.dateTo).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) : null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div 
        className="modal-content page-glow fade-in-up" 
        onClick={e => e.stopPropagation()} 
        style={{
          maxWidth: '460px',
          padding: '1.75rem',
          borderRadius: '20px',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(239, 68, 68, 0.12)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '16px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(239, 68, 68, 0.15)'
          }}>
            <Trash2 size={26} color="#ef4444" />
          </div>
          <button 
            onClick={onClose}
            disabled={isCanceling}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#71717a',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '8px',
              transition: 'color 0.2s'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <h3 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '1.25rem', fontWeight: 700 }}>
          ¿Cancelar este evento?
        </h3>
        
        <p style={{ margin: '0 0 1.25rem 0', color: '#a1a1aa', fontSize: '0.9rem', lineHeight: '1.5' }}>
          ¿Estás seguro de cancelar este evento? No tendrá efecto en la asistencia a partir de ahora.
        </p>

        {/* Resumen detallado del evento */}
        <div style={{
          background: '#121215',
          border: '1px solid #27272a',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#71717a', fontWeight: 600 }}>EMPLEADO</span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>
                {event.employee?.firstName} {event.employee?.lastName}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>
                ID: {event.employee?.identifier}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#71717a', fontWeight: 600 }}>TIPO</span>
            <EventTypeBadge type={event.type} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#71717a', fontWeight: 600 }}>FECHA / RANGO</span>
            <span style={{ fontSize: '0.85rem', color: '#e4e4e7', fontWeight: 500 }}>
              {eventDateFormatted} {eventDateToFormatted ? `hasta ${eventDateToFormatted}` : ''}
            </span>
          </div>

          {(event.startTime || event.endTime || event.minutes) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#71717a', fontWeight: 600 }}>DETALLE</span>
              <span style={{ fontSize: '0.85rem', color: '#d4d4d8' }}>
                {event.minutes ? `${event.minutes / 60} hrs extra` : null}
                {event.startTime && `Desde ${new Date(event.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
                {event.endTime && ` Hasta ${new Date(event.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
              </span>
            </div>
          )}

          {event.reason && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#71717a', fontWeight: 600 }}>MOTIVO</span>
              <span style={{ fontSize: '0.8rem', color: '#a1a1aa', textAlign: 'right', maxWidth: '240px' }}>
                {event.reason}
              </span>
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isCanceling}
            style={{
              padding: '0.65rem 1.25rem',
              background: '#27272a',
              color: '#e4e4e7',
              border: '1px solid #3f3f46',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isCanceling}
            style={{
              padding: '0.65rem 1.25rem',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
              transition: 'opacity 0.2s'
            }}
          >
            {isCanceling ? (
              <>
                <RefreshCw size={14} className="spin" /> Cancelando...
              </>
            ) : (
              <>
                <Trash2 size={15} /> Aceptar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente para el badge del tipo
const EventTypeBadge = ({ type }) => {
  const config = {
    OVERTIME: { label: 'Horas Extra', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
    EARLY_EXIT: { label: 'Salida Anticipada', color: '#eab308', bg: 'rgba(234, 179, 8, 0.1)' },
    JUSTIFIED_ABSENCE: { label: 'Falta Justificada', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
    VACATION: { label: 'Vacaciones', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
    LATE_ARRIVAL: { label: 'Llegada Tardía', color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' }
  };
  const c = config[type] || { label: type, color: '#fff', bg: '#333' };
  
  return (
    <span style={{ padding: '0.25rem 0.75rem', background: c.bg, color: c.color, borderRadius: '999px', fontSize: '0.75rem', fontWeight: 500, border: `1px solid ${c.color}33` }}>
      {c.label}
    </span>
  );
};

// Modal para crear un nuevo evento
const CreateEventModal = ({ onClose, onCreated }) => {
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [targetType, setTargetType] = useState('employee');
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await api.get('/departments');
        setDepartments(res.data);
      } catch (err) {
        console.error('Error fetching departments', err);
      }
    };
    fetchDepts();
  }, []);
  
  const [formData, setFormData] = useState({
    type: 'OVERTIME',
    date: new Date().toISOString().split('T')[0],
    dateTo: '',
    startTime: '',
    endTime: '',
    hours: '',
    reason: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [confirmDept, setConfirmDept] = useState(false);

  const executeSubmit = async () => {
    setLoading(true);
    
    // Preparar el payload
    const payload = {
      type: formData.type,
      date: formData.date,
      reason: formData.reason || 'Sin motivo'
    };

    if (targetType === 'employee') {
      payload.employeeId = selectedEmp.id;
    } else {
      payload.departmentId = selectedDeptId;
    }
    
    if ((formData.type === 'VACATION' || formData.type === 'OVERTIME') && formData.dateTo) {
      payload.dateTo = formData.dateTo;
    }
    
    if (formData.type === 'OVERTIME') {
      if (formData.hours) {
        payload.minutes = parseFloat(formData.hours) * 60;
      }
    } else if (formData.type === 'EARLY_EXIT') {
      if (formData.startTime) {
        payload.startTime = new Date(`${formData.date}T${formData.startTime}`).toISOString();
      }
      if (formData.endTime) {
        payload.endTime = new Date(`${formData.date}T${formData.endTime}`).toISOString();
      }
    } else if (formData.type === 'LATE_ARRIVAL') {
      if (formData.startTime) {
        payload.startTime = new Date(`${formData.date}T${formData.startTime}`).toISOString();
      }
    }

    try {
      const res = await api.post('/events', payload);
      if (res.data.message) {
        toast.success(res.data.message); // Mensaje del servidor sobre el batch
      } else {
        toast.success('Evento creado exitosamente');
      }
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Error al crear evento');
    } finally {
      setLoading(false);
      setConfirmDept(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (targetType === 'employee' && !selectedEmp) return toast.error('Debe seleccionar un empleado');
    if (targetType === 'department' && !selectedDeptId) return toast.error('Debe seleccionar un departamento');
    
    // Si es para departamento, mostrar confirmación estilizada
    if (targetType === 'department') {
      setConfirmDept(true);
      return;
    }

    executeSubmit();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content page-glow" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3 style={{ color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={20} /> Registrar Nuevo Evento
          </h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {formData.type === 'OVERTIME' && (
            <div>
              <label style={labelStyle}>Asignar a:</label>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="targetType" 
                    value="employee" 
                    checked={targetType === 'employee'} 
                    onChange={() => setTargetType('employee')}
                  />
                  Empleado Individual
                </label>
                <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="targetType" 
                    value="department" 
                    checked={targetType === 'department'} 
                    onChange={() => setTargetType('department')}
                  />
                  Departamento Completo
                </label>
              </div>
            </div>
          )}

          {targetType === 'employee' || formData.type !== 'OVERTIME' ? (
            <div>
              <label style={labelStyle}>Empleado</label>
              <EmployeeSearchSelect 
                selectedEmp={selectedEmp}
                onSelect={setSelectedEmp}
              />
            </div>
          ) : (
            <div>
              <label style={labelStyle}>Departamento</label>
              <select 
                value={selectedDeptId}
                onChange={e => setSelectedDeptId(e.target.value)}
                style={inputStyle}
                required
              >
                <option value="">Seleccione un departamento...</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Tipo de Evento</label>
              <select 
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value})}
                style={inputStyle}
                required
              >
                <option value="OVERTIME">Horas Extra</option>
                <option value="EARLY_EXIT">Salida Anticipada</option>
                <option value="JUSTIFIED_ABSENCE">Falta Justificada</option>
                <option value="VACATION">Vacaciones</option>
                <option value="LATE_ARRIVAL">Llegada Tardía</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Fecha {formData.type === 'VACATION' ? 'Inicio' : ''}</label>
              <input 
                type="date" 
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                style={inputStyle}
                required
              />
            </div>
          </div>

          {(formData.type === 'VACATION' || formData.type === 'OVERTIME') && (
            <div>
              <label style={labelStyle}>Fecha Fin {formData.type === 'OVERTIME' ? '(Opcional)' : ''}</label>
              <input 
                type="date" 
                value={formData.dateTo}
                onChange={e => setFormData({...formData, dateTo: e.target.value})}
                style={inputStyle}
                required={formData.type === 'VACATION'}
              />
            </div>
          )}

          {formData.type === 'OVERTIME' && (
            <div>
              <label style={labelStyle}>Cantidad de Horas Extra</label>
              <input 
                type="number" 
                min="0.5"
                step="0.5"
                value={formData.hours}
                onChange={e => setFormData({...formData, hours: e.target.value})}
                style={inputStyle}
                placeholder="Ej. 2"
                required
              />
            </div>
          )}

          {formData.type === 'EARLY_EXIT' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Hora de Salida (Opcional)</label>
                <input 
                  type="time" 
                  value={formData.startTime}
                  onChange={e => setFormData({...formData, startTime: e.target.value})}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Hora Esperada (Opcional)</label>
                <input 
                  type="time" 
                  value={formData.endTime}
                  onChange={e => setFormData({...formData, endTime: e.target.value})}
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          {formData.type === 'LATE_ARRIVAL' && (
            <div>
              <label style={labelStyle}>Hora Estimada de Llegada</label>
              <input 
                type="time" 
                value={formData.startTime}
                onChange={e => setFormData({...formData, startTime: e.target.value})}
                style={inputStyle}
                required
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>Motivo / Observaciones</label>
            <textarea 
              value={formData.reason}
              onChange={e => setFormData({...formData, reason: e.target.value})}
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
              placeholder="Detalle el motivo del evento..."
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #3f3f46' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
            <button type="submit" style={btnPrimary} disabled={loading || (targetType === 'employee' && !selectedEmp) || (targetType === 'department' && !selectedDeptId)}>
              {loading ? 'Guardando...' : 'Registrar Evento'}
            </button>
          </div>
        </form>

        {/* Modal de confirmación para asignación masiva a departamento */}
        {confirmDept && (
          <div 
            className="modal-overlay" 
            style={{ zIndex: 1200 }} 
            onClick={() => setConfirmDept(false)}
          >
            <div 
              className="modal-content page-glow fade-in-up" 
              onClick={e => e.stopPropagation()}
              style={{
                maxWidth: '440px',
                padding: '1.75rem',
                border: '1px solid rgba(234, 179, 8, 0.4)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(234, 179, 8, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#eab308'
                }}>
                  <AlertTriangle size={22} />
                </div>
                <h4 style={{ margin: 0, color: '#fff', fontSize: '1.15rem', fontWeight: 700 }}>
                  ¿Confirmar asignación masiva?
                </h4>
              </div>

              <p style={{ margin: '0 0 1.25rem 0', color: '#d4d4d8', fontSize: '0.85rem', lineHeight: '1.5' }}>
                Estás a punto de asignar Horas Extra a todos los empleados activos del departamento:{' '}
                <strong style={{ color: '#fff' }}>
                  {departments.find(d => d.id === selectedDeptId || d.name === selectedDeptId)?.name || selectedDeptId}
                </strong>.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setConfirmDept(false)}
                  style={btnSecondary}
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={executeSubmit}
                  disabled={loading}
                  style={btnPrimary}
                >
                  {loading ? 'Asignando...' : 'Confirmar y Asignar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Styles
const btnPrimary = {
  padding: '0.75rem 1.5rem',
  background: 'var(--primary-orange, #f97316)',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  transition: 'opacity 0.2s',
  fontFamily: 'inherit'
};

const btnSecondary = {
  padding: '0.75rem 1.5rem',
  background: '#1e1e1e',
  color: '#e4e4e7',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  transition: 'background 0.2s',
  fontFamily: 'inherit'
};

const inputStyle = {
  width: '100%',
  padding: '0.75rem',
  background: '#121212',
  color: '#fff',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit'
};

const labelStyle = {
  display: 'block',
  marginBottom: '0.5rem',
  color: '#a1a1aa',
  fontSize: '0.9rem',
  fontWeight: 500,
  fontFamily: 'inherit'
};

const dropdownMenu = {
  position: 'absolute',
  top: '100%',
  right: 0,
  marginTop: '0.5rem',
  background: '#27272a',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  padding: '0.5rem',
  zIndex: 10,
  minWidth: '200px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
};

const dropdownItem = {
  padding: '0.5rem 1rem',
  color: '#e4e4e7',
  cursor: 'pointer',
  borderRadius: '4px',
  fontSize: '0.9rem',
  fontFamily: 'inherit'
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.9rem',
  minWidth: '800px'
};

const thStyle = {
  padding: '1.25rem 1.5rem',
  textAlign: 'left',
  fontWeight: 600,
  color: '#a1a1aa'
};

const tdStyle = {
  padding: '1rem 1.5rem',
  color: '#e4e4e7'
};

export default EventsPage;
