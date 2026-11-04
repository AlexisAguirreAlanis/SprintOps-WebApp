import { memo, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Ellipse, Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import {
  ChevronLeft,
  File,
  Hand,
  Image as ImageIcon,
  Link2,
  Maximize2,
  Minimize2,
  Minus,
  MousePointer2,
  PaintBucket,
  Pencil,
  PenLine,
  Plus,
  Redo2,
  Share2,
  SprayCan,
  Square,
  Star,
  StickyNote,
  Table2,
  Type,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../auth/hooks/useAuth';
import { useProjects } from '../project/hooks/useProjects';
import { portfolioRepository } from '../../data/repositories/portfolioRepository';
import { useDismiss } from '../home/useDismiss';
import {
  alignElements,
  cloneElement,
  cornerRadius,
  createElement,
  createId,
  elementBounds,
  intersects,
  isArrow,
  parseDocument,
  sceneBounds,
  serializeDocument,
  syncConnectors,
  textColor,
} from './portfolioDocument';
import {
  arrowPath,
  attachEnds,
  bendFromPoint,
  connectionTargets,
  defaultBend,
  endAngle,
  headKind,
  headTrim,
  insertVertex,
  lineCount,
  localPoint,
  parallelCopies,
  pointAlong,
  removeVertex,
  strokeDash,
  trimPolyline,
} from './connectorGeometry';
import { readImageFile } from './editorMedia';
import EditorLibrary from './EditorLibrary';
import EditorInspector from './EditorInspector';
import './portfolio.css';

const FONTS = [
  { label: 'Sans', value: 'ui-sans-serif, system-ui, sans-serif' },
  { label: 'Redonda', value: '"Avenir Next", Avenir, "Segoe UI", sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Editorial', value: '"Iowan Old Style", Palatino, "Palatino Linotype", serif' },
  { label: 'Mono', value: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  { label: 'Compacta', value: '"Avenir Next Condensed", "Arial Narrow", sans-serif' },
];

const INK_SWATCHES = ['#1e293b', '#2f6f5e', '#67bfa1', '#c74634', '#d97706', '#3b6ea5', '#ffffff'];

function sprayDots(x, y, radius, count) {
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * radius;
    points.push(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist);
  }
  return points;
}

function paintOf(element, color) {
  if (element.type === 'image' || element.type === 'video') return null;
  if (element.type === 'text') return { textFill: color };
  if (element.type === 'line' && !element.closed) return { stroke: color, strokeWidth: element.strokeWidth || 3 };
  return { fill: color };
}

function editorReducer(state, action) {
  if (action.type === 'load') {
    return { elements: action.elements, past: [], future: [], gesturing: false, dirty: false, epoch: 0 };
  }
  if (action.type === 'begin') {
    if (state.gesturing) return state;
    return { ...state, gesturing: true, past: [...state.past, state.elements].slice(-80), future: [] };
  }
  if (action.type === 'live') {
    return { ...state, elements: action.elements, epoch: state.epoch + 1 };
  }
  if (action.type === 'end') {
    if (!state.gesturing) return state;
    return { ...state, gesturing: false, dirty: true, epoch: state.epoch + 1 };
  }
  if (action.type === 'touch') {
    return { ...state, dirty: true, epoch: state.epoch + 1 };
  }
  if (action.type === 'commit') {
    return {
      elements: action.elements,
      past: [...state.past, state.elements].slice(-80),
      future: [],
      gesturing: false,
      dirty: true,
      epoch: state.epoch + 1,
    };
  }
  if (action.type === 'undo') {
    if (state.past.length === 0) return { ...state, gesturing: false };
    return {
      elements: state.past.at(-1),
      past: state.past.slice(0, -1),
      future: [state.elements, ...state.future].slice(0, 80),
      gesturing: false,
      dirty: true,
      epoch: state.epoch + 1,
    };
  }
  if (action.type === 'redo') {
    if (state.future.length === 0) return state;
    return {
      elements: state.future[0],
      future: state.future.slice(1),
      past: [...state.past, state.elements].slice(-80),
      gesturing: false,
      dirty: true,
      epoch: state.epoch + 1,
    };
  }
  if (action.type === 'clean') return { ...state, dirty: false };
  return state;
}

function textEditorStyle(element, camera) {
  const scale = camera.scale || 1;
  const fontSize = (element.fontSize || 16) * scale;
  const pad = (element.type === 'text' ? 0 : 12) * scale;
  const width = Math.max(24, (element.width || 80) * scale);
  const height = Math.max(fontSize + pad * 2, (element.height || 32) * scale);
  const lines = Math.max(1, String(element.text || ' ').split('\n').length);
  const lineHeight = fontSize * 1.2;
  const inner = Math.max(lineHeight, height - pad * 2);
  const offset = Math.max(0, (inner - lines * lineHeight) / 2);
  return {
    left: camera.x + element.x * scale,
    top: camera.y + element.y * scale,
    width,
    height,
    fontSize,
    fontFamily: element.fontFamily,
    fontWeight: Number(element.fontWeight) >= 700 ? 700 : (element.fontWeight || 500),
    fontStyle: element.fontStyle === 'italic' ? 'italic' : 'normal',
    color: textColor(element),
    textAlign: element.align || 'center',
    lineHeight: 1.2,
    paddingTop: pad + offset,
    paddingRight: pad,
    paddingBottom: 0,
    paddingLeft: pad,
    textDecoration: element.textDecoration || 'none',
    letterSpacing: `${(element.letterSpacing || 0) * scale}px`,
    transform: `rotate(${element.rotation || 0}deg)`,
    transformOrigin: 'top left',
  };
}

function fontStyle(element) {
  const italic = element.fontStyle === 'italic';
  const bold = Number(element.fontWeight) >= 700;
  if (italic && bold) return 'italic bold';
  if (italic) return 'italic';
  if (bold) return 'bold';
  return 'normal';
}

const RemoteImage = memo(function RemoteImage({ src, width, height, cornerRadius }) {
  const [image, setImage] = useState(null);
  useEffect(() => {
    if (!src) return undefined;
    let alive = true;
    const picture = new window.Image();
    picture.onload = () => { if (alive) setImage(picture); };
    picture.src = src;
    return () => { alive = false; };
  }, [src]);
  return <KonvaImage image={image} width={width} height={height} cornerRadius={cornerRadius || 0} listening={false} />;
});

function HostMark({ host, hot, unit, accent }) {
  const strokeWidth = (hot ? 2 : 1.25) * unit;
  const dash = hot ? undefined : [5 * unit, 4 * unit];
  const stroke = { stroke: accent, strokeWidth, dash, dashEnabled: Boolean(dash), listening: false };
  const width = host.width;
  const height = host.height;
  if (host.kind === 'ellipse') {
    return (
      <>
        {hot && <Ellipse x={width / 2} y={height / 2} radiusX={width / 2} radiusY={height / 2} fill={accent} opacity={0.12} listening={false} />}
        <Ellipse x={width / 2} y={height / 2} radiusX={width / 2} radiusY={height / 2} {...stroke} />
      </>
    );
  }
  if (host.kind === 'media') {
    const arm = Math.max(8, Math.min(18, width * 0.16, height * 0.16));
    return (
      <>
        {hot && <Rect width={width} height={height} fill={accent} opacity={0.1} listening={false} />}
        <Line points={[0, arm, 0, 0, arm, 0]} {...stroke} dash={undefined} dashEnabled={false} />
        <Line points={[width - arm, 0, width, 0, width, arm]} {...stroke} dash={undefined} dashEnabled={false} />
        <Line points={[0, height - arm, 0, height, arm, height]} {...stroke} dash={undefined} dashEnabled={false} />
        <Line points={[width - arm, height, width, height, width, height - arm]} {...stroke} dash={undefined} dashEnabled={false} />
      </>
    );
  }
  const radius = host.kind === 'text' ? 4 : host.radius;
  const textDash = host.kind === 'text' ? [4 * unit, 3 * unit] : stroke.dash;
  return (
    <>
      {hot && <Rect width={width} height={height} cornerRadius={radius || 0} fill={accent} opacity={0.1} listening={false} />}
      <Rect width={width} height={height} cornerRadius={radius || 0} {...stroke} dash={textDash} dashEnabled={Boolean(textDash)} />
      {host.kind === 'frame' && width > 36 && height > 36 && (
        <Rect
          x={10}
          y={10}
          width={width - 20}
          height={height - 20}
          cornerRadius={Math.max(0, (typeof radius === 'number' ? radius : 16) - 8)}
          {...stroke}
        />
      )}
      {host.kind === 'note' && (
        <Line
          points={[width - Math.min(18, width * 0.2), 0, width, Math.min(18, height * 0.2)]}
          {...stroke}
          dash={undefined}
          dashEnabled={false}
        />
      )}
      {host.kind === 'table' && width > 24 && height > 24 && (
        <>
          <Line points={[0, height / 3, width, height / 3]} {...stroke} dash={undefined} dashEnabled={false} />
          <Line points={[0, (height * 2) / 3, width, (height * 2) / 3]} {...stroke} dash={undefined} dashEnabled={false} />
          <Line points={[width / 2, 0, width / 2, height]} {...stroke} dash={undefined} dashEnabled={false} />
        </>
      )}
    </>
  );
}

function ConnectionGuides({ x, y, elements, scale, accent, ignoreId }) {
  const { hosts, active } = connectionTargets(elements, x, y, ignoreId);
  const unit = 1 / (scale || 1);
  return (
    <Group listening={false}>
      {hosts.map((host) => (
        <Group key={host.id} x={host.x} y={host.y} rotation={host.rotation} opacity={active?.id === host.id ? 1 : 0.78} listening={false}>
          <HostMark host={host} hot={active?.id === host.id} unit={unit} accent={accent} />
        </Group>
      ))}
      {hosts.flatMap((host) => host.anchors.map((anchor) => {
        const on = active?.id === host.id && active.anchor === anchor.anchor;
        const center = anchor.anchor === 'center';
        return (
          <Circle
            key={`${host.id}-${anchor.anchor}`}
            x={anchor.x}
            y={anchor.y}
            radius={(on ? 6.5 : center ? 3 : 4.2) * unit}
            fill={on ? accent : '#ffffff'}
            stroke={accent}
            strokeWidth={(on ? 2 : 1.35) * unit}
            listening={false}
          />
        );
      }))}
      {active && (
        <>
          <Line
            points={[x, y, active.x, active.y]}
            stroke={accent}
            strokeWidth={1.6 * unit}
            dash={[5 * unit, 4 * unit]}
            listening={false}
          />
          <Circle x={active.x} y={active.y} radius={11 * unit} stroke={accent} strokeWidth={1.25 * unit} listening={false} />
        </>
      )}
    </Group>
  );
}

function ArrowTip({ x, y, scale, accent, label, onBegin, onDrag, onEnd, onRemove }) {
  const radius = Math.max(4.5, 7 / (scale || 1));
  return (
    <Circle
      x={x}
      y={y}
      radius={radius}
      fill="#ffffff"
      stroke={accent}
      strokeWidth={Math.max(1.25, 2 / (scale || 1))}
      draggable
      onMouseDown={(event) => { event.cancelBubble = true; }}
      onDblClick={(event) => { event.cancelBubble = true; onRemove?.(); }}
      onDragStart={(event) => { event.cancelBubble = true; onBegin(); }}
      onDragMove={(event) => { event.cancelBubble = true; onDrag(event.target.x(), event.target.y()); }}
      onDragEnd={(event) => { event.cancelBubble = true; onEnd(event.target.x(), event.target.y()); }}
      name={label}
    />
  );
}

function ConnectorHead({ kind, size, color, x, y, angle, width }) {
  if (!kind || kind === 'none') return null;
  const stroke = Math.max(1.5, width || 2);
  return (
    <Group x={x} y={y} rotation={(angle * 180) / Math.PI} listening={false}>
      {kind === 'triangle' && <Line points={[0, 0, -size, size * 0.42, -size, -size * 0.42]} closed fill={color} />}
      {kind === 'open' && <Line points={[-size, size * 0.42, 0, 0, -size, -size * 0.42]} stroke={color} strokeWidth={stroke} lineCap="round" lineJoin="round" />}
      {kind === 'ring' && <Circle x={-size * 0.42} radius={size * 0.3} stroke={color} strokeWidth={stroke} />}
      {kind === 'disc' && <Circle x={-size * 0.42} radius={size * 0.3} fill={color} />}
      {kind === 'diamond' && <Line points={[-size, 0, -size * 0.5, size * 0.36, 0, 0, -size * 0.5, -size * 0.36]} closed stroke={color} strokeWidth={stroke} />}
      {kind === 'gem' && <Line points={[-size, 0, -size * 0.5, size * 0.36, 0, 0, -size * 0.5, -size * 0.36]} closed fill={color} />}
      {kind === 'square' && <Rect x={-size} y={-size * 0.28} width={size * 0.56} height={size * 0.56} stroke={color} strokeWidth={stroke} />}
      {kind === 'box' && <Rect x={-size} y={-size * 0.28} width={size * 0.56} height={size * 0.56} fill={color} />}
      {kind === 'bar' && <Line points={[0, -size * 0.42, 0, size * 0.42]} stroke={color} strokeWidth={stroke * 1.3} lineCap="butt" />}
      {kind === 'crow' && <Line points={[-size, size * 0.38, 0, 0, -size, 0, 0, 0, -size, -size * 0.38]} stroke={color} strokeWidth={stroke} lineCap="round" lineJoin="round" />}
    </Group>
  );
}

function ArrowShape({ element, accent, selected, scale, onBegin, onLive, onEnd, onGuide }) {
  const raw = element.points;
  const route = element.route || 'straight';
  const path = arrowPath(element);
  const stroke = element.stroke && element.stroke !== 'transparent' ? element.stroke : accent;
  const width = element.strokeWidth || 3;
  const span = Math.hypot((raw[raw.length - 2] || 0) - raw[0], (raw[raw.length - 1] || 0) - raw[1]);
  const head = element.headSize || Math.max(14, Math.min(32, span * 0.28));
  const startKind = headKind(element, false);
  const endKind = headKind(element, true);
  const drawn = trimPolyline(path.points, headTrim(startKind, head), headTrim(endKind, head));
  const wires = parallelCopies(drawn, lineCount(element), width + Math.max(4, width * 0.65));
  const dash = strokeDash(element.dash, width);
  const cap = element.cap || (element.dash === 'dotted' ? 'round' : 'round');
  const join = element.join || 'round';
  const labelAt = element.label ? pointAlong(path.points, element.labelT ?? 0.5) : null;
  const moveTip = (index, x, y) => {
    const points = raw.slice();
    points[index] = x;
    points[index + 1] = y;
    const partial = { points };
    if (index === 0) partial.from = null;
    if (index === points.length - 2) partial.to = null;
    if ((element.route || 'straight') === 'curve' && points.length === 4) {
      partial.bend = Number.isFinite(element.bend) ? element.bend : defaultBend(points);
    }
    onLive(element.id, partial);
  };
  const settleTip = (index, x, y) => onEnd(index, x, y);
  const vertices = [];
  for (let index = 0; index < raw.length; index += 2) vertices.push(index);
  return (
    <>
      {wires.map((points, index) => (
        <Line
          key={index}
          points={points}
          tension={path.tension}
          stroke={stroke}
          strokeWidth={width}
          hitStrokeWidth={Math.max(16, width + 12)}
          lineCap={cap}
          lineJoin={join}
          dash={dash || undefined}
          dashEnabled={Boolean(dash)}
        />
      ))}
      <ConnectorHead kind={startKind} size={head} color={element.headFill || stroke} x={raw[0]} y={raw[1]} angle={endAngle(path.points, false)} width={width} />
      <ConnectorHead kind={endKind} size={head} color={element.headFill || stroke} x={raw[raw.length - 2]} y={raw[raw.length - 1]} angle={endAngle(path.points, true)} width={width} />
      {labelAt && (
        <Text
          x={labelAt.x - 48}
          y={labelAt.y - 18}
          width={96}
          align="center"
          text={element.label}
          fontSize={element.fontSize || 13}
          fontFamily={element.fontFamily}
          fill={element.textFill || stroke}
          listening={false}
        />
      )}
      {selected && vertices.map((index) => (
        <ArrowTip
          key={index}
          x={raw[index]}
          y={raw[index + 1]}
          scale={scale}
          accent={accent}
          label={index === 0 ? 'Inicio' : index === raw.length - 2 ? 'Punta' : 'Punto'}
          onBegin={() => {
            onBegin();
            if (index === 0 || index === raw.length - 2) onGuide?.(index === 0 ? 'from' : 'to');
          }}
          onDrag={(x, y) => moveTip(index, x, y)}
          onEnd={(x, y) => settleTip(index, x, y)}
          onRemove={index > 0 && index < raw.length - 2 ? () => {
            onBegin();
            onLive(element.id, { points: removeVertex(raw, index / 2), route: 'poly' });
            onEnd();
          } : undefined}
        />
      ))}
      {selected && route === 'curve' && raw.length === 4 && path.control && (
        <ArrowTip
          x={path.control.x}
          y={path.control.y}
          scale={scale}
          accent={accent}
          label="Curva"
          onBegin={onBegin}
          onDrag={(x, y) => onLive(element.id, { bend: bendFromPoint(raw, x, y), route: 'curve' })}
          onEnd={() => onEnd()}
        />
      )}
    </>
  );
}

const SceneNode = memo(function SceneNode({ element, tool, editing, selected, scale, accent, onSelect, onBegin, onLive, onEnd, onGuide, onDuplicate, setNode }) {
  const common = {
    id: element.id,
    x: element.x,
    y: element.y,
    rotation: element.rotation || 0,
    opacity: element.opacity ?? 1,
    draggable: tool === 'select' && !element.locked,
    listening: tool === 'select',
    onMouseDown: (event) => {
      event.cancelBubble = true;
      if (tool !== 'select' || element.locked) return;
      onSelect(element.id, event.evt.shiftKey);
    },
    onDragStart: (event) => {
      if (event.target !== event.currentTarget) return;
      if (event.evt?.altKey) onDuplicate?.(element.id);
      onBegin();
    },
    onDragMove: (event) => {
      if (event.target !== event.currentTarget) return;
      onLive(element.id, { x: event.target.x(), y: event.target.y() });
    },
    onDragEnd: (event) => {
      if (event.target !== event.currentTarget) return;
      onEnd();
    },
    onTransformStart: onBegin,
    onTransformEnd: (event) => {
      const node = event.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      if (element.type === 'line') {
        const points = (element.points || []).map((value, index) => value * (index % 2 === 0 ? scaleX : scaleY));
        onLive(element.id, { x: node.x(), y: node.y(), rotation: node.rotation(), points });
      } else {
        onLive(element.id, {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: Math.max(16, element.width * scaleX),
          height: Math.max(16, element.height * scaleY),
        });
      }
      onEnd();
    },
    ref: (node) => setNode(element.id, node),
  };

  return (
    <Group {...common}>
      {element.type === 'ellipse' ? (
        <Ellipse
          x={element.width / 2}
          y={element.height / 2}
          radiusX={element.width / 2}
          radiusY={element.height / 2}
          fill={element.fill}
          stroke={element.stroke}
          strokeWidth={element.strokeWidth || 0}
        />
      ) : isArrow(element) ? (
        <ArrowShape
          element={element}
          accent={accent}
          selected={selected && tool === 'select'}
          scale={scale}
          onBegin={onBegin}
          onLive={onLive}
          onEnd={onEnd}
          onGuide={onGuide}
        />
      ) : element.type === 'line' && element.brush === 'spray' ? (
        <SprayShape element={element} />
      ) : element.type === 'line' ? (
        <Line
          points={element.points || [0, 0, 80, 0]}
          stroke={element.stroke || accent}
          strokeWidth={element.strokeWidth || 3}
          hitStrokeWidth={16}
          lineCap={element.brush === 'pencil' ? 'butt' : 'round'}
          lineJoin={element.brush === 'pencil' ? 'miter' : 'round'}
          closed={Boolean(element.closed)}
          fill={element.closed ? element.fill : undefined}
          tension={element.brush === 'pencil' ? 0 : element.brush === 'brush' ? 0.5 : ((element.points || []).length > 6 ? 0.35 : 0)}
        />
      ) : element.type === 'image' ? (
        <RemoteImage src={element.src} width={element.width} height={element.height} cornerRadius={element.radius || 0} />
      ) : element.type === 'video' ? (
        <>
          <Rect width={element.width} height={element.height} cornerRadius={element.radius || 16} fill="#0f172a" />
          <RemoteImage src={element.poster} width={element.width} height={element.height} cornerRadius={element.radius || 16} />
        </>
      ) : element.type === 'table' ? (
        <TableShape element={element} />
      ) : (
        <Rect
          width={element.width}
          height={element.height}
          cornerRadius={cornerRadius(element) || (element.type === 'sticky' ? 8 : 0)}
          fill={element.type === 'text' ? 'transparent' : element.fill}
          stroke={element.type === 'frame' ? (element.stroke || accent) : element.stroke}
          strokeWidth={element.type === 'frame' ? (element.strokeWidth || 2) : (element.strokeWidth || 0)}
          shadowBlur={element.shadow || 0}
          shadowColor="rgba(15,23,42,0.28)"
          shadowOffsetY={element.shadow ? 8 : 0}
        />
      )}
      {element.type !== 'line' && element.type !== 'image' && element.type !== 'table' && (
        <Text
          text={element.text || ''}
          width={element.width}
          height={element.height}
          padding={element.type === 'text' ? 0 : 12}
          align={element.align || 'center'}
          verticalAlign="middle"
          fontSize={element.fontSize || 16}
          fontStyle={fontStyle(element)}
          fontFamily={element.fontFamily}
          fill={textColor(element)}
          textDecoration={element.textDecoration || ''}
          letterSpacing={element.letterSpacing || 0}
          opacity={editing ? 0 : 1}
          listening={false}
        />
      )}
    </Group>
  );
});

function SprayShape({ element }) {
  const points = element.points || [];
  let minX = 0;
  let minY = 0;
  let maxX = 1;
  let maxY = 1;
  if (points.length >= 2) {
    minX = Infinity;
    minY = Infinity;
    maxX = -Infinity;
    maxY = -Infinity;
    for (let index = 0; index < points.length; index += 2) {
      minX = Math.min(minX, points[index]);
      maxX = Math.max(maxX, points[index]);
      minY = Math.min(minY, points[index + 1]);
      maxY = Math.max(maxY, points[index + 1]);
    }
  }
  const radius = Math.max(1.4, (element.strokeWidth || 8) * 0.22);
  const pad = radius + 4;
  const dots = [];
  for (let index = 0; index < points.length; index += 2) {
    dots.push(
      <Circle key={index} x={points[index]} y={points[index + 1]} radius={radius} fill={element.stroke || '#1e293b'} listening={false} />,
    );
  }
  return (
    <>
      <Rect x={minX - pad} y={minY - pad} width={Math.max(8, maxX - minX + pad * 2)} height={Math.max(8, maxY - minY + pad * 2)} fill="rgba(0,0,0,0.001)" />
      {dots}
    </>
  );
}

function TableShape({ element }) {
  const rows = element.rows || 3;
  const cols = element.cols || 3;
  const cells = element.cells || [];
  const cellWidth = element.width / cols;
  const cellHeight = element.height / rows;
  const nodes = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      nodes.push(
        <Rect
          key={`box-${index}`}
          x={col * cellWidth}
          y={row * cellHeight}
          width={cellWidth}
          height={cellHeight}
          fill={row === 0 ? (element.fill || '#e8f6f1') : '#ffffff'}
          stroke={element.stroke || '#d7e3de'}
          strokeWidth={1}
        />,
        <Text
          key={`text-${index}`}
          x={col * cellWidth}
          y={row * cellHeight}
          width={cellWidth}
          height={cellHeight}
          text={cells[index] || ''}
          align="center"
          verticalAlign="middle"
          fontSize={element.fontSize || 14}
          fontStyle={fontStyle(element)}
          fill={textColor(element)}
          padding={4}
          listening={false}
        />,
      );
    }
  }
  return nodes;
}

