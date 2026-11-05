import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronLeft,
  Download,
  Highlighter,
  Image as ImageIcon,
  Indent,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Outdent,
  Pencil,
  Pilcrow,
  Redo2,
  RemoveFormatting,
  Search,
  Strikethrough,
  Subscript,
  Superscript,
  Table2,
  Underline,
  Undo2,
} from 'lucide-react';
import { portfolioRepository } from '../../data/repositories/portfolioRepository';
import { createId, serializeDocument } from './portfolioDocument';
import { readImageFile } from './editorMedia';
import SheetShare from './ShareSheet';

const PAGE_SIZE = {
  letter: { width: 816, height: 1056 },
  a4: { width: 794, height: 1123 },
};

const FONTS = [
  ['Georgia, "Times New Roman", serif', 'Georgia'],
  ['"Iowan Old Style", Palatino, "Palatino Linotype", serif', 'Palatino'],
  ['ui-sans-serif, system-ui, "Segoe UI", sans-serif', 'Sans'],
  ['"Avenir Next", Avenir, "Segoe UI", sans-serif', 'Avenir'],
  ['ui-monospace, SFMono-Regular, Menlo, monospace', 'Mono'],
];

function sanitizeHtml(html) {
  const root = document.createElement('div');
  root.innerHTML = html || '';
  root.querySelectorAll('script, iframe, object, embed, link, style, meta').forEach((node) => node.remove());
  root.querySelectorAll('*').forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || name === 'srcdoc') node.removeAttribute(attr.name);
      if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(attr.value)) node.removeAttribute(attr.name);
    });
  });
  return root.innerHTML || '<p><br></p>';
}

const pendingPages = {};

const PageBody = memo(function PageBody({ pageId, html, editable, onEdit, onPaste }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || node.dataset.ready) return;
    const pending = pendingPages[pageId];
    node.innerHTML = pending ? sanitizeHtml(pending) : sanitizeHtml(html);
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
      role="textbox"
      aria-multiline="true"
      onInput={onEdit}
      onPaste={onPaste}
    />
  );
});

const ChromeField = memo(function ChromeField({ className, value, placeholder, editable, onInput }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (ref.current && !ref.current.dataset.ready) {
      ref.current.textContent = value || '';
      ref.current.dataset.ready = '1';
    }
  }, [value]);
  return (
    <div
      ref={ref}
      className={className}
      contentEditable={editable}
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={onInput}
    />
  );
});

