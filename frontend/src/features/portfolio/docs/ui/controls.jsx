import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { FONTS } from '../fonts';
import { ColorGrid } from './colorPicker';

export { ColorGrid };
import { holdSelection } from '../engine/core';

const keepFocus = (event) => event.preventDefault();

export function ScrollPane({ children, maxHeight }) {
  const body = useRef(null);
  const drag = useRef(null);
  const edge = useRef(false);
  const hideTimer = useRef(0);
  const [metrics, setMetrics] = useState({ shown: false, top: 0, height: 28 });
  const [live, setLive] = useState(false);
  const [hot, setHot] = useState(false);
  const [grabbing, setGrabbing] = useState(false);

  const measure = useCallback(() => {
    const el = body.current;
    if (!el) return;
    const shown = el.scrollHeight > el.clientHeight + 1;
    const view = el.clientHeight;
    const height = shown ? Math.max(28, Math.min(view - 6, (view / el.scrollHeight) * view)) : view;
    const travel = Math.max(1, view - height);
    const top = shown ? (el.scrollTop / Math.max(1, el.scrollHeight - view)) * travel : 0;
    setMetrics((prev) => (
      prev.shown === shown && Math.abs(prev.top - top) < 0.5 && Math.abs(prev.height - height) < 0.5
        ? prev
        : { shown, top, height }
    ));
  }, []);

  const armHide = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (edge.current || drag.current) return;
      setLive(false);
      setHot(false);
    }, 700);
  }, []);

  const reveal = useCallback(() => {
    setLive(true);
    armHide();
  }, [armHide]);

  useLayoutEffect(() => {
    measure();
    const el = body.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(hideTimer.current);
    };
  }, [measure, children]);

  const onThumbDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const el = body.current;
    if (!el) return;
    drag.current = { y: event.clientY, scroll: el.scrollTop };
    setGrabbing(true);
    setLive(true);
    window.clearTimeout(hideTimer.current);
    const move = (ev) => {
      const view = el.clientHeight;
      const thumb = Math.max(28, Math.min(view - 6, (view / el.scrollHeight) * view));
      const travel = Math.max(1, view - thumb);
      el.scrollTop = drag.current.scroll + ((ev.clientY - drag.current.y) / travel) * (el.scrollHeight - view);
    };
    const up = () => {
      drag.current = null;
      setGrabbing(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      armHide();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onTrackDown = (event) => {
    if (event.target !== event.currentTarget) return;
    const el = body.current;
    if (!el) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    el.scrollTop = ratio * el.scrollHeight - el.clientHeight / 2;
    reveal();
  };

  const onPaneMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const near = event.clientX >= rect.right - 18;
    edge.current = near;
    if (near) reveal();
  };

  return (
    <div
      className={`wd-scrollpane${live ? ' is-on' : ''}${hot ? ' is-hot' : ''}${grabbing ? ' is-drag' : ''}`}
      style={maxHeight ? { maxHeight } : undefined}
      onPointerMove={onPaneMove}
      onPointerLeave={() => { edge.current = false; armHide(); }}
    >
      <div ref={body} className="wd-scrollpane-body" style={{ maxHeight: maxHeight || undefined, paddingRight: metrics.shown ? 14 : 0 }} data-hide-scrollbar onScroll={() => { measure(); reveal(); }}>
        {children}
      </div>
      {metrics.shown && (
        <div className="wd-scrollpane-track" onMouseDown={onTrackDown}>
          <span
            style={{ height: metrics.height, transform: `translateY(${metrics.top}px)` }}
            onPointerDown={onThumbDown}
            onPointerEnter={() => setHot(true)}
            onPointerLeave={() => { if (!drag.current) setHot(false); }}
          />
        </div>
      )}
    </div>
  );
}

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

export function Group({ label, children, grow = false, weight }) {
  return (
    <div className={`wd-group${grow ? ' is-grow' : ''}`} style={weight ? { flexGrow: weight } : undefined} role="group" aria-label={label}>
      <div className="wd-group-body">{children}</div>
      <span className="wd-group-label">{label}</span>
    </div>
  );
}

export function Row({ children }) {
  return <div className="wd-row">{children}</div>;
}

