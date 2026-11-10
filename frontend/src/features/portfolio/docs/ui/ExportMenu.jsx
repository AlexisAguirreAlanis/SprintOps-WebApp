import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollPane } from './controls';

const FORMATS = [
  ['docx', 'Word (.docx)', 'DOCX'],
  ['pdf', 'PDF (.pdf)', 'PDF'],
  ['odt', 'OpenDocument (.odt)', 'ODT'],
  ['rtf', 'Texto enriquecido (.rtf)', 'RTF'],
  ['txt', 'Texto plano (.txt)', 'TXT'],
  ['html', 'Página web (.html)', 'HTML'],
  ['md', 'Markdown (.md)', 'MD'],
  ['epub', 'Libro electrónico (.epub)', 'EPUB'],
];

export default function ExportMenu({ name, onExport }) {
  const [open, setOpen] = useState(false);
  const [alive, setAlive] = useState(false);
  const [busy, setBusy] = useState(null);
  const [pos, setPos] = useState(null);
  const wrap = useRef(null);

  useLayoutEffect(() => {
    if (!open || !wrap.current) return undefined;
    const place = () => {
      const rect = wrap.current.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 24);
      const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const up = below < 220 && above > below;
      const maxHeight = Math.max(160, Math.min(480, up ? above : below));
      setPos(up
        ? { left, width, maxHeight, top: 'auto', bottom: window.innerHeight - rect.top + 8 }
        : { left, width, maxHeight, top: rect.bottom + 8, bottom: 'auto' });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);

  useEffect(() => {
    if (open) {
      setAlive(true);
      return undefined;
    }
    if (!alive) return undefined;
    const timer = setTimeout(() => setAlive(false), 180);
    return () => clearTimeout(timer);
  }, [open, alive]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => { if (!wrap.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = async (format) => {
    if (busy) return;
    setBusy(format);
    try {
      await onExport(format);
      setOpen(false);
    } catch (error) {
      toast.error(error.message || 'No se pudo exportar.');
    } finally {
      setBusy(null);
    }
  };

  const title = name?.trim() || 'Documento';

  return (
    <div className="wd-export-wrap" ref={wrap}>
      <button type="button" className="wd-export-btn" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Download size={16} strokeWidth={2} /> Exportar
      </button>
      {alive && (
        <div className={`wd-export-pop${open ? ' is-open' : ''}`} role="dialog" aria-label="Exportar documento" style={pos ? { left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight } : undefined}>
          <div className="wd-export-head">
            <strong>Exportar</strong>
            <span>{title}</span>
          </div>
          <ScrollPane maxHeight={Math.max(120, (pos?.maxHeight || 320) - 72)}>
            {FORMATS.map(([format, label, ext], index) => (
              <button key={format} type="button" className="wd-export-card" style={{ '--i': index }} disabled={busy !== null} onClick={() => run(format)}>
                <i>{busy === format ? <Loader2 size={14} className="wd-spin" /> : ext}</i>
                <span>
                  <b>{label}</b>
                  <small>{busy === format ? 'Generando el archivo…' : `Descargar “${title}” como ${ext}`}</small>
                </span>
              </button>
            ))}
          </ScrollPane>
        </div>
      )}
    </div>
  );
}
