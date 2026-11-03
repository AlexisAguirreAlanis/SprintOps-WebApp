import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const HIDE_MS = 700;
const MIN_THUMB = 42;
const HIT = 18;
const EDGE = 20;

function stageMetrics() {
  const stage = document.querySelector('.app-stage');
  if (!stage) return null;
  const rect = stage.getBoundingClientRect();
  const scale = stage.offsetWidth ? rect.width / stage.offsetWidth : 1;
  return { rect, scale: scale || 1 };
}

function axisOf(el) {
  if (!(el instanceof HTMLElement)) return null;
  if (el.closest('[data-hide-scrollbar]')) return null;
  const scrollY = el.scrollHeight > el.clientHeight + 1;
  const scrollX = el.scrollWidth > el.clientWidth + 1;
  if (!scrollY && !scrollX) return null;
  const style = getComputedStyle(el);
  if (scrollY && (style.overflowY === 'auto' || style.overflowY === 'scroll')) return 'y';
  if (scrollX && (style.overflowX === 'auto' || style.overflowX === 'scroll')) return 'x';
  return null;
}

function describe(el, axis, scale, stageRect) {
  const rect = el.getBoundingClientRect();
  const trackVisual = axis === 'y' ? rect.height : rect.width;
  const view = axis === 'y' ? el.clientHeight : el.clientWidth;
  const total = axis === 'y' ? el.scrollHeight : el.scrollWidth;
  const pos = axis === 'y' ? el.scrollTop : el.scrollLeft;
  const track = trackVisual / scale;
  const minThumb = Math.min(MIN_THUMB, track);
  const proportional = total > 0 ? (view / total) * track : track;
  const thumb = Math.max(minThumb, Math.min(track, proportional));
  const travel = Math.max(1, track - thumb);
  const scrollable = Math.max(1, total - view);
  const offset = (pos / scrollable) * travel;
  const top = (rect.top - stageRect.top) / scale;
  const left = (rect.left - stageRect.left) / scale;
  if (axis === 'y') {
    return { axis, top, left: left + rect.width / scale - HIT, track, thumb, offset };
  }
  return { axis, top: top + rect.height / scale - HIT, left, track, thumb, offset };
}

function nearly(a, b) {
  return Math.abs(a - b) < 0.5;
}

function sameBox(a, b) {
  if (!a || !b) return false;
  return a.axis === b.axis
    && a.shown === b.shown
    && a.hot === b.hot
    && a.drag === b.drag
    && nearly(a.top, b.top)
    && nearly(a.left, b.left)
    && nearly(a.track, b.track)
    && nearly(a.thumb, b.thumb)
    && nearly(a.offset, b.offset);
}

/**
 * Barra dibujada (la nativa de macOS ignora el estilo de cápsula).
 * Crece al desplazar y, un momento después de soltar, se encoge.
 */