const PortfolioEditorPage = () => {
  const { hojaId } = useParams();
  const { user } = useAuth();
  const { projects } = useProjects(user?.id);
  const [state, dispatch] = useReducer(editorReducer, {
    elements: [], past: [], future: [], gesturing: false, dirty: false, epoch: 0,
  });
  const [camera, setCamera] = useState({ x: 80, y: 80, scale: 1 });
  const [tool, setTool] = useState('select');
  const [brush, setBrush] = useState({ size: 12, style: 'brush', color: '#1e293b' });
  const [shape, setShape] = useState('rect');
  const [arrowRoute, setArrowRoute] = useState('straight');
  const [shapesOpen, setShapesOpen] = useState(false);
  const [selection, setSelection] = useState([]);
  const [tipDrag, setTipDrag] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [meta, setMeta] = useState(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('saved');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorTab, setInspectorTab] = useState('design');
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [librarySection, setLibrarySection] = useState('elements');
  const [uploads, setUploads] = useState([]);
  const [people, setPeople] = useState([]);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [access, setAccess] = useState(null);
  const [shareEmail, setShareEmail] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [shareNote, setShareNote] = useState('');
  const [presentMode, setPresentMode] = useState('editor');
  const presenting = presentMode === 'entering' || presentMode === 'presenting';
  const [frameIndex, setFrameIndex] = useState(0);
  const [player, setPlayer] = useState(null);
  const [full, setFull] = useState(false);
  const [modifiers, setModifiers] = useState({ shift: false, alt: false });
  const [accent, setAccent] = useState('#67BFA1');
  const stageRef = useRef(null);
  const hostRef = useRef(null);
  const nodeRefs = useRef(new Map());
  const transformerRef = useRef(null);
  const elementsRef = useRef(state.elements);
  const cameraRef = useRef(camera);
  const toolRef = useRef(tool);
  const brushRef = useRef(brush);
  const shapeRef = useRef(shape);
  const arrowRouteRef = useRef(arrowRoute);
  const selectionRef = useRef(selection);
  const revisionRef = useRef(0);
  const epochRef = useRef(0);
  const drawRef = useRef(null);
  const panRef = useRef(null);
  const spaceRef = useRef(false);
  const clipboardRef = useRef([]);
  const editorRef = useRef(null);
  const peopleRef = useRef(null);
  const shareRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraMemory = useRef(null);
  const presentingRef = useRef(false);
  const presentModeRef = useRef('editor');
  const stopPresentRef = useRef(() => {});
  const stepFrameRef = useRef(() => {});
  elementsRef.current = state.elements;
  cameraRef.current = camera;
  toolRef.current = tool;
  brushRef.current = brush;
  shapeRef.current = shape;
  arrowRouteRef.current = arrowRoute;
  selectionRef.current = selection;
  epochRef.current = state.epoch;

  useEffect(() => {
    const read = () => setAccent(getComputedStyle(document.documentElement).getPropertyValue('--app-accent').trim() || '#67BFA1');
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = stageRef.current?.container();
    if (!node) return;
    if (tool === 'hand') node.style.cursor = 'grab';
    else if (tool === 'brush' && brush.style === 'bucket') node.style.cursor = 'cell';
    else if (tool === 'brush' || tool === 'text' || ['rect', 'ellipse', 'line', 'frame'].includes(tool)) node.style.cursor = 'crosshair';
    else node.style.cursor = 'default';
  }, [tool, brush.style, ready]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const observer = new ResizeObserver(() => setSize({ width: host.clientWidth, height: host.clientHeight }));
    observer.observe(host);
    setSize({ width: host.clientWidth, height: host.clientHeight });
    return () => observer.disconnect();
  }, [ready]);

  useEffect(() => {
    if (!user?.id || !hojaId) return undefined;
    let cancel = false;
    (async () => {
      try {
        const sheet = await portfolioRepository.get(hojaId, user.id);
        if (cancel) return;
        const document = parseDocument(sheet.document);
        dispatch({ type: 'load', elements: document.elements });
        if (document.viewport) setCamera(document.viewport);
        revisionRef.current = sheet.revision;
        setMeta(sheet);
        setName(sheet.name);
        setReady(true);
        setStatus('saved');
      } catch (err) {
        if (!cancel) setError(err.message || 'No se pudo abrir la hoja.');
      }
    })();
    return () => { cancel = true; };
  }, [hojaId, user?.id]);

  useEffect(() => {
    if (!ready || !state.dirty || !meta?.canEdit || meta.deleted) return undefined;
    const epoch = state.epoch;
    const timer = window.setTimeout(async () => {
      if (!navigator.onLine) {
        setStatus('offline');
        return;
      }
      setStatus('saving');
      try {
        const saved = await portfolioRepository.saveDocument(hojaId, {
          userId: user.id,
          revision: revisionRef.current,
          document: serializeDocument(elementsRef.current, cameraRef.current),
        });
        revisionRef.current = saved.revision;
        if (epochRef.current === epoch) {
          dispatch({ type: 'clean' });
          setStatus('saved');
        }
      } catch (err) {
        if (err.status === 409) {
          try {
            const fresh = await portfolioRepository.get(hojaId, user.id);
            const document = parseDocument(fresh.document);
            revisionRef.current = fresh.revision;
            dispatch({ type: 'load', elements: document.elements });
            setStatus('saved');
            setError('Se recuperó la versión guardada en el servidor.');
          } catch (reloadError) {
            setStatus('error');
            setError(reloadError.message);
          }
          return;
        }
        setStatus(navigator.onLine ? 'error' : 'offline');
        setError(err.message || 'Error al guardar.');
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [state.dirty, state.epoch, ready, meta, hojaId, user?.id]);

  useEffect(() => {
    const onKey = (event) => {
      const typing = ['INPUT', 'TEXTAREA'].includes(event.target.tagName);
      const editingText = event.target.classList?.contains('pf-text-editor');
      if (event.code === 'Space' && !typing) {
        event.preventDefault();
        spaceRef.current = event.type === 'keydown';
      }
      if (event.type !== 'keydown') return;
      if (editingText) {
        const key = event.key.toLowerCase();
        const mod = event.metaKey || event.ctrlKey;
        if (key === 'escape') {
          event.preventDefault();
          event.target.blur();
        } else if (mod && (key === 'z' || key === 'y')) {
          event.preventDefault();
          event.target.blur();
          dispatch({ type: key === 'y' || event.shiftKey ? 'redo' : 'undo' });
        }
        return;
      }
      if (typing) return;
      const key = event.key.toLowerCase();
      const mod = event.metaKey || event.ctrlKey;
      if (mod && key === 'z') {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
      } else if (mod && key === 'y') {
        event.preventDefault();
        dispatch({ type: 'redo' });
      } else if (mod && key === 'd') {
        event.preventDefault();
        duplicate();
      } else if (mod && key === 'a') {
        event.preventDefault();
        setSelection(elementsRef.current.filter((element) => element.visible !== false && !element.locked).map((element) => element.id));
      } else if (mod && key === 'c') {
        clipboardRef.current = elementsRef.current.filter((element) => selectionRef.current.includes(element.id));
      } else if (mod && key === 'v') {
        event.preventDefault();
        paste();
      } else if (key === 'backspace' || key === 'delete') {
        removeSelected();
      } else if (presentingRef.current && key === 'arrowright') {
        event.preventDefault();
        stepFrameRef.current(1);
      } else if (presentingRef.current && key === 'arrowleft') {
        event.preventDefault();
        stepFrameRef.current(-1);
      } else if (key === 'escape') {
        if (presentingRef.current) {
          stopPresentRef.current();
          return;
        }
        dispatch({ type: 'end' });
        setEditingId(null);
        setSelection([]);
        setShapesOpen(false);
      } else if (key === 'v') setTool('select');
      else if (key === 'h') setTool('hand');
      else if (key === 'b') setTool('brush');
      else if (key === 't') setTool('text');
      else if (key === 'r') { setShape('rect'); setTool('rect'); }
      else if (key === 'o') { setShape('ellipse'); setTool('ellipse'); }
      else if (key === 'l') { setShape('line'); setTool('line'); }
      else if (key === 'f') { setShape('frame'); setTool('frame'); }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, []);

  const live = (id, partial) => {
    const elements = syncConnectors(elementsRef.current.map((element) => (element.id === id ? { ...element, ...partial } : element)));
    elementsRef.current = elements;
    dispatch({ type: 'live', elements });
  };

  const commit = (elements) => dispatch({ type: 'commit', elements: syncConnectors(elements) });

  const duplicateInPlace = (id) => {
    const source = elementsRef.current.find((element) => element.id === id);
    if (!source) return;
    dispatch({ type: 'begin' });
    const clone = cloneElement(source, 0);
    const elements = [];
    elementsRef.current.forEach((element) => {
      if (element.id === id) elements.push(clone);
      elements.push(element);
    });
    elementsRef.current = elements;
    dispatch({ type: 'live', elements });
  };

  const finishTip = (id, index, x, y) => {
    setTipDrag(null);
    const current = elementsRef.current.find((element) => element.id === id);
    if (!current?.points) {
      dispatch({ type: 'end' });
      return;
    }
    const points = current.points.slice();
    points[index] = x;
    points[index + 1] = y;
    const draft = {
      ...current,
      points,
      from: index === 0 ? null : current.from,
      to: index === points.length - 2 ? null : current.to,
    };
    const linked = attachEnds(draft, elementsRef.current);
    live(id, linked || { points, from: draft.from, to: draft.to });
    dispatch({ type: 'end' });
  };

  const tipGuide = useMemo(() => {
    if (!tipDrag) return null;
    const arrow = state.elements.find((element) => element.id === tipDrag.id);
    if (!isArrow(arrow)) return null;
    const atEnd = tipDrag.end === 'to';
    const points = arrow.points;
    return {
      id: arrow.id,
      x: arrow.x + (atEnd ? points[points.length - 2] : points[0]),
      y: arrow.y + (atEnd ? points[points.length - 1] : points[1]),
    };
  }, [tipDrag, state.elements]);

  const selectedElements = state.elements.filter((element) => selection.includes(element.id));
  const primary = selectedElements.length === 1 ? selectedElements[0] : null;
  const swatch = primary ? (primary.type === 'text' ? textColor(primary) : primary.fill) : '#ffffff';
  const swatchValue = /^#[0-9a-fA-F]{6}$/.test(swatch) ? swatch : '#ffffff';

  const visibleElements = useMemo(() => {
    const view = {
      x: -camera.x / camera.scale - 240,
      y: -camera.y / camera.scale - 240,
      width: size.width / camera.scale + 480,
      height: size.height / camera.scale + 480,
    };
    return state.elements.filter((element) => {
      if (element.visible === false) return false;
      if (selection.includes(element.id)) return true;
      return intersects(elementBounds(element), view);
    });
  }, [state.elements, camera, size, selection]);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const nodes = selection
      .map((id) => ({ id, node: nodeRefs.current.get(id) }))
      .filter(({ id, node }) => {
        const element = state.elements.find((item) => item.id === id);
        return node && element && !element.locked && element.visible !== false && element.id !== editingId && !isArrow(element);
      })
      .map(({ node }) => node);
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selection, editingId, state.elements.map((element) => `${element.id}:${element.locked}:${element.visible}`).join('|')]);

  const worldFromEvent = (stage) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const current = cameraRef.current;
    return { x: (pointer.x - current.x) / current.scale, y: (pointer.y - current.y) / current.scale };
  };

  const addElement = (partial) => {
    const element = createElement(partial);
    commit([...elementsRef.current, element]);
    setSelection([element.id]);
    return element;
  };

  const insertElements = (partials) => {
    const drafts = partials.map((partial) => createElement({ x: 0, y: 0, ...partial }));
    const bounds = sceneBounds(drafts);
    const cam = cameraRef.current;
    const cx = (size.width / 2 - cam.x) / cam.scale;
    const cy = (size.height / 2 - cam.y) / cam.scale;
    const dx = bounds ? cx - (bounds.x + bounds.width / 2) : cx;
    const dy = bounds ? cy - (bounds.y + bounds.height / 2) : cy;
    const placed = drafts.map((element) => ({ ...element, id: createId(), x: element.x + dx, y: element.y + dy }));
    commit([...elementsRef.current, ...placed]);
    setSelection(placed.map((element) => element.id));
    setTool('select');
    placed.filter((element) => element.src || element.type === 'file').forEach((element) => {
      setUploads((current) => [{ key: element.id, name: element.name, element }, ...current].slice(0, 24));
    });
  };

  const fitBounds = (bounds, padding = 96) => {
    if (!bounds || size.width < 20) return;
    const scale = Math.min(1.5, Math.max(0.1, Math.min((size.width - padding) / bounds.width, (size.height - padding) / bounds.height)));
    const next = {
      scale,
      x: (size.width - bounds.width * scale) / 2 - bounds.x * scale,
      y: (size.height - bounds.height * scale) / 2 - bounds.y * scale,
    };
    setCamera(next);
    cameraRef.current = next;
  };

  const playMotion = (element) => {
    const node = nodeRefs.current.get(element.id);
    if (!node || !element.motion || element.motion === 'none') return;
    const duration = element.motionDuration || 0.45;
    if (element.motion === 'rise') node.y(element.y + 28);
    if (element.motion === 'pop') { node.scaleX(0.86); node.scaleY(0.86); }
    node.opacity(0);
    node.to({ x: element.x, y: element.y, scaleX: 1, scaleY: 1, opacity: element.opacity ?? 1, duration });
  };

  const duplicate = () => {
    const copies = elementsRef.current
      .filter((element) => selectionRef.current.includes(element.id) && !element.locked)
      .map((element) => cloneElement(element, 24));
    if (copies.length === 0) return;
    commit([...elementsRef.current, ...copies]);
    setSelection(copies.map((element) => element.id));
  };

  const paste = () => {
    const copies = clipboardRef.current.map((element) => cloneElement(element, 32));
    if (copies.length === 0) return;
    commit([...elementsRef.current, ...copies]);
    setSelection(copies.map((element) => element.id));
  };

  const removeSelected = () => {
    const ids = new Set(selectionRef.current);
    const remaining = elementsRef.current.filter((element) => !ids.has(element.id) || element.locked);
    if (remaining.length === elementsRef.current.length) return;
    commit(remaining);
    setSelection([]);
    setEditingId(null);
  };

  const fit = (onlySelection = false) => {
    const source = onlySelection
      ? state.elements.filter((element) => selection.includes(element.id))
      : state.elements;
    const bounds = sceneBounds(source);
    if (!bounds || size.width < 20) {
      setCamera({ x: 80, y: 80, scale: 1 });
      return;
    }
    const scale = Math.min(1.5, Math.max(0.1, Math.min((size.width - 120) / bounds.width, (size.height - 120) / bounds.height)));
    setCamera({
      scale,
      x: (size.width - bounds.width * scale) / 2 - bounds.x * scale,
      y: (size.height - bounds.height * scale) / 2 - bounds.y * scale,
    });
    dispatch({ type: 'touch' });
  };

  const zoomBy = (factor) => {
    const current = cameraRef.current;
    const nextScale = Math.min(4, Math.max(0.1, current.scale * factor));
    const cx = size.width / 2;
    const cy = size.height / 2;
    const point = { x: (cx - current.x) / current.scale, y: (cy - current.y) / current.scale };
    const next = { scale: nextScale, x: cx - point.x * nextScale, y: cy - point.y * nextScale };
    setCamera(next);
    cameraRef.current = next;
    dispatch({ type: 'touch' });
  };

  const onWheel = (event) => {
    event.evt.preventDefault();
    const native = event.evt;
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    const current = cameraRef.current;
    if (!pointer) return;
    if (native.ctrlKey || native.metaKey) {
      const oldScale = current.scale;
      const nextScale = Math.min(4, Math.max(0.1, oldScale * (native.deltaY > 0 ? 0.92 : 1.08)));
      const point = { x: (pointer.x - current.x) / oldScale, y: (pointer.y - current.y) / oldScale };
      const next = { scale: nextScale, x: pointer.x - point.x * nextScale, y: pointer.y - point.y * nextScale };
      setCamera(next);
      cameraRef.current = next;
      dispatch({ type: 'touch' });
      return;
    }
    let dx = native.deltaX;
    let dy = native.deltaY;
    if (native.shiftKey) {
      dx += dy;
      dy = 0;
    }
    const next = { ...current, x: current.x - dx, y: current.y - dy };
    setCamera(next);
    cameraRef.current = next;
    dispatch({ type: 'touch' });
  };

  const onMouseDown = (event) => {
    if (!meta?.canEdit || meta.deleted) return;
    const stage = event.target.getStage();
    const world = worldFromEvent(stage);
    if (!world) return;
    const pointer = stage.getPointerPosition();
    const drawing = ['rect', 'ellipse', 'frame', 'line'].includes(toolRef.current);
    if (toolRef.current === 'hand' || spaceRef.current || event.evt.button === 1) {
      panRef.current = pointer;
      return;
    }
    if (toolRef.current === 'brush') {
      const ink = brushRef.current;
      const color = ink.color || accent;
      if (ink.style === 'bucket') {
        const target = [...elementsRef.current].reverse().find((element) => {
          if (element.visible === false || element.locked) return false;
          const box = elementBounds(element);
          return world.x >= box.x && world.x <= box.x + box.width && world.y >= box.y && world.y <= box.y + box.height;
        });
        if (!target) return;
        const partial = paintOf(target, color);
        if (!partial) return;
        commit(elementsRef.current.map((element) => (element.id === target.id ? { ...element, ...partial } : element)));
        setSelection([target.id]);
        return;
      }
      const strokeWidth = ink.style === 'pencil' ? Math.max(1, Math.round(ink.size * 0.4)) : ink.size;
      const points = ink.style === 'spray' ? sprayDots(0, 0, ink.size, 12) : [0, 0];
      const element = createElement({
        type: 'line',
        name: ink.style === 'spray' ? 'Aerosol' : ink.style === 'pencil' ? 'Lápiz' : 'Pincel',
        x: world.x,
        y: world.y,
        width: 1,
        height: 1,
        points,
        stroke: color,
        strokeWidth,
        fill: 'transparent',
        text: '',
        brush: ink.style,
      });
      drawRef.current = { id: element.id, origin: world, type: 'brush', points };
      const elements = [...elementsRef.current, element];
      elementsRef.current = elements;
      dispatch({ type: 'begin' });
      dispatch({ type: 'live', elements });
      return;
    }
    if (toolRef.current === 'text') {
      const element = addElement({
        type: 'text', name: 'Texto', x: world.x, y: world.y, width: 220, height: 48,
        text: 'Escribe aquí', fill: 'transparent', textFill: '#1e293b', fontSize: 22, align: 'left',
      });
      setEditingId(element.id);
      setTool('select');
      return;
    }
    if (drawing) {
      const kind = toolRef.current === 'line' ? 'line' : shapeRef.current;
      const route = arrowRouteRef.current;
      const element = createElement({
        type: kind,
        name: kind === 'ellipse' ? 'Elipse' : kind === 'line' ? 'Flecha' : kind === 'frame' ? 'Marco' : 'Rectángulo',
        x: world.x,
        y: world.y,
        width: 4,
        height: 4,
        text: '',
        fill: kind === 'line' ? accent : kind === 'frame' ? 'transparent' : '#ffffff',
        stroke: accent,
        strokeWidth: kind === 'line' || kind === 'frame' ? 3 : 0,
        points: kind === 'line' ? [0, 0, 0, 0] : null,
        route: kind === 'line' ? route : undefined,
        bend: kind === 'line' && route === 'curve' ? 48 : 0,
        headStart: kind === 'line' ? 'none' : undefined,
        headEnd: kind === 'line' ? 'triangle' : undefined,
        dash: kind === 'line' ? 'solid' : undefined,
        radius: kind === 'rect' ? 0 : undefined,
      });
      drawRef.current = { id: element.id, origin: world, type: kind };
      const elements = [...elementsRef.current, element];
      elementsRef.current = elements;
      dispatch({ type: 'begin' });
      dispatch({ type: 'live', elements });
      return;
    }
    if (event.target === stage) {
      dispatch({ type: 'end' });
      setEditingId(null);
      setMarquee({ x: world.x, y: world.y, width: 0, height: 0, shift: event.evt.shiftKey });
      if (!event.evt.shiftKey) setSelection([]);
    }
  };

  const onMouseMove = () => {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    const world = stage ? worldFromEvent(stage) : null;
    if (panRef.current && pointer) {
      const dx = pointer.x - panRef.current.x;
      const dy = pointer.y - panRef.current.y;
      panRef.current = pointer;
      const next = { ...cameraRef.current, x: cameraRef.current.x + dx, y: cameraRef.current.y + dy };
      cameraRef.current = next;
      setCamera(next);
      return;
    }
    if (drawRef.current && world) {
      const { id, origin, type } = drawRef.current;
      if (type === 'brush') {
        const ink = brushRef.current;
        const points = drawRef.current.points || [];
        if (ink.style === 'spray') points.push(...sprayDots(world.x - origin.x, world.y - origin.y, ink.size, 7));
        else points.push(world.x - origin.x, world.y - origin.y);
        drawRef.current.points = points;
        live(id, { points: points.slice() });
      } else if (type === 'line') {
        const points = [0, 0, world.x - origin.x, world.y - origin.y];
        const route = arrowRouteRef.current;
        live(id, { points, route, bend: route === 'curve' ? defaultBend(points) : 0 });
      } else {
        live(id, {
          x: Math.min(origin.x, world.x),
          y: Math.min(origin.y, world.y),
          width: Math.abs(world.x - origin.x),
          height: Math.abs(world.y - origin.y),
        });
      }
      return;
    }
    if (marquee && world) {
      setMarquee((current) => current && ({
        ...current,
        width: world.x - current.x,
        height: world.y - current.y,
      }));
    }
  };

  const onMouseUp = () => {
    if (panRef.current) {
      panRef.current = null;
      dispatch({ type: 'touch' });
    }
    if (drawRef.current) {
      const kind = drawRef.current.type;
      const element = elementsRef.current.find((item) => item.id === drawRef.current.id);
      const box = element ? elementBounds(element) : null;
      drawRef.current = null;
      const tiny = kind === 'brush'
        ? (element?.points?.length || 0) < 4
        : !box || (box.width < 6 && box.height < 6);
      if (tiny) dispatch({ type: 'undo' });
      else {
        if (kind === 'line') {
          const linked = attachEnds(element, elementsRef.current);
          if (linked) live(element.id, linked);
        }
        dispatch({ type: 'end' });
        setSelection([element.id]);
        if (kind !== 'brush') setTool('select');
      }
    }
    if (marquee) {
      const box = {
        x: Math.min(marquee.x, marquee.x + marquee.width),
        y: Math.min(marquee.y, marquee.y + marquee.height),
        width: Math.abs(marquee.width),
        height: Math.abs(marquee.height),
      };
      if (box.width > 3 && box.height > 3) {
        const hits = elementsRef.current
          .filter((element) => element.visible !== false && !element.locked && intersects(elementBounds(element), box))
          .map((element) => element.id);
        setSelection(marquee.shift ? [...new Set([...selectionRef.current, ...hits])] : hits);
      }
      setMarquee(null);
    }
  };

  const updatePrimary = (partial) => {
    if (!primary) return;
    commit(state.elements.map((element) => (element.id === primary.id ? { ...element, ...partial } : element)));
  };

  useDismiss(peopleOpen, () => setPeopleOpen(false), peopleRef);
  useDismiss(shareOpen, () => setShareOpen(false), shareRef);

  useEffect(() => {
    const syncKeys = (event) => setModifiers({ shift: event.shiftKey, alt: event.altKey });
    const clearKeys = () => setModifiers({ shift: false, alt: false });
    window.addEventListener('keydown', syncKeys);
    window.addEventListener('keyup', syncKeys);
    window.addEventListener('blur', clearKeys);
    return () => {
      window.removeEventListener('keydown', syncKeys);
      window.removeEventListener('keyup', syncKeys);
      window.removeEventListener('blur', clearKeys);
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      const ours = document.fullscreenElement === editorRef.current;
      setFull(Boolean(document.fullscreenElement));
      if (presentModeRef.current === 'entering' && ours) {
        presentModeRef.current = 'presenting';
        presentingRef.current = true;
        setPresentMode('presenting');
      } else if (presentModeRef.current === 'presenting' && !ours) {
        stopPresentRef.current();
      }
    };
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  useEffect(() => {
    if (!ready || !user?.id || !hojaId) return undefined;
    let alive = true;
    const beat = async () => {
      try {
        const list = await portfolioRepository.presence(hojaId, user.id);
        if (alive) setPeople(Array.isArray(list) ? list : []);
      } catch {
        /* La presencia se reintenta en el siguiente pulso. */
      }
    };
    beat();
    const timer = window.setInterval(beat, 8000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [ready, hojaId, user?.id]);

  const saveName = async () => {
    if (!meta?.canManage) return;
    const trimmed = name.trim() || 'Sin título';
    setName(trimmed);
    if (trimmed === meta.name) return;
    const updated = await portfolioRepository.update(hojaId, { userId: user.id, name: trimmed });
    setMeta(updated);
  };

  const frames = state.elements
    .filter((element) => element.type === 'frame' && element.visible !== false)
    .slice()
    .sort((a, b) => a.x - b.x || a.y - b.y);

  const showFrame = (index) => {
    const frame = frames[index];
    const target = frame ? elementBounds(frame) : sceneBounds(state.elements.filter((element) => element.visible !== false));
    if (target) fitBounds(target, 120);
    const cast = frame
      ? state.elements.filter((element) => element.id !== frame.id && intersects(elementBounds(element), elementBounds(frame)))
      : state.elements;
    cast.forEach(playMotion);
  };

  const setMode = (mode) => {
    presentModeRef.current = mode;
    presentingRef.current = mode === 'entering' || mode === 'presenting';
    setPresentMode(mode);
  };

  const startPresent = () => {
    if (presentModeRef.current !== 'editor') return;
    cameraMemory.current = { ...cameraRef.current };
    setFrameIndex(0);
    setMode('entering');
    showFrame(0);
    const node = editorRef.current;
    if (!node?.requestFullscreen) {
      setMode('presenting');
      return;
    }
    node.requestFullscreen().then(() => {
      if (presentModeRef.current === 'entering') setMode('presenting');
    }).catch(() => {
      if (presentModeRef.current === 'entering') setMode('presenting');
    });
  };

  const stopPresent = () => {
    if (presentModeRef.current === 'editor' || presentModeRef.current === 'exiting') return;
    setMode('exiting');
    if (cameraMemory.current) {
      setCamera(cameraMemory.current);
      cameraRef.current = cameraMemory.current;
    }
    setMode('editor');
    const node = editorRef.current;
    if (node && document.fullscreenElement === node) document.exitFullscreen?.().catch(() => {});
  };
  stopPresentRef.current = stopPresent;

  const stepFrame = (direction) => {
    if (frames.length === 0) return;
    const next = (frameIndex + direction + frames.length) % frames.length;
    setFrameIndex(next);
    const frame = frames[next];
    fitBounds(elementBounds(frame), 120);
    state.elements
      .filter((element) => element.id !== frame.id && intersects(elementBounds(element), elementBounds(frame)))
      .forEach(playMotion);
  };
  stepFrameRef.current = stepFrame;

  const openShare = async () => {
    setShareOpen(true);
    setPeopleOpen(false);
    setShareNote('');
    if (!meta?.canManage) return;
    try {
      setAccess(await portfolioRepository.access(hojaId, user.id));
    } catch (err) {
      setShareNote(err.message || 'No se pudo abrir el acceso.');
    }
  };

  const changeAccess = async (patch) => {
    try {
      const next = await portfolioRepository.updateAccess(hojaId, { userId: user.id, ...patch });
      setAccess(next);
      setShareNote('');
      if (patch.visibility) setMeta((current) => current && ({ ...current, visibility: patch.visibility }));
    } catch (err) {
      setShareNote(err.message || 'No se pudo actualizar el acceso.');
    }
  };

  const onPickImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const image = await readImageFile(file);
      const height = Math.max(80, Math.round(280 * (image.height / image.width)));
      insertElements([{ type: 'image', name: file.name, width: 280, height, src: image.src, text: '', fill: 'transparent' }]);
    } catch (err) {
      setError(err.message);
    }
  };

  const onPickFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.type.startsWith('image/')) {
      onPickImage({ target: { files: [file], value: '' } });
      return;
    }
    insertElements([{ type: 'file', name: file.name, width: 220, height: 72, fill: '#ffffff', stroke: '#cbd5e1', strokeWidth: 1, radius: 14, text: file.name, align: 'left', fontSize: 14 }]);
  };

  const statusLabel = status === 'saving' ? 'Guardando…' : status === 'offline' ? 'Sin conexión' : status === 'error' ? 'Error al guardar' : 'Guardado';
  const marqueeBox = marquee && {
    x: Math.min(marquee.x, marquee.x + marquee.width),
    y: Math.min(marquee.y, marquee.y + marquee.height),
    width: Math.abs(marquee.width),
    height: Math.abs(marquee.height),
  };
  const editing = state.elements.find((element) => element.id === editingId);

  if (error && !ready) {
    return <div className="pf-page p-8"><p className="pf-error font-semibold">{error}</p><Link to="/portafolio" className="ps-quiet mt-4">Volver</Link></div>;
  }

  return (
    <div className={`pf-editor${presenting ? ' is-presenting' : ''}`} ref={editorRef}>
      <header className="pf-top">
        <Link to="/portafolio" className="pf-icon-btn" aria-label="Volver a Portafolio" title="Volver a Portafolio"><ChevronLeft size={18} /></Link>
        <label className="pf-name-wrap">
          <input
            className="pf-name"
            value={name}
            aria-label="Nombre de la hoja"
            disabled={!meta?.canManage}
            onChange={(event) => setName(event.target.value)}
            onBlur={saveName}
            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
          />
          {meta?.canManage && <Pencil size={14} />}
        </label>
        {meta && (
          <button
            type="button"
            className={`pf-icon-btn pf-star${meta.favorite ? ' is-on' : ''}`}
            aria-label="Favorita"
            onClick={async () => {
              const updated = await portfolioRepository.update(hojaId, { userId: user.id, favorite: !meta.favorite });
              setMeta(updated);
            }}
          >
            <Star size={16} fill={meta.favorite ? 'currentColor' : 'none'} />
          </button>
        )}
        <span className={`pf-status${status === 'error' ? ' is-error' : ''}`}>{ready ? statusLabel : 'Abriendo…'}</span>
        {error && <span className="pf-error text-xs font-semibold">{error}</span>}
        <div className="pf-top-spacer" />
        <div className="pf-presence" ref={peopleRef}>
          <button type="button" className="pf-faces" aria-label="Personas en la hoja" aria-expanded={peopleOpen} onClick={() => { setPeopleOpen((open) => !open); setShareOpen(false); }}>
            {people.slice(0, 3).map((person) => <Face key={person.id} person={person} />)}
            {people.length > 3 && <span className="pf-more">+{people.length - 3}</span>}
            {people.length === 0 && <Users size={16} />}
          </button>
          <div className={`pf-pop pf-people${peopleOpen ? ' is-open' : ''}`} role="dialog" aria-label="Personas en la hoja">
            <p>En esta hoja ahora</p>
            {people.length === 0 && <span className="pf-kicker">Conectando…</span>}
            {people.map((person, index) => (
              <div key={person.id} className="pf-person" style={{ '--i': index }}>
                <Face person={person} />
                <span>{person.name || person.email}</span>
              </div>
            ))}
          </div>
        </div>
        <button type="button" className="pf-present" onClick={presenting ? stopPresent : startPresent}>{presenting ? 'Salir' : 'Presentar'}</button>
        <div className="pf-share-wrap" ref={shareRef}>
          <button type="button" className="pf-share" aria-expanded={shareOpen} onClick={() => (shareOpen ? setShareOpen(false) : openShare())}><Share2 size={15} /> Compartir</button>
          <SharePanel
            open={shareOpen}
            meta={meta}
            access={access}
            projects={projects}
            email={shareEmail}
            memberQuery={memberQuery}
            note={shareNote}
            hojaId={hojaId}
            onEmail={setShareEmail}
            onMemberQuery={setMemberQuery}
            onClose={() => setShareOpen(false)}
            onChange={changeAccess}
            onLinkProject={async (projectId) => {
              const updated = await portfolioRepository.update(hojaId, { userId: user.id, projectId });
              setMeta(updated);
              setAccess(await portfolioRepository.access(hojaId, user.id));
            }}
            onNote={setShareNote}
          />
        </div>
      </header>
      <div className="pf-body">
        <EditorLibrary
          open={libraryOpen}
          section={librarySection}
          onSection={setLibrarySection}
          onToggle={() => setLibraryOpen((open) => !open)}
          onInsert={insertElements}
          uploads={uploads}
        />
        <div className="pf-stage" ref={hostRef}>
          <div
            className="pf-dots"
            style={{
              backgroundSize: `${24 * camera.scale}px ${24 * camera.scale}px`,
              backgroundPosition: `${camera.x}px ${camera.y}px`,
            }}
          />
          {ready && (
            <Stage
              ref={stageRef}
              width={size.width}
              height={size.height}
              x={camera.x}
              y={camera.y}
              scaleX={camera.scale}
              scaleY={camera.scale}
              onWheel={onWheel}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onDblClick={(event) => {
                let node = event.target;
                const stage = event.target.getStage();
                const world = worldFromEvent(stage);
                while (node && node !== stage) {
                  const element = elementsRef.current.find((item) => item.id === node.id());
                  if (element && element.type === 'link' && /^https?:\/\//i.test(element.href || '')) {
                    window.open(element.href, '_blank', 'noopener,noreferrer');
                    return;
                  }
                  if (element && element.type === 'video' && element.src) {
                    setPlayer({ src: element.src, title: element.name });
                    return;
                  }
                  if (element && isArrow(element) && world) {
                    const local = localPoint(element, world.x, world.y);
                    commit(elementsRef.current.map((item) => (item.id === element.id
                      ? { ...item, points: insertVertex(item.points, local.x, local.y), route: 'poly' }
                      : item)));
                    setSelection([element.id]);
                    return;
                  }
                  if (element && element.type !== 'line' && element.type !== 'image' && element.type !== 'video' && element.type !== 'table') {
                    setEditingId(element.id);
                    return;
                  }
                  node = node.getParent();
                }
              }}
            >
              <Layer>
                {visibleElements.map((element) => (
                  <SceneNode
                    key={element.id}
                    element={element}
                    tool={tool}
                    selected={selection.length === 1 && selection[0] === element.id}
                    scale={camera.scale}
                    editing={element.id === editingId}
                    accent={accent}
                    onSelect={(id, shift) => {
                      setSelection((current) => {
                        if (shift) return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
                        return current.includes(id) ? current : [id];
                      });
                    }}
                    onBegin={() => dispatch({ type: 'begin' })}
                    onLive={live}
                    onGuide={isArrow(element) ? (end) => setTipDrag({ id: element.id, end }) : undefined}
                    onEnd={(index, x, y) => (typeof index === 'number' ? finishTip(element.id, index, x, y) : dispatch({ type: 'end' }))}
                    onDuplicate={duplicateInPlace}
                    setNode={(id, node) => {
                      if (node) nodeRefs.current.set(id, node);
                      else nodeRefs.current.delete(id);
                    }}
                  />
                ))}
                {tipGuide && (
                  <ConnectionGuides
                    x={tipGuide.x}
                    y={tipGuide.y}
                    elements={state.elements}
                    scale={camera.scale}
                    accent={accent}
                    ignoreId={tipGuide.id}
                  />
                )}
                {marqueeBox && <Rect {...marqueeBox} fill={`${accent}33`} stroke={accent} listening={false} />}
                <Transformer ref={transformerRef} rotateEnabled keepRatio={modifiers.shift} centeredScaling={modifiers.alt} borderStroke={accent} anchorStroke={accent} anchorFill="#ffffff" />
              </Layer>
            </Stage>
          )}
          {editing && (
            <textarea
              className="pf-text-editor"
              autoFocus
              value={editing.text || ''}
              aria-label={`Editar ${editing.name || 'texto'}`}
              style={textEditorStyle(editing, camera)}
              onMouseDown={(event) => event.stopPropagation()}
              onFocus={() => dispatch({ type: 'begin' })}
              onChange={(event) => live(editing.id, { text: event.target.value })}
              onBlur={() => { setEditingId(null); dispatch({ type: 'end' }); }}
            />
          )}
          <div className="pf-toolbar" role="toolbar" aria-label="Herramientas">
            <button type="button" className={`pf-tool${tool === 'select' ? ' is-active' : ''}`} title="Selección (V)" onClick={() => { setTool('select'); setShapesOpen(false); }}><MousePointer2 size={16} /></button>
            <button type="button" className={`pf-tool${tool === 'hand' ? ' is-active' : ''}`} title="Mano (H)" onClick={() => { setTool('hand'); setShapesOpen(false); }}><Hand size={16} /></button>
            <button type="button" className={`pf-tool${['rect', 'ellipse', 'line', 'frame'].includes(tool) ? ' is-active' : ''}`} title="Figuras (R)" onClick={() => { setShapesOpen((open) => !open); setTool(shape); }}><Square size={16} /></button>
            <button type="button" className={`pf-tool${tool === 'brush' ? ' is-active' : ''}`} title="Pincel (B)" onClick={() => { setTool('brush'); setShapesOpen(false); }}><PenLine size={16} /></button>
            <button type="button" className={`pf-tool${tool === 'text' ? ' is-active' : ''}`} title="Texto (T)" onClick={() => { setTool('text'); setShapesOpen(false); }}><Type size={16} /></button>
            <button type="button" className="pf-tool" title="Imagen" onClick={() => imageInputRef.current?.click()}><ImageIcon size={16} /></button>
            <button type="button" className="pf-tool" title="Tabla" onClick={() => insertElements([{ type: 'table', name: 'Tabla', width: 360, height: 160, rows: 3, cols: 3, cells: ['A', 'B', 'C', '', '', '', '', '', ''], fill: '#e7f6f1', text: '' }])}><Table2 size={16} /></button>
            <button type="button" className="pf-tool" title="Post-it" onClick={() => insertElements([{ type: 'sticky', name: 'Post-it', width: 180, height: 160, fill: '#f8e7a2', text: 'Nota', radius: 6, fontSize: 16 }])}><StickyNote size={16} /></button>
            <button type="button" className="pf-tool" title="Archivo" onClick={() => fileInputRef.current?.click()}><File size={16} /></button>
            <button type="button" className="pf-tool" title="Enlace" onClick={() => insertElements([{ type: 'link', name: 'Enlace', width: 220, height: 52, fill: '#ffffff', stroke: '#cbd5e1', strokeWidth: 1, radius: 14, text: 'Abrir enlace', href: 'https://', align: 'left', fontSize: 15 }])}><Link2 size={16} /></button>
          </div>
          {shapesOpen && (
            <div className="pf-shapes">
              {[
                ['rect', 'Rectángulo'],
                ['ellipse', 'Elipse'],
                ['line', 'Flecha'],
                ['frame', 'Marco'],
              ].map(([id, label]) => (
                <button key={id} type="button" className={`pf-tool${shape === id ? ' is-active' : ''}`} onClick={() => { setShape(id); setTool(id); setShapesOpen(false); }}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {tool === 'line' && !shapesOpen && (
            <div className="pf-brush" role="group" aria-label="Estilo de flecha">
              <div className="pf-choices">
                {[
                  ['straight', 'Recta'],
                  ['curve', 'Curva'],
                  ['elbow', 'Codo'],
                  ['round', 'Redonda'],
                ].map(([id, label]) => (
                  <button key={id} type="button" className={arrowRoute === id ? 'is-active' : ''} aria-pressed={arrowRoute === id} onClick={() => setArrowRoute(id)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {tool === 'brush' && (
            <div className="pf-brush" role="group" aria-label="Pincel">
              <div className="pf-brush-styles">
                {[
                  ['brush', 'Pincel', PenLine],
                  ['pencil', 'Lápiz', Pencil],
                  ['spray', 'Aerosol', SprayCan],
                  ['bucket', 'Cubeta', PaintBucket],
                ].map(([id, label, Icon]) => (
                  <button key={id} type="button" className={brush.style === id ? 'is-active' : ''} aria-pressed={brush.style === id} onClick={() => setBrush((current) => ({ ...current, style: id }))}>
                    <Icon size={16} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              {brush.style !== 'bucket' && (
                <label className="pf-slider">
                  <span>Tamaño</span>
                  <input className="pf-range" type="range" min="1" max="48" value={brush.size} aria-label="Tamaño del pincel" onChange={(event) => setBrush((current) => ({ ...current, size: Number(event.target.value) }))} />
                  <span className="pf-slider-value">{brush.size}</span>
                </label>
              )}
              <div className="pf-swatches" role="listbox" aria-label="Color del pincel">
                {INK_SWATCHES.map((color) => (
                  <button key={color} type="button" className={brush.color.toLowerCase() === color ? 'is-active' : ''} style={{ background: color }} aria-label={color} aria-selected={brush.color.toLowerCase() === color} onClick={() => setBrush((current) => ({ ...current, color }))} />
                ))}
                <label className="pf-color" style={{ background: brush.color }} title="Otro color">
                  <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(brush.color) ? brush.color : '#1e293b'} aria-label="Otro color" onChange={(event) => setBrush((current) => ({ ...current, color: event.target.value }))} />
                </label>
              </div>
            </div>
          )}
          <div className="pf-zoom">
            <button type="button" className="pf-tool" aria-label="Deshacer" title="Deshacer (Ctrl+Z)" disabled={state.past.length === 0} onClick={() => dispatch({ type: 'undo' })}><Undo2 size={16} /></button>
            <button type="button" className="pf-tool" aria-label="Rehacer" title="Rehacer (Ctrl+Shift+Z)" disabled={state.future.length === 0} onClick={() => dispatch({ type: 'redo' })}><Redo2 size={16} /></button>
            <span className="pf-zoom-rule" />
            <button type="button" className="pf-tool" aria-label="Alejar" onClick={() => zoomBy(0.9)}><Minus size={16} /></button>
            <span className="px-1 text-xs font-bold tabular-nums">{Math.round(camera.scale * 100)}%</span>
            <button type="button" className="pf-tool" aria-label="Acercar" onClick={() => zoomBy(1.1)}><Plus size={16} /></button>
            <span className="pf-zoom-rule" />
            <button type="button" className="pf-tool" aria-label={full ? 'Salir de pantalla completa' : 'Pantalla completa'} onClick={() => (full ? document.exitFullscreen?.() : editorRef.current?.requestFullscreen?.())}>{full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
          </div>
          {presenting && (
            <div className="pf-present-bar">
              <button type="button" className="pf-tool" aria-label="Marco anterior" onClick={() => stepFrame(-1)}>←</button>
              <span>{frames.length ? `${frames[frameIndex]?.name || 'Marco'} · ${frameIndex + 1}/${frames.length}` : 'Lienzo completo'}</span>
              <button type="button" className="pf-tool" aria-label="Marco siguiente" onClick={() => stepFrame(1)}>→</button>
            </div>
          )}
          {!inspectorOpen && <button type="button" className="pf-reveal pf-reveal-right" onClick={() => setInspectorOpen(true)}>Diseño</button>}
          <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={onPickImage} />
          <input ref={fileInputRef} type="file" hidden onChange={onPickFile} />
          {player && (
            <div className="pf-player" role="dialog" aria-label={player.title}>
              <button type="button" className="pf-icon-btn" aria-label="Cerrar video" onClick={() => setPlayer(null)}><X size={16} /></button>
              <video src={player.src} controls autoPlay playsInline />
            </div>
          )}
        </div>
        <EditorInspector
          open={inspectorOpen}
          tab={inspectorTab}
          onTab={setInspectorTab}
          onToggle={() => setInspectorOpen(false)}
          primary={primary}
          selectedElements={selectedElements}
          elements={state.elements}
          selection={selection}
          fonts={FONTS}
          swatchValue={swatchValue}
          onUpdate={updatePrimary}
          onCommit={commit}
          onAlign={(mode) => commit(alignElements(state.elements, selection, mode))}
          onSelect={(id) => setSelection([id])}
          onLayer={(id, direction) => moveLayer(state.elements, id, direction, commit)}
          onPreviewMotion={playMotion}
        />
      </div>
    </div>
  );
};

function Face({ person }) {
  const letter = (person.name || person.email || '?').trim().slice(0, 1).toUpperCase() || '?';
  if (person.avatarUrl) return <img className="pf-face" src={person.avatarUrl} alt="" />;
  return <span className="pf-face">{letter}</span>;
}

function SharePanel({
  open, meta, access, projects, email, memberQuery, note, hojaId,
  onEmail, onMemberQuery, onChange, onLinkProject, onNote,
}) {
  const members = (access?.projectMembers || []).filter((person) => {
    const query = memberQuery.trim().toLowerCase();
    if (!query) return true;
    return `${person.name} ${person.email}`.toLowerCase().includes(query);
  });
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/portafolio/${hojaId}`);
      onNote('Enlace copiado.');
    } catch {
      onNote('No se pudo copiar el enlace.');
    }
  };
  return (
    <div className={`pf-pop pf-share-pop${open ? ' is-open' : ''}`} role="dialog" aria-label="Compartir hoja">
      <button type="button" className="ps-quiet" onClick={copyLink}>Copiar enlace</button>
      {!meta?.canManage ? (
        <p className="pf-kicker">Solo quien creó la hoja puede cambiar quién entra.</p>
      ) : (
        <>
          <div className="pf-segment" role="radiogroup" aria-label="Visibilidad">
            <button type="button" className={(access?.visibility || meta?.visibility) !== 'enlace' ? 'is-active' : ''} onClick={() => onChange({ visibility: 'privada' })}>Privada</button>
            <button type="button" className={(access?.visibility || meta?.visibility) === 'enlace' ? 'is-active' : ''} onClick={() => onChange({ visibility: 'enlace' })}>Con el enlace</button>
          </div>
          <p className="pf-kicker">{(access?.visibility || meta?.visibility) === 'enlace' ? 'Cualquier persona con sesión y el enlace puede verla. Editar sigue siendo de invitados y del equipo elegido.' : 'Solo tú, las personas invitadas y el equipo que elijas.'}</p>
          <form onSubmit={(event) => { event.preventDefault(); if (!email.trim()) return; onChange({ addEmail: email.trim() }); onEmail(''); }}>
            <label>Invitar por correo
              <span className="pf-invite">
                <input value={email} placeholder="correo@equipo.com" onChange={(event) => onEmail(event.target.value)} />
                <button type="submit" className="ps-quiet">Invitar</button>
              </span>
            </label>
          </form>
          {(access?.invites || []).map((person) => (
            <div key={person.id} className="pf-person">
              <Face person={person} />
              <span className="min-w-0 flex-1 truncate">{person.name || person.email}</span>
              <button type="button" className="pf-icon-btn" aria-label={`Quitar a ${person.name || person.email}`} onClick={() => onChange({ removeUserId: person.id })}><X size={14} /></button>
            </div>
          ))}
          <label>Proyecto vinculado
            <select value={meta?.projectId || ''} onChange={(event) => onLinkProject(event.target.value ? Number(event.target.value) : null)}>
              <option value="">Sin proyecto</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          {access?.projectId ? (
            <>
              <button type="button" className={`ps-quiet${!access.filterTeam ? ' is-active' : ''}`} onClick={() => onChange({ filterTeam: false })}>Todo el equipo</button>
              <input value={memberQuery} placeholder="Filtrar personas del proyecto" aria-label="Filtrar personas del proyecto" onChange={(event) => onMemberQuery(event.target.value)} />
              {members.map((person) => (
                <label key={person.id} className="pf-check">
                  <input
                    type="checkbox"
                    checked={access.filterTeam ? Boolean(person.included) : true}
                    onChange={(event) => {
                      const ids = (access.projectMembers || [])
                        .filter((item) => (item.id === person.id ? event.target.checked : (access.filterTeam ? item.included : true)))
                        .map((item) => item.id);
                      onChange({ filterTeam: true, teamUserIds: ids });
                    }}
                  />
                  <span>{person.name || person.email}</span>
                </label>
              ))}
              {members.length === 0 && <p className="pf-kicker">Nadie del proyecto coincide con el filtro.</p>}
            </>
          ) : <p className="pf-kicker">Vincula un proyecto para elegir a quién del equipo le compartes la hoja.</p>}
        </>
      )}
      {note && <p className="pf-kicker">{note}</p>}
    </div>
  );
}

function moveLayer(elements, id, direction, commit) {
  const index = elements.findIndex((element) => element.id === id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= elements.length) return;
  const copy = elements.slice();
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item);
  commit(copy);
}

export default PortfolioEditorPage;
