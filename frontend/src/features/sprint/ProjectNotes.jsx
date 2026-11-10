import React, { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Code, Heading1, Heading2, Heading3, Heading4, List, ListChecks, ListOrdered, Minus, Plus, Quote, Type } from 'lucide-react';
import { notesRepository } from '../../data/repositories/notesRepository';

const EMPTY_DOC = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 } },
    { type: 'paragraph' },
  ],
};

const BLOCKS = [
  { id: 'text', label: 'Texto', hint: '', keys: 'texto parrafo p', Icon: Type },
  { id: 'h1', label: 'Encabezado 1', hint: '#', keys: 'h1 titulo encabezado', Icon: Heading1 },
  { id: 'h2', label: 'Encabezado 2', hint: '##', keys: 'h2 titulo encabezado', Icon: Heading2 },
  { id: 'h3', label: 'Encabezado 3', hint: '###', keys: 'h3 subtitulo encabezado', Icon: Heading3 },
  { id: 'h4', label: 'Encabezado 4', hint: '####', keys: 'h4 encabezado', Icon: Heading4 },
  { id: 'bullet', label: 'Lista con viñetas', hint: '-', keys: 'lista viñetas bullet', Icon: List },
  { id: 'ordered', label: 'Lista numerada', hint: '1.', keys: 'lista numerada numero', Icon: ListOrdered },
  { id: 'task', label: 'Lista de tareas', hint: '[]', keys: 'lista tarea todo check', Icon: ListChecks },
  { id: 'quote', label: 'Cita', hint: '>', keys: 'cita quote', Icon: Quote },
  { id: 'code', label: 'Código', hint: '```', keys: 'codigo code', Icon: Code },
  { id: 'divider', label: 'Divisor', hint: '---', keys: 'divisor linea separador', Icon: Minus },
];

function matchingBlocks(query) {
  const q = query.trim().toLowerCase();
  if (!q) return BLOCKS;
  return BLOCKS.filter((block) => (
    block.label.toLowerCase().includes(q)
    || block.keys.includes(q)
    || (block.hint && block.hint.toLowerCase().startsWith(q))
  ));
}

function blockContent(kind) {
  if (kind === 'h1') return { type: 'heading', attrs: { level: 1 } };
  if (kind === 'h2') return { type: 'heading', attrs: { level: 2 } };
  if (kind === 'h3') return { type: 'heading', attrs: { level: 3 } };
  if (kind === 'h4') return { type: 'heading', attrs: { level: 4 } };
  if (kind === 'bullet') return { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] };
  if (kind === 'ordered') return { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] };
  if (kind === 'task') return { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] };
  if (kind === 'quote') return { type: 'blockquote', content: [{ type: 'paragraph' }] };
  if (kind === 'code') return { type: 'codeBlock' };
  if (kind === 'divider') return [{ type: 'horizontalRule' }, { type: 'paragraph' }];
  return { type: 'paragraph' };
}

function applySlashBlock(chain, kind) {
  if (kind === 'text') return chain.setParagraph();
  if (kind === 'h1') return chain.setNode('heading', { level: 1 });
  if (kind === 'h2') return chain.setNode('heading', { level: 2 });
  if (kind === 'h3') return chain.setNode('heading', { level: 3 });
  if (kind === 'h4') return chain.setNode('heading', { level: 4 });
  if (kind === 'bullet') return chain.toggleBulletList();
  if (kind === 'ordered') return chain.toggleOrderedList();
  if (kind === 'task') return chain.toggleTaskList();
  if (kind === 'quote') return chain.setBlockquote();
  if (kind === 'code') return chain.setCodeBlock();
  if (kind === 'divider') return chain.setHorizontalRule();
  return chain.setParagraph();
}