/** Menú desplegable que se pinta en un portal para no recortarse dentro de la cinta. */
export function Menu({ icon: Icon, label, text, children, wide = false, active = false, width = 240, limit = 360, menuClass = '', scroll = false, bare = false, disabled = false, title, mark = '', opened, onOpenChange }) {
  const [innerOpen, setInnerOpen] = useState(false);
  const controlled = opened !== undefined;
  const open = controlled ? opened : innerOpen;
  const openRef = useRef(open);
  openRef.current = open;
  const setOpen = useCallback((value) => {
    const next = typeof value === 'function' ? value(openRef.current) : value;
    if (!controlled) setInnerOpen(next);
    onOpenChange?.(next);
  }, [controlled, onOpenChange]);
  const [alive, setAlive] = useState(false);
  const [pos, setPos] = useState(null);
  const anchor = useRef(null);
  const panel = useRef(null);
  const close = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    if (open) {
      setAlive(true);
      return undefined;
    }
    if (!alive) return undefined;
    const timer = setTimeout(() => setAlive(false), 150);
    return () => clearTimeout(timer);
  }, [open, alive]);

  useLayoutEffect(() => {
    if (!open || !anchor.current) return undefined;
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 12;
      const below = window.innerHeight - rect.bottom - margin;
      const above = rect.top - margin;
      const up = below < Math.min(limit, 220) && above > below;
      const maxHeight = Math.max(96, Math.min(limit, up ? above : below));
      const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
      setPos(up
        ? { left, bottom: window.innerHeight - rect.top + 6, maxHeight, up: true }
        : { left, top: rect.bottom + 6, maxHeight, up: false });
    };
    place();
    window.addEventListener('resize', place);
    const frame = requestAnimationFrame(() => panel.current?.querySelector('.wd-item.is-active')?.scrollIntoView({ block: 'nearest' }));
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', place);
    };
  }, [open, width, limit]);

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
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
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
        {Icon && (
          <span className={`wd-ico${mark ? ' has-mark' : ''}`}>
            <Icon size={16} aria-hidden="true" />
            {mark ? <i style={{ background: mark }} /> : null}
          </span>
        )}
        {(wide || text) && <span>{text || label}</span>}
        <ChevronDown size={12} className="wd-caret" aria-hidden="true" />
      </button>
      {alive && pos && createPortal(
        <div ref={panel} className={`wd-pop is-clamped${bare ? ' is-bare' : ''}${menuClass ? ` ${menuClass}` : ''}${open ? '' : ' is-out'}`} role="menu" style={{ left: pos.left, width, maxHeight: pos.maxHeight, ...(pos.up ? { top: 'auto', bottom: pos.bottom } : { top: pos.top }) }} onMouseDown={(event) => { if (!event.target.closest('input, textarea, select, .wd-symbol-tabs, .wd-eq-panel')) event.preventDefault(); }}>
          {bare ? (typeof children === 'function' ? children(close) : children) : (
            <ScrollPane maxHeight={Math.max(80, pos.maxHeight - 8)}>{typeof children === 'function' ? children(close) : children}</ScrollPane>
          )}
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

export function FontField({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [alive, setAlive] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState(null);
  const anchor = useRef(null);
  const panel = useRef(null);
  const needle = String(value || '').replace(/["']/g, '').split(',')[0].trim().toLowerCase();
  const current = needle
    ? FONTS.find(([, name]) => name.toLowerCase() === needle) || FONTS.find(([stack]) => stack.replace(/["']/g, '').split(',')[0].trim().toLowerCase() === needle)
    : null;
  const label = current?.[1] || (needle ? value : 'Fuente');
  const searching = query.trim() && query.trim().toLowerCase() !== label.toLowerCase();
  const filtered = searching ? FONTS.filter(([, name]) => name.toLowerCase().includes(query.trim().toLowerCase())) : FONTS;

  useEffect(() => {
    if (open) {
      setAlive(true);
      return undefined;
    }
    if (!alive) return undefined;
    const timer = setTimeout(() => setAlive(false), 150);
    return () => clearTimeout(timer);
  }, [open, alive]);

  useLayoutEffect(() => {
    if (!open || !anchor.current) return undefined;
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const up = below < 180 && above > below;
      const maxHeight = Math.max(120, Math.min(248, up ? above : below));
      setPos({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 228)),
        width: Math.max(rect.width, 210),
        maxHeight,
        ...(up ? { top: 'auto', bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 4, bottom: 'auto' }),
      });
    };
    place();
    window.addEventListener('resize', place);
    const frame = requestAnimationFrame(() => panel.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }));
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (!panel.current?.contains(event.target) && !anchor.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (stack) => {
    onChange(stack);
    setQuery('');
    setOpen(false);
  };

  return (
    <span className="wd-picker is-font" ref={anchor}>
      <input
        className="wd-font-input"
        aria-label="Fuente"
        value={open ? query : label}
        placeholder={label}
        onMouseDown={() => holdSelection(document.querySelector('.wd-desk'))}
        onFocus={(event) => { setQuery(label); setOpen(true); requestAnimationFrame(() => event.target.select()); }}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && filtered[0]) { event.preventDefault(); choose(filtered[0][0]); }
        }}
      />
      {alive && pos && createPortal(
        <div ref={panel} className={`wd-pop wd-font-pop is-clamped${open ? '' : ' is-out'}`} role="listbox" aria-label="Fuentes" style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight }}>
          <ScrollPane maxHeight={Math.max(96, pos.maxHeight - 8)}>
            {filtered.length === 0 && <p className="wd-font-empty">Sin coincidencias</p>}
            {filtered.map(([stack, name]) => (
              <button key={name} type="button" role="option" aria-selected={name === label} className={name === label ? 'is-active' : ''} style={{ fontFamily: stack }} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(stack)}>
                {name}
              </button>
            ))}
          </ScrollPane>
        </div>,
        document.body,
      )}
    </span>
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

export function Select({ label, value, onChange, options, width = 120, title, quiet = false, className = '' }) {
  const items = options.map((option) => {
    const [val, text] = Array.isArray(option) ? option : [option, option];
    return { value: String(val), text: String(text) };
  });
  const current = items.find((option) => option.value === String(value)) || items[0];
  const fontOf = (option) => (option.value.includes(',') || option.value.includes('"') ? option.value : undefined);
  const compact = className.includes('is-size');
  return (
    <span className={`wd-picker${quiet ? ' is-quiet' : ''} ${className}`} style={width ? { width } : undefined} title={title || label}>
      <Menu label={label} text={current?.text || '—'} wide width={compact ? 88 : Math.max(width, 196)} limit={compact ? 196 : 360} menuClass={compact ? 'is-size-menu' : ''} scroll={compact}>
        {(close) => items.filter((option) => option.value !== '').map((option) => (
          <Item
            key={`${option.value}-${option.text}`}
            label={option.text}
            active={option.value === String(value)}
            close={close}
            onClick={() => onChange(option.value)}
          >
            <span style={fontOf(option) ? { fontFamily: fontOf(option) } : undefined}>{option.text}</span>
          </Item>
        ))}
      </Menu>
    </span>
  );
}

export function NumberField({ label, value, onChange, min = -9999, max = 9999, step = 1, width = 88, suffix }) {
  const numeric = Number(value);
  const shown = Number.isFinite(numeric) ? numeric : 0;
  const clamp = (next) => Math.min(max, Math.max(min, Math.round(next * 1000) / 1000));
  const commit = (next) => {
    if (!Number.isFinite(next)) return;
    onChange(clamp(next));
  };
  return (
    <span className="wd-stepper" style={{ width }} title={label}>
      <button type="button" aria-label={`Disminuir ${label}`} onMouseDown={keepFocus} onClick={() => commit(shown - step)}>−</button>
      <input
        inputMode="decimal"
        aria-label={label}
        value={shown}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (event.target.value === '' || event.target.value === '-') return;
          commit(next);
        }}
      />
      {suffix && <em>{suffix}</em>}
      <button type="button" aria-label={`Aumentar ${label}`} onMouseDown={keepFocus} onClick={() => commit(shown + step)}>+</button>
    </span>
  );
}

export function GridPicker({ onPick, close, cols = 10, rows = 8 }) {
  const [hover, setHover] = useState([0, 0]);
  return (
    <div className="wd-gridpick" onMouseLeave={() => setHover([0, 0])}>
      <div className="wd-gridpick-head">
        <strong>Insertar tabla</strong>
        <span>{hover[0] ? `${hover[0]} × ${hover[1]}` : 'Elige el tamaño'}</span>
      </div>
      <div className="wd-gridpick-cells" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: rows * cols }, (_, index) => {
          const r = Math.floor(index / cols) + 1;
          const c = (index % cols) + 1;
          const on = r <= hover[0] && c <= hover[1];
          const tip = r === hover[0] && c === hover[1];
          return (
            <button
              key={index}
              type="button"
              aria-label={`${r} por ${c}`}
              className={on ? `is-on${tip ? ' is-tip' : ''}` : ''}
              onMouseEnter={() => setHover([r, c])}
              onFocus={() => setHover([r, c])}
              onClick={() => { onPick(r, c); close?.(); }}
            />
          );
        })}
      </div>
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