function DocumentStudio({ hojaId, user, meta, initialName, revision, doc: initialDoc, onMeta }) {
  const deskRef = useRef(null);
  const revisionRef = useRef(revision);
  const docRef = useRef(initialDoc);
  const [doc, setDoc] = useState(initialDoc);
  const [pages, setPages] = useState(initialDoc.pages);
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState('saved');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [counts, setCounts] = useState({ words: 0, chars: 0 });
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const editRef = useRef(null);

  const metrics = PAGE_SIZE[doc.pageSize] || PAGE_SIZE.letter;
  const bodyHeight = metrics.height - doc.margin * 2 - 68;

  const markDirty = () => {
    const text = deskRef.current?.innerText || '';
    const words = text.trim().split(/\s+/).filter(Boolean);
    setCounts({ words: words.length, chars: text.replace(/\s/g, '').length });
    setDirty(true);
    setEpoch((value) => value + 1);
  };

  const readModel = () => {
    const nodes = [...(deskRef.current?.querySelectorAll('[data-page-body]') || [])];
    const header = deskRef.current?.querySelector('.wd-header')?.textContent || '';
    const footer = deskRef.current?.querySelector('.wd-footer-text')?.textContent || '';
    return {
      ...docRef.current,
      header,
      footer,
      pages: nodes.map((node) => ({ id: node.dataset.pageId, html: node.innerHTML || '<p><br></p>' })),
    };
  };

  const reflow = useCallback(() => {
    const root = deskRef.current;
    if (!root) return;
    const bodies = [...root.querySelectorAll('[data-page-body]')];
    for (let index = 0; index < bodies.length; index += 1) {
      const body = bodies[index];
      const breaker = [...body.children].find((child) => child.classList?.contains('wd-break'));
      if (breaker && breaker.nextElementSibling) {
        const moving = [];
        let node = breaker.nextSibling;
        while (node) {
          moving.push(node);
          node = node.nextSibling;
        }
        breaker.remove();
        const html = moving.map((node) => node.outerHTML || '').join('') || '<p><br></p>';
        moving.forEach((node) => node.remove());
        const next = bodies[index + 1];
        if (next) {
          next.insertAdjacentHTML('afterbegin', html);
        } else {
          const id = createId();
          pendingPages[id] = html;
          setPages((current) => [...current, { id, html: '' }]);
        }
        return;
      }
      if (body.scrollHeight > body.clientHeight + 4 && body.childElementCount > 1) {
        const last = body.lastElementChild;
        if (!last || last.scrollHeight >= body.clientHeight - 8) continue;
        const html = last.outerHTML;
        last.remove();
        const next = bodies[index + 1];
        if (next) next.insertAdjacentHTML('afterbegin', html);
        else {
          const id = createId();
          pendingPages[id] = html;
          setPages((current) => [...current, { id, html: '' }]);
        }
        return;
      }
      const next = bodies[index + 1];
      if (next?.firstElementChild && !next.firstElementChild.classList.contains('wd-break') && body.scrollHeight <= body.clientHeight + 4) {
        const candidate = next.firstElementChild;
        const html = candidate.outerHTML;
        body.insertAdjacentHTML('beforeend', html);
        if (body.scrollHeight > body.clientHeight + 4) {
          body.lastElementChild?.remove();
        } else {
          candidate.remove();
          if (!next.textContent.trim() && next.childElementCount === 0) {
            const id = next.dataset.pageId;
            setPages((current) => current.filter((page) => page.id !== id));
          }
          return;
        }
      }
    }
  }, []);

  useLayoutEffect(() => {
    reflow();
  }, [pages.length, doc.pageSize, doc.margin, reflow]);

  useEffect(() => {
    editRef.current = () => {
      reflow();
      markDirty();
    };
  });

  const onEdit = useCallback(() => editRef.current?.(), []);
  const onPaste = useCallback((event) => {
    const html = event.clipboardData?.getData('text/html');
    if (!html) return;
    event.preventDefault();
    document.execCommand('insertHTML', false, sanitizeHtml(html));
    editRef.current?.();
  }, []);

  useEffect(() => {
    if (!dirty || !meta?.canEdit || meta.deleted) return undefined;
    const savedEpoch = epoch;
    const timer = window.setTimeout(async () => {
      setStatus('saving');
      try {
        const saved = await portfolioRepository.saveDocument(hojaId, {
          userId: user.id,
          revision: revisionRef.current,
          document: serializeDocument({ kind: 'document', doc: readModel() }),
        });
        revisionRef.current = saved.revision;
        if (savedEpoch === epoch) {
          setDirty(false);
          setStatus('saved');
        }
      } catch (err) {
        setStatus('error');
        setError(err.message || 'No se pudo guardar el documento.');
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [dirty, epoch, hojaId, meta, user.id]);

  const command = (name, value = null) => {
    const active = document.activeElement?.closest?.('[data-page-body], .wd-header, .wd-footer-text');
    if (!active) deskRef.current?.querySelector('[data-page-body]')?.focus();
    document.execCommand('styleWithCSS', false, true);
    document.execCommand(name, false, value);
    editRef.current?.();
  };

  const applyLineHeight = (value) => {
    let node = document.getSelection()?.anchorNode;
    if (!node) return;
    if (node.nodeType === 3) node = node.parentElement;
    const block = node.closest?.('p, h1, h2, h3, li, blockquote, td, th');
    if (!block) return;
    block.style.lineHeight = value;
    editRef.current?.();
  };

  const insertHtml = (html) => {
    const body = document.activeElement?.closest?.('[data-page-body]') || deskRef.current?.querySelector('[data-page-body]');
    body?.focus();
    document.execCommand('insertHTML', false, html);
    editRef.current?.();
  };

  const onImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const image = await readImageFile(file);
      insertHtml(`<img src="${image.src}" alt="">`);
    } catch (err) {
      setError(err.message);
    }
  };

  const patchDoc = (partial) => {
    docRef.current = { ...docRef.current, ...partial };
    setDoc(docRef.current);
    markDirty();
  };

  const saveName = async () => {
    if (!meta?.canManage) return;
    const trimmed = name.trim() || 'Sin título';
    setName(trimmed);
    if (trimmed === meta.name) return;
    const updated = await portfolioRepository.update(hojaId, { userId: user.id, name: trimmed });
    onMeta(updated);
  };

  const findNext = () => {
    if (!findQuery) return;
    deskRef.current?.querySelector('[data-page-body]')?.focus();
    window.find?.(findQuery, false, false, true);
  };

  const replaceOne = () => {
    const selection = document.getSelection();
    if (selection && findQuery && selection.toString().toLowerCase() === findQuery.toLowerCase()) {
      document.execCommand('insertText', false, replaceQuery);
      editRef.current?.();
    } else {
      findNext();
    }
  };

  const onHeader = useCallback((event) => {
    docRef.current = { ...docRef.current, header: event.currentTarget.textContent || '' };
    setDirty(true);
    setEpoch((value) => value + 1);
  }, []);
  const onFooter = useCallback((event) => {
    docRef.current = { ...docRef.current, footer: event.currentTarget.textContent || '' };
    setDirty(true);
    setEpoch((value) => value + 1);
  }, []);

  const statusLabel = status === 'saving' ? 'Guardando…' : status === 'error' ? 'Error al guardar' : 'Guardado';
  const editable = meta?.canEdit !== false;

  return (
    <div className="pf-editor wd-editor">
      <header className="pf-top">
        <Link to="/portafolio" className="pf-icon-btn" aria-label="Volver a Portafolio"><ChevronLeft size={18} /></Link>
        <label className="pf-name-wrap">
          <input className="pf-name" value={name} aria-label="Nombre del documento" disabled={!meta?.canManage} onChange={(event) => setName(event.target.value)} onBlur={saveName} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
          {meta?.canManage && <Pencil size={14} />}
        </label>
        <span className="ss-kind">Documento</span>
        <span className={`pf-status${status === 'error' ? ' is-error' : ''}`}>{statusLabel}</span>
        {error && <span className="pf-error text-xs font-semibold">{error}</span>}
        <div className="pf-top-spacer" />
        <span className="wd-count">{counts.words} palabras · {counts.chars} caracteres</span>
        <button type="button" className="ps-quiet" onClick={() => { document.title = name || 'Documento'; window.print(); }}><Download size={16} /> Exportar</button>
        <SheetShare hojaId={hojaId} user={user} meta={meta} onMeta={onMeta} />
      </header>
      <div className="wd-ribbon" role="toolbar" aria-label="Formato del documento" onMouseDown={(event) => { if (event.target.closest('button')) event.preventDefault(); }}>
        <div className="wd-group">
          <button type="button" aria-label="Deshacer" onClick={() => command('undo')}><Undo2 size={16} /></button>
          <button type="button" aria-label="Rehacer" onClick={() => command('redo')}><Redo2 size={16} /></button>
          <button type="button" aria-label="Quitar formato" onClick={() => command('removeFormat')}><RemoveFormatting size={16} /></button>
        </div>
        <label className="wd-select">
          <span className="sr-only">Estilo</span>
          <select defaultValue="P" onChange={(event) => command('formatBlock', event.target.value)}>
            <option value="P">Normal</option>
            <option value="H1">Título 1</option>
            <option value="H2">Título 2</option>
            <option value="H3">Título 3</option>
            <option value="BLOCKQUOTE">Cita</option>
          </select>
        </label>
        <label className="wd-select">
          <span className="sr-only">Fuente</span>
          <select defaultValue={FONTS[0][0]} onChange={(event) => command('fontName', event.target.value)}>
            {FONTS.map(([value, label]) => <option key={label} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="wd-select wd-size">
          <span className="sr-only">Tamaño</span>
          <select defaultValue="3" onChange={(event) => command('fontSize', event.target.value)}>
            {[10, 13, 16, 18, 24, 32, 48].map((px, index) => <option key={px} value={index + 1}>{px}</option>)}
          </select>
        </label>
        <div className="wd-group">
          <button type="button" aria-label="Negrita" onClick={() => command('bold')}><Bold size={16} /></button>
          <button type="button" aria-label="Cursiva" onClick={() => command('italic')}><Italic size={16} /></button>
          <button type="button" aria-label="Subrayado" onClick={() => command('underline')}><Underline size={16} /></button>
          <button type="button" aria-label="Tachado" onClick={() => command('strikeThrough')}><Strikethrough size={16} /></button>
          <button type="button" aria-label="Superíndice" onClick={() => command('superscript')}><Superscript size={16} /></button>
          <button type="button" aria-label="Subíndice" onClick={() => command('subscript')}><Subscript size={16} /></button>
          <label className="wd-color" title="Color de texto">
            A
            <input type="color" defaultValue="#1e293b" onChange={(event) => command('foreColor', event.target.value)} />
          </label>
          <label className="wd-color" title="Resaltado">
            <Highlighter size={16} />
            <input type="color" defaultValue="#fff3a1" onChange={(event) => command('hiliteColor', event.target.value)} />
          </label>
        </div>
        <div className="wd-group">
          <button type="button" aria-label="Alinear a la izquierda" onClick={() => command('justifyLeft')}><AlignLeft size={16} /></button>
          <button type="button" aria-label="Centrar" onClick={() => command('justifyCenter')}><AlignCenter size={16} /></button>
          <button type="button" aria-label="Alinear a la derecha" onClick={() => command('justifyRight')}><AlignRight size={16} /></button>
          <button type="button" aria-label="Justificar" onClick={() => command('justifyFull')}><AlignJustify size={16} /></button>
          <button type="button" aria-label="Viñetas" onClick={() => command('insertUnorderedList')}><List size={16} /></button>
          <button type="button" aria-label="Numeración" onClick={() => command('insertOrderedList')}><ListOrdered size={16} /></button>
          <button type="button" aria-label="Reducir sangría" onClick={() => command('outdent')}><Outdent size={16} /></button>
          <button type="button" aria-label="Aumentar sangría" onClick={() => command('indent')}><Indent size={16} /></button>
          <label className="wd-select wd-size">
            <span className="sr-only">Interlineado</span>
            <select defaultValue="1.5" onChange={(event) => applyLineHeight(event.target.value)}>
              <option value="1">1.0</option>
              <option value="1.15">1.15</option>
              <option value="1.5">1.5</option>
              <option value="2">2.0</option>
            </select>
          </label>
        </div>
        <div className="wd-group">
          <button type="button" onClick={() => insertHtml('<table><tbody><tr><th>Columna</th><th>Columna</th><th>Columna</th></tr><tr><td><br></td><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table><p><br></p>')}><Table2 size={16} /> Tabla</button>
          <label>
            <ImageIcon size={16} /> Imagen
            <input type="file" accept="image/*" onChange={onImage} />
          </label>
          <button type="button" onClick={() => setLinkOpen((open) => !open)}><Link2 size={16} /> Enlace</button>
          <button type="button" aria-label="Línea horizontal" onClick={() => insertHtml('<hr>')}><Minus size={16} /></button>
          <button type="button" onClick={() => insertHtml('<hr class="wd-break"><p><br></p>')}><Pilcrow size={16} /> Salto</button>
          <button type="button" onClick={() => setFindOpen((open) => !open)}><Search size={16} /> Buscar</button>
        </div>
        <div className="wd-group">
          <label className="wd-select">
            <span className="sr-only">Tamaño de página</span>
            <select value={doc.pageSize} onChange={(event) => patchDoc({ pageSize: event.target.value })}>
              <option value="letter">Carta</option>
              <option value="a4">A4</option>
            </select>
          </label>
          <label className="wd-select">
            <span className="sr-only">Márgenes</span>
            <select value={String(doc.margin)} onChange={(event) => patchDoc({ margin: Number(event.target.value) })}>
              <option value="48">Márgenes estrechos</option>
              <option value="72">Márgenes normales</option>
              <option value="96">Márgenes amplios</option>
            </select>
          </label>
          <label className="wd-check">
            <input type="checkbox" checked={doc.pageNumbers} onChange={(event) => patchDoc({ pageNumbers: event.target.checked })} />
            Números
          </label>
          <label className="wd-zoom">
            {Math.round(zoom * 100)}%
            <input type="range" min="0.7" max="1.4" step="0.05" value={zoom} aria-label="Zoom" onChange={(event) => setZoom(Number(event.target.value))} />
          </label>
        </div>
      </div>
      {linkOpen && (
        <form className="wd-find" onSubmit={(event) => { event.preventDefault(); command('createLink', linkUrl.trim()); setLinkOpen(false); }}>
          <input value={linkUrl} aria-label="Dirección del enlace" onChange={(event) => setLinkUrl(event.target.value)} />
          <button type="submit">Aplicar enlace</button>
        </form>
      )}
      {findOpen && (
        <form className="wd-find" onSubmit={(event) => { event.preventDefault(); findNext(); }}>
          <input value={findQuery} aria-label="Buscar" placeholder="Buscar" onChange={(event) => setFindQuery(event.target.value)} />
          <input value={replaceQuery} aria-label="Reemplazar con" placeholder="Reemplazar con" onChange={(event) => setReplaceQuery(event.target.value)} />
          <button type="submit">Siguiente</button>
          <button type="button" onClick={replaceOne}>Reemplazar</button>
        </form>
      )}
      <div className="wd-desk" ref={deskRef}>
        <div className="wd-stack" style={{ transform: `scale(${zoom})` }}>
          {pages.map((page, number) => (
            <div key={page.id} className="wd-sheet">
              <PageRuler axis="x" length={metrics.width} margin={doc.margin} />
              <div className="wd-sheet-row">
                <PageRuler axis="y" length={metrics.height} margin={doc.margin} />
                <article className="wd-page" style={{ width: metrics.width, minHeight: metrics.height, padding: doc.margin, '--wd-body': `${bodyHeight}px` }}>
                  <ChromeField className="wd-header" value={doc.header} placeholder="Encabezado" editable={editable} onInput={onHeader} />
                  <PageBody pageId={page.id} html={page.html} editable={editable} onEdit={onEdit} onPaste={onPaste} />
                  <div className="wd-footer">
                    <ChromeField className="wd-footer-text" value={doc.footer} placeholder="Pie de página" editable={editable} onInput={onFooter} />
                    <span className="wd-page-no">{doc.pageNumbers ? number + 1 : ''}</span>
                  </div>
                </article>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageRuler({ axis, length, margin }) {
  const ticks = [];
  for (let value = 0; value <= length; value += 50) ticks.push(value);
  const marginStyle = axis === 'x'
    ? { left: margin, width: Math.max(0, length - margin * 2) }
    : { top: margin, height: Math.max(0, length - margin * 2) };
  return (
    <div className={`wd-ruler wd-ruler-${axis}`} style={axis === 'x' ? { width: length } : { height: length }} aria-hidden="true">
      <span className="wd-ruler-margin" style={marginStyle} />
      {ticks.map((value) => (
        <span key={value} className={`wd-tick${value % 100 === 0 ? ' is-major' : ''}`} style={axis === 'x' ? { left: value } : { top: value }}>
          {value % 100 === 0 ? value : ''}
        </span>
      ))}
    </div>
  );
}

export default DocumentStudio;
