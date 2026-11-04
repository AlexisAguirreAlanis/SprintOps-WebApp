import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeftRight,
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
import { DASH_OPTIONS, endAngle, HEAD_OPTIONS, parallelCopies, ROUTE_OPTIONS, trimPolyline } from './connectorGeometry';

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

function usePanelMotion(open) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = setTimeout(() => setMounted(false), 180);
    return () => clearTimeout(timer);
  }, [open]);
  return [mounted, visible];
}

function FontField({ value, fonts, onChange }) {
  const [open, setOpen] = useState(false);
  const [mounted, visible] = usePanelMotion(open);
  const current = fonts.find((font) => font.value === value) || fonts[0];
  return (
    <div className="pf-font">
      <span className="pf-field-label">Fuente</span>
      <button type="button" className="pf-choice" aria-expanded={open} onClick={() => setOpen((currentOpen) => !currentOpen)}>
        <span style={{ fontFamily: current?.value }}>{current?.label}</span>
        <ChevronDown size={15} />
      </button>
      {mounted && (
        <div className={`pf-font-list${visible ? ' is-open' : ''}`} role="listbox" aria-label="Fuente">
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

const INK_COLORS = ['#1e293b', '#2f6f5e', '#67bfa1', '#c74634', '#d97706', '#3b6ea5', '#ffffff'];
const LABEL_SIZES = [11, 13, 15, 18];
const WIRE_OPTIONS = [[1, 'Sencilla'], [2, 'Doble'], [3, 'Triple']];

function headReach(kind) {
  if (kind === 'triangle') return 12;
  if (kind === 'ring' || kind === 'disc') return 10;
  if (kind === 'diamond' || kind === 'gem') return 14;
  if (kind === 'square' || kind === 'box') return 11;
  return 0;
}

function HeadMark({ kind }) {
  if (kind === 'triangle') return <polygon points="0,0 -12,5 -12,-5" fill="currentColor" />;
  if (kind === 'open') return <polyline points="-12,5.2 0,0 -12,-5.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />;
  if (kind === 'ring') return <circle cx="-5.2" cy="0" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.7" />;
  if (kind === 'disc') return <circle cx="-5.2" cy="0" r="4.6" fill="currentColor" />;
  if (kind === 'diamond') return <polygon points="0,0 -7,5 -14,0 -7,-5" fill="none" stroke="currentColor" strokeWidth="1.7" />;
  if (kind === 'gem') return <polygon points="0,0 -7,5 -14,0 -7,-5" fill="currentColor" />;
  if (kind === 'square') return <rect x="-11" y="-5" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.7" />;
  if (kind === 'box') return <rect x="-11" y="-5" width="10" height="10" fill="currentColor" />;
  if (kind === 'bar') return <line x1="0" y1="-6.5" x2="0" y2="6.5" stroke="currentColor" strokeWidth="1.8" />;
  if (kind === 'crow') return <polyline points="-12,5.5 0,0 -12,0 0,0 -12,-5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />;
  return null;
}

function EndSample({ kind, side }) {
  const tip = 68;
  const y = 11;
  return (
    <svg className="pf-end-sample" viewBox="0 0 78 22" aria-hidden="true">
      <g transform={side === 'start' ? 'translate(78 0) scale(-1 1)' : undefined}>
        <line x1="6" y1={y} x2={tip - headReach(kind)} y2={y} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        {kind !== 'none' && (
          <g transform={`translate(${tip} ${y})`}>
            <HeadMark kind={kind} />
          </g>
        )}
      </g>
    </svg>
  );
}

function RouteGlyph({ route }) {
  const pen = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (route === 'curve') return <path d="M6 22 Q 20 6 34 22" {...pen} />;
  if (route === 'elbow') return <path d="M6 24 H 20 V 10 H 34" {...pen} />;
  if (route === 'round') return <path d="M6 24 H 16 Q 22 24 22 16 V 12 Q 22 8 28 8 H 34" {...pen} />;
  return <path d="M6 16 H 34" {...pen} />;
}

function WireGlyph({ count, wide }) {
  const rows = count === 3 ? [3, 8, 13] : count === 2 ? [5, 11] : [8];
  return rows.map((y) => <line key={y} x1="1" y1={y} x2={wide ? 46 : 17} y2={y} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />);
}

function previewRoute(route) {
  if (route === 'curve') {
    const points = [];
    for (let step = 0; step <= 24; step += 1) {
      const t = step / 24;
      const u = 1 - t;
      points.push(u * u * 30 + 2 * u * t * 110 + t * t * 190, u * u * 54 + 2 * u * t * 12 + t * t * 54);
    }
    return points;
  }
  if (route === 'elbow') return [30, 54, 110, 54, 110, 20, 190, 20];
  if (route === 'round') {
    const points = [30, 54];
    const radius = 18;
    for (let step = 0; step <= 8; step += 1) {
      const t = (step / 8) * (Math.PI / 2);
      points.push(92 + radius * Math.sin(t), 54 - radius * (1 - Math.cos(t)));
    }
    for (let step = 0; step <= 8; step += 1) {
      const t = (step / 8) * (Math.PI / 2);
      points.push(110 + radius * (1 - Math.cos(t)), 36 - radius * Math.sin(t));
    }
    points.push(190, 18);
    return points;
  }
  return [30, 36, 190, 36];
}

function ConnectorPreview({ route, start, end, dash, color, wires }) {
  const raw = previewRoute(route);
  const drawn = trimPolyline(raw, headReach(start), headReach(end));
  const copies = parallelCopies(drawn, wires, 5);
  const pattern = dash === 'dashed' ? '7 5' : dash === 'dotted' ? '1.2 6' : dash === 'dashdot' ? '7 4 1.2 4' : undefined;
  const startX = raw[0];
  const startY = raw[1];
  const endX = raw[raw.length - 2];
  const endY = raw[raw.length - 1];
  return (
    <svg viewBox="0 0 220 72" aria-hidden="true">
      {copies.map((points, index) => (
        <polyline key={index} points={points.join(' ')} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={pattern} />
      ))}
      {start !== 'none' && (
        <g transform={`translate(${startX} ${startY}) rotate(${(endAngle(raw, false) * 180) / Math.PI})`} style={{ color }}>
          <HeadMark kind={start} />
        </g>
      )}
      {end !== 'none' && (
        <g transform={`translate(${endX} ${endY}) rotate(${(endAngle(raw, true) * 180) / Math.PI})`} style={{ color }}>
          <HeadMark kind={end} />
        </g>
      )}
    </svg>
  );
}

function MiniMenu({ label, open, onToggle, summary, children }) {
  const ref = useRef(null);
  const popRef = useRef(null);
  const [box, setBox] = useState(null);
  const [mounted, visible] = usePanelMotion(open);
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      const target = event.target;
      if (ref.current?.contains(target) || popRef.current?.contains(target)) return;
      onToggle();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') onToggle();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onToggle]);
  useLayoutEffect(() => {
    if (!mounted) return undefined;
    const place = () => {
      const button = ref.current?.querySelector('button');
      const pop = popRef.current;
      if (!button || !pop) return;
      const rect = button.getBoundingClientRect();
      const margin = 10;
      const frame = pop.offsetHeight - pop.clientHeight;
      const content = Math.max(pop.scrollHeight + frame, 120);
      const room = window.innerHeight - margin * 2;
      const preferred = Math.min(content, room);
      let top = rect.bottom + 6;
      let upward = false;
      if (top + preferred > window.innerHeight - margin) {
        const above = rect.top - 6 - preferred;
        if (above >= margin) {
          top = above;
          upward = true;
        } else {
          top = margin;
        }
      }
      top = Math.max(margin, Math.min(top, window.innerHeight - margin - 120));
      const maxHeight = Math.min(content, window.innerHeight - margin - top);
      const width = Math.max(rect.width, 210);
      let left = rect.left;
      if (left + width > window.innerWidth - margin) left = Math.max(margin, rect.right - width);
      setBox((current) => (
        current
        && current.top === top
        && current.left === left
        && current.width === width
        && current.maxHeight === maxHeight
        && current.upward === upward
          ? current
          : { top, left, width, maxHeight, upward }
      ));
    };
    place();
    const scroller = ref.current?.closest('.pf-inspector-body');
    scroller?.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    const observer = new ResizeObserver(place);
    if (scroller) observer.observe(scroller);
    observer.observe(document.documentElement);
    return () => {
      scroller?.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      observer.disconnect();
    };
  }, [mounted]);
  return (
    <div className={`pf-mini${open ? ' is-open' : ''}`} ref={ref}>
      <button type="button" className="pf-mini-btn" aria-expanded={open} aria-label={label} onClick={onToggle}>
        {summary}
        <ChevronDown size={14} />
      </button>
      {mounted && createPortal(
        <div
          ref={popRef}
          className={`pf-mini-pop pf-mini-float${visible ? ' is-open' : ''}${box?.upward ? ' is-up' : ''}`}
          style={box ? { top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight } : { top: -9999, left: 0 }}
          role="listbox"
          aria-label={label}
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}

function WidthField({ value, onChange }) {
  const [draft, setDraft] = useState(null);
  const skip = useRef(false);
  return (
    <label className="pf-width">
      <input
        aria-label="Grosor"
        inputMode="numeric"
        value={draft ?? `${value} px`}
        onFocus={(event) => {
          setDraft(String(value));
          requestAnimationFrame(() => event.target.select());
        }}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, '').slice(0, 3))}
        onBlur={() => {
          if (skip.current) {
            skip.current = false;
            setDraft(null);
            return;
          }
          const next = Math.round(Number(draft));
          setDraft(null);
          if (Number.isFinite(next)) onChange(clamp(next, 1, 100));
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            skip.current = true;
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

function ConnectorPanel({ primary, onUpdate }) {
  const [menu, setMenu] = useState(null);
  const [advanced, setAdvanced] = useState(false);
  const route = primary.route || 'straight';
  const start = primary.headStart || 'none';
  const end = primary.headEnd || 'triangle';
  const dash = primary.dash || 'solid';
  const color = safeHex(primary.stroke, '#1e293b');
  const width = clamp(Math.round(primary.strokeWidth || 2), 1, 100);
  const wires = primary.lineCount === 2 || primary.lineCount === 3 ? primary.lineCount : 1;
  const cap = primary.cap || 'round';
  const labelOn = Boolean(primary.label);
  const close = () => setMenu(null);
  const toggle = (id) => setMenu((current) => (current === id ? null : id));
  const setRoute = (id) => onUpdate({
    route: id,
    bend: id === 'curve' ? (primary.bend || defaultBend(primary.points)) : primary.bend,
  });

  return (
    <section className="pf-block pf-connector">
      <h2>Conector</h2>
      <div className="pf-connector-preview">
        <ConnectorPreview route={route} start={start} end={end} dash={dash} color={color} wires={wires} />
      </div>
      <p className="pf-connector-label">Recorrido</p>
      <div className="pf-route-icons" role="radiogroup" aria-label="Recorrido">
        {ROUTE_OPTIONS.map(([id, name]) => (
          <button key={id} type="button" role="radio" aria-checked={route === id} aria-label={name} className={route === id ? 'is-active' : ''} onClick={() => setRoute(id)}>
            <svg viewBox="0 0 40 32"><RouteGlyph route={id} /></svg>
          </button>
        ))}
      </div>
      <p className="pf-connector-label">Apariencia</p>
      <div className="pf-appear-caps" aria-hidden="true">
        <span>Color</span>
        <span>Grosor</span>
        <span>Estilo</span>
        <span>Línea</span>
      </div>
      <div className="pf-appear">
        <MiniMenu label="Color" open={menu === 'color'} onToggle={() => toggle('color')} summary={<i className="pf-swatch" style={{ background: color }} />}>
          <div className="pf-swatch-row">
            {INK_COLORS.map((ink) => (
              <button key={ink} type="button" className={color.toLowerCase() === ink ? 'is-active' : ''} style={{ background: ink }} aria-label={ink} onClick={() => { onUpdate({ stroke: ink, fill: ink }); close(); }} />
            ))}
            <label className="pf-color" style={{ background: color }}>
              <input type="color" value={color} aria-label="Otro color" onChange={(event) => onUpdate({ stroke: event.target.value, fill: event.target.value })} />
            </label>
          </div>
        </MiniMenu>
        <WidthField value={width} onChange={(strokeWidth) => onUpdate({ strokeWidth })} />
        <MiniMenu label="Estilo de línea" open={menu === 'dash'} onToggle={() => toggle('dash')} summary={<svg viewBox="0 0 36 12" className="pf-dash-icon"><line x1="2" y1="6" x2="34" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={dash === 'dashed' ? '6 3' : dash === 'dotted' ? '1 4' : dash === 'dashdot' ? '6 3 1 3' : undefined} /></svg>}>
          {DASH_OPTIONS.map(([id, name]) => (
            <button key={id} type="button" className={dash === id ? 'is-active' : ''} onClick={() => { onUpdate({ dash: id, cap: id === 'dotted' ? 'round' : cap }); close(); }}>
              <svg viewBox="0 0 48 12"><line x1="2" y1="6" x2="46" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={id === 'dashed' ? '7 4' : id === 'dotted' ? '1 5' : id === 'dashdot' ? '7 3 1 3' : undefined} /></svg>
              {name}
            </button>
          ))}
        </MiniMenu>
        <MiniMenu label="Línea" open={menu === 'lines'} onToggle={() => toggle('lines')} summary={<svg viewBox="0 0 18 16" className="pf-wire-icon"><WireGlyph count={wires} /></svg>}>
          {WIRE_OPTIONS.map(([count, name]) => (
            <button key={count} type="button" className={wires === count ? 'is-active' : ''} onClick={() => { onUpdate({ lineCount: count }); close(); }}>
              <svg viewBox="0 0 48 16"><WireGlyph count={count} wide /></svg>
              {name}
            </button>
          ))}
        </MiniMenu>
      </div>
      <p className="pf-connector-label">Extremos</p>
      <div className="pf-ends">
        <div className="pf-end">
          <span>Inicio</span>
          <MiniMenu label="Inicio" open={menu === 'start'} onToggle={() => toggle('start')} summary={<EndSample kind={start} side="start" />}>
            {HEAD_OPTIONS.map(([id, name]) => (
              <button key={id} type="button" className={start === id ? 'is-active' : ''} onClick={() => { onUpdate({ headStart: id }); close(); }}>
                <EndSample kind={id} side="start" />
                {name}
              </button>
            ))}
          </MiniMenu>
        </div>
        <button type="button" className="pf-swap" aria-label="Invertir extremos" onClick={() => onUpdate({ headStart: end, headEnd: start })}>
          <ArrowLeftRight size={15} />
        </button>
        <div className="pf-end">
          <span>Final</span>
          <MiniMenu label="Final" open={menu === 'end'} onToggle={() => toggle('end')} summary={<EndSample kind={end} side="end" />}>
            {HEAD_OPTIONS.map(([id, name]) => (
              <button key={id} type="button" className={end === id ? 'is-active' : ''} onClick={() => { onUpdate({ headEnd: id }); close(); }}>
                <EndSample kind={id} side="end" />
                {name}
              </button>
            ))}
          </MiniMenu>
        </div>
      </div>
      <div className="pf-label-head">
        <p className="pf-connector-label">Etiqueta</p>
        <button type="button" className={`pf-switch${labelOn ? ' is-on' : ''}`} aria-pressed={labelOn} aria-label="Etiqueta" onClick={() => onUpdate(labelOn ? { label: '' } : { label: 'Etiqueta' })}>
          <i />
        </button>
      </div>
      {labelOn && (
        <>
          <input className="pf-input" aria-label="Texto de la etiqueta" value={primary.label} onChange={(event) => onUpdate({ label: event.target.value })} />
          <div className="pf-label-tools">
            <div className="pf-type-row" role="group" aria-label="Alineación de la etiqueta">
              {[
                ['left', 'Izquierda', AlignLeft],
                ['center', 'Centro', AlignCenter],
                ['right', 'Derecha', AlignRight],
              ].map(([align, name, Icon]) => (
                <button key={align} type="button" className={(primary.align || 'center') === align ? 'is-active' : ''} aria-label={name} aria-pressed={(primary.align || 'center') === align} onClick={() => onUpdate({ align })}>
                  <Icon size={14} />
                </button>
              ))}
            </div>
            <MiniMenu label="Tamaño de etiqueta" open={menu === 'size'} onToggle={() => toggle('size')} summary={<span className="pf-label-size">A</span>}>
              {LABEL_SIZES.map((size) => (
                <button key={size} type="button" className={(primary.fontSize || 13) === size ? 'is-active' : ''} onClick={() => { onUpdate({ fontSize: size }); close(); }}>{size}</button>
              ))}
            </MiniMenu>
          </div>
        </>
      )}
      <button type="button" className={`pf-advanced${advanced ? ' is-open' : ''}`} aria-expanded={advanced} onClick={() => setAdvanced((open) => !open)}>
        Opciones avanzadas
        <ChevronDown size={16} />
      </button>
      {advanced && (
        <div className="pf-advanced-body">
          <Slider label="Cabeza" min={10} max={40} value={primary.headSize || 16} onChange={(headSize) => onUpdate({ headSize })} />
          <Slider label="Posición" min={0} max={1} step={0.05} value={primary.labelT ?? 0.5} format={(value) => `${Math.round(value * 100)}%`} onChange={(labelT) => onUpdate({ labelT })} />
          <Slider label="Opacidad" min={0} max={1} step={0.05} value={primary.opacity ?? 1} format={(value) => `${Math.round(value * 100)}%`} onChange={(opacity) => onUpdate({ opacity })} />
          <div className="pf-choices" role="radiogroup" aria-label="Unión">
            {[
              ['round', 'Redonda'],
              ['bevel', 'Bisel'],
              ['miter', 'Ángulo'],
            ].map(([id, name]) => (
              <button key={id} type="button" role="radio" aria-checked={(primary.join || 'round') === id} className={(primary.join || 'round') === id ? 'is-active' : ''} onClick={() => onUpdate({ join: id })}>
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
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
        <button type="button" className={primary.textDecoration === 'underline' ? 'is-active' : ''} aria-label="Subrayado" aria-pressed={primary.textDecoration === 'underline'} onClick={() => onUpdate({ textDecoration: primary.textDecoration === 'underline' ? '' : 'underline' })}>S</button>
        <button type="button" className={primary.textDecoration === 'line-through' ? 'is-active' : ''} aria-label="Tachado" aria-pressed={primary.textDecoration === 'line-through'} onClick={() => onUpdate({ textDecoration: primary.textDecoration === 'line-through' ? '' : 'line-through' })}>T</button>
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
            {isArrow(primary) && <ConnectorPanel primary={primary} onUpdate={onUpdate} />}
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
            {isArrow(primary) && <ConnectorPanel primary={primary} onUpdate={onUpdate} />}
            {!isArrow(primary) && (
            <section className="pf-block">
              <h2>Apariencia</h2>
              {(
                <>
                  <ColorField label={primary.type === 'text' ? 'Color' : 'Relleno'} value={primary.type === 'text' ? swatchValue : primary.fill} fallback="#ffffff" onChange={(color) => onUpdate(primary.type === 'text' ? { textFill: color } : { fill: color })} />
                  <ColorField label="Borde" value={primary.stroke} onChange={(stroke) => onUpdate({ stroke, strokeWidth: primary.strokeWidth || 2 })} />
                </>
              )}
              <Slider label="Grosor" min={0} max={24} value={primary.strokeWidth || 0} onChange={(strokeWidth) => onUpdate({ strokeWidth })} />
              {primary.type !== 'line' && primary.type !== 'ellipse' && (
                <>
                  <Slider label="Radio" min={0} max={80} value={primary.radii ? 0 : (primary.radius || 0)} onChange={(radius) => onUpdate({ radius, radii: null })} />
                  <button type="button" className="pf-action" onClick={() => onUpdate(primary.radii ? { radii: null } : { radii: [primary.radius || 0, primary.radius || 0, primary.radius || 0, primary.radius || 0] })}>
                    {primary.radii ? 'Unificar esquinas' : 'Redondear cada esquina'}
                  </button>
                  {primary.radii && (
                    <div className="pf-fields">
                      {[
                        ['Superior izquierda', 0],
                        ['Superior derecha', 1],
                        ['Inferior derecha', 2],
                        ['Inferior izquierda', 3],
                      ].map(([label, index]) => (
                        <Stepper key={label} label={label} min={0} value={primary.radii[index] || 0} onChange={(value) => {
                          const radii = primary.radii.slice();
                          radii[index] = value;
                          onUpdate({ radii });
                        }} />
                      ))}
                    </div>
                  )}
                </>
              )}
              <Slider label="Sombra" min={0} max={40} value={primary.shadow || 0} onChange={(shadow) => onUpdate({ shadow })} />
              <Slider label="Opacidad" min={0} max={1} step={0.05} value={primary.opacity ?? 1} format={(value) => `${Math.round(value * 100)}%`} onChange={(opacity) => onUpdate({ opacity })} />
            </section>
            )}
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
