import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronUp, ChevronDown, Cloud, CloudOff, History, Loader2, Pencil, Users, AlertTriangle,
  House, Plus, Palette, Columns3, BookOpen, Mail, SpellCheck, Eye, Image, Shapes, ChartColumn, Network, Table2, Box,
  Scissors, Copy, ClipboardPaste, MessageSquarePlus, Link2, Languages, ListPlus, Sparkles, BookA, Trash2, Type, TextSelect,
} from 'lucide-react';
import { portfolioRepository } from '../../data/repositories/portfolioRepository';
import { createId, parseDocument, serializeDocument } from './portfolioDocument';
import SheetShare, { Face } from './ShareSheet';
import './docs/docs.css';
import { HEADER_SPACE, bodyHeight, formatPageNumber, normalizeDocModel, pageMetrics, plainText } from './docs/model';
import { sanitizeHtml } from './docs/sanitize';
import {
  caretPosition, clearHold, createHistory, currentBlock, holdSelection, rangeIn, rememberSelection, restoreCaretPosition, restoreSelection, selectedBlocks, selectionHeld,
  applyInlineStyle, applyBlockStyle, setBlockTag, transformCase, insertHtml, insertBlockHtml, exec, anchorElement, wordsOf, setMultiRanges,
} from './docs/engine/core';
import { reflow } from './docs/engine/pagination';
import { trackDelete, trackFormat, trackInsertText } from './docs/engine/tracking';
import { decorateComments, hydrateFields, hydrateRich, stripDecorations } from './docs/render/rich';
import { hydrateLiveBlocks, hydrateRefs, loadProject } from './docs/sprintops';
import { numberNotes, updateCaptions, updateCitations } from './docs/references';
import { recalcFormulas } from './docs/engine/tables';
import { createActions } from './docs/actions';
import { Btn, useFilePicker } from './docs/ui/controls';
import DocDialog from './docs/ui/DocDialog';
import { BubbleBar, ContextMenu, InlineMenu, ObjectHandles } from './docs/ui/overlays';
import InkLayer from './docs/draw/InkLayer';
import HomeTab, { FONTS } from './docs/ribbon/HomeTab';
import InsertTab from './docs/ribbon/InsertTab';
import DrawTab from './docs/ribbon/DrawTab';
import DesignTab from './docs/ribbon/DesignTab';
import LayoutTab from './docs/ribbon/LayoutTab';
import ReferencesTab from './docs/ribbon/ReferencesTab';
import MailingsTab from './docs/ribbon/MailingsTab';
import ReviewTab from './docs/ribbon/ReviewTab';
import ViewTab, { VIEW_MODES } from './docs/ribbon/ViewTab';
import { ChartTab, DiagramTab, ImageTab, ObjectTab, ShapeTab, TableTab } from './docs/ribbon/ContextTabs';
import LeftPanel from './docs/panels/LeftPanel';
import RightPanel from './docs/panels/RightPanel';
import ExportMenu from './docs/ui/ExportMenu';
import { SLASH_COMMANDS } from './docs/render/blocks';
import { ensureFonts } from './docs/fonts';
import { loadLocale } from '../../domain/locale';

const TABS = [
  ['home', 'Inicio', House], ['insert', 'Insertar', Plus], ['draw', 'Dibujar', Pencil], ['design', 'Diseño', Palette], ['layout', 'Disposición', Columns3],
  ['references', 'Referencias', BookOpen], ['mailings', 'Correspondencia', Mail], ['review', 'Revisar', SpellCheck], ['view', 'Vista', Eye],
];

const CONTEXT_TABS = {
  image: ['Formato de imagen', ImageTab, Image],
  shape: ['Formato de forma', ShapeTab, Shapes],
  chart: ['Diseño de gráfico', ChartTab, ChartColumn],
  diagram: ['Diseño de SmartArt', DiagramTab, Network],
  table: ['Diseño de tabla', TableTab, Table2],
  object: ['Formato de objeto', ObjectTab, Box],
};

const EMPTY_SEL = { bold: false, italic: false, underline: false, strike: false, sub: false, sup: false, align: 'left', font: '', size: 0, color: '', highlight: '', shade: '', line: '', list: null, styleId: 'normal', inTable: false, blockStyle: {} };
const solidPaint = (color) => (color && color !== 'transparent' && !/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(color) ? color : '');
const paintBetween = (el, stop) => {
  let node = el;
  while (node && node !== stop) {
    const color = solidPaint(getComputedStyle(node).backgroundColor);
    if (color) return color;
    node = node.parentElement;
  }
  return '';
};
const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4d7c0f'];
const colorFor = (id) => COLORS[Math.abs(Number(id) || 0) % COLORS.length];

const pendingPages = {};

const storage = {
  get: (key, fallback) => {
    try {
      const value = localStorage.getItem(`wd-${key}`);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(`wd-${key}`, JSON.stringify(value));
    } catch {
      toast.error('No hay espacio en el almacenamiento local.');
    }
  },
};

const PageBody = memo(function PageBody({ pageId, html, editable, spellcheck, lang }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || node.dataset.ready) return;
    const pending = pendingPages[pageId];
    node.innerHTML = sanitizeHtml(pending ?? html);
    delete pendingPages[pageId];
    node.dataset.ready = '1';
  }, [html, pageId]);
  return (
    <div
      ref={ref}
      className="wd-body"
      data-page-body
      data-page-id={pageId}
      contentEditable={editable}
      suppressContentEditableWarning
      spellCheck={spellcheck}
      lang={lang}
      role="textbox"
      aria-multiline="true"
      aria-label="Contenido del documento"
    />
  );
});

