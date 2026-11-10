import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CheckCircle2, X, Search, ChevronDown, User, Building, Users } from 'lucide-react';
import api from '../utils/api';

const EmployeeSearchSelect = ({ selectedEmp, onSelect, required = false }) => {
  const [allEmployees, setAllEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Cargar lista completa de empleados una vez al montar
  useEffect(() => {
    let isMounted = true;
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const res = await api.get('/employees');
        if (isMounted) {
          const list = Array.isArray(res.data) ? res.data : [];
          // Priorizar empleados activos
          const sorted = list.sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));
          setAllEmployees(sorted);
        }
      } catch (err) {
        console.error('Error fetching employees for select:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchEmployees();
    return () => {
      isMounted = false;
    };
  }, []);

  // Cerrar dropdown al hacer click fuera del contenedor
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filtrar en tiempo real a medida que el usuario escribe
  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return allEmployees;
    const term = search.toLowerCase().trim();
    return allEmployees.filter((emp) => {
      const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
      const identifier = (emp.identifier || '').toLowerCase();
      const department = (emp.department?.name || '').toLowerCase();
      const position = (emp.position || '').toLowerCase();
      return (
        fullName.includes(term) ||
        identifier.includes(term) ||
        department.includes(term) ||
        position.includes(term)
      );
    });
  }, [allEmployees, search]);

  const handleSelect = (emp) => {
    onSelect(emp);
    setSearch('');
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onSelect(null);
    setSearch('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {selectedEmp ? (
        // Estado: Empleado Seleccionado
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.65rem 0.85rem',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid #10b981',
            borderRadius: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem',
                flexShrink: 0
              }}
            >
              {selectedEmp.firstName?.charAt(0) || <User size={15} />}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden'
                }}
              >
                <span>{selectedEmp.firstName} {selectedEmp.lastName}</span>
                <CheckCircle2 size={15} style={{ color: '#10b981', flexShrink: 0 }} />
              </div>
              <div style={{ fontSize: '0.75rem', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <code style={{ color: '#34d399' }}>ID: {selectedEmp.identifier}</code>
                {selectedEmp.department?.name && (
                  <>
                    <span>·</span>
                    <span>{selectedEmp.department.name}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            title="Cambiar empleado"
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              borderRadius: '6px',
              padding: '0.3rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '0.5rem',
              transition: 'all 0.15s'
            }}
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        // Estado: Buscador y Lista Desplegable
        <div>
          <div
            style={{ position: 'relative', display: 'flex', alignItems: 'center', cursor: 'text' }}
            onClick={() => {
              setIsOpen(true);
              inputRef.current?.focus();
            }}
          >
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.85rem',
                color: isOpen ? '#f97316' : '#71717a',
                pointerEvents: 'none',
                transition: 'color 0.15s'
              }}
            />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder="Buscar por nombre, apellido, matrícula o departamento..."
              required={required && !selectedEmp}
              style={{
                width: '100%',
                padding: '0.75rem 2.25rem 0.75rem 2.4rem',
                background: '#121214',
                color: '#fff',
                border: `1px solid ${isOpen ? '#f97316' : '#3f3f46'}`,
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                fontSize: '0.88rem',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                boxShadow: isOpen ? '0 0 0 2px rgba(249, 115, 22, 0.2)' : 'none'
              }}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
                if (!isOpen) inputRef.current?.focus();
              }}
              style={{
                position: 'absolute',
                right: '0.75rem',
                background: 'transparent',
                border: 'none',
                color: '#71717a',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 0
              }}
            >
              <ChevronDown
                size={16}
                style={{
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease'
                }}
              />
            </button>
          </div>

          {/* Menú Desplegable con Lista de Empleados */}
          {isOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                background: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '10px',
                zIndex: 100,
                boxShadow: '0 12px 30px rgba(0,0,0,0.7)',
                overflow: 'hidden'
              }}
            >
              {/* Encabezado con conteo */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0.85rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderBottom: '1px solid #27272a',
                  fontSize: '0.75rem',
                  color: '#a1a1aa'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Users size={13} style={{ color: '#f97316' }} />
                  {search ? 'Resultados de búsqueda' : 'Directorio de colaboradores'}
                </span>
                <span style={{ color: '#d4d4d8', fontWeight: 600 }}>
                  {filteredEmployees.length} {filteredEmployees.length === 1 ? 'empleado' : 'empleados'}
                </span>
              </div>

              {/* Lista con scroll */}
              <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                {loading ? (
                  <div style={{ padding: '1.25rem', textAlign: 'center', color: '#a1a1aa', fontSize: '0.85rem' }}>
                    Cargando lista de empleados...
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#71717a', fontSize: '0.85rem' }}>
                    No se encontraron colaboradores que coincidan con <strong>"{search}"</strong>
                  </div>
                ) : (
                  filteredEmployees.map((emp) => {
                    const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
                    const initials = `${emp.firstName?.charAt(0) || ''}${emp.lastName?.charAt(0) || ''}`.toUpperCase();

                    return (
                      <div
                        key={emp.id}
                        onClick={() => handleSelect(emp)}
                        className="table-row-hover"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.65rem 0.85rem',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          cursor: 'pointer',
                          transition: 'background 0.12s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '7px',
                              background: 'rgba(249, 115, 22, 0.15)',
                              color: '#f97316',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              flexShrink: 0
                            }}
                          >
                            {initials || <User size={14} />}
                          </div>
                          <div style={{ overflow: 'hidden' }}>
                            <div
                              style={{
                                color: '#fff',
                                fontSize: '0.86rem',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden'
                              }}
                            >
                              {fullName}
                            </div>
                            <div
                              style={{
                                fontSize: '0.74rem',
                                color: '#a1a1aa',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                marginTop: '0.1rem'
                              }}
                            >
                              <code style={{ color: '#fb923c' }}>{emp.identifier}</code>
                              {emp.department?.name && (
                                <>
                                  <span>·</span>
                                  <span>{emp.department.name}</span>
                                </>
                              )}
                              {emp.position && (
                                <>
                                  <span>·</span>
                                  <span style={{ color: '#71717a' }}>{emp.position}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: '#10b981',
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            flexShrink: 0,
                            marginLeft: '0.5rem'
                          }}
                        >
                          Seleccionar
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeeSearchSelect;
