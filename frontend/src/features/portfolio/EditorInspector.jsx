import { useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Eye,
  EyeOff,
  Italic,
  Lock,
  LockOpen,
  Minus,
  Plus,
} from 'lucide-react';
import { defaultBend, isArrow } from './portfolioDocument';

const TABS = [
  { id: 'design', label: 'Diseño' },
  { id: 'style', label: 'Estilo' },
  { id: 'motion', label: 'Animación' },
];

const MOTION = [
  { id: 'none', label: 'Ninguna' },
  { id: 'fade', label: 'Fundido' },
  { id: 'rise', label: 'Subir' },
  { id: 'pop', label: 'Aparecer' },
];

const textCapable = (element) => element && !['line', 'image', 'video'].includes(element.type);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const safeHex = (value, fallback = '#1e293b') => (/^#[0-9a-fA-F]{6}$/.test(value || '') ? value : fallback);

function Stepper({ label, value, min = -4000, max = 4000, step = 1, onChange }) {
  const current = Number.isFinite(value) ? value : 0;
  const set = (next) => onChange(clamp(Math.round(next), min, max));
  return (
    <label className="pf-field">
      <span>{label}</span>
      <span className="pf-stepper">
        <button type="button" aria-label={`Disminuir ${label}`} onClick={() => set(current - step)}><Minus size={13} /></button>
        <input
          inputMode="numeric"
          aria-label={label}
          value={Math.round(current)}
          onChange={(event) => {
            const raw = event.target.value.trim();
            if (raw === '' || raw === '-') return;
            const next = Number(raw);
            if (Number.isFinite(next)) set(next);
          }}
        />
        <button type="button" aria-label={`Aumentar ${label}`} onClick={() => set(current + step)}><Plus size={13} /></button>
      </span>
    </label>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, format }) {
  const current = Number.isFinite(value) ? value : min;
  return (
    <label className="pf-slider">
      <span>{label}</span>
      <input className="pf-range" type="range" min={min} max={max} step={step} value={current} aria-label={label} onChange={(event) => onChange(Number(event.target.value))} />
      <span className="pf-slider-value">{format ? format(current) : current}</span>
    </label>
  );
}

function ColorField({ label, value, fallback, onChange }) {
  const hex = safeHex(value, fallback);
  return (
    <div className="pf-color-row">
      <span>{label}</span>
      <label className="pf-color" style={{ background: hex }}>
        <input type="color" value={hex} aria-label={label} onChange={(event) => onChange(event.target.value)} />
      </label>
      <input
        className="pf-hex"
        aria-label={`${label} en hexadecimal`}
        value={hex}
        spellCheck={false}
        onChange={(event) => {
          const next = event.target.value.trim();
          if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next);
        }}
      />
    </div>
  );
}

