import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Star, Building2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../utils/api';

const HolidaysPage = () => {
  const [holidays, setHolidays] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    date: new Date().toISOString().slice(0, 10),
    isMandatory: true,
    departmentIds: []
  });

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const [holsRes, deptsRes] = await Promise.all([
        api.get('/holidays'),
        api.get('/departments').catch(() => ({ data: [] }))
      ]);
      setHolidays(holsRes.data || []);
      setDepartments(deptsRes.data || []);
    } catch (err) {
      toast.error('Error al cargar días festivos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/holidays', {
        name: formData.name,
        date: formData.date,
        isMandatory: formData.isMandatory,
        departmentIds: formData.departmentIds.length > 0 ? formData.departmentIds : null
      });
      toast.success('Día festivo registrado exitosamente');
      setIsModalOpen(false);
      setFormData({
        name: '',
        date: new Date().toISOString().slice(0, 10),
        isMandatory: true,
        departmentIds: []
      });
      fetchHolidays();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar festivo');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`¿Eliminar el festivo "${name}"?`)) return;
    try {
      await api.delete(`/holidays/${id}`);
      toast.success('Día festivo eliminado');
      fetchHolidays();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar festivo');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: '#e4e4e7' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Calendar className="w-7 h-7 text-orange-500" />
            Días Festivos Oficiales
          </h1>
          <p style={{ color: '#a1a1aa', fontSize: '0.9rem', margin: 0 }}>
            Configuración de días feriados y de descanso obligatorio para evitar faltas injustificadas.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            background: '#f97316',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)'
          }}
        >
          <Plus size={18} /> Agregar Festivo
        </button>
      </div>

      {/* Tabla de Festivos */}
      <div style={{ background: '#18181b', borderRadius: '16px', border: '1px solid #27272a', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: '#202023', borderBottom: '1px solid #27272a' }}>
              <th style={{ padding: '1rem 1.5rem', color: '#a1a1aa', fontWeight: 600 }}>Fecha</th>
              <th style={{ padding: '1rem 1.5rem', color: '#a1a1aa', fontWeight: 600 }}>Nombre del Festivo</th>
              <th style={{ padding: '1rem 1.5rem', color: '#a1a1aa', fontWeight: 600 }}>Tipo</th>
              <th style={{ padding: '1rem 1.5rem', color: '#a1a1aa', fontWeight: 600 }}>Alcance</th>
              <th style={{ padding: '1rem 1.5rem', color: '#a1a1aa', fontWeight: 600, textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#a1a1aa' }}>
                  Cargando días festivos...
                </td>
              </tr>
            ) : holidays.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#a1a1aa' }}>
                  <AlertCircle size={36} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                  <div>No hay días festivos registrados para esta empresa.</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.7 }}>
                    Haga clic en "Agregar Festivo" para registrar feriados oficiales.
                  </div>
                </td>
              </tr>
            ) : (
              holidays.map(h => {
                const dateStr = h.date ? (typeof h.date === 'string' ? h.date.slice(0, 10) : new Date(h.date).toISOString().slice(0, 10)) : '—';
                return (
                  <tr key={h.id} style={{ borderBottom: '1px solid #27272a', transition: 'background-color 0.15s' }}>
                    <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: '#f97316' }}>
                      {dateStr}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: '#fff' }}>
                      {h.name}
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span style={{
                        padding: '0.25rem 0.65rem',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: h.isMandatory ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                        color: h.isMandatory ? '#10b981' : '#94a3b8',
                        border: `1px solid ${h.isMandatory ? 'rgba(16, 185, 129, 0.3)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}>
                        {h.isMandatory ? 'Obligatorio' : 'Opcional / Conmemorativo'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', color: '#a1a1aa' }}>
                      {h.departmentIds && Array.isArray(h.departmentIds) && h.departmentIds.length > 0 ? (
                        <span>Departamentos específicos ({h.departmentIds.length})</span>
                      ) : (
                        <span style={{ color: '#38bdf8' }}>Toda la empresa</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                      <button
                        onClick={() => handleDelete(h.id, h.name)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          padding: '0.45rem',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                        title="Eliminar día festivo"
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

      {/* Modal Agregar Festivo */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '16px',
            padding: '2rem',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff', margin: '0 0 1.5rem 0' }}>
              Registrar Día Festivo
            </h2>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.4rem', fontWeight: 500 }}>
                  Nombre del Festivo
                </label>
                <input
                  type="text"
                  placeholder="Ej: Día de la Constitución"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#121214',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: '#fff',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '0.4rem', fontWeight: 500 }}>
                  Fecha (YYYY-MM-DD)
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#121214',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: '#fff',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="checkbox"
                  id="isMandatoryCheck"
                  checked={formData.isMandatory}
                  onChange={e => setFormData({ ...formData, isMandatory: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: '#f97316' }}
                />
                <label htmlFor="isMandatoryCheck" style={{ color: '#e4e4e7', fontSize: '0.9rem', cursor: 'pointer' }}>
                  Descanso Obligatorio (no computar como falta laboral)
                </label>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '0.65rem 1.25rem',
                    background: 'transparent',
                    border: '1px solid #3f3f46',
                    color: '#e4e4e7',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.65rem 1.5rem',
                    background: '#f97316',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 600,
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Guardar Festivo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HolidaysPage;
