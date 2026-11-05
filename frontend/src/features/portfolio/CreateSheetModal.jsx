import { useEffect, useState } from 'react';
import { FileText, Presentation, Shapes, X } from 'lucide-react';
import { AnimatedPopup } from '../../components/PopupPortal';

const KINDS = [
  {
    id: 'document',
    title: 'Documento',
    text: 'Páginas, estilos, tablas e imágenes, como un procesador de texto.',
    points: ['Páginas Carta y A4', 'Reglas laterales', 'Estilos de texto'],
    icon: FileText,
  },
  {
    id: 'slides',
    title: 'Presentaciones',
    text: 'Diapositivas 16:9, una a la vez, con panel de elementos.',
    points: ['Formato de diapositivas', 'Panel de elementos', 'Presentar y exportar'],
    icon: Presentation,
  },
  {
    id: 'canvas',
    title: 'Freeflow',
    text: 'Lienzo libre. Tiene panel de elementos y, además, panel de diseño.',
    points: ['Lienzo sin límites', 'Panel de elementos', 'Panel de diseño'],
    icon: Shapes,
  },
];

const CreateSheetModal = ({ open, busy, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('canvas');

  useEffect(() => {
    if (!open) return;
    setName('');
    setKind('canvas');
  }, [open]);

  const submit = (event) => {
    event.preventDefault();
    onCreate(kind, name);
  };

  return (
    <AnimatedPopup open={open}>
      <div className="popup-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="popup-panel flex max-h-[calc(var(--app-h,900px)-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 p-6">
            <h2 className="text-xl font-black tracking-tight text-gray-800">Crear hoja</h2>
            <button type="button" className="text-gray-400 transition-colors hover:text-gray-600" aria-label="Cerrar" onClick={onClose}>
              <X size={24} />
            </button>
          </div>
          <form className="flex min-h-0 flex-col gap-5 overflow-y-auto p-6" onSubmit={submit}>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-gray-500" htmlFor="sheet-name">Nombre</label>
              <input
                id="sheet-name"
                className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 focus:outline-none focus:ring-2 focus:ring-[#67BFA1]"
                value={name}
                placeholder="Sin título"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="pf-kind-grid" role="radiogroup" aria-label="Tipo de hoja">
              {KINDS.map((item) => {
                const Icon = item.icon;
                const selected = kind === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`pf-kind-card${selected ? ' is-selected' : ''}`}
                    onClick={() => setKind(item.id)}
                  >
                    <span className="pf-kind-art" data-kind={item.id} aria-hidden="true">
                      <Icon size={22} />
                    </span>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                    <ul>
                      {item.points.map((point) => <li key={point}>{point}</li>)}
                    </ul>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="ps-quiet" onClick={onClose}>Cancelar</button>
              <button type="submit" className="ps-primary" disabled={busy}>{busy ? 'Creando…' : 'Crear hoja'}</button>
            </div>
          </form>
        </div>
      </div>
    </AnimatedPopup>
  );
};

export default CreateSheetModal;