function FontField({ value, fonts, onChange }) {
  const [open, setOpen] = useState(false);
  const current = fonts.find((font) => font.value === value) || fonts[0];
  return (
    <div className="pf-font">
      <span className="pf-field-label">Fuente</span>
      <button type="button" className="pf-choice" aria-expanded={open} onClick={() => setOpen((currentOpen) => !currentOpen)}>
        <span style={{ fontFamily: current?.value }}>{current?.label}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="pf-font-list" role="listbox" aria-label="Fuente">
          {fonts.map((font) => (
            <button
              key={font.label}
              type="button"
              role="option"
              aria-selected={font.value === value}
              className={font.value === value ? 'is-active' : ''}
              style={{ fontFamily: font.value }}
              onClick={() => { onChange(font.value); setOpen(false); }}
            >
              {font.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ArrowRoutes({ primary, onUpdate }) {
  const route = primary.route || 'straight';
  return (
    <>
      <div className="pf-choices" role="radiogroup" aria-label="Estilo de flecha">
        {[
          ['straight', 'Recta'],
          ['curve', 'Curva'],
          ['elbow', 'Codo'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={route === id}
            className={route === id ? 'is-active' : ''}
            onClick={() => onUpdate({
              route: id,
              bend: id === 'curve' ? (primary.bend || defaultBend(primary.points)) : primary.bend,
            })}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="pf-kicker">Arrastra cada punta. En curva, el punto del centro dobla el trazo.</p>
    </>
  );
}

function TypeControls({ primary, fonts, onUpdate, withText }) {
  const bold = Number(primary.fontWeight) >= 700;
  const italic = primary.fontStyle === 'italic';
  return (
    <div className="pf-type">
      <FontField value={primary.fontFamily} fonts={fonts} onChange={(fontFamily) => onUpdate({ fontFamily })} />
      <Slider label="Tamaño" min={8} max={120} value={primary.fontSize || 16} onChange={(fontSize) => onUpdate({ fontSize })} />
      <div className="pf-type-row" role="group" aria-label="Estilo del texto">
        <button type="button" className={bold ? 'is-active' : ''} aria-pressed={bold} onClick={() => onUpdate({ fontWeight: bold ? 500 : 700 })}>B</button>
        <button type="button" className={italic ? 'is-active' : ''} aria-label="Cursiva" aria-pressed={italic} onClick={() => onUpdate({ fontStyle: italic ? 'normal' : 'italic' })}><Italic size={14} /></button>
        <span className="pf-type-rule" />
        {[
          ['left', 'Izquierda', AlignLeft],
          ['center', 'Centro', AlignCenter],
          ['right', 'Derecha', AlignRight],
        ].map(([align, label, Icon]) => (
          <button key={align} type="button" className={(primary.align || 'center') === align ? 'is-active' : ''} aria-label={label} aria-pressed={(primary.align || 'center') === align} onClick={() => onUpdate({ align })}>
            <Icon size={14} />
          </button>
        ))}
      </div>
      {withText && (
        <label className="pf-field">
          <span>Texto</span>
          <textarea value={primary.text || ''} onChange={(event) => onUpdate({ text: event.target.value })} />
        </label>
      )}
    </div>
  );
}

const EditorInspector = ({
  open,
  tab,
  onTab,
  onToggle,
  primary,
  selectedElements,
  elements,
  selection,
  fonts,
  swatchValue,
  onUpdate,
  onCommit,
  onAlign,
  onSelect,
  onLayer,
  onPreviewMotion,
}) => (
  <aside className={`pf-inspector${open ? '' : ' is-collapsed'}`}>
    <div className="pf-inspector-inner">
      <div className="pf-inspector-head">
        <div className="pf-segment" role="tablist" aria-label="Propiedades">
          {TABS.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'is-active' : ''} onClick={() => onTab(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className="pf-icon-btn" aria-label="Compactar panel" onClick={onToggle}>–</button>
      </div>
      <div className="pf-inspector-body">
        {!primary && <p className="pf-kicker">{selectedElements.length > 1 ? `${selectedElements.length} elementos` : 'Nada seleccionado'}</p>}
        {tab === 'design' && (
          <>
            {selectedElements.length > 1 && (
              <div className="pf-align">
                {[['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha'], ['top', 'Arriba'], ['middle', 'Medio'], ['bottom', 'Abajo']].map(([mode, label]) => (
                  <button key={mode} type="button" onClick={() => onAlign(mode)}>{label}</button>
                ))}
              </div>
            )}
            {primary && (
              <section className="pf-block">
                <h2>Posición y tamaño</h2>
                <label className="pf-field">
                  <span>Nombre</span>
                  <input className="pf-input" value={primary.name || ''} onChange={(event) => onUpdate({ name: event.target.value })} />
                </label>
                <div className="pf-fields">
                  <Stepper label="X" value={primary.x} onChange={(x) => onUpdate({ x })} />
                  <Stepper label="Y" value={primary.y} onChange={(y) => onUpdate({ y })} />
                  {primary.type !== 'line' && <Stepper label="Ancho" min={16} value={primary.width} onChange={(width) => onUpdate({ width })} />}
                  {primary.type !== 'line' && <Stepper label="Alto" min={16} value={primary.height} onChange={(height) => onUpdate({ height })} />}
                  <Stepper label="Rotación" min={-360} max={360} value={primary.rotation || 0} onChange={(rotation) => onUpdate({ rotation })} />
                </div>
              </section>
            )}
            {isArrow(primary) && (
              <section className="pf-block">
                <h2>Flecha</h2>
                <ArrowRoutes primary={primary} onUpdate={onUpdate} />
              </section>
            )}
            {textCapable(primary) && (
              <section className="pf-block">
                <h2>Tipografía</h2>
                <TypeControls primary={primary} fonts={fonts} onUpdate={onUpdate} />
              </section>
            )}
            <section className="pf-block pf-layers">
              <h2>Capas</h2>
              {[...elements].reverse().map((element) => (
                <div key={element.id} className={`pf-layer${selection.includes(element.id) ? ' is-active' : ''}`}>
                  <button type="button" className="pf-layer-name" onClick={() => onSelect(element.id)}>{element.name}</button>
                  <button type="button" className="pf-icon-btn" aria-label="Subir capa" onClick={() => onLayer(element.id, 1)}><ArrowUp size={14} /></button>
                  <button type="button" className="pf-icon-btn" aria-label="Bajar capa" onClick={() => onLayer(element.id, -1)}><ArrowDown size={14} /></button>
                  <button type="button" className="pf-icon-btn" aria-label={element.visible === false ? 'Mostrar' : 'Ocultar'} onClick={() => onCommit(elements.map((item) => item.id === element.id ? { ...item, visible: item.visible === false } : item))}>{element.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                  <button type="button" className="pf-icon-btn" aria-label={element.locked ? 'Desbloquear' : 'Bloquear'} onClick={() => onCommit(elements.map((item) => item.id === element.id ? { ...item, locked: !item.locked } : item))}>{element.locked ? <Lock size={14} /> : <LockOpen size={14} />}</button>
                </div>
              ))}
            </section>
          </>
        )}
        {tab === 'style' && primary && (
          <div className="pf-stack">
            {isArrow(primary) && (
              <section className="pf-block">
                <h2>Flecha</h2>
                <ArrowRoutes primary={primary} onUpdate={onUpdate} />
              </section>
            )}
            <section className="pf-block">
              <h2>Apariencia</h2>
              {isArrow(primary) ? (
                <ColorField label="Color" value={primary.stroke} onChange={(stroke) => onUpdate({ stroke, fill: stroke })} />
              ) : (
                <>
                  <ColorField label={primary.type === 'text' ? 'Color' : 'Relleno'} value={primary.type === 'text' ? swatchValue : primary.fill} fallback="#ffffff" onChange={(color) => onUpdate(primary.type === 'text' ? { textFill: color } : { fill: color })} />
                  <ColorField label="Borde" value={primary.stroke} onChange={(stroke) => onUpdate({ stroke, strokeWidth: primary.strokeWidth || 2 })} />
                </>
              )}
              <Slider label="Grosor" min={0} max={24} value={primary.strokeWidth || 0} onChange={(strokeWidth) => onUpdate({ strokeWidth })} />
              <Slider label="Radio" min={0} max={80} value={primary.radius || 0} onChange={(radius) => onUpdate({ radius })} />
              <Slider label="Sombra" min={0} max={40} value={primary.shadow || 0} onChange={(shadow) => onUpdate({ shadow })} />
              <Slider label="Opacidad" min={0} max={1} step={0.05} value={primary.opacity ?? 1} format={(value) => `${Math.round(value * 100)}%`} onChange={(opacity) => onUpdate({ opacity })} />
            </section>
            {textCapable(primary) && (
              <section className="pf-block">
                <h2>Tipografía</h2>
                <TypeControls primary={primary} fonts={fonts} onUpdate={onUpdate} withText={primary.type !== 'table'} />
              </section>
            )}
            {(primary.type === 'link' || primary.href) && (
              <label className="pf-field">
                <span>Enlace</span>
                <input className="pf-input" value={primary.href || ''} placeholder="https://" onChange={(event) => onUpdate({ href: event.target.value })} />
              </label>
            )}
            {primary.type === 'table' && (
              <section className="pf-block">
                <h2>Celdas</h2>
                <div className="pf-fields">
                  {(primary.cells || []).map((cell, index) => (
                    <label key={index} className="pf-field">
                      <span>Celda {index + 1}</span>
                      <input className="pf-input" value={cell} onChange={(event) => {
                        const cells = (primary.cells || []).slice();
                        cells[index] = event.target.value;
                        onUpdate({ cells });
                      }} />
                    </label>
                  ))}
                </div>
              </section>
            )}
            {primary.credit && <p className="pf-kicker">{primary.credit}</p>}
          </div>
        )}
        {tab === 'style' && !primary && <p className="pf-kicker">Elige un elemento para ver su estilo.</p>}
        {tab === 'motion' && (
          <div className="pf-stack">
            {primary ? (
              <section className="pf-block">
                <h2>Entrada</h2>
                <div className="pf-choices" role="radiogroup" aria-label="Entrada">
                  {MOTION.map((item) => (
                    <button key={item.id} type="button" role="radio" aria-checked={(primary.motion || 'none') === item.id} className={(primary.motion || 'none') === item.id ? 'is-active' : ''} onClick={() => onUpdate({ motion: item.id })}>
                      {item.label}
                    </button>
                  ))}
                </div>
                <Slider label="Duración" min={0.15} max={2} step={0.05} value={primary.motionDuration || 0.45} format={(value) => `${value.toFixed(2)}s`} onChange={(motionDuration) => onUpdate({ motionDuration })} />
                <button type="button" className="pf-action" onClick={() => onPreviewMotion(primary)}>Probar animación</button>
                <p className="pf-kicker">Al presentar, la entrada se reproduce sobre el elemento.</p>
              </section>
            ) : <p className="pf-kicker">Elige un elemento para animarlo.</p>}
          </div>
        )}
      </div>
    </div>
  </aside>
);

export default EditorInspector;
