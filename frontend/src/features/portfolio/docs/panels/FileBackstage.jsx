import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Clock3, Copy, Download, FilePlus2, FileText, FolderOpen, History,
  Info, LayoutTemplate, Printer, Save, Search, Trash2, Upload, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { portfolioRepository } from '../../../../data/repositories/portfolioRepository';
import { DOC_TEMPLATES } from '../docTemplates';
import { IMPORT_ACCEPT } from '../io/importers';
import { EXPORT_FORMATS } from '../io/exporters';
import { plainText } from '../model';
import { useFilePicker } from '../ui/controls';

const when = (iso) => (iso ? new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—');

function DocRow({ hoja, activeId, navigate }) {
  return (
    <button type="button" className={`wd-list-row${hoja.id === activeId ? ' is-active' : ''}`} onClick={() => navigate(`/portafolio/${hoja.id}`)}>
      <FileText size={16} />
      <span className="wd-item-label">
        <b>{hoja.name || 'Sin título'}</b>
        <small>{hoja.projectName || 'Sin proyecto'} · {when(hoja.updatedAt)}{hoja.shared ? ' · Compartido' : ''}</small>
      </span>
      {hoja.favorite ? <span className="wd-chip">Favorito</span> : null}
    </button>
  );
}

function Home({ actions, api, doc, meta, name, autosave, counts, onClose, navigate }) {
  const canEdit = meta?.canEdit !== false;
  const [copies, setCopies] = useState(1);
  return (
    <section className="wd-back-section">
      <h2>{name || 'Sin título'}</h2>
      <p className="wd-muted">
        {doc.pages.length} página(s) · {counts.words} palabras
        {meta?.projectName ? ` · Proyecto: ${meta.projectName}` : ''}
      </p>
      <div className="wd-back-cards">
        {canEdit && (
          <button type="button" className="wd-back-card" onClick={() => { api.saveNow?.(); toast.success('Documento guardado.'); onClose(); }}>
            <Save size={20} />
            <b>Guardar</b>
            <small>Guardar el estado actual ahora</small>
          </button>
        )}
        {meta?.canManage && (
          <button type="button" className="wd-back-card" onClick={async () => {
            const value = window.prompt('Nombre de la copia', `${name} (copia)`);
            if (value?.trim()) { await actions.saveAs(value.trim(), meta?.projectId); }
          }}>
            <Copy size={20} />
            <b>Guardar una copia</b>
            <small>Crea un documento nuevo con el contenido actual</small>
          </button>
        )}
        {canEdit && (
          <button type="button" className="wd-back-card" onClick={actions.saveAsTemplate}>
            <LayoutTemplate size={20} />
            <b>Guardar como plantilla</b>
            <small>Reutiliza este documento como plantilla personal</small>
          </button>
        )}
        {meta?.canManage && (
          <button type="button" className="wd-back-card" onClick={actions.namedVersion}>
            <History size={20} />
            <b>Nueva versión</b>
            <small>Registra un punto de restauración con nombre</small>
          </button>
        )}
        <button type="button" className="wd-back-card" onClick={() => { setCopies(1); actions.print({ copies }); }}>
          <Printer size={20} />
          <b>Imprimir</b>
          <small>Vista de impresión del documento</small>
        </button>
        <button type="button" className="wd-back-card" onClick={() => navigate('/portafolio')}>
          <ArrowLeft size={20} />
          <b>Cerrar</b>
          <small>Volver a la lista de documentos</small>
        </button>
      </div>
      {meta?.canManage && (
        <label className="wd-row" style={{ marginTop: 18 }}>
          <input type="checkbox" checked={autosave} onChange={(event) => api.setAutosave?.(event.target.checked)} />
          <span>Guardado automático</span>
        </label>
      )}
      <h3 style={{ marginTop: 22 }}>Plantillas</h3>
      <div className="wd-back-cards">
        {DOC_TEMPLATES.slice(0, 4).map((template) => (
          <button key={template.id} type="button" className="wd-back-card" onClick={() => actions.createFromTemplate(template.id)}>
            <FilePlus2 size={20} />
            <b>{template.name}</b>
            <small>{template.blurb}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function NewDoc({ actions, api }) {
  const customs = api.storage.get('templates', []);
  const removeCustom = (id) => {
    api.storage.set('templates', customs.filter((template) => template.id !== id));
  };
  const [tick, setTick] = useState(0);
  void tick;
  return (
    <section className="wd-back-section">
      <h2>Nuevo documento</h2>
      <p className="wd-muted">Crea un documento desde una plantilla de SprintOps o una plantilla personal.</p>
      <h3>Plantillas</h3>
      <div className="wd-back-cards">
        {DOC_TEMPLATES.map((template) => (
          <button key={template.id} type="button" className="wd-back-card" onClick={() => actions.createFromTemplate(template.id)}>
            <FileText size={20} />
            <b>{template.name}</b>
            <small>{template.blurb}</small>
          </button>
        ))}
      </div>
      <h3 style={{ marginTop: 22 }}>Mis plantillas</h3>
      {customs.length === 0 && <p className="wd-muted">Aún no tienes plantillas. Usa “Guardar como plantilla” en Inicio.</p>}
      <div className="wd-back-cards">
        {customs.map((template) => (
          <div key={template.id} className="wd-back-card is-static">
            <FileText size={20} />
            <b>{template.name}</b>
            <small>{when(template.createdAt)}</small>
            <span className="wd-back-card-actions">
              <button type="button" className="wd-btn wd-primary" onClick={() => actions.createFromCustomTemplate(template)}>Usar</button>
              <button type="button" className="wd-btn" onClick={() => { removeCustom(template.id); setTick((v) => v + 1); }}>Eliminar</button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Open({ hojaId, user, navigate }) {
  const [items, setItems] = useState(null);
  const [query, setQuery] = useState('');
  useEffect(() => {
    portfolioRepository.list(user.id).then(setItems).catch(() => setItems([]));
  }, [user.id]);
  const filtered = useMemo(() => (items || [])
    .filter((hoja) => !hoja.deleted)
    .filter((hoja) => !query.trim() || (hoja.name || '').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [items, query]);
  return (
    <section className="wd-back-section">
      <h2>Abrir</h2>
      <div className="wd-row">
        <Search size={15} />
        <input className="wd-input" placeholder="Buscar documento…" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {items === null && <p className="wd-muted">Cargando…</p>}
      {items !== null && filtered.length === 0 && <p className="wd-muted">No hay documentos que coincidan.</p>}
      <div className="wd-list">
        {filtered.map((hoja) => <DocRow key={hoja.id} hoja={hoja} activeId={hojaId} navigate={navigate} />)}
      </div>
    </section>
  );
}

function Import({ actions }) {
  const [mode, setMode] = useState('insert');
  const [busy, setBusy] = useState(false);
  const [pick, input] = useFilePicker(async (file) => {
    setBusy(true);
    try { await actions.importFile(file, mode); } catch (error) { toast.error(error.message || 'No se pudo importar.'); }
    setBusy(false);
  });
  return (
    <section className="wd-back-section">
      <h2>Importar</h2>
      <p className="wd-muted">Convierte archivos a HTML del documento: DOCX, DOC, ODT, RTF, TXT, HTML, Markdown y PDF.</p>
      <div className="wd-row">
        <select className="wd-select" value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="insert">Insertar en el cursor</option>
          <option value="replace">Reemplazar el documento</option>
          <option value="new">Crear documento nuevo</option>
        </select>
        <button type="button" className="wd-btn wd-primary" disabled={busy} onClick={pick}>
          <Upload size={15} /> {busy ? 'Importando…' : 'Elegir archivo'}
        </button>
      </div>
      <input ref={input} type="file" accept={IMPORT_ACCEPT} hidden />
      <p className="wd-muted" style={{ marginTop: 14 }}>También puedes arrastrar y soltar un archivo directamente sobre el documento.</p>
    </section>
  );
}

function Export({ actions, name }) {
  const [scope, setScope] = useState('all');
  const [pagesRange, setPagesRange] = useState('');
  const [busy, setBusy] = useState(null);
  const run = async (format) => {
    setBusy(format);
    try {
      await actions.exportAs(format, { scope, pages: pagesRange });
    } catch (error) {
      toast.error(error.message || 'No se pudo exportar.');
    }
    setBusy(null);
  };
  return (
    <section className="wd-back-section">
      <h2>Exportar</h2>
      <div className="wd-row">
        <select className="wd-select" value={scope} onChange={(event) => setScope(event.target.value)}>
          <option value="all">Documento completo</option>
          <option value="selection">Selección actual</option>
          <option value="pages">Páginas específicas</option>
        </select>
        {scope === 'pages' && <input className="wd-input" style={{ width: 140 }} placeholder="1-3, 5" value={pagesRange} onChange={(event) => setPagesRange(event.target.value)} />}
      </div>
      <div className="wd-back-cards">
        {Object.entries(EXPORT_FORMATS).map(([format, label]) => (
          <button key={format} type="button" className="wd-back-card" disabled={busy !== null} onClick={() => run(format)}>
            <Download size={20} />
            <b>{label}</b>
            <small>{busy === format ? 'Generando…' : `Descargar “${name || 'documento'}” como ${format.toUpperCase()}`}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function PrintSection({ actions, doc }) {
  const [range, setRange] = useState('all');
  const [pagesText, setPagesText] = useState('');
  const [orientation, setOrientation] = useState(doc.orientation || 'portrait');
  const [scale, setScale] = useState(100);
  const [copies, setCopies] = useState(1);
  return (
    <section className="wd-back-section">
      <h2>Imprimir</h2>
      <div className="wd-form-grid">
        <label className="wd-field-row"><span>Intervalo</span>
          <select className="wd-select" value={range} onChange={(event) => setRange(event.target.value)}>
            <option value="all">Todo el documento</option>
            <option value="current">Página actual</option>
            <option value="pages">Páginas</option>
            <option value="selection">Selección</option>
          </select>
        </label>
        {range === 'pages' && <label className="wd-field-row"><span>Páginas</span><input className="wd-input" placeholder="1-3, 5" value={pagesText} onChange={(event) => setPagesText(event.target.value)} /></label>}
        <label className="wd-field-row"><span>Orientación</span>
          <select className="wd-select" value={orientation} onChange={(event) => setOrientation(event.target.value)}>
            <option value="portrait">Vertical</option>
            <option value="landscape">Horizontal</option>
          </select>
        </label>
        <label className="wd-field-row"><span>Escala</span>
          <input className="wd-range" type="range" min="50" max="150" value={scale} onChange={(event) => setScale(Number(event.target.value))} />
          <b>{scale}%</b>
        </label>
        <label className="wd-field-row"><span>Copias</span><input className="wd-input" type="number" min="1" max="20" value={copies} onChange={(event) => setCopies(Number(event.target.value) || 1)} /></label>
      </div>
      <div className="wd-dialog-actions">
        <button type="button" className="wd-btn wd-primary" onClick={() => actions.print({ range, pages: pagesText, orientation, scale, copies })}>
          <Printer size={15} /> Imprimir
        </button>
      </div>
    </section>
  );
}

function InfoSection({ actions, doc, meta, hojaId, user, counts, name, navigate, onClose }) {
  const [versions, setVersions] = useState(null);
  useEffect(() => {
    portfolioRepository.versions(hojaId, user.id).then(setVersions).catch(() => setVersions([]));
  }, [hojaId, user.id]);
  const text = plainText(doc.pages.map((page) => page.html).join(' '));
  const archive = async () => {
    if (!window.confirm('¿Mover este documento a la papelera?')) return;
    try {
      await portfolioRepository.update(hojaId, { userId: user.id, deleted: true });
      toast.success('Documento enviado a la papelera.');
      navigate('/portafolio');
    } catch {
      toast.error('No se pudo archivar.');
    }
  };
  return (
    <section className="wd-back-section">
      <h2>Información</h2>
      <dl className="wd-props">
        <dt>Nombre</dt><dd>{name || 'Sin título'}</dd>
        <dt>Propietario</dt><dd>{meta?.ownerName || '—'}</dd>
        <dt>Proyecto</dt><dd>{meta?.projectName || 'Sin proyecto'}</dd>
        <dt>Creado</dt><dd>{when(meta?.createdAt)}</dd>
        <dt>Modificado</dt><dd>{when(meta?.updatedAt)}</dd>
        <dt>Páginas</dt><dd>{doc.pages.length}</dd>
        <dt>Palabras</dt><dd>{counts.words}</dd>
        <dt>Caracteres</dt><dd>{text.length}</dd>
        <dt>Tamaño</dt><dd>{Math.max(1, Math.round(JSON.stringify(doc).length / 1024))} KB</dd>
        <dt>Tu rol</dt><dd>{meta?.role || (meta?.canManage ? 'Propietario' : meta?.canEdit ? 'Editor' : 'Lector')}</dd>
      </dl>
      <h3 style={{ marginTop: 20 }}>Historial de versiones</h3>
      {versions === null && <p className="wd-muted">Cargando…</p>}
      {versions?.length === 0 && <p className="wd-muted">Todavía no hay versiones guardadas.</p>}
      <div className="wd-list">
        {(versions || []).slice(0, 8).map((version) => (
          <div key={version.id} className="wd-list-row is-static">
            <Clock3 size={15} />
            <span className="wd-item-label">
              <b>{version.label || `Versión ${version.id}`}</b>
              <small>{version.authorName || 'Automática'} · {when(version.createdAt)}</small>
            </span>
            <span className="wd-back-card-actions">
              <button type="button" className="wd-btn" onClick={() => actions.previewVersion(version.id, version.label)}>Ver</button>
              {meta?.canEdit && <button type="button" className="wd-btn" onClick={async () => { await actions.restoreVersion(version.id); onClose(); }}>Restaurar</button>}
            </span>
          </div>
        ))}
      </div>
      {meta?.canManage && (
        <div className="wd-row" style={{ marginTop: 20 }}>
          <button type="button" className="wd-btn" onClick={archive}><Trash2 size={14} /> Enviar a la papelera</button>
        </div>
      )}
    </section>
  );
}

const NAV = [
  ['home', 'Inicio', FileText],
  ['new', 'Nuevo', FilePlus2],
  ['open', 'Abrir', FolderOpen],
  ['import', 'Importar', Upload],
  ['export', 'Exportar', Download],
  ['print', 'Imprimir', Printer],
  ['info', 'Información', Info],
];

export default function FileBackstage({ section, setSection, onClose, actions, api, doc, meta, user, hojaId, counts, name, autosave }) {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const shared = { actions, api, doc, meta, user, hojaId, counts, name, autosave, navigate, onClose };
  const panels = {
    home: <Home {...shared} />,
    new: <NewDoc {...shared} />,
    open: <Open hojaId={hojaId} user={user} navigate={navigate} />,
    import: <Import actions={actions} />,
    export: <Export actions={actions} name={name} />,
    print: <PrintSection actions={actions} doc={doc} />,
    info: <InfoSection {...shared} />,
  };
  return (
    <div className="wd-back" role="dialog" aria-modal="true" aria-label="Archivo">
      <aside className="wd-back-nav">
        <button type="button" className="wd-back-return" onClick={onClose}><ArrowLeft size={16} /> Volver</button>
        {NAV.map(([id, label, Icon]) => (
          <button key={id} type="button" className={`wd-back-tab${section === id ? ' is-active' : ''}`} onClick={() => setSection(id)}>
            <Icon size={16} /> {label}
          </button>
        ))}
        <div className="wd-back-nav-foot">
          <span className="wd-muted">{api.readOnly ? 'Solo lectura' : meta?.canManage ? 'Propietario' : 'Editor'}</span>
        </div>
      </aside>
      <main className="wd-back-body">
        <button type="button" className="wd-back-close" aria-label="Cerrar" onClick={onClose}><X size={18} /></button>
        {panels[section] || panels.home}
      </main>
    </div>
  );
}