const ChromeField = memo(function ChromeField({ field, value, placeholder, editable, editing, onInput }) {
  const ref = useRef(null);
  const kind = field.startsWith('header') ? 'header' : 'footer';
  const filled = Boolean((value || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
  useLayoutEffect(() => {
    if (ref.current && document.activeElement !== ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = sanitizeHtml(value || '').replace(/^<p><br><\/p>$/, '');
  }, [value]);
  const rule = editing ? (
    <div className="wd-chrome-rule" aria-hidden="true">
      <span className="wd-chrome-tag">{placeholder}</span>
    </div>
  ) : null;
  return (
    <div className={`wd-chrome wd-chrome-${kind}${editing ? ' is-editing' : ''}${filled ? ' has-text' : ''}`}>
      {kind === 'footer' && rule}
      <div
        ref={ref}
        className="wd-chrome-text"
        data-chrome={field}
        contentEditable={editable && editing}
        suppressContentEditableWarning
        data-placeholder={editing ? 'Escribe aquí' : ''}
        onInput={(event) => onInput(field, event.currentTarget)}
      />
      {kind === 'header' && rule}
    </div>
  );
});

const RULER_CM = 96 / 2.54;
const RULER_SNAP = RULER_CM / 4;

function rulerPx(value) {
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

function snapRuler(value, limit) {
  const snapped = Math.round(value / RULER_SNAP) * RULER_SNAP;
  return Math.min(limit, Math.max(0, snapped));
}

function paragraphMarks(length, marginStart, marginEnd, paragraph) {
  const contentLeft = marginStart;
  const contentRight = length - marginEnd;
  const marginLeft = rulerPx(paragraph?.marginLeft);
  const marginRight = rulerPx(paragraph?.marginRight);
  const textIndent = rulerPx(paragraph?.textIndent);
  const pad = rulerPx(paragraph?.paddingLeft);
  const body = contentLeft + marginLeft + (textIndent < 0 ? pad || -textIndent : 0);
  const first = contentLeft + marginLeft + textIndent;
  return {
    first,
    body,
    right: contentRight - marginRight,
    contentLeft,
    contentRight,
  };
}

function marksToStyle(marks) {
  const marginLeft = Math.min(marks.first, marks.body) - marks.contentLeft;
  const textIndent = marks.first - marks.body;
  return {
    marginLeft: `${Math.max(0, Math.round(marginLeft))}px`,
    marginRight: `${Math.max(0, Math.round(marks.contentRight - marks.right))}px`,
    textIndent: textIndent ? `${Math.round(textIndent)}px` : '',
    paddingLeft: textIndent < 0 ? `${Math.round(-textIndent)}px` : '',
  };
}

function PageRuler({ axis, length, marginStart, marginEnd, paragraph, editable, onIndent, onCommit }) {
  const base = paragraphMarks(length, marginStart, marginEnd, paragraph);
  const [live, setLive] = useState(null);
  const [readout, setReadout] = useState(null);
  const liveRef = useRef(null);
  const baseRef = useRef(base);
  baseRef.current = base;
  const marks = live || base;
  const ticks = [];
  for (let value = 0; value <= length; value += RULER_CM / 2) ticks.push(value);

  const drag = (event, kind) => {
    if (!editable || axis !== 'x') return;
    event.preventDefault();
    event.stopPropagation();
    const ruler = event.currentTarget.closest('.wd-ruler');
    const rect = ruler.getBoundingClientRect();
    const toPage = (client) => ((client - rect.left) / rect.width) * length;
    const origin = { ...baseRef.current };
    const grab = toPage(event.clientX);
    let moved = false;
    const apply = (next) => {
      moved = true;
      liveRef.current = next;
      setLive(next);
      const marker = kind === 'right' ? next.right : kind === 'first' ? next.first : next.body;
      setReadout({ x: marker, text: `${((marker - next.contentLeft) / RULER_CM).toFixed(2)} cm` });
      onIndent?.(marksToStyle(next));
    };
    const move = (ev) => {
      const delta = toPage(ev.clientX) - grab;
      const next = { ...origin };
      const place = (value, max) => snapRuler(Math.min(value, max), length);
      if (kind === 'first') next.first = place(origin.first + delta, origin.right - 16);
      if (kind === 'body') {
        next.body = place(origin.body + delta, origin.right - 16);
        if (next.body < origin.first) next.first = next.body;
      }
      if (kind === 'both') {
        next.body = place(origin.body + delta, origin.right - 16);
        next.first = place(origin.first + delta, origin.right - 16);
      }
      if (kind === 'right') next.right = snapRuler(Math.max(origin.right + delta, Math.max(origin.body, origin.first) + 16), length);
      apply(next);
    };
    const up = () => {
      setLive(null);
      setReadout(null);
      liveRef.current = null;
      if (moved) onCommit?.();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div
      className={`wd-ruler wd-ruler-${axis}${editable && axis === 'x' ? ' is-live' : ''}`}
      style={axis === 'x' ? { width: length } : { height: length }}
      aria-hidden={axis === 'y'}
    >
      <span className="wd-ruler-margin" style={axis === 'x' ? { left: marginStart, width: Math.max(0, length - marginStart - marginEnd) } : { top: marginStart, height: Math.max(0, length - marginStart - marginEnd) }} />
      {ticks.map((value, index) => (
        <span key={value} className={`wd-tick${index % 2 === 0 ? ' is-major' : ''}`} style={axis === 'x' ? { left: value } : { top: value }}>
          {index % 2 === 0 && index > 0 ? <em>{index / 2}</em> : null}
        </span>
      ))}
      {axis === 'x' && editable && (
        <>
          <button type="button" className="wd-indent is-first" style={{ left: marks.first }} aria-label="Sangría de primera línea" onPointerDown={(event) => drag(event, 'first')} />
          <button type="button" className="wd-indent is-body" style={{ left: marks.body }} aria-label="Sangría izquierda" onPointerDown={(event) => drag(event, 'body')} />
          <button type="button" className="wd-indent is-both" style={{ left: marks.body }} aria-label="Mover sangría izquierda y primera línea" onPointerDown={(event) => drag(event, 'both')} />
          <button type="button" className="wd-indent is-right" style={{ left: marks.right }} aria-label="Sangría derecha" onPointerDown={(event) => drag(event, 'right')} />
          {readout && <span className="wd-indent-readout" style={{ left: readout.x }}>{readout.text}</span>}
        </>
      )}
    </div>
  );
}

function DocumentStudio({ hojaId, user, meta, initialName, revision, doc: initialDoc, onMeta }) {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const deskRef = useRef(null);
  const bubblePaused = useRef(false);
  const mirrorRef = useRef(null);
  const revisionRef = useRef(revision);
  const docRef = useRef(normalizeDocModel(initialDoc, createId));
  const baseRef = useRef(docRef.current);
  const historyRef = useRef(createHistory());
  const dirtyRef = useRef(false);
  const epochRef = useRef(0);
  const savingRef = useRef(false);
  const queuedRef = useRef(false);
  const timers = useRef({});
  const pendingCaret = useRef(null);
  const inlineRef = useRef(null);

  const [doc, setDoc] = useState(docRef.current);
  const [pages, setPages] = useState(docRef.current.pages);
  const [mount, setMount] = useState(0);
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState('saved');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [tab, setTab] = useState('home');
  const [ribbonOpen, setRibbonOpen] = useState(true);
  const [view, setViewState] = useState({ mode: 'print', zoom: 1, fit: null, layout: 'single', rulers: false, vruler: false, grid: false, marks: false, bounds: false, split: false, syncScroll: true, compare: null, markup: 'all', spellcheck: true });
  const [left, setLeft] = useState({ open: false, tab: 'nav' });
  const [right, setRight] = useState({ open: false, tab: 'comments' });
  const [sel, setSel] = useState(EMPTY_SEL);
  const [object, setObject] = useState(null);
  const [objects, setObjects] = useState([]);
  const [objVersion, setObjVersion] = useState(0);
  const [cell, setCell] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [people, setPeople] = useState([]);
  const [counts, setCounts] = useState({ words: 0, chars: 0, charsNoSpace: 0, paragraphs: 0, page: 1 });
  const [headings, setHeadings] = useState([]);
  const [pen, setPenState] = useState({ tool: null, color: '#1e293b', width: 2.2, opacity: 1, ruler: { on: false, angle: 0 } });
  const [inkSel, setInkSel] = useState({ pageId: null, ids: [] });
  const [activeComment, setActiveComment] = useState(null);
  const [mergePreview, setMergePreview] = useState(null);
  const [menu, setMenu] = useState(null);
  const [inline, setInline] = useState(null);
  const [inlineActive, setInlineActive] = useState(0);
  const [bubble, setBubble] = useState(null);
  const [banner, setBanner] = useState(null);
  const [project, setProject] = useState(null);
  const [painter, setPainter] = useState(null);
  const [find, setFind] = useState({ query: '', replace: '', matchCase: false, wholeWord: false, regex: false, format: '', showReplace: false, results: 0, index: -1 });
  const [notes, setNotes] = useState({ byPage: {}, endnotes: [] });
  const [reading, setReading] = useState(false);
  const [grammar, setGrammar] = useState(null);
  const [borderPen, setBorderPenState] = useState({ style: 'solid', width: 1, color: '#334155' });
  const [autosave, setAutosaveState] = useState(() => storage.get('autosave', true));
  const [finalOverride, setFinalOverride] = useState(false);
  const [chromeEdit, setChromeEdit] = useState(null);
  const [locale, setLocale] = useState(() => loadLocale());

  useEffect(() => {
    const sync = (next) => {
      const id = next === 'en' || next === 'es' ? next : loadLocale();
      setLocale(id);
      if (docRef.current?.language !== id) {
        docRef.current = { ...docRef.current, language: id };
        setDoc(docRef.current);
      }
    };
    const onLocale = (event) => sync(event.detail);
    window.addEventListener('sprintops-locale', onLocale);
    sync(loadLocale());
    return () => window.removeEventListener('sprintops-locale', onLocale);
  }, []);

  useEffect(() => {
    if (!chromeEdit) return;
    const field = deskRef.current?.querySelector(`[data-chrome="${chromeEdit}"]`);
    if (!field || document.activeElement === field) return;
    field.focus();
    const range = document.createRange();
    range.selectNodeContents(field);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [chromeEdit]);
  const [collab, setCollab] = useState([]);
  const [mirrorHtml, setMirrorHtml] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [pickFile, fileInput] = useFilePicker();

  const metrics = pageMetrics(doc);
  const owner = Boolean(meta?.canManage);
  const canEdit = meta?.canEdit !== false && !meta?.deleted;
  const lockedByOther = Boolean(doc.lock && String(doc.lock.id) !== String(user.id));
  const mode = doc.protection?.mode || 'none';
  const canComment = (meta?.canComment ?? canEdit) && !lockedByOther;
  const editable = canEdit && !lockedByOther && view.mode !== 'read' && !(mode === 'readonly' && !owner) && !(mode === 'comments' && !owner) && !(mode === 'final' && !finalOverride) && mergePreview === null;
  const tracking = doc.tracking || (mode === 'tracked' && !owner);
  const paginate = view.mode === 'print' || view.mode === 'focus' || view.mode === 'read';

  const desk = useCallback(() => deskRef.current, []);

  const setView = useCallback((patch) => setViewState((current) => ({ ...current, ...patch })), []);
  const setPen = useCallback((patch) => setPenState((current) => ({ ...current, ...patch })), []);
  const setBorderPen = useCallback((patch) => setBorderPenState((current) => ({ ...current, ...patch })), []);

  // ---------- Lectura del modelo, paginación, historial ----------

  const readModel = useCallback(() => {
    const root = deskRef.current;
    const bodies = [...(root?.querySelectorAll('[data-page-body]') || [])];
    if (canEdit) {
      const quotes = {};
      root?.querySelectorAll('mark.wd-cmark[data-comment-id]').forEach((mark) => { quotes[mark.dataset.commentId] = (quotes[mark.dataset.commentId] || '') + mark.textContent; });
      if (Object.keys(quotes).length) docRef.current = { ...docRef.current, comments: docRef.current.comments.map((comment) => (quotes[comment.id] && quotes[comment.id] !== comment.quote ? { ...comment, quote: quotes[comment.id] } : comment)) };
    }
    return {
      ...docRef.current,
      pages: bodies.length ? bodies.map((body) => ({ id: body.dataset.pageId, html: stripDecorations(body.innerHTML) || '<p><br></p>' })) : docRef.current.pages,
    };
  }, [canEdit]);

  const addPage = useCallback((html) => {
    const id = createId();
    pendingPages[id] = html;
    setPages((current) => [...current, { id, html: '' }]);
  }, []);

  const removePage = useCallback((id) => setPages((current) => (current.length > 1 ? current.filter((page) => page.id !== id) : current)), []);

  const runReflow = useCallback(() => {
    if (!paginate) return;
    reflow(deskRef.current, { addPage, removePage, pageStart: docRef.current.pageNumberStart });
  }, [paginate, addPage, removePage]);

  const snapshot = useCallback(() => {
    const root = deskRef.current;
    if (!root) return;
    const list = [...root.querySelectorAll('[data-page-body]')].map((body) => ({ id: body.dataset.pageId, html: stripDecorations(body.innerHTML) }));
    historyRef.current.push({ key: list.map((page) => page.html).join('\u0000'), pages: list, caret: caretPosition(root) });
  }, []);

  const refreshAux = useCallback(() => {
    const root = deskRef.current;
    if (!root) return;
    const current = docRef.current;
    const bodies = [...root.querySelectorAll('[data-page-body]')];
    const text = bodies.map((body) => body.innerText).join('\n');
    const words = wordsOf(text).length;
    setCounts((prev) => ({
      ...prev,
      words,
      chars: text.replace(/\n/g, '').length,
      charsNoSpace: text.replace(/\s/g, '').length,
      paragraphs: root.querySelectorAll('[data-page-body] p, [data-page-body] li, [data-page-body] h1, [data-page-body] h2, [data-page-body] h3, [data-page-body] h4, [data-page-body] blockquote').length,
    }));
    setHeadings([...root.querySelectorAll('[data-page-body] h1, [data-page-body] h2, [data-page-body] h3, [data-page-body] h4, [data-page-body] h5, [data-page-body] h6')]
      .filter((heading) => heading.textContent.trim() && !heading.closest('.wd-toc, .wd-bibliography'))
      .map((heading) => {
        if (!heading.id) heading.id = createId();
        return { id: heading.id, level: Number(heading.tagName[1]), text: heading.textContent.trim(), page: Number(heading.closest('[data-page-index]')?.dataset.pageIndex || 0) };
      }));
    hydrateFields(root, { pageStart: current.pageNumberStart, pageFormat: current.pageNumberFormat, pageCount: bodies.length, title: name, author: current.properties?.author || meta?.ownerName, language: current.language, words, updatedAt: meta?.updatedAt });
    updateCitations(root, current);
    updateCaptions(root);
    recalcFormulas(root);
    setNotes(numberNotes(root, current));
  }, [name, meta?.ownerName, meta?.updatedAt]);

  const change = useCallback((options = {}) => {
    if (!options.noReflow) runReflow();
    dirtyRef.current = true;
    epochRef.current += 1;
    setDirty(true);
    setEpoch(epochRef.current);
    clearTimeout(timers.current.history);
    if (!options.noHistory) timers.current.history = setTimeout(snapshot, 450);
    clearTimeout(timers.current.aux);
    timers.current.aux = setTimeout(refreshAux, 260);
    clearTimeout(timers.current.backup);
    timers.current.backup = setTimeout(() => {
      try {
        localStorage.setItem(`wd-backup-${hojaId}`, JSON.stringify({ at: Date.now(), revision: revisionRef.current, model: readModel() }));
      } catch {
        /* sin espacio para respaldo local */
      }
    }, 1500);
  }, [runReflow, snapshot, refreshAux, hojaId, readModel]);

  const patchDoc = useCallback((partial, options = {}) => {
    docRef.current = { ...docRef.current, ...partial };
    setDoc(docRef.current);
    requestAnimationFrame(() => change(options));
  }, [change]);

  const applyModel = useCallback((model, { caret = null, keepHistory = false } = {}) => {
    const next = normalizeDocModel(model, createId);
    next.language = loadLocale();
    docRef.current = next;
    setDoc(next);
    const root = deskRef.current;
    const bodies = [...(root?.querySelectorAll('[data-page-body]') || [])];
    const sameShape = bodies.length === next.pages.length && bodies.every((body, index) => body.dataset.pageId === next.pages[index].id);
    if (sameShape) {
      bodies.forEach((body, index) => { body.innerHTML = sanitizeHtml(next.pages[index].html); });
      requestAnimationFrame(() => {
        runReflow();
        if (caret) restoreCaretPosition(root, caret);
        refreshAux();
        hydrateRich(root);
      });
    } else {
      pendingCaret.current = caret;
      setPages(next.pages);
      setMount((value) => value + 1);
    }
    if (!keepHistory) setTimeout(snapshot, 50);
  }, [runReflow, refreshAux, snapshot]);

  const applySnapshot = useCallback((entry) => {
    if (!entry) return;
    const root = deskRef.current;
    const bodies = [...root.querySelectorAll('[data-page-body]')];
    const sameShape = bodies.length === entry.pages.length && bodies.every((body, index) => body.dataset.pageId === entry.pages[index].id);
    if (sameShape) {
      bodies.forEach((body, index) => { if (body.innerHTML !== entry.pages[index].html) body.innerHTML = entry.pages[index].html; });
      restoreCaretPosition(root, entry.caret);
    } else {
      pendingCaret.current = entry.caret;
      setPages(entry.pages);
      setMount((value) => value + 1);
    }
    change({ noHistory: true });
  }, [change]);

  useEffect(() => { ensureFonts(); }, []);

  // Reflow cuando cambia el número de páginas o la geometría.
  useLayoutEffect(() => {
    runReflow();
  }, [pages.length, doc.pageSize, doc.orientation, doc.margins, doc.columns, doc.customSize, runReflow, mount, notes]);

  // Al montar o remontar las páginas: hidratar contenido enriquecido, comentarios y datos.
  useEffect(() => {
    const root = deskRef.current;
    if (!root) return;
    if (pendingCaret.current) {
      restoreCaretPosition(root, pendingCaret.current);
      pendingCaret.current = null;
    }
    refreshAux();
    hydrateRich(root);
    decorateComments(root, docRef.current.comments, activeComment);
    if (project) {
      hydrateRefs(root, project);
      hydrateLiveBlocks(root, project);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mount]);

  useEffect(() => {
    historyRef.current.reset();
    const timer = setTimeout(snapshot, 120);
    return () => clearTimeout(timer);
  }, [snapshot]);

  // Datos de SprintOps del proyecto vinculado.
  const refreshProject = useCallback(async (force = false) => {
    if (!meta?.projectId) {
      setProject(null);
      return null;
    }
    const data = await loadProject(meta.projectId, force);
    setProject(data);
    const root = deskRef.current;
    if (root && data) {
      hydrateRefs(root, data);
      if (force) hydrateLiveBlocks(root, data);
    }
    return data;
  }, [meta?.projectId]);

  useEffect(() => {
    refreshProject(false);
  }, [refreshProject]);

  // Recuperación ante cierres inesperados.
  useEffect(() => {
    try {
      const backup = JSON.parse(localStorage.getItem(`wd-backup-${hojaId}`) || 'null');
      const updated = Date.parse(meta?.updatedAt || 0) || 0;
      if (backup?.model && backup.at > updated + 2000) {
        const local = backup.model.pages.map((page) => page.html).join('');
        const server = docRef.current.pages.map((page) => page.html).join('');
        if (local !== server) setBanner({ kind: 'recover', at: backup.at, model: backup.model });
      }
    } catch {
      /* respaldo ilegible */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hojaId]);

  useEffect(() => {
    const onUnload = (event) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  // ---------- Guardado, conflictos y sincronización ----------

  const save = useCallback(async () => {
    if (!canComment && !canEdit) return;
    if (savingRef.current) {
      queuedRef.current = true;
      return;
    }
    savingRef.current = true;
    setStatus('saving');
    const epochAtSave = epochRef.current;
    const model = readModel();
    try {
      const saved = await portfolioRepository.saveDocument(hojaId, { userId: user.id, revision: revisionRef.current, document: serializeDocument({ kind: 'document', doc: model }) });
      revisionRef.current = saved.revision;
      baseRef.current = model;
      if (epochAtSave === epochRef.current) {
        dirtyRef.current = false;
        setDirty(false);
        localStorage.removeItem(`wd-backup-${hojaId}`);
      }
      setStatus('saved');
      setError('');
      setSavedAt(new Date());
    } catch (err) {
      if (err.status === 409) {
        savingRef.current = false;
        await timers.current.resolveConflict?.();
        return;
      }
      setStatus(navigator.onLine ? 'error' : 'offline');
      setError(err.message || 'No se pudo guardar el documento.');
    } finally {
      savingRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        setTimeout(() => timers.current.save?.(), 50);
      }
    }
  }, [canComment, canEdit, readModel, hojaId, user.id]);
  timers.current.save = save;

  useEffect(() => {
    if (!dirty || !autosave || meta?.deleted || (!canEdit && !canComment)) return undefined;
    const timer = setTimeout(save, 900);
    return () => clearTimeout(timer);
  }, [dirty, epoch, autosave, save, meta?.deleted, canEdit, canComment]);

  useEffect(() => {
    const online = () => { if (dirtyRef.current) save(); };
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [save]);

  // Presencia, cursores de colaboradores y sincronización de cambios remotos.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const root = deskRef.current;
      const range = rangeIn(root);
      let cursor = null;
      if (range) {
        const body = range.startContainer.parentElement?.closest('[data-page-body]');
        const block = currentBlock(root);
        const top = block?.closest('[data-page-body] > *');
        if (body && top) cursor = { page: [...root.querySelectorAll('[data-page-body]')].indexOf(body), block: [...body.children].indexOf(top), text: range.toString().slice(0, 60), color: colorFor(user.id) };
      }
      try {
        const list = await portfolioRepository.presence(hojaId, user.id, cursor);
        if (alive) setPeople((list || []).filter((person) => String(person.id) !== String(user.id)));
      } catch {
        /* presencia opcional */
      }
      if (dirtyRef.current || savingRef.current) return;
      try {
        const remote = await portfolioRepository.revision(hojaId, user.id);
        if (alive && remote.revision > revisionRef.current && !dirtyRef.current) {
          const fresh = await portfolioRepository.get(hojaId, user.id);
          const parsed = parseDocument(fresh.document);
          if (parsed.doc && !dirtyRef.current) {
            const caret = caretPosition(deskRef.current);
            revisionRef.current = fresh.revision;
            baseRef.current = parsed.doc;
            applyModel(parsed.doc, { caret, keepHistory: true });
            onMeta?.((current) => current && ({ ...current, updatedAt: fresh.updatedAt }));
          }
        }
      } catch {
        /* sin conexión */
      }
    };
    tick();
    const timer = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [hojaId, user.id, applyModel, onMeta]);

  // Marcas de cursor de colaboradores sobre la página.
  useLayoutEffect(() => {
    const root = deskRef.current;
    if (!root) return;
    const bodies = [...root.querySelectorAll('[data-page-body]')];
    setCollab(people.filter((person) => person.cursor && bodies[person.cursor.page]).map((person) => {
      const body = bodies[person.cursor.page];
      const block = body.children[person.cursor.block] || body.lastElementChild;
      return { id: person.id, name: person.name || person.email, color: person.cursor.color || colorFor(person.id), page: person.cursor.page, top: (block?.offsetTop || 0) + body.offsetTop, height: block?.offsetHeight || 20, text: person.cursor.text };
    }));
  }, [people, epoch]);

  // ---------- Selección y estado de formato ----------

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const root = deskRef.current;
      const range = rangeIn(root);
      if (!range) {
        if (!selectionHeld()) setBubble(null);
        return;
      }
      rememberSelection(root);
      const el = anchorElement();
      const block = currentBlock(root);
      const style = el ? window.getComputedStyle(el) : null;
      const blockStyle = block ? window.getComputedStyle(block) : null;
      const tag = block?.tagName || 'P';
      const styleClass = [...(block?.classList || [])].find((name) => name.startsWith('wd-style-') || name.startsWith('wd-cs-'));
      const styleId = styleClass ? styleClass.replace('wd-style-', '').replace('wd-cs-', '') : tag === 'P' ? 'normal' : tag === 'BLOCKQUOTE' ? 'quote' : tag === 'PRE' ? 'code' : tag.toLowerCase();
      const tableCell = el?.closest?.('td, th');
      setCell(tableCell && root.contains(tableCell) ? tableCell : null);
      setSel({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
        sub: document.queryCommandState('subscript'),
        sup: document.queryCommandState('superscript'),
        align: blockStyle?.textAlign || 'left',
        font: (style?.fontFamily || '').split(',')[0].replace(/["']/g, '').trim(),
        size: style ? Math.round(parseFloat(style.fontSize)) : 0,
        color: style?.color || '',
        highlight: paintBetween(el, block),
        shade: solidPaint(blockStyle?.backgroundColor),
        line: block?.style.lineHeight || '',
        list: el?.closest?.('ol, ul')?.tagName || null,
        styleId,
        inTable: Boolean(tableCell),
        blockStyle: block ? { marginLeft: block.style.marginLeft, marginRight: block.style.marginRight, textIndent: block.style.textIndent, paddingLeft: block.style.paddingLeft, marginTop: block.style.marginTop || blockStyle.marginTop, marginBottom: block.style.marginBottom || blockStyle.marginBottom } : {},
      });
      const body = range.startContainer.parentElement?.closest?.('[data-page-body]');
      if (body) setCounts((prev) => ({ ...prev, page: Number(body.closest('[data-page-index]')?.dataset.pageIndex || 0) + 1 }));
      const text = range.toString();
      const line = [...range.getClientRects()].find((item) => item.width > 1 && item.height > 1) || range.getBoundingClientRect();
      setBubble(!bubblePaused.current && !range.collapsed && text.trim() && editable && !pen.tool ? line : null);
      const menuState = inlineRef.current;
      if (menuState) {
        const query = (() => {
          if (!menuState.node.isConnected || range.startContainer !== menuState.node || range.startOffset <= menuState.offset) return null;
          return menuState.node.data.slice(menuState.offset + 1, range.startOffset);
        })();
        if (query === null || query.length > 40 || (menuState.trigger === '/' && /\s/.test(query))) {
          inlineRef.current = null;
          setInline(null);
        } else if (query !== menuState.query) {
          inlineRef.current = { ...menuState, query };
          setInline(inlineRef.current);
          setInlineActive(0);
        }
      }
    };
    const onChange = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    document.addEventListener('selectionchange', onChange);
    const topUi = '.wd-ribbon-wrap, .wd-top, .wd-pop, .wd-export-pop';
    const restoreBubble = () => {
      const range = rangeIn(deskRef.current);
      const text = range && !range.collapsed ? range.toString() : '';
      if (!text.trim() || !editable || pen.tool) { setBubble(null); return; }
      const line = [...range.getClientRects()].find((item) => item.width > 1 && item.height > 1) || range.getBoundingClientRect();
      setBubble(line);
    };
    const onOver = (event) => {
      if (!event.target.closest?.(topUi)) return;
      bubblePaused.current = true;
      setBubble(null);
    };
    const onOut = (event) => {
      if (!event.target.closest?.(topUi)) return;
      const next = event.relatedTarget;
      if (next?.closest?.(topUi) || next?.closest?.('.wd-bubble')) return;
      bubblePaused.current = false;
      restoreBubble();
    };
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    return () => {
      document.removeEventListener('selectionchange', onChange);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      cancelAnimationFrame(frame);
    };
  }, [editable, pen.tool, deskRef]);

  const selectObject = useCallback((el, additive = false) => {
    const root = deskRef.current;
    root?.querySelectorAll('.is-obj-selected').forEach((node) => { if (!additive || node === el) node.classList.remove('is-obj-selected'); });
    if (!el) {
      setObject(null);
      setObjects([]);
      return;
    }
    el.classList.add('is-obj-selected');
    setObject(el);
    setObjects((current) => (additive ? [...new Set([...current.filter((node) => node.isConnected), el])] : [el]));
    setObjVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    if (object && !object.isConnected) selectObject(null);
  }, [epoch, object, selectObject]);

  // Decoraciones de comentarios cuando cambian.
  const commentsKey = doc.comments.map((comment) => `${comment.id}:${comment.resolved}:${comment.quote}`).join('|');
  useEffect(() => {
    const root = deskRef.current;
    if (!root) return;
    const caret = caretPosition(root);
    decorateComments(root, docRef.current.comments, activeComment);
    if (caret && document.activeElement?.closest?.('[data-page-body]')) restoreCaretPosition(root, caret);
  }, [commentsKey, activeComment]);

  // ---------- Zoom ----------

  const effectiveZoom = useMemo(() => {
    const root = deskRef.current;
    if (!view.fit || !root) return view.zoom;
    const width = root.clientWidth - 72;
    const height = root.clientHeight - 56;
    if (view.fit === 'width') return Math.max(0.2, width / metrics.width);
    if (view.fit === 'page') return Math.max(0.2, Math.min(width / metrics.width, height / (metrics.height + 40)));
    if (view.fit === 'multi') return Math.max(0.15, Math.min(0.6, width / (metrics.width * 3 + 80)));
    if (view.fit === 'side') return Math.max(0.2, Math.min(width / (metrics.width * 2 + 48), height / (metrics.height + 40)));
    return view.zoom;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.fit, view.zoom, metrics.width, metrics.height, left.open, right.open]);

  // ---------- Diálogos, IA y acciones ----------

  const ask = useCallback((config) => new Promise((resolve) => setDialog({ ...config, resolve })), []);
  const openDialog = useCallback((title, render, width) => new Promise((resolve) => setDialog({ title, render, width, resolve })), []);
  const ai = useCallback(async (action, body = {}) => {
    const result = await portfolioRepository.ai(hojaId, { userId: user.id, action, ...body });
    return result.result;
  }, [hojaId, user.id]);

  const ctx = {
    desk, user, meta, hojaId, name, setName, onMeta, navigate, storage, toast,
    doc: () => docRef.current, setDocRaw: (next) => { docRef.current = next; setDoc(next); },
    patchDoc, change, readModel, applyModel, applySnapshot, save, snapshot, history: historyRef.current, refreshAux,
    ask, dialog: openDialog, pick: pickFile, ai,
    editable: () => editable, canEdit, canComment, owner, tracking: () => tracking,
    object: () => object, objects: () => objects.filter((node) => node.isConnected), selectObject, cell: () => cell, bumpObject: () => setObjVersion((value) => value + 1),
    view: () => view, setView, openLeft: (tabName) => setLeft({ open: true, tab: tabName }), openRight: (tabName) => setRight({ open: true, tab: tabName }),
    setFind, find: () => find,
    project: () => project, refreshProject,
    pen: () => pen, setPen, inkSel: () => inkSel, setInkSel,
    mergePreview: () => mergePreview, setMergePreview,
    painter: () => painter, setPainter,
    setBanner, setReading, setGrammar, setActiveComment, setFinalOverride,
    revision: () => revisionRef.current, setRevision: (value) => { revisionRef.current = value; }, base: () => baseRef.current, setBase: (model) => { baseRef.current = model; },
    autosave: () => autosave, setAutosave: (value) => { setAutosaveState(value); storage.set('autosave', value); },
    borderPen: () => borderPen,
    rootEl: () => rootRef.current,
    setStatus,
    openChrome: (kind) => {
      const field = deskRef.current?.querySelector(`[data-chrome^="${kind}"]`);
      if (!field) return;
      if (field.dataset.chrome === chromeEdit) field.focus();
      else setChromeEdit(field.dataset.chrome);
    },
  };
  const actions = createActions(ctx);
  timers.current.resolveConflict = actions.resolveConflict;

  const trackedFormat = (fn) => {
    if (tracking) trackFormat(fn, user);
    else fn();
  };

  const api = {
    doc, user, meta, view, setView, pen, setPen, storage, fonts: FONTS, painter: Boolean(painter), canUndo: historyRef.current.canUndo(), canRedo: historyRef.current.canRedo(),
    readOnly: !editable, canEdit, canComment, object, objects, cell, project, mergePreview, mergeRows: actions.mergeRows(), reading, inkSelection: inkSel.ids,
    rightTab: right.open ? right.tab : null, leftOpen: left.open, recentColors: storage.get('recentColors', []), borderPen, setBorderPen,
    autosave, setAutosave: ctx.setAutosave, saveNow: save,
    cmd: (command, value) => { if (!editable) return; trackedFormat(() => exec(deskRef.current, command, value)); change(); },
    inline: (styles) => {
      if (!editable) return;
      trackedFormat(() => applyInlineStyle(deskRef.current, styles));
      setMultiRanges([]);
      if (styles.color) storage.set('recentColors', [styles.color, ...storage.get('recentColors', []).filter((color) => color !== styles.color)].slice(0, 6));
      change();
    },
    block: (styles) => { if (!editable) return; applyBlockStyle(deskRef.current, styles); change(); },
    setTag: (tag, className) => { if (!editable) return; setBlockTag(deskRef.current, tag, className); change(); },
    caseOf: (caseMode) => { if (!editable) return; transformCase(deskRef.current, caseMode); change(); },
    insert: (html) => { if (!editable) return; insertHtml(deskRef.current, html); change(); },
    insertBlock: (html) => { if (!editable) return null; const nodes = insertBlockHtml(deskRef.current, html); change(); return nodes; },
    patchDoc,
    run: (actionName, ...args) => {
      const fn = actions[actionName];
      if (!fn) {
        toast.error(`Acción no disponible: ${actionName}`);
        return undefined;
      }
      return Promise.resolve(fn(...args)).catch((err) => toast.error(err?.message || 'No se pudo completar la acción.'));
    },
    openLeft: (tabName) => setLeft({ open: true, tab: tabName }),
    closeLeft: () => setLeft((current) => ({ ...current, open: false })),
    openRight: (tabName) => setRight({ open: true, tab: tabName }),
    closeRight: () => setRight((current) => ({ ...current, open: false })),
  };

  // ---------- Eventos del documento ----------

  const onInput = (event) => {
    if (event.target.closest?.('.wd-chrome')) return;
    if (doc.autocorrect && event.nativeEvent.inputType === 'insertText' && /^[\s.,;:!?)]$/.test(event.nativeEvent.data || '')) actions.autocorrect(event.nativeEvent.data);
    if (event.nativeEvent.inputType === 'insertText' && (event.nativeEvent.data === '/' || event.nativeEvent.data === '@')) {
      const range = rangeIn(deskRef.current);
      const node = range?.startContainer;
      if (node?.nodeType === 3) {
        const before = node.data.slice(0, range.startOffset - 1);
        if (!before || /\s$/.test(before) || before.endsWith('\u00a0')) {
          const rect = range.getBoundingClientRect();
          inlineRef.current = { trigger: event.nativeEvent.data, node, offset: range.startOffset - 1, query: '', rect: rect.height ? rect : node.parentElement.getBoundingClientRect() };
          setInline(inlineRef.current);
          setInlineActive(0);
        }
      }
    }
    change();
  };

  const onBeforeInput = (event) => {
    if (!editable) {
      event.preventDefault();
      return;
    }
    if (!tracking || event.target.closest?.('.wd-chrome')) return;
    const type = event.nativeEvent.inputType;
    if (type === 'insertText' || type === 'insertReplacementText') {
      const text = event.nativeEvent.data ?? event.nativeEvent.dataTransfer?.getData('text/plain');
      if (text && trackInsertText(text, user)) {
        event.preventDefault();
        change();
      }
    } else if (type.startsWith('delete')) {
      event.preventDefault();
      trackDelete(type, user);
      change();
    }
  };

  const inlineItems = useMemo(() => actions.inlineItems(inline), [inline, project]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickInline = (item) => {
    const state = inlineRef.current;
    inlineRef.current = null;
    setInline(null);
    if (!state || !item) return;
    actions.consumeTrigger(state);
    actions.pickInline(item);
  };

  const onKeyDown = (event) => {
    const mod = event.metaKey || event.ctrlKey;
    if (inline) {
      if (event.key === 'ArrowDown') { event.preventDefault(); setInlineActive((value) => Math.min(inlineItems.length - 1, value + 1)); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); setInlineActive((value) => Math.max(0, value - 1)); return; }
      if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); pickInline(inlineItems[inlineActive]); return; }
      if (event.key === 'Escape') { event.preventDefault(); inlineRef.current = null; setInline(null); return; }
    }
    if (object && (event.key === 'Delete' || event.key === 'Backspace') && !event.target.closest?.('.wd-textbox-body')) {
      event.preventDefault();
      actions.deleteObject();
      return;
    }
    if (object && object.style.position === 'absolute' && event.key.startsWith('Arrow')) {
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      if (event.key === 'ArrowLeft') object.style.left = `${object.offsetLeft - step}px`;
      if (event.key === 'ArrowRight') object.style.left = `${object.offsetLeft + step}px`;
      if (event.key === 'ArrowUp') object.style.top = `${object.offsetTop - step}px`;
      if (event.key === 'ArrowDown') object.style.top = `${object.offsetTop + step}px`;
      setObjVersion((value) => value + 1);
      change({ noReflow: true });
      return;
    }
    if (event.key === 'Tab' && !mod) {
      if (actions.handleTab(event.shiftKey)) event.preventDefault();
      return;
    }
    if (!mod) return;
    const key = event.key.toLowerCase();
    const shortcuts = {
      s: () => save(), p: () => actions.print(), f: () => actions.find(event.altKey ? null : {}), h: () => actions.find({ replace: true }), g: () => actions.goto(), k: () => actions.link(),
      z: () => (event.shiftKey ? actions.redo() : actions.undo()), y: () => actions.redo(), enter: () => (event.shiftKey ? actions.columnBreak() : actions.pageBreak()),
      l: () => api.cmd('justifyLeft'), e: () => api.cmd('justifyCenter'), r: () => api.cmd('justifyRight'), j: () => api.cmd('justifyFull'),
      ']': () => actions.growFont(1), '[': () => actions.growFont(-1), ',': () => api.cmd('subscript'), '.': () => api.cmd('superscript'), d: () => actions.fontDialog(),
      '/': () => actions.shortcuts(), '*': () => setView({ marks: !view.marks }),
    };
    if (event.shiftKey && key === 'c') return void (event.preventDefault(), actions.copyFormat());
    if (event.shiftKey && key === 'v') return void (event.preventDefault(), painter ? actions.pasteFormat() : actions.pastePlain());
    if (event.shiftKey && (key === '7' || key === '&')) return void (event.preventDefault(), api.cmd('insertOrderedList'));
    if (event.shiftKey && (key === '8' || key === '(')) return void (event.preventDefault(), api.cmd('insertUnorderedList'));
    if (event.altKey && /^[0-6]$/.test(event.code.replace('Digit', ''))) {
      event.preventDefault();
      const level = Number(event.code.replace('Digit', ''));
      api.setTag(level ? `H${level}` : 'P');
      return;
    }
    if (event.altKey && key === 'm') return void (event.preventDefault(), actions.comment());
    if (event.altKey && key === 'f') return void (event.preventDefault(), actions.note('foot'));
    const fn = shortcuts[key];
    if (fn) {
      event.preventDefault();
      fn();
    }
  };

  const onPaste = (event) => {
    if (event.target.closest?.('.wd-chrome')) return;
    event.preventDefault();
    if (!editable) return;
    actions.pasteFromEvent(event.clipboardData);
  };

  const onDrop = (event) => {
    const files = [...(event.dataTransfer?.files || [])];
    if (!files.length || !editable) return;
    event.preventDefault();
    const point = document.caretRangeFromPoint?.(event.clientX, event.clientY) || (() => {
      const pos = document.caretPositionFromPoint?.(event.clientX, event.clientY);
      if (!pos) return null;
      const range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      return range;
    })();
    if (point) {
      const s = document.getSelection();
      s.removeAllRanges();
      s.addRange(point);
      rememberSelection(deskRef.current);
    }
    files.forEach((file) => actions.insertFile(file));
  };

  const onClick = (event) => {
    const target = event.target;
    if (target.closest('.wd-obj-handles')) return;
    const obj = target.closest('figure.wd-obj, [data-page-body] img');
    if (obj && !target.closest('.wd-textbox-body') && deskRef.current.contains(obj)) {
      const top = obj.parentElement?.closest('figure.wd-group') || obj;
      selectObject(top, event.shiftKey);
      return;
    }
    if (object && !event.shiftKey) selectObject(null);
    const li = target.closest('ul.wd-checklist > li');
    if (li && event.clientX - li.getBoundingClientRect().left < 24 && (editable || canComment)) {
      li.dataset.checked = li.dataset.checked === 'true' ? 'false' : 'true';
      change({ noReflow: true });
      return;
    }
    const mark = target.closest('mark.wd-cmark');
    if (mark) {
      setActiveComment(mark.dataset.commentId);
      setRight({ open: true, tab: 'comments' });
    }
    const noteRef = target.closest('sup.wd-note-ref');
    if (noteRef) return void actions.editNote(noteRef.dataset.note);
    const link = target.closest('a[href]');
    if (link && (event.metaKey || event.ctrlKey || !editable || link.classList.contains('wd-ref'))) {
      if (!(event.metaKey || event.ctrlKey) && link.classList.contains('wd-ref') && editable) return;
      event.preventDefault();
      actions.followLink(link);
    }
  };

  const onDoubleClick = (event) => {
    const page = event.target.closest?.('.wd-page');
    if (page && !event.target.closest('figure.wd-obj, figure.wd-mermaid, .wd-eq')) {
      const box = page.getBoundingClientRect();
      const y = event.clientY - box.top;
      const margins = docRef.current.margins;
      const bodyBox = page.querySelector('.wd-body-wrap')?.getBoundingClientRect();
      const inHeader = y >= 0 && y <= Math.max(margins.top + 24, 108) && (!bodyBox || event.clientY <= bodyBox.top + 8);
      const inFooter = y <= box.height && box.height - y <= Math.max(margins.bottom + 24, 108);
      if (inHeader || inFooter) {
        const kind = inFooter && (!inHeader || y > box.height / 2) ? 'footer' : 'header';
        setChromeEdit(page.querySelector(`[data-chrome^="${kind}"]`)?.dataset.chrome || null);
        return;
      }
    }
    const obj = event.target.closest('figure.wd-obj, figure.wd-mermaid, .wd-eq, .wd-progress-block, a.wd-ref, [data-page-body] img');
    if (!obj) return;
    if (obj.matches('a.wd-ref')) return void actions.followLink(obj);
    event.preventDefault();
    actions.editObject(obj);
  };

  const onContextMenu = (event) => {
    if (!deskRef.current.contains(event.target) || event.shiftKey) return;
    event.preventDefault();
    const items = actions.contextItems(event.target, { Scissors, Copy, ClipboardPaste, MessageSquarePlus, Link2, Languages, ListPlus, Sparkles, BookA, Trash2, Type, TextSelect });
    setMenu({ x: event.clientX, y: event.clientY, items });
  };

  const onChromeInput = useCallback((field, el) => {
    docRef.current = { ...docRef.current, [field]: el.innerHTML };
    deskRef.current?.querySelectorAll(`[data-chrome="${field}"]`).forEach((node) => { if (node !== el) node.innerHTML = el.innerHTML; });
    dirtyRef.current = true;
    epochRef.current += 1;
    setDoc(docRef.current);
    setDirty(true);
    setEpoch(epochRef.current);
  }, []);

  const onInkChange = useCallback((pageId, strokes, commit) => {
    docRef.current = { ...docRef.current, ink: { ...docRef.current.ink, [pageId]: strokes } };
    setDoc(docRef.current);
    if (commit) change({ noReflow: true });
  }, [change]);

  const onInkSelect = useCallback((pageId, ids) => setInkSel({ pageId, ids }), []);

  // Vista dividida / en paralelo
  useEffect(() => {
    if (!view.split) return undefined;
    const timer = setTimeout(() => setMirrorHtml(readModel().pages.map((page) => `<article class="wd-mirror-page" style="width:${metrics.width}px;min-height:${metrics.height}px;padding:${doc.margins.top}px ${doc.margins.right}px ${doc.margins.bottom}px ${doc.margins.left}px">${sanitizeHtml(page.html)}</article>`).join('')), 300);
    return () => clearTimeout(timer);
  }, [view.split, epoch, readModel, metrics.width, metrics.height, doc.margins]);

  const onDeskScroll = () => {
    const root = deskRef.current;
    const mirror = mirrorRef.current;
    if (!mirror || !view.syncScroll) return;
    const ratio = root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight);
    mirror.scrollTop = ratio * (mirror.scrollHeight - mirror.clientHeight);
  };

  // ---------- Render ----------

  const saveName = async () => {
    if (!owner) return;
    const trimmed = name.trim() || 'Sin título';
    setName(trimmed);
    if (trimmed === meta.name) return;
    const updated = await portfolioRepository.update(hojaId, { userId: user.id, name: trimmed });
    onMeta(updated);
  };

  const theme = doc.theme;
  const set = STYLE_SET_VARS(doc);
  const stackStyle = {
    zoom: effectiveZoom,
    '--wd-primary': theme.colors.primary,
    '--wd-accent': theme.colors.accent,
    '--wd-text': theme.colors.text,
    '--wd-heading': theme.colors.heading,
    '--wd-muted': theme.colors.muted,
    '--wd-font-heading': theme.fonts.heading,
    '--wd-font-body': doc.defaultFont.family || theme.fonts.body,
    '--wd-size-body': `${doc.defaultFont.size || 16}px`,
    ...set,
  };
  const background = doc.background?.type === 'image' ? `center / cover no-repeat url("${doc.background.value}")` : doc.background?.type && doc.background.type !== 'none' ? doc.background.value : undefined;
  const contextKind = object ? (object.tagName === 'IMG' ? 'image' : ({ image: 'image', shape: 'shape', chart: 'chart', diagram: 'diagram' }[object.dataset.kind] || 'object')) : cell ? 'table' : null;
  const statusIcon = status === 'saving' ? <Loader2 size={14} className="wd-spin" /> : status === 'error' || status === 'offline' ? <CloudOff size={14} /> : <Cloud size={14} />;
  const statusLabel = status === 'saving' ? 'Guardando…' : status === 'offline' ? 'Sin conexión: se guardará al reconectar' : status === 'error' ? 'Error al guardar' : dirty ? (autosave ? 'Cambios pendientes' : 'Sin guardar') : `Guardado${savedAt ? ` · ${savedAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}` : ''}`;
  const customCss = doc.customStyles.map((style) => `.wd-stack .wd-cs-${style.id}{${String(style.css || '').replace(/[{}<>]/g, '')}}`).join('\n');
  const chromeKey = (index, kind) => {
    if (doc.differentFirst && index === 0) return `${kind}First`;
    if (doc.differentOddEven && (index + doc.pageNumberStart) % 2 === 0) return `${kind}Even`;
    return kind;
  };
  const ContextTab = contextKind ? CONTEXT_TABS[contextKind][1] : null;
  const ContextIcon = contextKind ? CONTEXT_TABS[contextKind][2] : null;
  const activeTab = tab === 'context' && !ContextTab ? 'home' : tab;
  const TabBody = { home: HomeTab, insert: InsertTab, draw: DrawTab, design: DesignTab, layout: LayoutTab, references: ReferencesTab, mailings: MailingsTab, review: ReviewTab, view: ViewTab, context: ContextTab }[activeTab];

  return (
    <div ref={rootRef} className={`pf-editor wd-editor is-${view.mode}${view.marks ? ' show-marks' : ''}${view.bounds ? ' show-bounds' : ''}${view.grid ? ' show-grid' : ''} markup-${view.markup}${tracking ? ' is-tracking' : ''}`}>
      <header className="pf-top wd-top">
        <Link to="/portafolio" className="pf-icon-btn" aria-label="Volver a documentos" title="Volver a documentos"><ChevronLeft size={18} /></Link>
        <label className="pf-name-wrap">
          <input className="pf-name" value={name} aria-label="Nombre del documento" disabled={!owner} onChange={(event) => setName(event.target.value)} onBlur={saveName} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
          {owner && <Pencil size={14} />}
        </label>
        <span className="ss-kind">Documento</span>
        <button type="button" className={`wd-save-state${status === 'error' || status === 'offline' ? ' is-error' : ''}`} onClick={save} title={error || 'Guardar ahora (⌘S)'} aria-live="polite">{statusIcon}<span>{statusLabel}</span></button>
        {!editable && <span className="wd-ro-chip">{lockedByOther ? `Bloqueado por ${doc.lock.name}` : mode === 'final' ? 'Marcado como final' : canComment && !canEdit ? 'Solo comentarios' : 'Solo lectura'}</span>}
        <div className="pf-top-spacer" />
        <div className="wd-people" aria-label="Colaboradores conectados">
          {people.slice(0, 5).map((person) => <span key={person.id} className="wd-person" style={{ '--c': colorFor(person.id) }} title={`${person.name || person.email} está aquí`}><Face person={person} /></span>)}
          {people.length > 5 && <span className="wd-person-more">+{people.length - 5}</span>}
        </div>
        <Btn icon={History} label="Historial de versiones" onClick={() => setRight({ open: true, tab: 'history' })} />
        <Btn icon={Users} label="Colaboradores" onClick={() => setRight({ open: true, tab: 'people' })} />
        <ExportMenu name={name} onExport={(format) => actions.exportAs(format)} />
        <SheetShare hojaId={hojaId} user={user} meta={meta} onMeta={onMeta} />
      </header>

      {banner && (
        <div className={`wd-banner is-${banner.kind}`} role="status">
          <AlertTriangle size={16} />
          <span>{banner.kind === 'recover' ? `Recuperamos cambios sin guardar del ${new Date(banner.at).toLocaleString('es')}.` : banner.text}</span>
          {banner.kind === 'recover' && <button type="button" className="wd-primary" onClick={() => { applyModel(banner.model); setBanner(null); change(); }}>Restaurar</button>}
          {banner.actions?.map((action) => <button key={action.label} type="button" className="ps-quiet" onClick={() => { action.run(); setBanner(null); }}>{action.label}</button>)}
          <button type="button" className="ps-quiet" onClick={() => { if (banner.kind === 'recover') localStorage.removeItem(`wd-backup-${hojaId}`); setBanner(null); }}>Descartar</button>
        </div>
      )}
      {mode === 'final' && !finalOverride && (
        <div className="wd-banner is-final" role="status"><span>Este documento está marcado como final.</span>{owner && <button type="button" className="ps-quiet" onClick={() => setFinalOverride(true)}>Editar de todos modos</button>}</div>
      )}

      {view.mode !== 'read' && view.mode !== 'focus' && (
        <div
          className="wd-ribbon-wrap"
          onMouseDownCapture={(event) => {
            if (event.target.closest('input, textarea, select')) {
              holdSelection(deskRef.current);
              return;
            }
            event.preventDefault();
            holdSelection(deskRef.current);
          }}
        >
          <div className="wd-tabs" role="tablist" aria-label="Cinta de opciones">
            {TABS.map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                className={`wd-tab${activeTab === id ? ' is-active' : ''}`}
                onClick={() => { setTab(id); setRibbonOpen(true); }}
                onDoubleClick={() => setRibbonOpen((value) => !value)}
              >
                <Icon size={14} aria-hidden="true" />
                <span className="wd-tab-label"><span>{label}</span></span>
              </button>
            ))}
            {ContextTab && <button type="button" role="tab" aria-selected={activeTab === 'context'} className={`wd-tab is-context${activeTab === 'context' ? ' is-active' : ''}`} onMouseDown={(event) => event.preventDefault()} onClick={() => { setTab('context'); setRibbonOpen(true); }}><ContextIcon size={14} aria-hidden="true" /><span className="wd-tab-label"><span>{CONTEXT_TABS[contextKind][0]}</span></span></button>}
            <div className="wd-tabs-gap" />
            <button type="button" className="wd-tab-toggle" aria-label={ribbonOpen ? 'Contraer cinta' : 'Expandir cinta'} title={ribbonOpen ? 'Contraer cinta' : 'Expandir cinta'} onClick={() => setRibbonOpen((value) => !value)}>{ribbonOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>
          </div>
          {ribbonOpen && TabBody && (
            <div className={`wd-ribbon${!editable && activeTab !== 'view' && activeTab !== 'review' ? ' is-readonly' : ''}`} role="tabpanel" aria-label={TABS.find(([id]) => id === activeTab)?.[1] || 'Herramientas'} key={activeTab}>
              <TabBody api={api} sel={sel} />
            </div>
          )}
        </div>
      )}

      <div className="wd-main">
        {left.open && <LeftPanel tab={left.tab} setTab={(tabName) => setLeft({ open: true, tab: tabName })} onClose={() => setLeft((current) => ({ ...current, open: false }))} headings={headings} pages={pages} desk={deskRef} epoch={epoch} find={find} setFind={setFind} actions={actions} project={project} meta={meta} doc={doc} metrics={metrics} />}
        <div
          ref={deskRef}
          className={`wd-desk layout-${view.layout}${pen.tool ? ' is-drawing' : ''}`}
          onInput={onInput}
          onBeforeInput={onBeforeInput}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onDrop={onDrop}
          onMouseDown={(event) => { clearHold(); if (!event.target.closest('.wd-chrome')) setChromeEdit(null); }}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          onContextMenu={onContextMenu}
          onScroll={onDeskScroll}
          onCopy={(event) => actions.onCopy(event)}
        >
          <style>{customCss}</style>
          <div className={`wd-stack effects-${theme.effects || 'none'} hyphen-${doc.hyphenation}${doc.lineNumbers ? ' line-numbers' : ''}`} style={stackStyle}>
            {pages.map((page, index) => {
              const headerKey = chromeKey(index, 'header');
              const footerKey = chromeKey(index, 'footer');
              const pageNotes = notes.byPage[page.id] || [];
              const isLast = index === pages.length - 1;
              const endnotes = isLast ? notes.endnotes : [];
              const noteLines = pageNotes.length + endnotes.length;
              const noteHeight = noteLines ? noteLines * 20 + 18 : 0;
              const wm = doc.watermark;
              const border = doc.pageBorder;
              return (
                <div key={`${mount}-${page.id}`} className="wd-sheet">
                  {view.rulers && view.mode === 'print' && (
                    <PageRuler
                      axis="x"
                      length={metrics.width}
                      marginStart={doc.margins.left}
                      marginEnd={doc.margins.right}
                      paragraph={index === counts.page - 1 ? sel.blockStyle : null}
                      editable={editable && index === counts.page - 1}
                      onIndent={(styles) => applyBlockStyle(deskRef.current, styles)}
                      onCommit={() => change()}
                    />
                  )}
                  <div className="wd-sheet-row">
                    {view.vruler && view.mode === 'print' && <PageRuler axis="y" length={metrics.height} marginStart={doc.margins.top} marginEnd={doc.margins.bottom} />}
                    <article
                      className={`wd-page${chromeEdit?.startsWith('header') ? ' is-header-open' : ''}${chromeEdit?.startsWith('footer') ? ' is-footer-open' : ''}`}
                      data-page-index={index}
                      style={{
                        width: metrics.width,
                        height: paginate ? metrics.height : undefined,
                        minHeight: paginate ? undefined : 200,
                        padding: `${doc.margins.top}px ${doc.margins.right}px ${doc.margins.bottom}px ${doc.margins.left}px`,
                        background,
                        '--wd-body': `${bodyHeight(doc) - noteHeight}px`,
                        '--wd-mt': `${doc.margins.top}px`,
                        '--wd-mb': `${doc.margins.bottom}px`,
                        '--wd-ml': `${doc.margins.left}px`,
                        '--wd-mr': `${doc.margins.right}px`,
                        '--wd-chrome': `${HEADER_SPACE}px`,
                        '--wd-band': '96px',
                      }}
                    >
                      {wm?.type === 'text' && wm.text && <div className="wd-watermark" aria-hidden="true" style={{ color: wm.color, opacity: wm.opacity, fontSize: wm.size, transform: `translate(-50%, -50%) rotate(${wm.rotate ?? -35}deg)` }}>{wm.text}</div>}
                      {wm?.type === 'image' && wm.image && <img className="wd-watermark-img" src={wm.image} alt="" aria-hidden="true" style={{ opacity: wm.opacity ?? 0.15, width: `${wm.scale || 50}%` }} />}
                      {border?.style && border.style !== 'none' && <div className="wd-page-border" aria-hidden="true" style={{ inset: border.offset ?? 24, border: `${border.width || 2}px ${border.style} ${border.color || '#1e293b'}`, borderRadius: border.radius || 0 }} />}
                      <ChromeField field={headerKey} value={doc[headerKey]} placeholder={doc.differentFirst && index === 0 ? 'Encabezado de primera página' : headerKey === 'headerEven' ? 'Encabezado de página par' : 'Encabezado'} editable={editable} editing={chromeEdit === headerKey} onInput={onChromeInput} />
                      <div className={`wd-body-wrap${doc.columns.count > 1 ? ' has-columns' : ''}`} style={{ '--wd-cols': doc.columns.count, '--wd-col-gap': `${doc.columns.gap}px`, '--wd-col-rule': doc.columns.divider ? '1px solid #cbd5e1' : 'none' }}>
                        <PageBody pageId={page.id} html={page.html} editable={editable} spellcheck={view.spellcheck} lang={locale} />
                      </div>
                      {noteLines > 0 && (
                        <div className="wd-footnotes">
                          {pageNotes.map((note) => <p key={note.id} onClick={() => actions.editNote(note.id)}><sup>{note.label}</sup> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(doc.notes.find((item) => item.id === note.id)?.html || '') }} /></p>)}
                          {endnotes.length > 0 && <p className="wd-endnotes-title">Notas al final</p>}
                          {endnotes.map((note) => <p key={note.id} onClick={() => actions.editNote(note.id)}><sup>{note.label}</sup> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(doc.notes.find((item) => item.id === note.id)?.html || '') }} /></p>)}
                        </div>
                      )}
                      <div className="wd-footer">
                        <ChromeField field={footerKey} value={doc[footerKey]} placeholder={footerKey === 'footerFirst' ? 'Pie de primera página' : footerKey === 'footerEven' ? 'Pie de página par' : 'Pie de página'} editable={editable} editing={chromeEdit === footerKey} onInput={onChromeInput} />
                        {doc.pageNumbers && <span className={`wd-page-no is-${doc.pageNumberAlign}`}>{doc.pageNumberFormat === 'page-of' ? `Página ${index + doc.pageNumberStart} de ${pages.length + doc.pageNumberStart - 1}` : formatPageNumber(index + doc.pageNumberStart, doc.pageNumberFormat)}</span>}
                      </div>
                      <InkLayer pageId={page.id} strokes={doc.ink[page.id] || []} width={metrics.width} height={paginate ? metrics.height : 1200} pen={pen} zoom={effectiveZoom} selected={inkSel.pageId === page.id ? inkSel.ids : []} onChange={onInkChange} onSelect={onInkSelect} />
                      {collab.filter((mark) => mark.page === index).map((mark) => (
                        <div key={mark.id} className="wd-collab-tag" style={{ top: mark.top, height: mark.height, '--c': mark.color }} title={mark.text ? `${mark.name} seleccionó: “${mark.text}”` : mark.name}>
                          <span>{mark.name}</span>
                        </div>
                      ))}
                    </article>
                  </div>
                </div>
              );
            })}
          </div>
          <ObjectHandles el={object} deskEl={deskRef.current} zoom={effectiveZoom} version={objVersion} onChange={() => setObjVersion((value) => value + 1)} onCommit={() => change()} />
        </div>
        {(view.split || view.compare) && (
          <aside className="wd-mirror" ref={mirrorRef} aria-label={view.compare ? `Comparando con ${view.compare.name}` : 'Ventana dividida'}>
            <div className="wd-mirror-head">
              <strong>{view.compare ? view.compare.name : 'Vista dividida (solo lectura)'}</strong>
              <button type="button" className="ps-quiet" onClick={() => setView({ split: false, compare: null })}>Cerrar</button>
            </div>
            <div className="wd-mirror-body" style={{ zoom: Math.min(effectiveZoom, 0.9), ...stackStyle, '--wd-body': 'auto' }} dangerouslySetInnerHTML={{ __html: view.compare ? view.compare.html : mirrorHtml }} />
          </aside>
        )}
        {right.open && <RightPanel tab={right.tab} setTab={(tabName) => setRight({ open: true, tab: tabName })} onClose={() => setRight((current) => ({ ...current, open: false }))} api={api} actions={actions} doc={doc} user={user} meta={meta} people={people} activeComment={activeComment} setActiveComment={setActiveComment} grammar={grammar} setGrammar={setGrammar} epoch={epoch} desk={deskRef} hojaId={hojaId} colorFor={colorFor} />}
      </div>

      <footer className="wd-status" aria-label="Barra de estado">
        <button type="button" className="wd-status-item" onClick={() => actions.goto()} title="Ir a página">Página {counts.page} de {pages.length}</button>
        <button type="button" className="wd-status-item" onClick={() => actions.wordCount()} title="Estadísticas">{counts.words.toLocaleString('es')} palabras</button>
        <span className="wd-status-item wd-status-hide-sm">{counts.chars.toLocaleString('es')} caracteres</span>
        {tracking && <span className="wd-status-chip">Control de cambios</span>}
        <span className={`wd-status-save${status === 'error' ? ' is-error' : ''}`}>{statusIcon}{statusLabel}</span>
        <div className="wd-status-gap" />
        <div className="wd-status-modes" role="radiogroup" aria-label="Modo de visualización">
          {['read', 'print', 'web'].map((viewMode) => {
            const ModeIcon = VIEW_MODES[viewMode].icon;
            return <button key={viewMode} type="button" role="radio" aria-checked={view.mode === viewMode} className={view.mode === viewMode ? 'is-active' : ''} title={VIEW_MODES[viewMode].label} aria-label={VIEW_MODES[viewMode].label} onClick={() => setView({ mode: viewMode })}><ModeIcon size={14} /></button>;
          })}
        </div>
        <div className="wd-zoom" aria-label="Zoom">
          <button type="button" aria-label="Alejar" onClick={() => setView({ zoom: Math.max(0.5, effectiveZoom - 0.1), fit: null })}>−</button>
          <div
            className="wd-zoom-track"
            role="slider"
            tabIndex={0}
            aria-valuemin={50}
            aria-valuemax={200}
            aria-valuenow={Math.round(effectiveZoom * 100)}
            aria-label="Zoom"
            onPointerDown={(event) => {
              const track = event.currentTarget;
              const zoomAt = (clientX) => {
                const rect = track.getBoundingClientRect();
                const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
                setView({ zoom: 0.5 + ratio * 1.5, fit: null });
              };
              zoomAt(event.clientX);
              const move = (ev) => zoomAt(ev.clientX);
              const up = () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
              };
              window.addEventListener('pointermove', move);
              window.addEventListener('pointerup', up);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') setView({ zoom: Math.max(0.5, effectiveZoom - 0.1), fit: null });
              if (event.key === 'ArrowRight') setView({ zoom: Math.min(2, effectiveZoom + 0.1), fit: null });
            }}
          >
            <span className="wd-zoom-fill" style={{ width: `${((Math.min(2, Math.max(0.5, effectiveZoom)) - 0.5) / 1.5) * 100}%` }} />
            <span className="wd-zoom-thumb" style={{ left: `${((Math.min(2, Math.max(0.5, effectiveZoom)) - 0.5) / 1.5) * 100}%` }} />
          </div>
          <button type="button" aria-label="Acercar" onClick={() => setView({ zoom: Math.min(2, effectiveZoom + 0.1), fit: null })}>+</button>
          <button type="button" className="wd-zoom-label" onClick={() => actions.zoomCustom()}>{Math.round(effectiveZoom * 100)}%</button>
        </div>
      </footer>

      {(view.mode === 'read' || view.mode === 'focus') && (
        <div className="wd-mode-exit"><button type="button" className="ps-quiet" onClick={() => setView({ mode: 'print' })}>Salir de {VIEW_MODES[view.mode].label.toLowerCase()}</button></div>
      )}

      <BubbleBar rect={bubble && !menu && !inline ? bubble : null} sel={sel} api={api} />
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
      <InlineMenu menu={inline} items={inlineItems} active={inlineActive} onPick={pickInline} onHover={setInlineActive} />
      <DocDialog dialog={dialog} onClose={() => setDialog(null)} />
      {fileInput}
      <span className="sr-only" aria-live="polite">{statusLabel}</span>
    </div>
  );
}

function STYLE_SET_VARS(doc) {
  const sets = { default: [10, 1.5, 30, 23, 18], compact: [4, 1.2, 26, 20, 16], airy: [16, 1.8, 34, 25, 19], formal: [12, 2, 28, 22, 17] };
  const [after, line, h1, h2, h3] = sets[doc.styleSet] || sets.default;
  return {
    '--wd-after': `${doc.theme.paragraphAfter ?? after}px`,
    '--wd-line': line,
    '--wd-h1': `${h1}px`,
    '--wd-h2': `${h2}px`,
    '--wd-h3': `${h3}px`,
  };
}

export { plainText, selectedBlocks, restoreSelection };
export default DocumentStudio;
