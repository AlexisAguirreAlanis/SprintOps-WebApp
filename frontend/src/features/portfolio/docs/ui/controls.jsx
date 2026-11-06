import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

const keepFocus = (event) => event.preventDefault();

export function Btn({ icon: Icon, label, onClick, active = false, disabled = false, wide = false, children, title, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`wd-btn${active ? ' is-active' : ''}${wide ? ' is-wide' : ''} ${className}`}
      aria-label={label}
      aria-pressed={active || undefined}
      title={title || label}
      disabled={disabled}
      onMouseDown={keepFocus}
      onClick={onClick}
      {...rest}
    >
      {Icon && <Icon size={16} aria-hidden="true" />}
      {(wide || children) && <span>{children || label}</span>}
    </button>
  );
}

export function Group({ label, children }) {
  return (
    <div className="wd-group" role="group" aria-label={label}>
      <div className="wd-group-body">{children}</div>
      <span className="wd-group-label">{label}</span>
    </div>
  );
}

export function Row({ children }) {
  return <div className="wd-row">{children}</div>;
}

/** Menú desplegable que se pinta en un portal para no recortarse dentro de la cinta. */
export function Menu({ icon: Icon, label, text, children, wide = false, active = false, width = 240, disabled = false, title }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const anchor = useRef(null);
  const panel = useRef(null);
  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const rect = anchor.current.getBoundingClientRect();
    const left = Math.min(rect.left, window.innerWidth - width - 8);
    const below = window.innerHeight - rect.bottom;
    setPos({ left: Math.max(8, left), top: rect.bottom + 4, maxHeight: Math.max(220, below - 16) });
  }, [open, width]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (!panel.current?.contains(event.target) && !anchor.current?.contains(event.target)) close();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        close();
        anchor.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={`wd-btn wd-menu-btn${wide || text ? ' is-wide' : ''}${active || open ? ' is-active' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={title || label}
        disabled={disabled}
        onMouseDown={keepFocus}
        onClick={() => setOpen((value) => !value)}
      >
        {Icon && <Icon size={16} aria-hidden="true" />}
        {(wide || text) && <span>{text || label}</span>}
        <ChevronDown size={12} className="wd-caret" aria-hidden="true" />
      </button>
      {open && pos && createPortal(
        <div ref={panel} className="wd-pop" role="menu" style={{ left: pos.left, top: pos.top, width, maxHeight: pos.maxHeight }} onMouseDown={(event) => { if (!event.target.closest('input, textarea, select')) event.preventDefault(); }}>
          {typeof children === 'function' ? children(close) : children}
        </div>,
        document.body,
      )}
    </>
  );
}

export function Item({ icon: Icon, label, hint, onClick, active = false, disabled = false, close, danger = false, children }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`wd-item${active ? ' is-active' : ''}${danger ? ' is-danger' : ''}`}
      disabled={disabled}
      onClick={() => {
        onClick?.();
        close?.();
      }}
    >
      {Icon ? <Icon size={15} aria-hidden="true" /> : <span className="wd-item-gap" />}
      <span className="wd-item-label">{children || label}</span>
      {hint && <kbd>{hint}</kbd>}
    </button>
  );
}

export function Sep({ label }) {
  return label ? <div className="wd-sep-label">{label}</div> : <div className="wd-sep" role="separator" />;
}

export const SWATCHES = [
  '#000000', '#1e293b', '#475569', '#94a3b8', '#e2e8f0', '#ffffff',
  '#7f1d1d', '#be123c', '#f97316', '#f59e0b', '#facc15', '#fff3a1',
  '#14532d', '#2f6f5e', '#67bfa1', '#b7e4d4', '#0e7490', '#06b6d4',
  '#1e3a8a', '#2563eb', '#93c5fd', '#4338ca', '#7c3aed', '#e3d4f6',
];

export function ColorGrid({ value, onPick, close, allowNone = false, recent = [] }) {
  return (
    <div className="wd-colors">
      {allowNone && <button type="button" className="wd-item" onClick={() => { onPick(''); close?.(); }}>Sin color</button>}
      {recent.length > 0 && <div className="wd-swatches">{recent.map((color) => <button key={color} type="button" className="wd-swatch" style={{ background: color }} aria-label={color} onClick={() => { onPick(color); close?.(); }} />)}</div>}
      <div className="wd-swatches">
        {SWATCHES.map((color) => (
          <button key={color} type="button" className={`wd-swatch${value === color ? ' is-active' : ''}`} style={{ background: color }} aria-label={color} title={color} onClick={() => { onPick(color); close?.(); }} />
        ))}
      </div>
      <label className="wd-custom-color">
        Personalizado
        <input type="color" defaultValue={value || '#2f6f5e'} onChange={(event) => onPick(event.target.value)} />
      </label>
    </div>
  );
}

export function ColorMenu({ icon, label, value, onPick, allowNone = false, swatch }) {
  return (
    <Menu icon={icon} label={label} width={220}>
      {(close) => (
        <>
          <ColorGrid value={value} onPick={onPick} close={close} allowNone={allowNone} />
          {swatch}
        </>
      )}
    </Menu>
  );
}

export function Select({ label, value, onChange, options, width = 120, title }) {
  return (
    <label className="wd-select" style={{ width }} title={title || label}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        {options.map((option) => {
          const [val, text] = Array.isArray(option) ? option : [option, option];
          return <option key={val} value={val}>{text}</option>;
        })}
      </select>
    </label>
  );
}

export function NumberField({ label, value, onChange, min, max, step = 1, width = 64, suffix }) {
  return (
    <label className="wd-number" style={{ width }} title={label}>
      <span className="sr-only">{label}</span>
      <input type="number" value={value} min={min} max={max} step={step} aria-label={label} onChange={(event) => onChange(Number(event.target.value))} />
      {suffix && <em>{suffix}</em>}
    </label>
  );
}

export function GridPicker({ onPick, close, max = 10 }) {
  const [hover, setHover] = useState([0, 0]);
  return (
    <div className="wd-gridpick">
      <div className="wd-gridpick-cells" onMouseLeave={() => setHover([0, 0])}>
        {Array.from({ length: max * max }, (_, index) => {
          const r = Math.floor(index / max) + 1;
          const c = (index % max) + 1;
          return (
            <button
              key={index}
              type="button"
              aria-label={`${r} × ${c}`}
              className={r <= hover[0] && c <= hover[1] ? 'is-on' : ''}
              onMouseEnter={() => setHover([r, c])}
              onFocus={() => setHover([r, c])}
              onClick={() => { onPick(r, c); close?.(); }}
            />
          );
        })}
      </div>
      <span>{hover[0] ? `${hover[0]} × ${hover[1]}` : 'Elige filas y columnas'}</span>
    </div>
  );
}

export function useFilePicker() {
  const inputRef = useRef(null);
  const resolver = useRef(null);
  const pick = useCallback((accept = '*/*', multiple = false) => new Promise((resolve) => {
    resolver.current = resolve;
    const input = inputRef.current;
    input.accept = accept;
    input.multiple = multiple;
    input.value = '';
    input.click();
  }), []);
  const input = (
    <input
      ref={inputRef}
      type="file"
      hidden
      onChange={(event) => {
        const files = [...(event.target.files || [])];
        resolver.current?.(event.target.multiple ? files : files[0] || null);
        resolver.current = null;
      }}
    />
  );
  return [pick, input];
}
