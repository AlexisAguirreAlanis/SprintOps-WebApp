import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  Copy,
  Download,
  Image as ImageIcon,
  Pencil,
  Plus,
  Presentation,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react';
import { portfolioRepository } from '../../data/repositories/portfolioRepository';
import { createElement, createId, sceneBounds, serializeDocument, SLIDE_SIZE } from './portfolioDocument';
import { readImageFile } from './editorMedia';
import { snapBox } from './alignGuides';
import EditorLibrary from './EditorLibrary';
import SheetShare from './ShareSheet';
import SheetThumb from './SheetThumb';

const WIDTH = SLIDE_SIZE.width;
const HEIGHT = SLIDE_SIZE.height;

function cloneElements(elements) {
  return elements.map((element) => ({ ...element, id: createId() }));
}

function SlideStudio({
  hojaId,
  user,
  meta,
  initialName,
  revision,
  slides: initialSlides,
  onMeta,
}) {
  const viewportRef = useRef(null);
  const slidesRef = useRef(initialSlides);
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const revisionRef = useRef(revision);
  const dragRef = useRef(null);
  const [slides, setSlides] = useState(initialSlides);
  const [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [scale, setScale] = useState(0.5);
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState('saved');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const [guides, setGuides] = useState([]);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [librarySection, setLibrarySection] = useState('elements');

  const slide = slides[Math.min(index, slides.length - 1)];

  const remember = (next, record = true) => {
    if (record) {
      pastRef.current.push(JSON.stringify(slidesRef.current));
      if (pastRef.current.length > 60) pastRef.current.shift();
      futureRef.current = [];
    }
    slidesRef.current = next;
    setSlides(next);
    setDirty(true);
    setEpoch((value) => value + 1);
  };

  const updateSlide = (patch, record = true) => {
    const current = slidesRef.current[index];
    if (!current) return;
    const next = slidesRef.current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
    remember(next, record);
  };

  const updateElement = (id, patch, record = false) => {
    const current = slidesRef.current[index];
    updateSlide({
      elements: current.elements.map((element) => (element.id === id ? { ...element, ...patch } : element)),
    }, record);
  };

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;
    const fit = () => {
      const styles = getComputedStyle(node);
      const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const availableW = Math.max(160, node.clientWidth - padX);
      const availableH = Math.max(120, node.clientHeight - padY);
      setScale(Math.min(availableW / WIDTH, availableH / HEIGHT));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    fit();
    return () => observer.disconnect();
  }, [presenting]);

  useEffect(() => {
    if (!dirty || !meta?.canEdit || meta.deleted) return undefined;
    const savedEpoch = epoch;
    const timer = window.setTimeout(async () => {
      setStatus('saving');
      try {
        const saved = await portfolioRepository.saveDocument(hojaId, {
          userId: user.id,
          revision: revisionRef.current,
          document: serializeDocument({ kind: 'slides', slides: slidesRef.current, slideSize: SLIDE_SIZE }),
        });
        revisionRef.current = saved.revision;
        if (savedEpoch === epoch) {
          setDirty(false);
          setStatus('saved');
        }
      } catch (err) {
        setStatus('error');
        setError(err.message || 'No se pudo guardar la presentación.');
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [dirty, epoch, hojaId, meta, user.id]);

  useEffect(() => {
    const onKey = (event) => {
      const typing = ['INPUT', 'TEXTAREA'].includes(event.target.tagName) || event.target.isContentEditable;
      if (event.key === 'Escape' && presenting) {
        setPresenting(false);
        return;
      }
      if (presenting && (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'ArrowDown')) {
        event.preventDefault();
        setIndex((current) => Math.min(slidesRef.current.length - 1, current + 1));
        return;
      }
      if (presenting && (event.key === 'ArrowLeft' || event.key === 'ArrowUp')) {
        event.preventDefault();
        setIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (typing || presenting) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        const stack = event.shiftKey ? futureRef : pastRef;
        const other = event.shiftKey ? pastRef : futureRef;
        const snap = stack.current.pop();
        if (!snap) return;
        other.current.push(JSON.stringify(slidesRef.current));
        const next = JSON.parse(snap);
        slidesRef.current = next;
        setSlides(next);
        setDirty(true);
        setEpoch((value) => value + 1);
      } else if ((event.key === 'Backspace' || event.key === 'Delete') && selectedId) {
        event.preventDefault();
        const current = slidesRef.current[index];
        const next = slidesRef.current.map((item, itemIndex) => (
          itemIndex === index ? { ...item, elements: item.elements.filter((element) => element.id !== selectedId) } : item
        ));
        remember(next);
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presenting, selectedId, index]);

  const addElement = (partial) => {
    const element = createElement({ x: 120, y: 120, ...partial });
    updateSlide({ elements: [...slidesRef.current[index].elements, element] });
    setSelectedId(element.id);
    setEditingId(partial.type === 'text' ? element.id : null);
  };

  const addSlide = () => {
    const next = [...slidesRef.current, { id: createId(), name: `Diapositiva ${slidesRef.current.length + 1}`, background: '#ffffff', elements: [] }];
    remember(next);
    setIndex(next.length - 1);
    setSelectedId(null);
  };

  const duplicateSlide = () => {
    const current = slidesRef.current[index];
    const copy = { ...current, id: createId(), name: `${current.name} copia`, elements: cloneElements(current.elements) };
    const next = slidesRef.current.slice();
    next.splice(index + 1, 0, copy);
    remember(next);
    setIndex(index + 1);
  };

  const deleteSlide = () => {
    if (slidesRef.current.length < 2) return;
    const next = slidesRef.current.filter((_, itemIndex) => itemIndex !== index);
    remember(next);
    setIndex(Math.max(0, index - 1));
    setSelectedId(null);
  };

  const onPointerDown = (event, element) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setSelectedId(element.id);
    const rect = event.currentTarget.parentElement.getBoundingClientRect();
    dragRef.current = {
      id: element.id,
      mode: event.target.dataset.handle || 'move',
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...element },
      scale,
      recorded: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (event.clientX - drag.startX) / drag.scale;
    const dy = (event.clientY - drag.startY) / drag.scale;
    const origin = drag.origin;
    let patch = { x: origin.x + dx, y: origin.y + dy };
    if (drag.mode === 'resize') {
      patch = {
        x: origin.x,
        y: origin.y,
        width: Math.max(40, origin.width + dx),
        height: Math.max(28, origin.height + dy),
      };
      setGuides([]);
    } else {
      const current = slidesRef.current[index];
      const others = (current?.elements || [])
        .filter((item) => item.id !== drag.id)
        .map((item) => ({ x: item.x, y: item.y, width: item.width || 1, height: item.height || 1 }));
      const snapped = snapBox(
        { x: patch.x, y: patch.y, width: origin.width || 1, height: origin.height || 1 },
        others,
        { x: 0, y: 0, width: WIDTH, height: HEIGHT },
        8,
      );
      patch = { x: patch.x + snapped.dx, y: patch.y + snapped.dy };
      setGuides(snapped.guides);
    }
    updateElement(drag.id, patch, !drag.recorded);
    drag.recorded = true;
  };

  const onPointerUp = () => {
    dragRef.current = null;
    setGuides([]);
  };

  const insertElements = (partials) => {
    const drafts = partials.map((partial) => createElement({ x: 0, y: 0, ...partial }));
    const bounds = sceneBounds(drafts);
    const dx = bounds ? WIDTH / 2 - (bounds.x + bounds.width / 2) : 80;
    const dy = bounds ? HEIGHT / 2 - (bounds.y + bounds.height / 2) : 80;
    const placed = drafts.map((element) => ({ ...element, id: createId(), x: element.x + dx, y: element.y + dy }));
    const current = slidesRef.current[index];
    updateSlide({ elements: [...(current?.elements || []), ...placed] });
    setSelectedId(placed[0]?.id || null);
  };

  const onPickImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const image = await readImageFile(file);
      const height = Math.max(80, Math.round(360 * (image.height / image.width)));
      addElement({ type: 'image', name: file.name, width: 360, height, src: image.src, text: '', fill: 'transparent' });
    } catch (err) {
      setError(err.message);
    }
  };

  const saveName = async () => {
    if (!meta?.canManage) return;
    const trimmed = name.trim() || 'Sin título';
    setName(trimmed);
    if (trimmed === meta.name) return;
    const updated = await portfolioRepository.update(hojaId, { userId: user.id, name: trimmed });
    onMeta(updated);
  };

  const moveSlide = (from, to) => {
    if (to < 0 || to >= slidesRef.current.length || from === to) return;
    const next = slidesRef.current.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    remember(next);
    setIndex(to);
  };

  const statusLabel = status === 'saving' ? 'Guardando…' : status === 'error' ? 'Error al guardar' : 'Guardado';

  return (
    <div className={`pf-editor ss-editor${presenting ? ' is-presenting' : ''}`}>
      <header className="pf-top">
        <Link to="/portafolio" className="pf-icon-btn" aria-label="Volver a Portafolio"><ChevronLeft size={18} /></Link>
        <label className="pf-name-wrap">
          <input className="pf-name" value={name} aria-label="Nombre de la presentación" disabled={!meta?.canManage} onChange={(event) => setName(event.target.value)} onBlur={saveName} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
          {meta?.canManage && <Pencil size={14} />}
        </label>
        <span className="ss-kind">Diapositivas</span>
        <span className={`pf-status${status === 'error' ? ' is-error' : ''}`}>{statusLabel}</span>
        {error && <span className="pf-error text-xs font-semibold">{error}</span>}
        <div className="pf-top-spacer" />
        <button type="button" className="ps-quiet" onClick={() => { document.title = name || 'Presentación'; window.print(); }}><Download size={16} /> Exportar</button>
        <SheetShare hojaId={hojaId} user={user} meta={meta} onMeta={onMeta} />
        <button type="button" className="ps-quiet" onClick={() => setPresenting(true)}><Presentation size={16} /> Presentar</button>
      </header>
      {!presenting && (
        <div className="ss-toolbar" role="toolbar" aria-label="Herramientas de la diapositiva">
          <button type="button" onClick={() => addElement({ type: 'text', name: 'Texto', width: 640, height: 80, text: 'Texto', fontSize: 36, fontWeight: 700, align: 'left', fill: '#1e293b' })}><Type size={16} /> Texto</button>
          <button type="button" onClick={() => addElement({ type: 'rect', name: 'Rectángulo', width: 280, height: 160, fill: '#b7e4d4', text: '' })}><Square size={16} /> Rectángulo</button>
          <button type="button" onClick={() => addElement({ type: 'ellipse', name: 'Círculo', width: 180, height: 180, fill: '#d3eaf8', text: '' })}>Círculo</button>
          <label>
            <ImageIcon size={16} /> Imagen
            <input type="file" accept="image/*" onChange={onPickImage} />
          </label>
          <label className="ss-bg" title="Fondo de la diapositiva">
            Fondo
            <input type="color" value={toColor(slide?.background)} aria-label="Fondo de la diapositiva" onChange={(event) => updateSlide({ background: event.target.value })} />
          </label>
          <span className="ss-toolbar-gap" />
          <button type="button" onClick={duplicateSlide}><Copy size={16} /> Duplicar</button>
          <button type="button" onClick={deleteSlide} disabled={slides.length < 2}><Trash2 size={16} /> Eliminar</button>
          <button type="button" aria-label="Deshacer" onClick={() => {
            const snap = pastRef.current.pop();
            if (!snap) return;
            futureRef.current.push(JSON.stringify(slidesRef.current));
            const next = JSON.parse(snap);
            slidesRef.current = next;
            setSlides(next);
            setDirty(true);
            setEpoch((value) => value + 1);
          }}><Undo2 size={16} /></button>
          <button type="button" aria-label="Rehacer" onClick={() => {
            const snap = futureRef.current.pop();
            if (!snap) return;
            pastRef.current.push(JSON.stringify(slidesRef.current));
            const next = JSON.parse(snap);
            slidesRef.current = next;
            setSlides(next);
            setDirty(true);
            setEpoch((value) => value + 1);
          }}><Redo2 size={16} /></button>
        </div>
      )}
      <div className="ss-body">
        {!presenting && (
          <EditorLibrary
            open={libraryOpen}
            section={librarySection}
            onSection={setLibrarySection}
            onToggle={() => setLibraryOpen((open) => !open)}
            onInsert={insertElements}
            uploads={[]}
          />
        )}
        {!presenting && (
          <aside className="ss-film" aria-label="Diapositivas">
            {slides.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                className={itemIndex === index ? 'is-active' : ''}
                draggable
                onDragStart={(event) => event.dataTransfer.setData('text/plain', String(itemIndex))}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  moveSlide(Number(event.dataTransfer.getData('text/plain')), itemIndex);
                }}
                onClick={() => { setIndex(itemIndex); setSelectedId(null); setEditingId(null); }}
              >
                <span>{itemIndex + 1}</span>
                <div className="ss-mini"><SheetThumb elements={item.elements} /></div>
              </button>
            ))}
            <button type="button" className="ss-add" onClick={addSlide}><Plus size={16} /> Diapositiva</button>
          </aside>
        )}
        <div
          ref={viewportRef}
          className="ss-viewport"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={() => { if (!presenting) { setSelectedId(null); setEditingId(null); } }}
        >
          <div className="ss-scale" style={{ width: WIDTH * scale, height: HEIGHT * scale }}>
            <div className="ss-slide" style={{ width: WIDTH, height: HEIGHT, transform: `scale(${scale})`, background: slide?.background || '#ffffff' }} onClick={(event) => event.stopPropagation()}>
              {slide?.elements.map((element) => (
                <SlidePiece
                  key={element.id}
                  element={element}
                  selected={element.id === selectedId && !presenting}
                  editing={editingId === element.id}
                  onPointerDown={onPointerDown}
                  onEdit={() => element.type === 'text' && setEditingId(element.id)}
                  onText={(value) => updateElement(element.id, { text: value }, true)}
                  onBlur={() => setEditingId(null)}
                />
              ))}
              {guides.map((guide, guideIndex) => (
                <div
                  key={`${guide.x1}-${guide.y1}-${guideIndex}`}
                  className={`ss-guide${guide.measure ? ' is-measure' : ''}${Math.abs(guide.x2 - guide.x1) >= Math.abs(guide.y2 - guide.y1) ? ' is-x' : ' is-y'}`}
                  style={{
                    left: Math.min(guide.x1, guide.x2),
                    top: Math.min(guide.y1, guide.y2),
                    width: Math.max(1, Math.abs(guide.x2 - guide.x1)),
                    height: Math.max(1, Math.abs(guide.y2 - guide.y1)),
                  }}
                >
                  {guide.label && <span>{guide.label}</span>}
                </div>
              ))}
            </div>
          </div>
          {presenting && (
            <div className="ss-present-bar">
              <button type="button" onClick={() => setIndex((current) => Math.max(0, current - 1))}>Anterior</button>
              <span>{index + 1} / {slides.length}</span>
              <button type="button" onClick={() => setIndex((current) => Math.min(slides.length - 1, current + 1))}>Siguiente</button>
              <button type="button" onClick={() => setPresenting(false)}>Salir</button>
            </div>
          )}
        </div>
      </div>
      <div className="ss-print" aria-hidden="true">
        {slides.map((item) => (
          <div key={item.id} className="ss-print-slide" style={{ background: item.background || '#ffffff' }}>
            {item.elements.map((element) => (
              <SlidePiece key={element.id} element={element} selected={false} editing={false} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SlidePiece({ element, selected, editing, onPointerDown, onEdit, onText, onBlur }) {
  const polygon = element.type === 'line' && element.closed && element.points?.length >= 6;
  const arrow = element.type === 'line' && !element.closed;
  return (
    <div
      className={`ss-el${selected ? ' is-selected' : ''}${element.type === 'text' ? ' is-text' : ''}${polygon || arrow ? ' is-line' : ''}`}
      style={{
        left: element.x,
        top: element.y,
        width: Math.max(element.width || 1, 1),
        height: Math.max(element.height || 1, 1),
        background: element.type === 'text' || element.type === 'image' || polygon || arrow ? 'transparent' : element.fill,
        borderRadius: element.type === 'ellipse' ? '50%' : `${element.radius || 0}px`,
        color: element.type === 'text' ? (element.textFill || element.fill || '#1e293b') : '#1e293b',
        fontSize: element.fontSize || 28,
        fontWeight: element.fontWeight || 600,
        textAlign: element.align || 'left',
        border: element.type === 'ellipse' && element.strokeWidth ? `${element.strokeWidth}px solid ${element.stroke || '#1e293b'}` : undefined,
      }}
      onPointerDown={onPointerDown ? (event) => onPointerDown(event, element) : undefined}
      onDoubleClick={onEdit}
    >
      {(polygon || arrow) && (
        <svg viewBox={`0 0 ${Math.max(element.width || 1, 1)} ${Math.max(element.height || 1, 1)}`} width="100%" height="100%" preserveAspectRatio="none">
          {polygon ? (
            <polygon points={pairPoints(element.points)} fill={element.fill || '#f6f1e8'} stroke={element.stroke || '#1e293b'} strokeWidth={element.strokeWidth || 2} strokeLinejoin="round" />
          ) : (
            <>
              <polyline points={pairPoints(element.points)} fill="none" stroke={element.stroke || '#1e293b'} strokeWidth={element.strokeWidth || 3} strokeLinecap="round" />
              <polygon points={arrowHead(element.points)} fill={element.stroke || '#1e293b'} />
            </>
          )}
        </svg>
      )}
      {element.type === 'image' && element.src && <img src={element.src} alt="" draggable={false} />}
      {element.type === 'text' && !editing && element.text}
      {element.type !== 'text' && element.type !== 'image' && element.type !== 'line' && element.text}
      {selected && <i data-handle="resize" onPointerDown={(event) => onPointerDown(event, element)} />}
      {editing && (
        <textarea
          autoFocus
          value={element.text || ''}
          onChange={(event) => onText(event.target.value)}
          onPointerDown={(event) => event.stopPropagation()}
          onBlur={onBlur}
        />
      )}
    </div>
  );
}

function pairPoints(points = []) {
  const pairs = [];
  for (let index = 0; index < points.length; index += 2) pairs.push(`${points[index]},${points[index + 1]}`);
  return pairs.join(' ');
}

function arrowHead(points = []) {
  if (points.length < 4) return '';
  const x2 = points[points.length - 2];
  const y2 = points[points.length - 1];
  const x1 = points[points.length - 4];
  const y1 = points[points.length - 3];
  const length = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / length;
  const uy = (y2 - y1) / length;
  const baseX = x2 - ux * 14;
  const baseY = y2 - uy * 14;
  return `${x2},${y2} ${baseX - uy * 7},${baseY + ux * 7} ${baseX + uy * 7},${baseY - ux * 7}`;
}

function toColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#ffffff';
}

export default SlideStudio;
