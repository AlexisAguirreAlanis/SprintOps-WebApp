import { memo, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Ellipse, Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Eye,
  EyeOff,
  Hand,
  Lock,
  LockOpen,
  Minus,
  MousePointer2,
  Plus,
  Square,
  Star,
  Type,
} from 'lucide-react';
import { useAuth } from '../auth/hooks/useAuth';
import { portfolioRepository } from '../../data/repositories/portfolioRepository';
import {
  alignElements,
  cloneElement,
  createElement,
  elementBounds,
  intersects,
  parseDocument,
  sceneBounds,
  serializeDocument,
  textColor,
} from './portfolioDocument';
import './portfolio.css';

const FONTS = [
  { label: 'Sans', value: 'ui-sans-serif, system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Mono', value: 'ui-monospace, SFMono-Regular, monospace' },
];

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

function fontStyle(element) {
  const italic = element.fontStyle === 'italic';
  const bold = Number(element.fontWeight) >= 700;
  if (italic && bold) return 'italic bold';
  if (italic) return 'italic';
  if (bold) return 'bold';
  return 'normal';
}

const SceneNode = memo(function SceneNode({ element, tool, editing, accent, onSelect, onBegin, onLive, onEnd, setNode }) {
  const common = {
    id: element.id,
    x: element.x,
    y: element.y,
    rotation: element.rotation || 0,
    opacity: editing ? 0 : element.opacity ?? 1,
    draggable: tool === 'select' && !element.locked,
    listening: tool === 'select',
    onMouseDown: (event) => {
      event.cancelBubble = true;
      if (tool !== 'select' || element.locked) return;
      onSelect(element.id, event.evt.shiftKey);
    },
    onDragStart: onBegin,
    onDragMove: (event) => onLive(element.id, { x: event.target.x(), y: event.target.y() }),
    onDragEnd: onEnd,
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
      ) : element.type === 'line' ? (
        <Line
          points={element.points || [0, 0, 80, 0]}
          stroke={element.stroke || accent}
          strokeWidth={element.strokeWidth || 2}
          hitStrokeWidth={16}
          lineCap="round"
        />
      ) : (
        <Rect
          width={element.width}
          height={element.height}
          cornerRadius={element.radius || 0}
          fill={element.type === 'text' ? 'transparent' : element.fill}
          stroke={element.type === 'frame' ? (element.stroke || accent) : element.stroke}
          strokeWidth={element.type === 'frame' ? (element.strokeWidth || 2) : (element.strokeWidth || 0)}
        />
      )}
      {element.type !== 'line' && (
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
          listening={false}
        />
      )}
    </Group>
  );
});

