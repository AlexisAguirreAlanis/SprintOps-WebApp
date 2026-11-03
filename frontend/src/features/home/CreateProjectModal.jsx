import React, { useState } from 'react';
import { X } from 'lucide-react';
import ProjectCodeModal from '../../components/ui/ProjectCodeModal';
import { AnimatedPopup } from '../../components/PopupPortal';
import { projectDateBounds } from '../../domain/scheduleDates';

const MODES = [
  {
    id: 'agil',
    title: 'Modo Ágil',
    hint: 'Estándar',
    text: 'Sprints, story points y seguimiento de tareas, sin control detallado del tiempo.',
  },
  {
    id: 'tiempo',
    title: 'Gestión por tiempo',
    hint: 'Esfuerzo real',
    text: 'Todo lo del modo ágil, más horas por tarea, reportes y comparación contra lo estimado.',
  },
];

const CreateProjectModal = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [modo, setModo] = useState('agil');
  const [cotizacionHabilitada, setCotizacionHabilitada] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [createdName, setCreatedName] = useState('');
  const [formError, setFormError] = useState('');
  const bounds = projectDateBounds(start);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (start < bounds.startMin || start > bounds.startMax || end < bounds.endMin || end > bounds.endMax) {
      setFormError('El proyecto empieza hoy o después, y termina como máximo dentro de 3 años.');
      return;
    }
    setFormError('');

    let result;
    try {
      result = await onCreate({
      name,
      description,
      start,
      end,
      modo,
      cotizacionHabilitada: modo === 'tiempo' && cotizacionHabilitada,
    });
    } catch (err) {
      setFormError(err?.message || 'No se pudo crear el proyecto.');
      return;
    }

    setCreatedName(name);
    setGeneratedCode(result?.codigo || '');
    setShowCodeModal(true);
    setName('');
    setDescription('');
    setStart('');
    setEnd('');
    setModo('agil');
    setCotizacionHabilitada(false);
  };

  const handleCodeModalClose = () => {
    setShowCodeModal(false);
    onClose();
  };

  return (
    <>
    {!showCodeModal && (
    <AnimatedPopup open={isOpen}>
      <div className="popup-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="popup-panel flex max-h-[calc(var(--app-h,900px)-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
            <h2 className="text-xl font-black text-gray-800 tracking-tight">Crear Nuevo Proyecto</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={24} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-col gap-4 overflow-y-auto p-6">
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 md:gap-6">
            <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Nombre del Proyecto</label>
              <input 
                required
                className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#67BFA1] bg-gray-50"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej. Reestructuración de API"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Descripción</label>
              <textarea 
                required
                className="h-24 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-4 focus:outline-none focus:ring-2 focus:ring-[#67BFA1]"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Breve descripción del proyecto..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Fecha Inicio</label>
                <input 
                  required type="date"
                  min={bounds.startMin}
                  max={bounds.startMax}
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#67BFA1] bg-gray-50 text-sm"
                  value={start}
                  onChange={e => {
                    const next = e.target.value;
                    setStart(next);
                    if (end && next && end < next) setEnd(next);
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Fecha Fin</label>
                <input 
                  required type="date"
                  min={bounds.endMin}
                  max={bounds.endMax}
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#67BFA1] bg-gray-50 text-sm"
                  value={end} onChange={e => setEnd(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-slate-400 -mt-2">Desde hoy y hasta dentro de 3 años.</p>
            </div>

            <div>
              <p className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Modo del proyecto</p>
              <div className="grid grid-cols-1 gap-3">
                {MODES.map((option) => {
                  const active = modo === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setModo(option.id);
                        if (option.id !== 'tiempo') setCotizacionHabilitada(false);
                      }}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        active
                          ? 'border-[#67BFA1] bg-[#67BFA1]/10'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-slate-800">{option.title}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-[#67BFA1]">{option.hint}</span>
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-500">{option.text}</span>
                    </button>
                  );
                })}
              </div>

            <label className={`mt-3 flex items-start gap-3 rounded-xl border p-3 ${
              modo === 'tiempo' ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
            }`}>
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[#67BFA1]"
                checked={modo === 'tiempo' && cotizacionHabilitada}
                disabled={modo !== 'tiempo'}
                onChange={(e) => setCotizacionHabilitada(e.target.checked)}
              />
              <span>
                <span className="block text-sm font-bold text-slate-800">Incluir recomendaciones de cotización</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                  Con las horas registradas, SprintOps sugiere un rango de precio. Si lo dejas apagado, el proyecto igual guarda las métricas de tiempo, pero no muestra precios.
                </span>
              </span>
            </label>
            </div>
            </div>
            
            {formError && <p className="text-sm font-medium text-red-600">{formError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 h-12 bg-gray-100 text-slate-600 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
              <button type="submit" className="flex-1 h-12 bg-[#67BFA1] text-white font-bold rounded-xl hover:bg-[#52A98A] transition-colors shadow-lg shadow-[#67BFA1]/25">
                Crear Proyecto
              </button>
            </div>
          </form>
        </div>
      </div>
    </AnimatedPopup>
    )}
    <ProjectCodeModal
      isOpen={isOpen && showCodeModal}
      projectName={createdName}
      projectCode={generatedCode}
      onClose={handleCodeModalClose}
    />
    </>
  );
};

export default CreateProjectModal;
