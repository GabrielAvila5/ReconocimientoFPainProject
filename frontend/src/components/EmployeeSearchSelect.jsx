import React, { useState, useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import api from '../utils/api';

const EmployeeSearchSelect = ({ selectedEmp, onSelect }) => {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Buscar empleados para el autocompletado
    if (search.length > 2) {
      const fetchEmps = async () => {
        try {
          const res = await api.get('/employees');
          const data = res.data;
          const filtered = data.filter(e => 
            e.firstName.toLowerCase().includes(search.toLowerCase()) || 
            e.lastName.toLowerCase().includes(search.toLowerCase()) ||
            e.identifier.toLowerCase().includes(search.toLowerCase())
          );
          setEmployees(filtered.slice(0, 5)); // Mostrar max 5
        } catch (err) {
          console.error('Error fetching employees:', err);
        }
      };
      fetchEmps();
    } else {
      setEmployees([]);
    }
  }, [search]);

  return (
    <div style={{ position: 'relative' }}>
      {selectedEmp ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '8px' }}>
          <span style={{ color: '#10b981', fontWeight: 500, fontFamily: 'inherit' }}>
            <CheckCircle2 size={16} style={{ display: 'inline', marginRight: '6px' }} />
            {selectedEmp.firstName} {selectedEmp.lastName} ({selectedEmp.identifier})
          </span>
          <button 
            type="button" 
            onClick={() => onSelect(null)} 
            style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div>
          <input 
            type="text" 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Escriba nombre o matrícula..."
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#121212',
              color: '#fff',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'inherit'
            }}
            required
          />
          {employees.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px', marginTop: '4px', zIndex: 10 }}>
              {employees.map(emp => (
                <div 
                  key={emp.id} 
                  onClick={() => { onSelect(emp); setSearch(''); setEmployees([]); }} 
                  style={{ padding: '0.75rem', borderBottom: '1px solid #3f3f46', cursor: 'pointer', color: '#fff', fontFamily: 'inherit' }} 
                  className="table-row-hover"
                >
                  {emp.firstName} {emp.lastName} <span style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>({emp.identifier})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeeSearchSelect;