const ProjectNotes = ({ projectId, userId }) => {
  const hostRef = useRef(null);
  const readyRef = useRef(false);
  const saveTimer = useRef(null);
  const pending = useRef(null);
  const [plus, setPlus] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [slash, setSlash] = useState(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [status, setStatus] = useState('');
  const menuRef = useRef(false);
  const anchorRef = useRef(null);
  const slashRef = useRef(null);
  const dismissedRef = useRef(null);
  const syncRef = useRef(() => {});
  const keyRef = useRef(() => false);
  slashRef.current = slash;

  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        showOnlyCurrent: false,
        placeholder: ({ node }) => (
          node.type.name === 'heading' && node.attrs.level === 1
            ? 'Sin título'
            : 'Escribe, usa / o + para un bloque'
        ),
      }),
    ],
    content: EMPTY_DOC,
    editorProps: {
      attributes: {
        class: 'ph-notes-editor',
        'aria-label': 'Notas del proyecto',
      },
      handleKeyDown: (view, event) => keyRef.current(view, event),
    },
    onSelectionUpdate: ({ editor: current }) => syncRef.current(current),
    onUpdate: ({ editor: current }) => {
      syncRef.current(current);
      if (!readyRef.current) return;
      pending.current = current.getJSON();
      setStatus('Guardando…');
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        const content = pending.current;
        pending.current = null;
        if (!content || !userId) {
          setStatus(userId ? '' : 'Inicia sesión para guardar');
          return;
        }
        notesRepository.savePage(projectId, userId, content)
          .then(() => setStatus('Guardado'))
          .catch(() => setStatus('No se pudo guardar'));
      }, 700);
    },
  });

  useEffect(() => {
    readyRef.current = false;
    let cancelled = false;
    notesRepository.getPage(projectId)
      .then((page) => {
        if (cancelled || !editor) return;
        editor.commands.setContent(page?.content?.type === 'doc' ? page.content : EMPTY_DOC, { emitUpdate: false });
        readyRef.current = true;
      })
      .catch(() => {
        if (cancelled || !editor) return;
        editor.commands.setContent(EMPTY_DOC, { emitUpdate: false });
        readyRef.current = true;
        setStatus('No se pudo cargar la página');
      });
    return () => { cancelled = true; };
  }, [projectId, editor]);

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  const setMenu = (open) => {
    menuRef.current = open;
    setMenuOpen(open);
  };

  syncRef.current = (current) => {
    const { selection } = current.state;
    if (!selection.empty || current.isActive('codeBlock')) {
      setSlash(null);
      return;
    }
    const parent = selection.$from.parent;
    if (!parent.isTextblock) {
      setSlash(null);
      return;
    }
    const typed = parent.textBetween(0, selection.$from.parentOffset, '\0', '\0');
    const match = /^\/([^\s]*)$/.exec(typed);
    if (!match || dismissedRef.current === typed) {
      if (!match) dismissedRef.current = null;
      setSlash(null);
      return;
    }
    const query = match[1];
    const from = selection.$from.start();
    const to = selection.$from.pos;
    let coords;
    try {
      coords = current.view.coordsAtPos(to);
    } catch {
      return;
    }
    const host = hostRef.current?.getBoundingClientRect();
    const next = {
      query,
      from,
      to,
      top: host ? coords.bottom - host.top + 6 : coords.bottom,
      left: host ? Math.max(0, coords.left - host.left) : coords.left,
    };
    setSlash((prev) => {
      if (prev && prev.query === next.query && prev.from === next.from && prev.to === next.to && prev.top === next.top && prev.left === next.left) return prev;
      return next;
    });
    setSlashIndex((index) => {
      const count = matchingBlocks(query).length;
      if (!slashRef.current || slashRef.current.query !== query) return 0;
      return Math.min(index, Math.max(0, count - 1));
    });
  };

  keyRef.current = (view, event) => {
    const current = slashRef.current;
    if (!current) return false;
    const items = matchingBlocks(current.query);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSlashIndex((index) => (items.length ? (index + 1) % items.length : 0));
      return true;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSlashIndex((index) => (items.length ? (index - 1 + items.length) % items.length : 0));
      return true;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      if (items[slashIndex]) pickSlash(items[Math.min(slashIndex, items.length - 1)]);
      return true;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      dismissedRef.current = `/${current.query}`;
      setSlash(null);
      return true;
    }
    return false;
  };

  const pickSlash = (block) => {
    const current = slashRef.current;
    if (!editor || !current || !block) return;
    dismissedRef.current = null;
    setSlash(null);
    applySlashBlock(
      editor.chain().focus().deleteRange({ from: current.from, to: current.to }),
      block.id,
    ).run();
  };

  useEffect(() => {
    if (!menuOpen && !slash) return undefined;
    const close = (event) => {
      if (hostRef.current?.contains(event.target)) return;
      if (menuRef.current) setMenu(false);
      if (slashRef.current) {
        dismissedRef.current = `/${slashRef.current.query}`;
        setSlash(null);
      }
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menuOpen, slash]);

  useEffect(() => {
    if (!slash) return;
    hostRef.current?.querySelector('.ph-notes-menu.is-slash button.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [slash, slashIndex]);

  const trackBlock = (event) => {
    if (event.target.closest?.('.ph-notes-gutter, .ph-notes-menu')) return;
    const root = hostRef.current?.querySelector('.ProseMirror');
    const host = hostRef.current;
    if (!root || !host) return;
    const block = event.target.closest?.('.ProseMirror > *');
    if (!block || !root.contains(block)) return;
    if (menuRef.current) return;
    const next = { top: block.getBoundingClientRect().top - host.getBoundingClientRect().top, block };
    anchorRef.current = next;
    setPlus(next);
  };

  const insertBlock = (kind) => {
    const target = plus?.block || anchorRef.current?.block;
    if (!editor || !target) return;
    let pos;
    try {
      pos = editor.view.posAtDOM(target, 0);
    } catch {
      setMenu(false);
      return;
    }
    const resolved = editor.state.doc.resolve(pos);
    const from = resolved.before(1);
    const after = resolved.after(1);
    const empty = target.textContent.trim() === '' && target.matches('p, h1, h2, h3, h4, pre');
    const content = blockContent(kind);
    const chain = editor.chain().focus();
    if (empty) chain.insertContentAt({ from, to: after }, content);
    else chain.insertContentAt(after, content);
    chain.run();
    setMenu(false);
    setPlus(null);
  };

  return (
    <div
      className="ph-notes"
      ref={hostRef}
      onMouseMove={trackBlock}
      onMouseLeave={() => { if (!menuRef.current) setPlus(null); }}
    >
      <div className="ph-notes-status" aria-live="polite">{status}</div>
      {(plus || (menuOpen && anchorRef.current)) && (
        <div className="ph-notes-gutter" style={{ top: (plus || anchorRef.current).top }}>
          <button
            type="button"
            className={`ph-notes-plus${menuOpen ? ' is-open' : ''}`}
            aria-label="Agregar bloque"
            aria-expanded={menuOpen}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setMenu(!menuRef.current);
            }}
          >
            <Plus size={15} />
          </button>
        </div>
      )}
      {menuOpen && (plus || anchorRef.current) && (
        <div className="ph-notes-menu" style={{ top: (plus || anchorRef.current).top + 28 }} role="menu">
          <div className="ph-notes-menu-label">Bloques básicos</div>
          {BLOCKS.map((block) => (
            <button key={block.id} type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => insertBlock(block.id)}>
              <block.Icon size={15} /> {block.label}
              {block.hint ? <span>{block.hint}</span> : null}
            </button>
          ))}
        </div>
      )}
      {slash && (
        <div className="ph-notes-menu is-slash" style={{ top: slash.top, left: slash.left }} role="listbox" aria-label="Insertar bloque">
          <div className="ph-notes-menu-label">{slash.query ? `/${slash.query}` : 'Escribe para filtrar…'}</div>
          {matchingBlocks(slash.query).map((block, index) => (
            <button
              key={block.id}
              type="button"
              role="option"
              aria-selected={index === slashIndex}
              className={index === slashIndex ? 'is-active' : undefined}
              onMouseEnter={() => setSlashIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pickSlash(block)}
            >
              <block.Icon size={15} /> {block.label}
              {block.hint ? <span>{block.hint}</span> : null}
            </button>
          ))}
          {matchingBlocks(slash.query).length === 0 && <div className="ph-notes-menu-empty">Sin resultados</div>}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
};

export default ProjectNotes;
