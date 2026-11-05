import { useEffect, useMemo, useState } from 'react';
import {
  AppWindow,
  Frame,
  Image as ImageIcon,
  LayoutTemplate,
  Library,
  Shapes,
  Type,
  SwatchBook,
} from 'lucide-react';
import { buildTemplate, listTemplates } from './portfolioDocument';
import { STICKERS, TEXT_PRESETS, SHAPES, shapeElements, deviceElements, kitElements, appElements } from './editorCatalog';
import { searchCommons } from './editorMedia';
import PanelToggleIcon from './PanelToggleIcon';
import ShapeGlyph from './ShapeGlyph';

const RECENT_KEY = 'sprintops.recent-elements';

function readRecent() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.key).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function pushRecent(entry) {
  const next = [entry, ...readRecent().filter((item) => item.key !== entry.key)].slice(0, 8);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

const SECTIONS = [
  { id: 'templates', label: 'Plantillas', icon: LayoutTemplate },
  { id: 'elements', label: 'Elementos', icon: Shapes },
  { id: 'text', label: 'Texto', icon: Type },
  { id: 'media', label: 'Media', icon: ImageIcon },
  { id: 'frames', label: 'Marcos', icon: Frame },
  { id: 'kits', label: 'UI Kits', icon: SwatchBook },
  { id: 'library', label: 'Biblioteca', icon: Library },
  { id: 'apps', label: 'Apps', icon: AppWindow },
];

const EditorLibrary = ({ open, section, onSection, onToggle, onInsert, uploads }) => {
  const templates = useMemo(() => listTemplates().filter((item) => item.id !== 'blank'), []);
  const [query, setQuery] = useState('');
  const [mediaKind, setMediaKind] = useState('image');
  const [media, setMedia] = useState([]);
  const [mediaState, setMediaState] = useState('idle');
  const [expanded, setExpanded] = useState({});
  const [recent, setRecent] = useState(readRecent);
  const needle = query.trim().toLowerCase();
  const match = (label) => !needle || label.toLowerCase().includes(needle);

  useEffect(() => {
    if (section !== 'media' || !needle) return undefined;
    let alive = true;
    const timer = window.setTimeout(async () => {
      setMediaState('loading');
      try {
        const results = await searchCommons(needle, mediaKind);
        if (!alive) return;
        setMedia(results);
        setMediaState(results.length ? 'ready' : 'empty');
      } catch (error) {
        if (!alive) return;
        setMedia([]);
        setMediaState(error.message || 'error');
      }
    }, 320);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [needle, mediaKind, section]);

  const pick = (id) => {
    onSection(id);
    if (!open) onToggle();
  };

  const insertCatalog = (kind, id, name) => {
    setRecent(pushRecent({ key: `${kind}:${id}`, kind, id, name }));
    if (kind === 'shape') {
      onInsert(shapeElements(id));
      return;
    }
    const figure = STICKERS.find((item) => item.name === id);
    if (!figure) return;
    onInsert([{ type: 'image', name: figure.name, width: 140, height: 140, src: figure.src, text: '', fill: 'transparent', credit: 'Figurita de SprintOps' }]);
  };

  return (
    <aside className={`pf-library${open ? ' is-open' : ''}`}>
      <nav className="pf-rail" aria-label="Biblioteca">
        {SECTIONS.map((item) => {
          const Icon = item.icon;
          const selected = open && section === item.id;
          return (
            <button key={item.id} type="button" className={selected ? 'is-active' : ''} aria-pressed={selected} title={item.label} onClick={() => (selected ? onToggle() : pick(item.id))}>
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="pf-drawer">
        <div className="pf-drawer-inner">
          <div className="pf-drawer-head">
            <h2>{SECTIONS.find((item) => item.id === section)?.label}</h2>
            <button type="button" className="pf-icon-btn pf-panel-toggle" aria-label="Compactar biblioteca" onClick={onToggle}><PanelToggleIcon /></button>
          </div>
          <div className="pf-drawer-tools">
            <input className="pf-search" value={query} placeholder={section === 'media' ? 'Buscar en Commons…' : 'Buscar'} aria-label="Buscar en la biblioteca" onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="pf-drawer-body">
            {section === 'templates' && (
              <div className="pf-asset-grid">
                {templates.filter((item) => match(item.name)).map((item) => (
                  <button key={item.id} type="button" className="pf-asset" onClick={() => onInsert(buildTemplate(item.id))}>
                    <span className="pf-asset-name">{item.name}</span>
                  </button>
                ))}
              </div>
            )}
            {section === 'elements' && (
              <>
                <section className="pf-asset-group">
                  <div className="pf-asset-group-head"><h3>Usados recientemente</h3></div>
                  {recent.filter((item) => match(item.name)).length === 0 ? (
                    <p className="pf-kicker">Lo que insertes desde Figuras o Formas queda aquí.</p>
                  ) : (
                    <div className="pf-recent">
                      {recent.filter((item) => match(item.name)).map((item) => (
                        <ElementTile
                          key={item.key}
                          item={item.kind === 'shape' ? SHAPES.find((shape) => shape.id === item.id) : STICKERS.find((figure) => figure.name === item.id)}
                          kind={item.kind}
                          onPick={() => insertCatalog(item.kind, item.id, item.name)}
                        />
                      ))}
                    </div>
                  )}
                </section>
                <AssetGroup title="Figuras" expanded={expanded.figures !== false} onToggle={() => setExpanded((current) => ({ ...current, figures: current.figures === false }))}>
                  {STICKERS.filter((item) => match(item.name)).map((item) => (
                    <ElementTile key={item.name} item={item} kind="figure" onPick={() => insertCatalog('figure', item.name, item.name)} />
                  ))}
                </AssetGroup>
                <AssetGroup title="Formas" expanded={expanded.shapes !== false} onToggle={() => setExpanded((current) => ({ ...current, shapes: current.shapes === false }))}>
                  {SHAPES.filter((item) => match(item.name)).map((item) => (
                    <ElementTile key={item.id} item={item} kind="shape" onPick={() => insertCatalog('shape', item.id, item.name)} />
                  ))}
                </AssetGroup>
              </>
            )}
            {section === 'text' && TEXT_PRESETS.filter((item) => match(item.name)).map((item) => (
              <button key={item.name} type="button" className="pf-text-preset" onClick={() => onInsert([{ type: 'text', name: item.name, text: item.text, fontSize: item.fontSize, fontWeight: item.fontWeight, fontStyle: item.fontStyle || 'normal', width: item.width, height: item.height, fill: 'transparent', textFill: '#1e293b', align: 'left' }])}>
                <span style={{ fontSize: Math.min(item.fontSize, 28), fontWeight: item.fontWeight }}>{item.name}</span>
              </button>
            ))}
            {section === 'media' && (
              <>
                <div className="pf-segment" role="group" aria-label="Tipo de medio">
                  <button type="button" className={mediaKind === 'image' ? 'is-active' : ''} onClick={() => setMediaKind('image')}>Imágenes</button>
                  <button type="button" className={mediaKind === 'video' ? 'is-active' : ''} onClick={() => setMediaKind('video')}>Videos</button>
                </div>
                <p className="pf-kicker">Wikimedia Commons, solo licencias libres. El crédito se guarda en el elemento.</p>
                {mediaState === 'loading' && <p className="pf-kicker">Buscando…</p>}
                {mediaState === 'empty' && <p className="pf-kicker">No hay resultados con licencia libre.</p>}
                {mediaState !== 'idle' && mediaState !== 'loading' && mediaState !== 'ready' && mediaState !== 'empty' && <p className="pf-error text-xs font-semibold">{mediaState}</p>}
                <div className="pf-asset-grid">
                  {media.map((item) => (
                    <button key={item.src} type="button" className="pf-asset pf-asset-visual" title={item.credit} onClick={() => onInsert([item.mime.startsWith('video/') ? { type: 'video', name: item.title, width: 320, height: 180, src: item.src, poster: item.poster, text: '', fill: '#0f172a', credit: item.credit } : { type: 'image', name: item.title, width: 280, height: 180, src: item.src, text: '', fill: 'transparent', credit: item.credit }])}>
                      {item.poster || item.mime.startsWith('image/') ? <img src={item.poster || item.src} alt="" /> : <span className="pf-asset-fallback">Video</span>}
                      <span>{item.license}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {section === 'frames' && (
              <>
                <AssetGroup title="Dispositivos" expanded={expanded.devices} onToggle={() => setExpanded((current) => ({ ...current, devices: !current.devices }))}>
                  {[['phone', 'Teléfono'], ['tablet', 'Tablet'], ['laptop', 'Laptop']].filter(([, label]) => match(label)).map(([id, label]) => (
                    <button key={id} type="button" className="pf-asset" onClick={() => onInsert(deviceElements(id))}>{label}</button>
                  ))}
                </AssetGroup>
                <AssetGroup title="Marcos" expanded={expanded.frames} onToggle={() => setExpanded((current) => ({ ...current, frames: !current.frames }))}>
                  {[['Marco', 360, 240], ['Marco ancho', 520, 300]].filter(([label]) => match(label)).map(([label, width, height]) => (
                    <button key={label} type="button" className="pf-asset" onClick={() => onInsert([{ type: 'frame', name: label, width, height, fill: 'transparent', stroke: '#1e293b', strokeWidth: 2, radius: 18, text: '' }])}>{label}</button>
                  ))}
                </AssetGroup>
              </>
            )}
            {section === 'kits' && (
              <div className="pf-asset-grid">
                {[['button', 'Botón'], ['input', 'Campo'], ['card', 'Tarjeta'], ['chip', 'Chip'], ['glass', 'Vidrio']].filter(([, label]) => match(label)).map(([id, label]) => (
                  <button key={id} type="button" className="pf-asset" onClick={() => onInsert(kitElements(id))}>{label}</button>
                ))}
              </div>
            )}
            {section === 'library' && (
              uploads.filter((item) => match(item.name)).length === 0
                ? <p className="pf-kicker">Lo que subas o insertes desde un archivo queda aquí para volver a usarlo en esta hoja.</p>
                : (
                  <div className="pf-asset-grid">
                    {uploads.filter((item) => match(item.name)).map((item) => (
                      <button key={item.key} type="button" className="pf-asset pf-asset-visual" onClick={() => onInsert([item.element])}>
                        {item.element.src && item.element.type === 'image' ? <img src={item.element.src} alt="" /> : <span className="pf-asset-fallback">{item.element.type}</span>}
                        <span>{item.name}</span>
                      </button>
                    ))}
                  </div>
                )
            )}
            {section === 'apps' && (
              <div className="pf-asset-grid">
                {[['note', 'Nota'], ['tasks', 'Lista'], ['bars', 'Barras']].filter(([, label]) => match(label)).map(([id, label]) => (
                  <button key={id} type="button" className="pf-asset" onClick={() => onInsert(appElements(id))}>{label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

const ElementTile = ({ item, kind, onPick }) => {
  if (!item) return null;
  return (
    <button type="button" className="pf-asset pf-shape-tile" onClick={onPick}>
      {kind === 'shape' ? <ShapeGlyph id={item.id} /> : <img src={item.src} alt="" />}
      <span>{item.name}</span>
    </button>
  );
};

const AssetGroup = ({ title, expanded, onToggle, children }) => {
  const items = [].concat(children).filter(Boolean);
  const visible = expanded ? items : items.slice(0, 4);
  return (
    <section className="pf-asset-group">
      <div className="pf-asset-group-head">
        <h3>{title}</h3>
        {items.length > 4 && <button type="button" onClick={onToggle}>{expanded ? 'Ver menos' : 'Ver todo'}</button>}
      </div>
      <div className="pf-asset-grid">{visible}</div>
    </section>
  );
};

export default EditorLibrary;