export default function AppScrollbar() {
  const [root, setRoot] = useState(null);
  const [box, setBox] = useState(null);
  const targetRef = useRef(null);
  const axisRef = useRef('y');
  const shownRef = useRef(false);
  const edgeRef = useRef(false);
  const thumbRef = useRef(false);
  const dragRef = useRef(null);
  const hideTimer = useRef(0);
  const scheduleRef = useRef(() => {});

  useLayoutEffect(() => {
    setRoot(document.getElementById('popup-root'));
  }, []);

  useEffect(() => {
    let alive = true;
    let frame = 0;
    let observed = null;
    const ro = new ResizeObserver(() => schedule());

    const watch = (el) => {
      if (observed === el) return;
      ro.disconnect();
      observed = el;
      if (el) ro.observe(el);
    };

    const visible = () => shownRef.current || edgeRef.current || thumbRef.current || Boolean(dragRef.current);

    const paint = () => {
      if (!alive) return;
      const el = targetRef.current;
      const metrics = stageMetrics();
      if (!el || !el.isConnected || !metrics) {
        watch(null);
        setBox((prev) => (prev && prev.shown ? { ...prev, shown: false, hot: false, drag: false } : prev));
        return;
      }
      const axis = axisOf(el) || axisRef.current;
      if (!axisOf(el)) {
        watch(null);
        setBox((prev) => (prev && prev.shown ? { ...prev, shown: false, hot: false, drag: false } : prev));
        return;
      }
      axisRef.current = axis;
      watch(el);
      const next = {
        ...describe(el, axis, metrics.scale, metrics.rect),
        shown: visible(),
        hot: thumbRef.current && !dragRef.current,
        drag: Boolean(dragRef.current),
      };
      setBox((prev) => (sameBox(prev, next) ? prev : next));
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        paint();
      });
    };
    scheduleRef.current = schedule;

    const armHide = () => {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => {
        shownRef.current = false;
        schedule();
      }, HIDE_MS);
    };

    const onScroll = (event) => {
      const raw = event.target;
      const el = raw === document
        ? document.scrollingElement
        : raw instanceof HTMLElement
          ? raw
          : null;
      if (!el || !axisOf(el)) return;
      targetRef.current = el;
      axisRef.current = axisOf(el);
      shownRef.current = true;
      armHide();
      schedule();
    };

    let pointerX = 0;
    let pointerY = 0;
    let pointerTarget = null;
    let pointerFrame = 0;

    const checkEdge = () => {
      pointerFrame = 0;
      if (dragRef.current) return;
      let el = pointerTarget instanceof Element ? pointerTarget : null;
      let found = null;
      while (el && el !== document.documentElement) {
        if (el.classList?.contains('app-scrollbar') || el.id === 'popup-root') break;
        const axis = axisOf(el);
        if (axis) {
          const rect = el.getBoundingClientRect();
          const onY = axis === 'y'
            && pointerX >= rect.right - EDGE
            && pointerX <= rect.right + 8
            && pointerY >= rect.top
            && pointerY <= rect.bottom;
          const onX = axis === 'x'
            && pointerY >= rect.bottom - EDGE
            && pointerY <= rect.bottom + 8
            && pointerX >= rect.left
            && pointerX <= rect.right;
          if (onY || onX) {
            found = { el, axis };
            break;
          }
        }
        el = el.parentElement;
      }
      if (found) {
        const changed = !edgeRef.current || targetRef.current !== found.el;
        edgeRef.current = true;
        targetRef.current = found.el;
        axisRef.current = found.axis;
        if (changed) schedule();
        return;
      }
      if (edgeRef.current) {
        edgeRef.current = false;
        armHide();
        schedule();
      }
    };

    const onPointerMove = (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      pointerTarget = event.target;
      if (pointerFrame) return;
      pointerFrame = requestAnimationFrame(checkEdge);
    };

    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      alive = false;
      document.removeEventListener('scroll', onScroll, { capture: true });
      document.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', schedule);
      window.clearTimeout(hideTimer.current);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(pointerFrame);
      ro.disconnect();
    };
  }, []);

  const onPointerEnter = () => {
    thumbRef.current = true;
    scheduleRef.current();
  };

  const onPointerLeave = () => {
    thumbRef.current = false;
    if (!dragRef.current) scheduleRef.current();
  };

  const onPointerDown = (event) => {
    const el = targetRef.current;
    const metrics = stageMetrics();
    if (!el || !metrics || !box) return;
    event.preventDefault();
    event.stopPropagation();
    const axis = box.axis;
    const rect = el.getBoundingClientRect();
    const thumbVisual = box.thumb * metrics.scale;
    const thumbStart = (axis === 'y' ? rect.top : rect.left) + box.offset * metrics.scale;
    const pointer = axis === 'y' ? event.clientY : event.clientX;
    let grab = pointer - thumbStart;
    const jump = grab < 0 || grab > thumbVisual;
    if (jump) grab = thumbVisual / 2;
    dragRef.current = { axis, grab };
    thumbRef.current = true;
    shownRef.current = true;
    window.clearTimeout(hideTimer.current);
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const move = (ev) => {
      const current = targetRef.current;
      const drag = dragRef.current;
      if (!current || !drag) return;
      const r = current.getBoundingClientRect();
      const track = drag.axis === 'y' ? r.height : r.width;
      const view = drag.axis === 'y' ? current.clientHeight : current.clientWidth;
      const total = drag.axis === 'y' ? current.scrollHeight : current.scrollWidth;
      const layout = drag.axis === 'y' ? current.offsetHeight : current.offsetWidth;
      const scale = layout ? track / layout : 1;
      const minThumb = Math.min(MIN_THUMB * scale, track);
      const proportional = total > 0 ? (view / total) * track : track;
      const thumb = Math.max(minThumb, Math.min(track, proportional));
      const travel = Math.max(1, track - thumb);
      const origin = drag.axis === 'y' ? r.top : r.left;
      const client = drag.axis === 'y' ? ev.clientY : ev.clientX;
      const ratio = Math.min(1, Math.max(0, (client - origin - drag.grab) / travel));
      const next = ratio * Math.max(0, total - view);
      if (drag.axis === 'y') current.scrollTop = next;
      else current.scrollLeft = next;
    };

    const up = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => {
        shownRef.current = false;
        scheduleRef.current();
      }, HIDE_MS);
      scheduleRef.current();
    };

    if (jump) move(event);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    scheduleRef.current();
  };

  if (!root || !box) return null;

  const vertical = box.axis !== 'x';
  const faceStyle = vertical
    ? { top: box.offset, height: box.thumb }
    : { left: box.offset, width: box.thumb };

  return createPortal(
    <div
      aria-hidden="true"
      className={`app-scrollbar${vertical ? '' : ' is-x'}${box.shown ? ' is-on' : ''}${box.hot ? ' is-hot' : ''}${box.drag ? ' is-drag' : ''}`}
      style={vertical
        ? { top: box.top, left: box.left, height: box.track, width: HIT }
        : { top: box.top, left: box.left, width: box.track, height: HIT }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
    >
      <div className="app-scrollbar-face">
        <span className="app-scrollbar-pill" style={faceStyle} />
      </div>
    </div>,
    root,
  );
}
