import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bold, Highlighter, Italic, Palette, Strikethrough, Underline } from 'lucide-react';
import { applyTransform } from '../engine/objects';
import { holdSelection } from '../engine/core';
import { SIZES } from '../ribbon/HomeTab';
import { Btn, ColorGrid, FontField, Menu, Select } from './controls';

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** Manejadores de redimensión, rotación y arrastre del objeto seleccionado. */
export function ObjectHandles({ el, deskEl, zoom, version, onChange, onCommit }) {
  const [rect, setRect] = useState(null);
  const drag = useRef(null);

  useLayoutEffect(() => {
    if (!el?.isConnected || !deskEl) {
      setRect(null);
      return;
    }
    const measure = () => {
      const r = el.getBoundingClientRect();
      const d = deskEl.getBoundingClientRect();
      setRect({ left: r.left - d.left + deskEl.scrollLeft, top: r.top - d.top + deskEl.scrollTop, width: r.width, height: r.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    deskEl.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      deskEl.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [el, deskEl, zoom, version]);

  if (!rect || !el?.isConnected) return null;
  const absolute = el.style.position === 'absolute';
  const target = el.tagName === 'IMG' ? el : el;

  const start = (event, mode) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      mode,
      x: event.clientX,
      y: event.clientY,
      width: target.offsetWidth,
      height: target.offsetHeight,
      left: el.offsetLeft,
      top: el.offsetTop,
      ratio: target.offsetHeight / (target.offsetWidth || 1),
      rotate: Number(el.dataset.rotate || 0),
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
    };
  };

  const move = (event) => {
    const g = drag.current;
    if (!g) return;
    const dx = (event.clientX - g.x) / zoom;
    const dy = (event.clientY - g.y) / zoom;
    if (g.mode === 'move') {
      el.style.left = `${Math.round(g.left + dx)}px`;
      el.style.top = `${Math.round(g.top + dy)}px`;
    } else if (g.mode === 'rotate') {
      const d = deskEl.getBoundingClientRect();
      const angle = (Math.atan2(event.clientY - d.top + deskEl.scrollTop - g.cy, event.clientX - d.left + deskEl.scrollLeft - g.cx) * 180) / Math.PI + 90;
      el.dataset.rotate = String(Math.round(event.shiftKey ? Math.round(angle / 15) * 15 : angle));
      applyTransform(el);
    } else {
      const lock = event.shiftKey || el.dataset.lockRatio === 'true' || (el.tagName === 'IMG' || el.dataset.kind === 'image' || el.dataset.kind === 'chart' || el.dataset.kind === 'diagram') !== event.altKey;
      let width = g.width + (g.mode.includes('e') ? dx : g.mode.includes('w') ? -dx : 0);
      let height = g.height + (g.mode.includes('s') ? dy : g.mode.includes('n') ? -dy : 0);
      if (lock && g.mode.length === 2) height = width * g.ratio;
      if (lock && (g.mode === 'e' || g.mode === 'w')) height = width * g.ratio;
      if (lock && (g.mode === 'n' || g.mode === 's')) width = height / g.ratio;
      width = Math.max(16, width);
      height = Math.max(12, height);
      target.style.width = `${Math.round(width)}px`;
      target.style.height = `${Math.round(height)}px`;
      if (el.tagName === 'IMG') target.removeAttribute('height');
      if (absolute && g.mode.includes('w')) el.style.left = `${Math.round(g.left + (g.width - width))}px`;
      if (absolute && g.mode.includes('n')) el.style.top = `${Math.round(g.top + (g.height - height))}px`;
    }
    onChange?.();
  };

  const end = () => {
    if (drag.current) onCommit?.();
    drag.current = null;
  };

  return (
    <div className="wd-obj-handles" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      {absolute && <div className="wd-obj-move" onPointerDown={(event) => start(event, 'move')} title="Arrastrar" />}
      {HANDLES.map((handle) => <span key={handle} className={`wd-h wd-h-${handle}`} onPointerDown={(event) => start(event, handle)} />)}
      <span className="wd-h wd-h-rot" title="Girar (Mayús: pasos de 15°)" onPointerDown={(event) => start(event, 'rotate')} />
    </div>
  );
}

/** Barra flotante sobre el texto seleccionado. */
export function BubbleBar({ rect, sel, api }) {
  if (!rect) return null;
  const top = Math.max(8, rect.top - 48);
  const left = Math.min(window.innerWidth - 440, Math.max(8, rect.left));
  return createPortal(
    <div className="wd-bubble" style={{ top, left }} role="toolbar" aria-label="Formato rápido" onMouseDown={(event) => { if (event.target.closest('input, textarea')) { holdSelection(document.querySelector('.wd-desk')); return; } event.preventDefault(); }}>
      <FontField value={sel.font || ''} onChange={(value) => value && api.inline({ fontFamily: value })} />
      <Select className="is-size" label="Tamaño" width={58} value={String(sel.size || '')} options={[['', sel.size ? String(sel.size) : '—'], ...SIZES.map((size) => [String(size), String(size)])]} onChange={(value) => value && api.inline({ fontSize: `${value}px` })} />
      <Btn icon={Bold} label="Negrita" active={sel.bold} onClick={() => api.cmd('bold')} />
      <Btn icon={Italic} label="Cursiva" active={sel.italic} onClick={() => api.cmd('italic')} />
      <Btn icon={Underline} label="Subrayado" active={sel.underline} onClick={() => api.cmd('underline')} />
      <Btn icon={Strikethrough} label="Tachado" active={sel.strike} onClick={() => api.cmd('strikeThrough')} />
      <Menu icon={Palette} label="Color de texto" width={248}>{(close) => <ColorGrid value={sel.color} onPick={(color) => api.inline({ color })} close={close} />}</Menu>
      <Menu icon={Highlighter} label="Resaltado" width={196}>{(close) => <ColorGrid kind="highlight" allowNone noneLabel="Sin color" onPick={(color) => api.inline({ backgroundColor: color || 'transparent' })} close={close} />}</Menu>
    </div>,
    document.body,
  );
}

/** Menú contextual (clic derecho). */
export function ContextMenu({ menu, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!menu) return undefined;
    const close = (event) => { if (!ref.current?.contains(event.target)) onClose(); };
    const key = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', key);
    };
  }, [menu, onClose]);
  if (!menu) return null;
  const top = Math.min(menu.y, window.innerHeight - menu.items.length * 32 - 16);
  const left = Math.min(menu.x, window.innerWidth - 248);
  return createPortal(
    <div ref={ref} className="wd-pop wd-context" role="menu" style={{ top, left, width: 240 }} onMouseDown={(event) => event.preventDefault()}>
      {menu.items.map((item, index) => (item === '-' ? <div key={index} className="wd-sep" /> : (
        <button key={item.label} type="button" role="menuitem" className="wd-item" disabled={item.disabled} onClick={() => { onClose(); item.run(); }}>
          {item.icon ? <item.icon size={15} /> : <span className="wd-item-gap" />}
          <span className="wd-item-label">{item.label}</span>
          {item.hint && <kbd>{item.hint}</kbd>}
        </button>
      )))}
    </div>,
    document.body,
  );
}

