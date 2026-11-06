import { memo, useRef, useState } from 'react';
import { INK_TOOLS, erasePoints, hitStroke, pressurePolygon, selectStrokes, strokeBounds, strokePath, transformStrokes } from './ink';

/** Capa de tinta de una página. Funciona con mouse, trackpad, pantallas táctiles y lápices (Pointer Events + presión). */
function InkLayer({ pageId, strokes, width, height, pen, zoom, selected, onChange, onSelect }) {
  const svgRef = useRef(null);
  const [draft, setDraft] = useState(null);
  const [area, setArea] = useState(null);
  const gesture = useRef(null);
  const active = Boolean(pen.tool);
  const selectedStrokes = strokes.filter((stroke) => selected.includes(stroke.id));
  const box = selectedStrokes.length ? strokeBounds(selectedStrokes) : null;

  const point = (event) => {
    const rect = svgRef.current.getBoundingClientRect();
    const scale = rect.width / width || zoom || 1;
    return [(event.clientX - rect.left) / scale, (event.clientY - rect.top) / scale, event.pressure > 0 && event.pointerType === 'pen' ? event.pressure : 0.5];
  };

  const snap = (start, [x, y, p]) => {
    if (!pen.ruler?.on) return [x, y, p];
    const angle = (pen.ruler.angle * Math.PI) / 180;
    const dx = x - start[0];
    const dy = y - start[1];
    const t = dx * Math.cos(angle) + dy * Math.sin(angle);
    return [start[0] + t * Math.cos(angle), start[1] + t * Math.sin(angle), p];
  };

  const onPointerDown = (event) => {
    if (!active || (event.button !== 0 && event.pointerType === 'mouse')) return;
    event.preventDefault();
    event.stopPropagation();
    svgRef.current.setPointerCapture(event.pointerId);
    const p = point(event);
    if (box && (pen.tool === 'select' || pen.tool === 'lasso')) {
      const handle = event.target.dataset.handle;
      const inside = p[0] >= box.x - 6 && p[0] <= box.x + box.w + 6 && p[1] >= box.y - 6 && p[1] <= box.y + box.h + 6;
      if (handle || inside) {
        gesture.current = { mode: handle || 'move', start: p, original: selectedStrokes, box };
        return;
      }
    }
    if (INK_TOOLS[pen.tool]) {
      gesture.current = { mode: 'draw', start: p };
      setDraft({ id: `ink-${Date.now().toString(36)}`, tool: pen.tool, color: pen.color, width: pen.width || INK_TOOLS[pen.tool].width, opacity: pen.opacity ?? INK_TOOLS[pen.tool].opacity, points: p });
    } else if (pen.tool === 'eraser' || pen.tool === 'strokeEraser') {
      gesture.current = { mode: pen.tool };
      erase(p);
    } else if (pen.tool === 'select') {
      gesture.current = { mode: 'area', start: p };
      setArea({ x: p[0], y: p[1], w: 0, h: 0 });
    } else if (pen.tool === 'lasso') {
      gesture.current = { mode: 'lasso' };
      setArea({ polygon: [p[0], p[1]] });
    }
  };

  const erase = (p) => {
    const radius = Math.max(6, (pen.width || 10) * 1.2);
    const next = pen.tool === 'eraser' ? erasePoints(strokes, p[0], p[1], radius) : strokes.filter((stroke) => !hitStroke(stroke, p[0], p[1], radius));
    if (next.length !== strokes.length || next.some((stroke, index) => stroke !== strokes[index])) onChange(pageId, next, false);
  };

  const onPointerMove = (event) => {
    const g = gesture.current;
    if (!g) return;
    const p = point(event);
    if (g.mode === 'draw') {
      const snapped = snap(g.start, p);
      setDraft((current) => current && { ...current, points: pen.ruler?.on ? [...current.points.slice(0, 3), ...snapped] : [...current.points, ...snapped] });
    } else if (g.mode === 'eraser' || g.mode === 'strokeEraser') erase(p);
    else if (g.mode === 'area') setArea({ x: Math.min(g.start[0], p[0]), y: Math.min(g.start[1], p[1]), w: Math.abs(p[0] - g.start[0]), h: Math.abs(p[1] - g.start[1]) });
    else if (g.mode === 'lasso') setArea((current) => ({ polygon: [...current.polygon, p[0], p[1]] }));
    else {
      const origin = { x: g.box.x + g.box.w / 2, y: g.box.y + g.box.h / 2 };
      let moved;
      if (g.mode === 'move') moved = transformStrokes(g.original, { dx: p[0] - g.start[0], dy: p[1] - g.start[1], origin });
      else if (g.mode === 'scale') {
        const scale = Math.max(0.1, Math.hypot(p[0] - origin.x, p[1] - origin.y) / Math.hypot(g.start[0] - origin.x, g.start[1] - origin.y));
        moved = transformStrokes(g.original, { scale, origin });
      } else {
        const angle = Math.atan2(p[1] - origin.y, p[0] - origin.x) - Math.atan2(g.start[1] - origin.y, g.start[0] - origin.x);
        moved = transformStrokes(g.original, { angle, origin });
      }
      const map = new Map(moved.map((stroke) => [stroke.id, stroke]));
      onChange(pageId, strokes.map((stroke) => map.get(stroke.id) || stroke), false);
    }
  };

  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.mode === 'draw' && draft) {
      onChange(pageId, [...strokes, draft], true);
      setDraft(null);
    } else if (g.mode === 'area' || g.mode === 'lasso') {
      const picked = area ? selectStrokes(strokes, area) : [];
      onSelect(pageId, picked.map((stroke) => stroke.id));
      setArea(null);
    } else onChange(pageId, strokes, true);
  };

  const render = (stroke, extra = {}) => {
    const tool = INK_TOOLS[stroke.tool] || INK_TOOLS.ballpoint;
    const poly = tool.pressure ? pressurePolygon(stroke.points, stroke.width) : null;
    return poly
      ? <path key={stroke.id} d={poly} fill={stroke.color} opacity={stroke.opacity} {...extra} />
      : <path key={stroke.id} d={strokePath(stroke.points)} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" opacity={stroke.opacity} style={tool.blend ? { mixBlendMode: tool.blend } : undefined} {...extra} />;
  };

  if (!strokes.length && !active) return null;
  return (
    <svg
      ref={svgRef}
      className={`wd-ink-layer${active ? ' is-active' : ''}`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      data-tool={pen.tool || ''}
      aria-hidden={!active}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {strokes.map((stroke) => render(stroke))}
      {draft && render(draft)}
      {area && !area.polygon && <rect x={area.x} y={area.y} width={area.w} height={area.h} className="wd-ink-area" />}
      {area?.polygon && <polyline points={area.polygon.join(' ')} className="wd-ink-area" />}
      {box && active && (
        <g className="wd-ink-selection">
          <rect x={box.x - 6} y={box.y - 6} width={box.w + 12} height={box.h + 12} />
          <circle data-handle="scale" cx={box.x + box.w + 6} cy={box.y + box.h + 6} r="7" />
          <circle data-handle="rotate" cx={box.x + box.w / 2} cy={box.y - 24} r="7" />
          <line x1={box.x + box.w / 2} y1={box.y - 6} x2={box.x + box.w / 2} y2={box.y - 17} />
        </g>
      )}
      {pen.ruler?.on && active && (
        <g className="wd-ruler-tool" transform={`translate(${width / 2} ${height / 2}) rotate(${pen.ruler.angle})`}>
          <rect x={-width * 0.45} y={-22} width={width * 0.9} height={44} rx={6} />
          {Array.from({ length: 41 }, (_, index) => <line key={index} x1={-width * 0.4 + (index * width * 0.8) / 40} y1={-22} x2={-width * 0.4 + (index * width * 0.8) / 40} y2={index % 5 ? -14 : -6} />)}
        </g>
      )}
    </svg>
  );
}

export default memo(InkLayer);
