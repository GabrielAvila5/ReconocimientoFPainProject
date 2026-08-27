import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';

const DepartmentsTab = ({ onDepartmentChange }) => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  
  // Forms
  const [deptName, setDeptName] = useState('');

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/departments');
      setDepartments(res.data);
    } catch (error) {
      toast.error('Error al cargar departamentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/departments', { name: deptName });
      toast.success('Departamento creado');
      setIsAddModalOpen(false);
      setDeptName('');
      fetchDepartments();
      if (onDepartmentChange) onDepartmentChange();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al crear');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/departments/${editingDept.id}`, { name: deptName });
      toast.success('Departamento actualizado');
      setIsEditModalOpen(false);
      setEditingDept(null);
      setDeptName('');
      fetchDepartments();
      if (onDepartmentChange) onDepartmentChange();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al actualizar');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este departamento?')) return;
    try {
      await api.delete(`/departments/${id}`);
      toast.success('Departamento eliminado');
      fetchDepartments();
      if (onDepartmentChange) onDepartmentChange();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al eliminar');
    }
  };

  const openEdit = (dept) => {
    setEditingDept(dept);
    setDeptName(dept.name);
    setIsEditModalOpen(true);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h2 style={{ color: '#fff', fontSize: '1.5rem', margin: 0 }}>Gestión de Departamentos</h2>
        <button 
          onClick={() => { setDeptName(''); setIsAddModalOpen(true); }}
          style={{ padding: '0.5rem 1rem', background: '#f97316', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={18} /> Nuevo Departamento
        </button>
      </div>

      {loading ? <div style={{ color: '#a1a1aa' }}>Cargando...</div> : (
        <div style={{ background: '#1e1e1e', borderRadius: '12px', border: '1px solid #333', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: '#e4e4e7' }}>
            <thead>
              <tr style={{ background: '#27272a', borderBottom: '1px solid #333' }}>
                <th style={{ padding: '1rem', textAlign: 'left', color: '#a1a1aa' }}>Nombre</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: '#a1a1aa' }}>Horario Personalizado</th>
                <th style={{ padding: '1rem', textAlign: 'center', color: '#a1a1aa' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {departments.map(dept => (
                <tr key={dept.id} style={{ borderBottom: '1px solid #333' }}>
                  <td style={{ padding: '1rem' }}>{dept.name}</td>
                  <td style={{ padding: '1rem' }}>
                    {dept.useCustom && dept.shift ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '0.25rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem' }}>
                        <Clock size={12} /> {dept.shift.startTime} - {dept.shift.endTime}
                      </span>
                    ) : (
                      <span style={{ color: '#71717a', fontSize: '0.85rem' }}>Heredado (Global)</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button onClick={() => openEdit(dept)} style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', border: 'none', padding: '0.4rem', borderRadius: '8px', cursor: 'pointer' }}>
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(dept.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', padding: '0.4rem', borderRadius: '8px', cursor: 'pointer' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {departments.length === 0 && (
                <tr>
                  <td colSpan="3" style={{ padding: '2rem', textAlign: 'center', color: '#a1a1aa' }}>No hay departamentos registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e1e1e', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', border: '1px solid #333' }}>
            <h3 style={{ color: '#fff', margin: '0 0 1.5rem 0' }}>{isAddModalOpen ? 'Nuevo Departamento' : 'Editar Departamento'}</h3>
            <form onSubmit={isAddModalOpen ? handleCreate : handleUpdate}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Nombre</label>
                <input 
                  type="text" 
                  value={deptName} 
                  onChange={(e) => setDeptName(e.target.value)} 
                  required
                  style={{ width: '100%', padding: '0.75rem', background: '#121212', border: '1px solid #333', color: '#fff', borderRadius: '8px', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} style={{ padding: '0.75rem 1rem', background: 'transparent', border: '1px solid #333', color: '#e4e4e7', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '0.75rem 1rem', background: '#f97316', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentsTab;