/** Menú en línea para "/" (bloques) y "@" (menciones). */
export function InlineMenu({ menu, items, active, onPick, onHover }) {
  const listRef = useRef(null);
  useEffect(() => {
    listRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  if (!menu) return null;
  const top = Math.min(menu.rect.bottom + 6, window.innerHeight - 320);
  const left = Math.min(menu.rect.left, window.innerWidth - 300);
  return createPortal(
    <div className="wd-pop wd-inline-menu" role="listbox" style={{ top, left, width: 290, maxHeight: 310 }} ref={listRef} onMouseDown={(event) => event.preventDefault()}>
      <div className="wd-sep-label">{menu.trigger === '/' ? 'Insertar bloque' : 'Mencionar'}{menu.query ? ` · “${menu.query}”` : ''}</div>
      {items.length === 0 && <p className="wd-muted wd-pad">Sin resultados</p>}
      {items.map((item, index) => (
        <button key={item.key} type="button" role="option" aria-selected={index === active} className={`wd-item${index === active ? ' is-active' : ''}`} onMouseEnter={() => onHover(index)} onClick={() => onPick(item)}>
          <span className={`wd-badge is-${item.kind || 'block'}`}>{item.badge}</span>
          <span className="wd-item-label"><b>{item.label}</b><small>{item.hint}</small></span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