const PortfolioEditorPage = () => {
  const { hojaId } = useParams();
  const { user } = useAuth();
  const [state, dispatch] = useReducer(editorReducer, {
    elements: [], past: [], future: [], gesturing: false, dirty: false, epoch: 0,
  });
  const [camera, setCamera] = useState({ x: 80, y: 80, scale: 1 });
  const [tool, setTool] = useState('select');
  const [shape, setShape] = useState('rect');
  const [shapesOpen, setShapesOpen] = useState(false);
  const [selection, setSelection] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [meta, setMeta] = useState(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('saved');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [accent, setAccent] = useState('#67BFA1');
  const stageRef = useRef(null);
  const hostRef = useRef(null);
  const nodeRefs = useRef(new Map());
  const transformerRef = useRef(null);
  const elementsRef = useRef(state.elements);
  const cameraRef = useRef(camera);
  const toolRef = useRef(tool);
  const shapeRef = useRef(shape);
  const selectionRef = useRef(selection);
  const revisionRef = useRef(0);
  const epochRef = useRef(0);
  const drawRef = useRef(null);
  const panRef = useRef(null);
  const spaceRef = useRef(false);
  const clipboardRef = useRef([]);
  elementsRef.current = state.elements;
  cameraRef.current = camera;
  toolRef.current = tool;
  shapeRef.current = shape;
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
      if (event.code === 'Space' && !typing) {
        event.preventDefault();
        spaceRef.current = event.type === 'keydown';
      }
      if (event.type !== 'keydown' || typing) return;
      const key = event.key.toLowerCase();
      const mod = event.metaKey || event.ctrlKey;
      if (mod && key === 'z') {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
      } else if (mod && key === 'd') {
        event.preventDefault();
        duplicate();
      } else if (mod && key === 'c') {
        clipboardRef.current = elementsRef.current.filter((element) => selectionRef.current.includes(element.id));
      } else if (mod && key === 'v') {
        event.preventDefault();
        paste();
      } else if (key === 'backspace' || key === 'delete') {
        removeSelected();
      } else if (key === 'escape') {
        dispatch({ type: 'end' });
        setEditingId(null);
        setSelection([]);
        setShapesOpen(false);
      } else if (key === 'v') setTool('select');
      else if (key === 'h') setTool('hand');
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
    dispatch({
      type: 'live',
      elements: elementsRef.current.map((element) => (element.id === id ? { ...element, ...partial } : element)),
    });
  };

  const commit = (elements) => dispatch({ type: 'commit', elements });

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
        return node && element && !element.locked && element.visible !== false && element.id !== editingId;
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
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    const current = cameraRef.current;
    const oldScale = current.scale;
    const nextScale = Math.min(4, Math.max(0.1, oldScale * (event.evt.deltaY > 0 ? 0.92 : 1.08)));
    const point = { x: (pointer.x - current.x) / oldScale, y: (pointer.y - current.y) / oldScale };
    const next = { scale: nextScale, x: pointer.x - point.x * nextScale, y: pointer.y - point.y * nextScale };
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
      const element = createElement({
        type: kind,
        name: kind === 'ellipse' ? 'Elipse' : kind === 'line' ? 'Línea' : kind === 'frame' ? 'Marco' : 'Rectángulo',
        x: world.x,
        y: world.y,
        width: 4,
        height: 4,
        text: '',
        fill: kind === 'frame' ? 'transparent' : '#ffffff',
        stroke: accent,
        strokeWidth: kind === 'line' || kind === 'frame' ? 2 : 0,
        points: kind === 'line' ? [0, 0, 0, 0] : null,
      });
      drawRef.current = { id: element.id, origin: world, type: kind };
      dispatch({ type: 'begin' });
      dispatch({ type: 'live', elements: [...elementsRef.current, element] });
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
      if (type === 'line') {
        live(id, { points: [0, 0, world.x - origin.x, world.y - origin.y] });
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
      const element = elementsRef.current.find((item) => item.id === drawRef.current.id);
      const box = element ? elementBounds(element) : null;
      drawRef.current = null;
      if (!box || (box.width < 6 && box.height < 6)) dispatch({ type: 'undo' });
      else {
        dispatch({ type: 'end' });
        setSelection([element.id]);
        setTool('select');
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

  const saveName = async () => {
    if (!meta?.canManage) return;
    const trimmed = name.trim() || 'Sin título';
    setName(trimmed);
    if (trimmed === meta.name) return;
    const updated = await portfolioRepository.update(hojaId, { userId: user.id, name: trimmed });
    setMeta(updated);
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
    <div className="pf-editor">
      <header className="pf-top">
        <Link to="/portafolio" className="pf-icon-btn" aria-label="Volver a Portafolio" title="Volver a Portafolio"><ChevronLeft size={18} /></Link>
        <input
          className="pf-name"
          value={name}
          aria-label="Nombre de la hoja"
          disabled={!meta?.canManage}
          onChange={(event) => setName(event.target.value)}
          onBlur={saveName}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
        />
        <span className={`pf-status${status === 'error' ? ' is-error' : ''}`}>{ready ? statusLabel : 'Abriendo…'}</span>
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
        <button type="button" className="pf-mobile-inspector pf-tool" onClick={() => setInspectorOpen((open) => !open)}>Propiedades</button>
      </header>
      <div className="pf-body">
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
                while (node && node !== stage) {
                  const element = elementsRef.current.find((item) => item.id === node.id());
                  if (element && element.type !== 'line') {
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
                    onEnd={() => dispatch({ type: 'end' })}
                    setNode={(id, node) => {
                      if (node) nodeRefs.current.set(id, node);
                      else nodeRefs.current.delete(id);
                    }}
                  />
                ))}
                {marqueeBox && <Rect {...marqueeBox} fill={`${accent}33`} stroke={accent} listening={false} />}
                <Transformer ref={transformerRef} rotateEnabled borderStroke={accent} anchorStroke={accent} anchorFill="#ffffff" />
              </Layer>
            </Stage>
          )}
          {editing && (
            <textarea
              className="pf-text-editor"
              autoFocus
              value={editing.text || ''}
              style={{
                left: camera.x + editing.x * camera.scale,
                top: camera.y + editing.y * camera.scale,
                width: Math.max(80, editing.width * camera.scale),
                height: Math.max(32, editing.height * camera.scale),
                fontSize: (editing.fontSize || 16) * camera.scale,
                fontFamily: editing.fontFamily,
                color: textColor(editing),
                textAlign: editing.align || 'center',
                transform: `rotate(${editing.rotation || 0}deg)`,
              }}
              onFocus={() => dispatch({ type: 'begin' })}
              onChange={(event) => live(editing.id, { text: event.target.value })}
              onBlur={() => { setEditingId(null); dispatch({ type: 'end' }); }}
            />
          )}
          <div className="pf-toolbar" role="toolbar" aria-label="Herramientas">
            <button type="button" className={`pf-tool${tool === 'select' ? ' is-active' : ''}`} title="Selección (V)" onClick={() => { setTool('select'); setShapesOpen(false); }}><MousePointer2 size={16} /></button>
            <button type="button" className={`pf-tool${tool === 'hand' ? ' is-active' : ''}`} title="Mano (H)" onClick={() => { setTool('hand'); setShapesOpen(false); }}><Hand size={16} /></button>
            <button type="button" className={`pf-tool${['rect', 'ellipse', 'line', 'frame'].includes(tool) ? ' is-active' : ''}`} title="Formas (R)" onClick={() => { setShapesOpen((open) => !open); setTool(shape); }}><Square size={16} /></button>
            <button type="button" className={`pf-tool${tool === 'text' ? ' is-active' : ''}`} title="Texto (T)" onClick={() => { setTool('text'); setShapesOpen(false); }}><Type size={16} /></button>
          </div>
          {shapesOpen && (
            <div className="pf-shapes">
              {[
                ['rect', 'Rectángulo'],
                ['ellipse', 'Elipse'],
                ['line', 'Línea'],
                ['frame', 'Marco'],
              ].map(([id, label]) => (
                <button key={id} type="button" className={`pf-tool${shape === id ? ' is-active' : ''}`} onClick={() => { setShape(id); setTool(id); setShapesOpen(false); }}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="pf-zoom">
            <button type="button" className="pf-tool" aria-label="Alejar" onClick={() => zoomBy(0.9)}><Minus size={16} /></button>
            <span className="px-1 text-xs font-bold tabular-nums">{Math.round(camera.scale * 100)}%</span>
            <button type="button" className="pf-tool" aria-label="Acercar" onClick={() => zoomBy(1.1)}><Plus size={16} /></button>
            <button type="button" className="pf-tool" title="Ver todo" onClick={() => fit(false)}>Todo</button>
            <button type="button" className="pf-tool" title="Ver selección" onClick={() => fit(true)}>Selección</button>
          </div>
        </div>
        <aside className={`pf-inspector${inspectorOpen ? ' is-open' : ''}`}>
          <h2>Propiedades</h2>
          {error && <p className="pf-error text-xs font-semibold">{error}</p>}
          {!primary && <p className="pf-kicker text-sm">{selectedElements.length > 1 ? `${selectedElements.length} elementos` : 'Nada seleccionado'}</p>}
          {selectedElements.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {[['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha'], ['top', 'Arriba'], ['middle', 'Medio'], ['bottom', 'Abajo']].map(([mode, label]) => (
                <button key={mode} type="button" className="ps-quiet" onClick={() => commit(alignElements(state.elements, selection, mode))}>{label}</button>
              ))}
            </div>
          )}
          {primary && (
            <div className="pf-stack flex flex-col gap-2">
              <label>Nombre<input value={primary.name} onChange={(event) => updatePrimary({ name: event.target.value })} /></label>
              <div className="pf-fields">
                <label>X<input type="number" value={Math.round(primary.x)} onChange={(event) => updatePrimary({ x: Number(event.target.value) })} /></label>
                <label>Y<input type="number" value={Math.round(primary.y)} onChange={(event) => updatePrimary({ y: Number(event.target.value) })} /></label>
                {primary.type !== 'line' && <label>Ancho<input type="number" value={Math.round(primary.width)} onChange={(event) => updatePrimary({ width: Math.max(16, Number(event.target.value)) })} /></label>}
                {primary.type !== 'line' && <label>Alto<input type="number" value={Math.round(primary.height)} onChange={(event) => updatePrimary({ height: Math.max(16, Number(event.target.value)) })} /></label>}
                <label>Rotación<input type="number" value={Math.round(primary.rotation || 0)} onChange={(event) => updatePrimary({ rotation: Number(event.target.value) })} /></label>
                <label>Opacidad<input type="number" min="0" max="1" step="0.05" value={primary.opacity ?? 1} onChange={(event) => updatePrimary({ opacity: Number(event.target.value) })} /></label>
              </div>
              <label>Color<input type="color" value={swatchValue} onChange={(event) => updatePrimary(primary.type === 'text' ? { textFill: event.target.value } : { fill: event.target.value })} /></label>
              {primary.type !== 'line' && (
                <>
                  <label>Texto<textarea value={primary.text || ''} onChange={(event) => updatePrimary({ text: event.target.value })} /></label>
                  <div className="pf-fields">
                    <label>Tamaño<input type="number" value={primary.fontSize || 16} onChange={(event) => updatePrimary({ fontSize: Number(event.target.value) })} /></label>
                    <label>Fuente
                      <select value={primary.fontFamily} onChange={(event) => updatePrimary({ fontFamily: event.target.value })}>
                        {FONTS.map((font) => <option key={font.label} value={font.value}>{font.label}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" className={`ps-quiet${Number(primary.fontWeight) >= 700 ? ' is-active' : ''}`} onClick={() => updatePrimary({ fontWeight: Number(primary.fontWeight) >= 700 ? 500 : 700 })}>Negrita</button>
                    <button type="button" className={`ps-quiet${primary.fontStyle === 'italic' ? ' is-active' : ''}`} onClick={() => updatePrimary({ fontStyle: primary.fontStyle === 'italic' ? 'normal' : 'italic' })}>Cursiva</button>
                    {['left', 'center', 'right'].map((align) => (
                      <button key={align} type="button" className={`ps-quiet${primary.align === align ? ' is-active' : ''}`} onClick={() => updatePrimary({ align })}>{align === 'left' ? 'Izq' : align === 'center' ? 'Centro' : 'Der'}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="pf-layers">
            <h2>Capas</h2>
            {[...state.elements].reverse().map((element) => (
              <div key={element.id} className={`pf-layer${selection.includes(element.id) ? ' is-active' : ''}`}>
                <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-semibold" onClick={() => setSelection([element.id])}>{element.name}</button>
                <button type="button" className="pf-icon-btn" aria-label="Subir capa" onClick={() => moveLayer(state.elements, element.id, 1, commit)}><ArrowUp size={14} /></button>
                <button type="button" className="pf-icon-btn" aria-label="Bajar capa" onClick={() => moveLayer(state.elements, element.id, -1, commit)}><ArrowDown size={14} /></button>
                <button type="button" className="pf-icon-btn" aria-label={element.visible === false ? 'Mostrar' : 'Ocultar'} onClick={() => commit(state.elements.map((item) => item.id === element.id ? { ...item, visible: item.visible === false } : item))}>{element.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                <button type="button" className="pf-icon-btn" aria-label={element.locked ? 'Desbloquear' : 'Bloquear'} onClick={() => commit(state.elements.map((item) => item.id === element.id ? { ...item, locked: !item.locked } : item))}>{element.locked ? <Lock size={14} /> : <LockOpen size={14} />}</button>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};

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
