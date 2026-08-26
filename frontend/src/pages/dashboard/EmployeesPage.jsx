import React, { useState, useEffect, useMemo } from 'react';
import FaceRegistration from '../../components/FaceRecognition/FaceRegistration';
import { Search, Filter, Users, Fingerprint, Clock, MoreVertical, Plus, AlertCircle, RefreshCw, Camera, Trash2, Edit, Calendar, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const EmployeesPage = () => {
  const [employees, setEmployees] = useState([]);
  const [showRegistration, setShowRegistration] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  
  // States for filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // States for modal
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  
  // State for Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState(null);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/v1/employees`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Error de conexión con el backend');
      const data = await res.json();
      setEmployees(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!showRegistration) {
      fetchEmployees();
    }
  }, [showRegistration]);

  // Derive data
  const departments = useMemo(() => {
    const deps = employees
      .map(emp => emp.department?.name)
      .filter(Boolean);
    return [...new Set(deps)];
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchSearch = 
        emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.identifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.position || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchDepartment = selectedDepartment ? emp.department?.name === selectedDepartment : true;
      
      return matchSearch && matchDepartment;
    });
  }, [employees, searchTerm, selectedDepartment]);

  const handleRowClick = async (empId) => {
    setSelectedEmployeeId(empId);
    setIsModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setEmployeeDetails(null);
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/v1/employees/${empId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al obtener detalles del empleado');
      const data = await res.json();
      setEmployeeDetails(data);
    } catch (err) {
      console.error(err);
      setModalError(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleCancelEvent = async (eventId) => {
    if (!window.confirm('¿Estás seguro de cancelar este evento?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/v1/events/${eventId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al cancelar evento');
      // Update local state to remove the event from employeeDetails
      setEmployeeDetails(prev => ({
        ...prev,
        eventRequests: prev.eventRequests.filter(evt => evt.id !== eventId)
      }));
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  // Computed stats
  const totalEmployees = employees.length;
  const enrolledProfiles = employees.filter(emp => emp.faceDescriptor && emp.faceDescriptor !== '[]').length; // Basic logic
  const coverage = totalEmployees > 0 ? Math.round((enrolledProfiles / totalEmployees) * 100) : 0;
  
  // Temporal for "Personal en Turno" until attendance is linked
  const staffOnShift = employees.filter(emp => emp.isActive).length;

  if (showRegistration) {
    return (
      <div className="fade-in">
        <FaceRegistration onComplete={() => setShowRegistration(false)} />
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ paddingBottom: '2rem' }}>
      {/* Header */}
      <div className="flex-mobile-col" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
        <div>
          <h2 style={{ color: '#fff', margin: 0, fontSize: '1.8rem' }}>Gestión de Empleados</h2>
          <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0 0', fontSize: '0.95rem' }}>Administra el personal, perfiles y estados de enrolamiento biométrico.</p>
        </div>
        <button 
          onClick={() => setShowRegistration(true)}
          style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          className="mobile-w-full justify-center"
        >
          <Plus size={18} /> Agregar Empleado
        </button>
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Card 1 */}
        <div className="card card-glow-blue" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '170px', padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-muted text-sm font-semibold">Total Empleados</span>
            <div className="icon-box" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
              <Users size={18} style={{ color: '#3b82f6' }} />
            </div>
          </div>
          <div>
            {loading ? <Skeleton height="2.5rem" width="60px" /> : <h2 style={{ fontSize: '2.5rem', color: '#3b82f6', lineHeight: '1', margin: '0' }}>{totalEmployees || '—'}</h2>}
            {loading ? <Skeleton height="1rem" width="110px" style={{ marginTop: '0.75rem' }} /> : <p className="text-xs text-muted mt-2" style={{ margin: '0.75rem 0 0 0' }}>Registrados en el sistema</p>}
          </div>
        </div>

        {/* Card 2 */}
        <div className="card card-glow-yellow" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '170px', padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-muted text-sm font-semibold">Perfiles Biométricos Enrolados</span>
            <div className="icon-box" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)' }}>
              <Fingerprint size={18} style={{ color: '#eab308' }} />
            </div>
          </div>
          <div>
            {loading ? <Skeleton height="2.5rem" width="60px" /> : <h2 style={{ fontSize: '2.5rem', color: '#eab308', lineHeight: '1', margin: '0' }}>{enrolledProfiles || '—'}</h2>}
            {loading ? <Skeleton height="1rem" width="100px" style={{ marginTop: '0.75rem' }} /> : <p className="text-xs text-muted mt-2" style={{ margin: '0.75rem 0 0 0' }}>{coverage}% de cobertura</p>}
          </div>
        </div>

        {/* Card 3 */}
        <div className="card card-glow-green" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '170px', padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-muted text-sm font-semibold">Personal en Turno</span>
            <div className="icon-box" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
              <Clock size={18} style={{ color: '#10b981' }} />
            </div>
          </div>
          <div>
            {loading ? <Skeleton height="2.5rem" width="60px" /> : <h2 style={{ fontSize: '2.5rem', color: '#10b981', lineHeight: '1', margin: '0' }}>{staffOnShift || '—'}</h2>}
            {loading ? <Skeleton height="1rem" width="120px" style={{ marginTop: '0.75rem' }} /> : <p className="text-xs text-muted mt-2" style={{ margin: '0.75rem 0 0 0' }}>En instalaciones ahora</p>}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex-mobile-col" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="mobile-w-full" style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa' }} />
          <input 
            type="text" 
            placeholder="Buscar empleado por nombre o correo..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.5rem' }}
          />
        </div>
        
        <div className="mobile-w-full" style={{ position: 'relative' }}>
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            className="mobile-w-full justify-center"
          >
            <Filter size={18} /> Filtrar por Departamento
          </button>
          
          {isFilterOpen && (
            <div style={dropdownMenu}>
              <div 
                style={dropdownItem} 
                onClick={() => { setSelectedDepartment(''); setIsFilterOpen(false); }}
              >
                Todos los departamentos
              </div>
              {departments.map(dep => (
                <div 
                  key={dep} 
                  style={dropdownItem}
                  onClick={() => { setSelectedDepartment(dep); setIsFilterOpen(false); }}
                >
                  {dep}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* State Handlers & Table */}
      {error ? (
        <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'center' }}>
          <AlertCircle size={40} style={{ margin: '0 auto 1rem auto', opacity: 0.8 }} />
          <h3 style={{ margin: '0 0 0.5rem 0' }}>Error al cargar empleados</h3>
          <p style={{ margin: '0 0 1.5rem 0', color: '#fca5a5' }}>{error}</p>
          <button onClick={fetchEmployees} style={{ ...btnPrimary, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={16} /> Reintentar
          </button>
        </div>
      ) : loading ? (
        <div style={{ background: '#1e1e1e', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
          <div className="table-responsive-wrapper">
            <table style={tableStyle}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333' }}>
                  <th style={thStyle}>Empleado</th>
                  <th style={thStyle}>Departamento / Cargo</th>
                  <th style={thStyle}>Estado Biométrico</th>
                  <th style={thStyle}>Estado Laboral</th>
                  <th style={thStyle}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map(i => (
                  <tr key={i} style={{ borderBottom: '1px solid #333' }}>
                    <td style={tdStyle}><Skeleton height="40px" width="150px" /></td>
                    <td style={tdStyle}><Skeleton height="40px" width="120px" /></td>
                    <td style={tdStyle}><Skeleton height="24px" width="80px" borderRadius="12px" /></td>
                    <td style={tdStyle}><Skeleton height="24px" width="60px" borderRadius="12px" /></td>
                    <td style={tdStyle}><Skeleton height="24px" width="24px" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : employees.length === 0 ? (
        <div style={{ padding: '4rem 2rem', textAlign: 'center', background: '#1e1e1e', borderRadius: '12px', border: '1px solid #333' }}>
          <Users size={48} style={{ color: '#52525b', margin: '0 auto 1rem auto' }} />
          <h3 style={{ color: '#fff', margin: '0 0 0.5rem 0' }}>No hay empleados registrados</h3>
          <p style={{ color: '#a1a1aa', margin: '0 0 1.5rem 0' }}>Comienza registrando a tu primer empleado en el sistema.</p>
          <button onClick={() => setShowRegistration(true)} style={btnPrimary}>
            + Agregar Empleado
          </button>
        </div>
      ) : (
        <div style={{ background: '#1e1e1e', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
          <div className="table-responsive-wrapper">
            <table style={tableStyle}>
              <thead>
              <tr style={{ borderBottom: '1px solid #333', background: '#18181b' }}>
                <th style={thStyle}>Empleado</th>
                <th style={thStyle}>Departamento / Cargo</th>
                <th style={thStyle}>Estado Biométrico</th>
                <th style={thStyle}>Estado Laboral</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: '#a1a1aa' }}>
                    No se encontraron empleados que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(emp => {
                  const hasBiometric = emp.faceDescriptor && emp.faceDescriptor !== '[]' && emp.faceDescriptor.length > 10;
                  const getInitials = (f, l) => `${(f||'').charAt(0)}${(l||'').charAt(0)}`.toUpperCase();

                  return (
                    <tr key={emp.id} onClick={() => handleRowClick(emp.id)} style={{ borderBottom: '1px solid #333', transition: 'background-color 0.2s', cursor: 'pointer' }} className="table-row-hover">
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.2)', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {getInitials(emp.firstName, emp.lastName)}
                          </div>
                          <div>
                            <div style={{ color: '#fff', fontWeight: 500 }}>{emp.firstName} {emp.lastName}</div>
                            <div style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>{emp.email || emp.identifier}</div>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ color: '#e4e4e7' }}>{emp.department?.name || 'Sin departamento'}</div>
                        <div style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>{emp.position || 'Sin cargo'}</div>
                      </td>
                      <td style={tdStyle}>
                        {hasBiometric ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <span style={{ padding: '0.25rem 0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 500, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                              Enrolado
                            </span>
                            {emp.enrolledAt && (
                              <span style={{ fontSize: '0.7rem', color: '#a1a1aa', marginTop: '4px' }}>
                                {new Date(emp.enrolledAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ padding: '0.25rem 0.75rem', background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 500, border: '1px solid rgba(234, 179, 8, 0.2)' }}>
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ padding: '0.25rem 0.75rem', background: emp.isActive ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: emp.isActive ? '#3b82f6' : '#ef4444', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 500, border: `1px solid ${emp.isActive ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)'}` }}>
                          {emp.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <ActionMenu hasBiometric={hasBiometric} employee={emp} navigate={navigate} onRefresh={fetchEmployees} setIsEditModalOpen={setIsEditModalOpen} setEmployeeToEdit={setEmployeeToEdit} />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Employee Details Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content page-glow" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--text-main)', margin: 0 }}>Detalles del Empleado</h3>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              {modalLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <RefreshCw className="spin" size={24} style={{ color: '#f97316', margin: '0 auto' }} />
                  <p style={{ color: '#a1a1aa', marginTop: '1rem' }}>Cargando información...</p>
                </div>
              ) : modalError ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: '#ef4444' }}>
                  <AlertCircle size={32} style={{ margin: '0 auto 1rem' }} />
                  <p>{modalError}</p>
                </div>
              ) : employeeDetails ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #333', paddingBottom: '1.5rem' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.2)', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.5rem' }}>
                      {`${(employeeDetails.firstName||'').charAt(0)}${(employeeDetails.lastName||'').charAt(0)}`.toUpperCase()}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>{employeeDetails.firstName} {employeeDetails.lastName}</h4>
                      <p style={{ margin: '0.2rem 0 0 0', color: '#a1a1aa', fontSize: '0.9rem' }}>{employeeDetails.email || employeeDetails.identifier}</p>
                      <p style={{ margin: '0.2rem 0 0 0', color: '#e4e4e7', fontSize: '0.9rem' }}>{employeeDetails.department?.name || 'Sin departamento'} • {employeeDetails.position || 'Sin cargo'}</p>
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h5 style={{ margin: '0 0 0.5rem 0', color: '#a1a1aa', fontSize: '0.9rem' }}>Estado Biométrico</h5>
                    {employeeDetails.faceDescriptor && employeeDetails.faceDescriptor !== '[]' && employeeDetails.faceDescriptor.length > 10 ? (
                      <span style={{ padding: '0.3rem 0.8rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '999px', fontSize: '0.8rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        Enrolado el {new Date(employeeDetails.enrolledAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span style={{ padding: '0.3rem 0.8rem', background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', borderRadius: '999px', fontSize: '0.8rem', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
                        Pendiente de enrolamiento
                      </span>
                    )}
                  </div>
                  
                  <div>
                    <h5 style={{ margin: '0 0 0.75rem 0', color: '#a1a1aa', fontSize: '0.9rem' }}>Último Registro de Asistencia</h5>
                    {employeeDetails.attendances && employeeDetails.attendances.length > 0 ? (
                      <div style={{ background: '#18181b', padding: '1rem', borderRadius: '8px', border: '1px solid #333' }}>
                        <p style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '0.95rem' }}>
                          <Calendar size={14} style={{ display: 'inline', marginRight: '6px', color: '#a1a1aa', verticalAlign: 'middle' }} /> 
                          {new Date(employeeDetails.attendances[0].date).toLocaleDateString()}
                        </p>
                        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                          <div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#a1a1aa' }}>Entrada</p>
                            <p style={{ margin: '0.2rem 0 0 0', color: '#fff', fontWeight: 500 }}>
                              {employeeDetails.attendances[0].entrada ? new Date(employeeDetails.attendances[0].entrada).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}
                            </p>
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#a1a1aa' }}>Salida</p>
                            <p style={{ margin: '0.2rem 0 0 0', color: '#fff', fontWeight: 500 }}>
                              {employeeDetails.attendances[0].salida ? new Date(employeeDetails.attendances[0].salida).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}
                              {employeeDetails.attendances[0].isAutoClosed && (
                                <span title="Cierre automático por el sistema" style={{ marginLeft: '4px', color: '#f97316' }}>
                                  <AlertCircle size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: '#18181b', padding: '1.5rem 1rem', borderRadius: '8px', border: '1px solid #333', textAlign: 'center' }}>
                        <Clock size={24} style={{ color: '#52525b', margin: '0 auto 0.5rem' }} />
                        <p style={{ margin: 0, color: '#a1a1aa', fontSize: '0.9rem' }}>El empleado aún no tiene registros de asistencia.</p>
                      </div>
                    )}
                  </div>
                  
                  {employeeDetails.eventRequests && employeeDetails.eventRequests.length > 0 && (
                    <div style={{ marginTop: '1.5rem' }}>
                      <h5 style={{ margin: '0 0 0.75rem 0', color: '#a1a1aa', fontSize: '0.9rem' }}>Eventos Recientes</h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {employeeDetails.eventRequests.map(evt => {
                          const eventConfig = {
                            OVERTIME: { label: 'Horas Extra', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.05)' },
                            EARLY_EXIT: { label: 'Salida Anticipada', color: '#eab308', bg: 'rgba(234, 179, 8, 0.05)' },
                            JUSTIFIED_ABSENCE: { label: 'Falta Justificada', color: '#10b981', bg: 'rgba(16, 185, 129, 0.05)' },
                            VACATION: { label: 'Vacaciones', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.05)' },
                            LATE_ARRIVAL: { label: 'Llegada Tardía', color: '#f97316', bg: 'rgba(249, 115, 22, 0.05)' }
                          };
                          const conf = eventConfig[evt.type] || { label: evt.type, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.05)' };

                          return (
                            <div key={evt.id} style={{ background: conf.bg, border: `1px solid ${conf.color}33`, padding: '0.75rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <p style={{ margin: 0, color: conf.color, fontWeight: 500, fontSize: '0.9rem' }}>{conf.label}</p>
                                <p style={{ margin: '0.2rem 0 0 0', color: '#a1a1aa', fontSize: '0.8rem' }}>{new Date(evt.date).toLocaleDateString()}</p>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ padding: '0.2rem 0.5rem', background: conf.bg, color: conf.color, borderRadius: '4px', fontSize: '0.75rem' }}>
                                  Activo
                                </span>
                                <button onClick={() => handleCancelEvent(evt.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.2rem' }} title="Eliminar Evento">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            {employeeDetails && (
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #3f3f46', display: 'flex', justifyContent: 'flex-end' }}>
                <button style={btnSecondary} onClick={() => setIsModalOpen(false)}>Cerrar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {isEditModalOpen && employeeToEdit && (
        <EditEmployeeModal
          employee={employeeToEdit}
          onClose={() => { setIsEditModalOpen(false); setEmployeeToEdit(null); }}
          onSaved={() => { 
            setIsEditModalOpen(false); 
            setEmployeeToEdit(null); 
            fetchEmployees(); 
          }}
        />
      )}
    </div>
  );
};

// --- Subcomponents ---

const Skeleton = ({ width, height, borderRadius = '4px', style = {} }) => (
  <div style={{ width, height, borderRadius, background: 'linear-gradient(90deg, #27272a 25%, #3f3f46 50%, #27272a 75%)', backgroundSize: '200% 100%', animation: 'skeleton-loading 1.5s infinite', ...style }} className="skeleton" />
);

const ActionMenu = ({ hasBiometric, employee, navigate, onRefresh, setIsEditModalOpen, setEmployeeToEdit }) => {
  const handleDeleteEmployee = async (e) => {
    e.stopPropagation();
    if (window.confirm(`¿Eliminar permanentemente al empleado ${employee.firstName} ${employee.lastName}?\nEsta acción no se puede deshacer.`)) {
      try {
        const token = localStorage.getItem('token') || 'dev-token';
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/employees/${employee.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          onRefresh();
        } else {
          alert('Error al eliminar empleado');
        }
      } catch (err) {
        console.error(err);
        alert('Error de conexión al eliminar');
      }
    }
  };

  const handleEditEmployee = (e) => {
    e.stopPropagation();
    setEmployeeToEdit(employee);
    setIsEditModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
      <button 
        onClick={(e) => { e.stopPropagation(); navigate(`/kiosk/enroll/${employee.id}`); }}
        title={hasBiometric ? "Re-enrolar" : "Enrolar"}
        style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: '#3b82f6', cursor: 'pointer', padding: '0.4rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {hasBiometric ? <RefreshCw size={16} /> : <Camera size={16} />}
      </button>

      <button 
        onClick={handleEditEmployee}
        title="Editar empleado"
        style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', color: '#eab308', cursor: 'pointer', padding: '0.4rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Edit size={16} />
      </button>

      <button 
        onClick={handleDeleteEmployee}
        title="Eliminar empleado"
        style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', cursor: 'pointer', padding: '0.4rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};

// --- Styles ---

// Removed cardStyle and iconBoxStyle as they are replaced by .card classes

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
  padding: '0.75rem 1.5rem',
  background: '#1e1e1e',
  color: '#e4e4e7',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 500,
  transition: 'background 0.2s'
};

const inputStyle = {
  width: '100%',
  padding: '0.75rem',
  background: '#121212',
  color: '#fff',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  outline: 'none',
  boxSizing: 'border-box'
};

const dropdownMenu = {
  position: 'absolute',
  top: '100%',
  left: 0,
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
  fontSize: '0.9rem'
};

const actionMenuItem = {
  padding: '0.5rem 1rem',
  color: '#e4e4e7',
  cursor: 'pointer',
  borderRadius: '4px',
  fontSize: '0.85rem'
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

const labelStyle = {
  display: 'block',
  marginBottom: '0.5rem',
  color: '#a1a1aa',
  fontSize: '0.9rem'
};

// --- Edit Employee Modal Component ---
const EditEmployeeModal = ({ employee, onClose, onSaved }) => {
  const [formData, setFormData] = useState({
    firstName: employee.firstName || '',
    lastName: employee.lastName || '',
    identifier: employee.identifier || '',
    email: employee.email || '',
    department: employee.department?.name || '',
    position: employee.position || '',
    isActive: employee.isActive
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/v1/employees/${employee.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al actualizar empleado');
      }
      onSaved();
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="modal-content page-glow" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h3 style={{ color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Edit size={20} /> Editar Empleado
          </h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Nombre(s)</label>
              <input type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Apellidos</label>
              <input type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} style={inputStyle} required />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Identificador (DNI / Matrícula)</label>
            <input type="text" value={formData.identifier} onChange={e => setFormData({...formData, identifier: e.target.value})} style={inputStyle} required />
          </div>
          <div>
            <label style={labelStyle}>Correo Electrónico (Opcional)</label>
            <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Departamento (Opcional)</label>
              <input type="text" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} style={inputStyle} placeholder="Ej. TI" />
            </div>
            <div>
              <label style={labelStyle}>Cargo (Opcional)</label>
              <input type="text" value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})} style={inputStyle} placeholder="Ej. Desarrollador" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} />
            <label htmlFor="isActive" style={{ color: '#e4e4e7', cursor: 'pointer' }}>Empleado Activo</label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #3f3f46' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
            <button type="submit" style={btnPrimary} disabled={loading}>{loading ? 'Guardando...' : 'Guardar Cambios'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeesPage;
