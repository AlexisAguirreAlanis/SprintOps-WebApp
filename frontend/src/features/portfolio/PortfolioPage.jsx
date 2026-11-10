import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  LayoutGrid,
  List,
  Plus,
  Search,
  Star,
  MoreHorizontal,
} from 'lucide-react';
import { useAuth } from '../auth/hooks/useAuth';
import { useProjects } from '../project/hooks/useProjects';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { portfolioRepository } from '../../data/repositories/portfolioRepository';
import { useDismiss } from '../home/useDismiss';
import { editedLabel, listStripTemplates, listTemplateCatalog, templateDocument } from './portfolioDocument';
import TemplateGallery from './TemplateGallery';
import CreateSheetModal from './CreateSheetModal';
import SheetThumb from './SheetThumb';
import './portfolio.css';

const FILTERS = [
  { id: 'all', label: 'Mis hojas' },
  { id: 'shared', label: 'Compartidas' },
  { id: 'team', label: 'En equipo' },
  { id: 'favorites', label: 'Favoritas' },
  { id: 'archived', label: 'Archivadas' },
  { id: 'deleted', label: 'Eliminadas' },
];

const SORTS = [
  { id: 'activity', label: 'Última actividad' },
  { id: 'name-asc', label: 'Nombre A-Z' },
  { id: 'name-desc', label: 'Nombre Z-A' },
];

const MENU_CAP = 248;

function SheetMenu({ anchorRef, open, children }) {
  const menuRef = useRef(null);
  const bodyRef = useRef(null);
  const drag = useRef(null);
  const edge = useRef(false);
  const hideTimer = useRef(0);
  const [box, setBox] = useState(null);
  const [thumb, setThumb] = useState(null);
  const [shown, setShown] = useState(false);
  const [mounted, setMounted] = useState(open);
  const [live, setLive] = useState(false);
  const [hot, setHot] = useState(false);
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => setShown(true));
      return () => window.cancelAnimationFrame(frame);
    }
    setShown(false);
    setLive(false);
    setHot(false);
    const timer = window.setTimeout(() => setMounted(false), 200);
    return () => window.clearTimeout(timer);
  }, [open]);

  const syncThumb = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    const overflow = body.scrollHeight - body.clientHeight;
    if (overflow <= 1) {
      setThumb((current) => (current ? null : current));
      return;
    }
    const track = Math.max(1, body.clientHeight - 12);
    const size = Math.max(28, Math.min(track - 6, Math.round((body.clientHeight / body.scrollHeight) * track)));
    const offset = Math.round((body.scrollTop / overflow) * Math.max(0, track - size));
    setThumb((current) => (current && current.size === size && current.offset === offset ? current : { size, offset }));
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

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  useLayoutEffect(() => {
    if (!mounted) return undefined;
    const place = () => {
      const anchor = anchorRef.current;
      const menu = menuRef.current;
      const body = bodyRef.current;
      if (!anchor || !menu || !body) return;
      const rect = anchor.getBoundingClientRect();
      const margin = 10;
      const width = 224;
      const content = body.scrollHeight + 12;
      const needed = Math.min(content, MENU_CAP);
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const upward = spaceBelow < needed && spaceAbove > spaceBelow;
      const room = Math.max(0, upward ? spaceAbove : spaceBelow);
      const height = Math.round(Math.min(needed, room));
      let left = Math.round(rect.right - width);
      left = Math.max(margin, Math.min(left, window.innerWidth - margin - width));
      const top = Math.round(upward ? Math.max(margin, rect.top - 6 - height) : rect.bottom + 6);
      setBox((current) => (
        current
        && current.top === top
        && current.left === left
        && current.height === height
        && current.upward === upward
          ? current
          : { top, left, height, upward }
      ));
      syncThumb();
    };
    place();
    const observer = new ResizeObserver(place);
    if (bodyRef.current) observer.observe(bodyRef.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorRef, mounted, syncThumb]);

  const onThumbDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const el = bodyRef.current;
    if (!el) return;
    drag.current = { y: event.clientY, scroll: el.scrollTop };
    setGrabbing(true);
    setLive(true);
    window.clearTimeout(hideTimer.current);
    const move = (ev) => {
      const view = el.clientHeight;
      const track = Math.max(1, view - 12);
      const size = Math.max(28, Math.min(track - 6, (view / el.scrollHeight) * track));
      const travel = Math.max(1, track - size);
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
    event.preventDefault();
    event.stopPropagation();
    const el = bodyRef.current;
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

  if (!mounted) return null;

  return createPortal(
    <div
      ref={menuRef}
      className={`ps-popover pf-sheet-menu${box?.upward ? ' is-up' : ''}${shown ? ' is-open' : ''}${thumb ? ' is-scroll' : ''}${live ? ' is-on' : ''}${hot ? ' is-hot' : ''}${grabbing ? ' is-drag' : ''}`}
      role="menu"
      data-hide-scrollbar
      style={box
        ? { top: box.top, left: box.left, height: box.height }
        : { top: -9999, left: 0 }}
      onPointerMove={onPaneMove}
      onPointerLeave={() => { edge.current = false; armHide(); }}
    >
      <div ref={bodyRef} className="pf-sheet-menu-body" data-hide-scrollbar onScroll={() => { syncThumb(); reveal(); }}>
        {children}
      </div>
      {thumb && (
        <div className="pf-sheet-menu-bar" aria-hidden="true" onMouseDown={onTrackDown}>
          <span
            style={{ height: thumb.size, transform: `translateY(${thumb.offset}px)` }}
            onPointerDown={onThumbDown}
            onPointerEnter={() => setHot(true)}
            onPointerLeave={() => { if (!drag.current) setHot(false); }}
          />
        </div>
      )}
    </div>,
    document.body,
  );
}

const PortfolioPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects } = useProjects(user?.id);
  const templates = useMemo(() => listStripTemplates(), []);
  const catalog = useMemo(() => listTemplateCatalog(), []);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('activity');
  const [sortOpen, setSortOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [kindOpen, setKindOpen] = useState(false);
  const [view, setView] = useLocalStorage('sprintops.portfolio.view', 'grid');
  const [menuId, setMenuId] = useState(null);
  const [rename, setRename] = useState('');
  const [busy, setBusy] = useState(false);
  const createRef = useRef(null);
  const sortRef = useRef(null);
  const stripRef = useRef(null);
  const railRef = useRef(null);
  const sheetsRef = useRef(null);
  const menuAnchorRef = useRef(null);
  const menuSheetRef = useRef(null);
  const [rail, setRail] = useState({ left: false, right: false });
  useDismiss(createOpen, () => setCreateOpen(false), createRef);
  useDismiss(sortOpen, () => setSortOpen(false), sortRef);

  const loadToken = useRef(0);
  const load = async () => {
    if (!user?.id) return;
    const token = ++loadToken.current;
    setLoading(true);
    setError('');
    const pull = () => portfolioRepository.list(user.id);
    try {
      let data;
      try {
        data = await pull();
      } catch {
        data = await pull();
      }
      if (token !== loadToken.current) return;
      setSheets(data);
      setError('');
    } catch (err) {
      if (token !== loadToken.current) return;
      setError(err.message || 'No se pudieron cargar las hojas.');
    } finally {
      if (token === loadToken.current) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  useLayoutEffect(() => {
    const railEl = railRef.current;
    if (!railEl) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = railEl.scrollWidth - railEl.clientWidth;
      const overflow = max > 2;
      const leftDistance = railEl.scrollLeft;
      const rightDistance = max - railEl.scrollLeft;
      const fadeMax = 64;
      const length = (distance) => {
        const span = Math.max(80, fadeMax * 1.2);
        const t = Math.min(1, Math.max(0, distance / span));
        const eased = t * t * (3 - 2 * t);
        return `${Math.round(fadeMax * eased)}px`;
      };
      railEl.style.setProperty('--fade-left', overflow ? length(leftDistance) : '0px');
      railEl.style.setProperty('--fade-right', overflow ? length(rightDistance) : '0px');
      const next = { left: leftDistance > 2, right: overflow && rightDistance > 2 };
      setRail((current) => (current.left === next.left && current.right === next.right ? current : next));
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(railEl);
    railEl.addEventListener('scroll', schedule, { passive: true });
    update();
    return () => {
      cancelAnimationFrame(frame);
      railEl.removeEventListener('scroll', schedule);
      observer.disconnect();
    };
  }, [templates.length]);

  const nudgeTemplates = (direction) => {
    railRef.current?.scrollBy({ left: direction * 360, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!menuId) return undefined;
    const close = (event) => {
      if (event.target.closest('.pf-sheet-menu, .pf-sheet-more')) return;
      setMenuId(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuId]);

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    const filtered = sheets.filter((sheet) => {
      if (text && !sheet.name.toLowerCase().includes(text)) return false;
      if (filter === 'deleted') return sheet.deleted;
      if (sheet.deleted) return false;
      if (filter === 'archived') return sheet.archived;
      if (sheet.archived) return false;
      if (filter === 'favorites') return sheet.favorite;
      if (filter === 'team') return sheet.team;
      if (filter === 'shared') return sheet.shared;
      return true;
    });
    return filtered.sort((a, b) => {
      if (sort === 'name-asc') return a.name.localeCompare(b.name, 'es');
      if (sort === 'name-desc') return b.name.localeCompare(a.name, 'es');
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });
  }, [sheets, query, filter, sort]);

  useLayoutEffect(() => {
    const viewport = sheetsRef.current;
    if (!viewport) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const fadeMax = Math.min(48, Math.max(24, Math.round(viewport.clientHeight * 0.07)));
      const maxScroll = viewport.scrollHeight - viewport.clientHeight;
      const active = maxScroll > 2;
      const length = (distance) => {
        const span = Math.max(64, fadeMax * 1.25);
        const t = Math.min(1, Math.max(0, distance / span));
        const eased = t * t * (3 - 2 * t);
        return `${Math.round(fadeMax * eased)}px`;
      };
      viewport.style.setProperty('--fade-top', active ? length(viewport.scrollTop) : '0px');
      viewport.style.setProperty('--fade-bottom', active ? length(maxScroll - viewport.scrollTop) : '0px');
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(viewport);
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    viewport.addEventListener('scroll', schedule, { passive: true });
    update();
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('scroll', schedule);
      observer.disconnect();
    };
  }, [loading, visible.length, view]);

  const createSheet = async (templateId, name) => {
    if (!user?.id || busy) return;
    setBusy(true);
    setError('');
    try {
      const built = templateDocument(templateId);
      const sheet = await portfolioRepository.create({
        userId: user.id,
        name: name?.trim() || (templateId === 'blank' ? 'Sin título' : built.name),
        document: built.document,
      });
      navigate(`/portafolio/${sheet.id}`);
    } catch (err) {
      setError(err.message || 'No se pudo crear la hoja.');
      setBusy(false);
    }
  };

  const patch = async (sheet, body) => {
    const updated = await portfolioRepository.update(sheet.id, { userId: user.id, ...body });
    setSheets((current) => current.map((item) => (item.id === sheet.id ? { ...item, ...updated } : item)));
  };

  const openMenu = (event, sheet) => {
    event.stopPropagation();
    menuAnchorRef.current = event.currentTarget;
    setMenuId((current) => (current === sheet.id ? null : sheet.id));
    setRename(sheet.name);
  };

  const activeMenuSheet = sheets.find((sheet) => sheet.id === menuId);
  if (activeMenuSheet) menuSheetRef.current = activeMenuSheet;
  const menuSheet = activeMenuSheet || menuSheetRef.current;

  return (
    <div className="pf-page flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden px-4 pt-5 md:px-6 lg:px-8">
      <div className="mb-5 flex shrink-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">Portafolio</h1>
          <p className="pf-kicker mt-1 max-w-2xl text-sm md:text-base">
            Crea, organiza y comparte ideas, presentaciones, diseños y proyectos en un lienzo sin límites.
          </p>
        </div>
        <div className="relative" ref={createRef}>
          <div className="ps-split">
            <button type="button" className="ps-primary" disabled={busy} onClick={() => { setCreateOpen(false); setKindOpen(true); }}>
              <Plus size={16} /> Crear hoja
            </button>
            <button
              type="button"
              className={`ps-primary-caret${createOpen ? ' is-open' : ''}`}
              aria-expanded={createOpen}
              aria-label="Más formas de crear"
              onClick={() => setCreateOpen((open) => !open)}
            >
              <ChevronDown size={16} />
            </button>
          </div>
          <div className={`ps-popover ps-join-pop right-0 w-56${createOpen ? ' is-open' : ''}`} role="menu" inert={!createOpen}>
            <button
              type="button"
              className="ps-menu-item"
              onClick={() => {
                setCreateOpen(false);
                setGalleryOpen(true);
              }}
            >
              Crear desde plantilla
            </button>
          </div>
        </div>
      </div>

      {error && <p className="pf-error mb-4 text-sm font-semibold">{error}</p>}

      <div className="mb-3 shrink-0" ref={stripRef}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black">Crear desde una plantilla</h2>
        </div>
        <div className="pf-template-stage">
          <div className="pf-templates no-scrollbar" ref={railRef}>
            {templates.map((template) => (
              <button key={template.id} type="button" className="pf-template" disabled={busy} onClick={() => createSheet(template.id)}>
                <div className="pf-template-art"><SheetThumb elements={template.elements} /></div>
                <span>{template.name}</span>
              </button>
            ))}
          </div>
          {rail.left && (
            <button type="button" className="pf-template-arrow is-left" aria-label="Plantillas anteriores" onClick={() => nudgeTemplates(-1)}>
              <ChevronLeft size={16} />
            </button>
          )}
          {rail.right && (
            <button type="button" className="pf-template-arrow is-right" aria-label="Más plantillas" onClick={() => nudgeTemplates(1)}>
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 flex shrink-0 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="ps-tabs" role="tablist">
          {FILTERS.map((item) => (
            <button key={item.id} type="button" className={filter === item.id ? 'is-active' : ''} onClick={() => setFilter(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <label className={`pf-sheet-search${query ? ' has-query' : ''}`}>
            <Search size={16} />
            <span className="pf-sheet-search-field">
              <span>
                <input
                  value={query}
                  placeholder="Buscar hojas"
                  aria-label="Buscar hojas"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </span>
            </span>
          </label>
          <div className="relative" ref={sortRef}>
            <button type="button" className={`ps-quiet ps-sort-toggle${sortOpen ? ' is-open' : ''}`} aria-expanded={sortOpen} onClick={() => setSortOpen((open) => !open)}>
              Ordenar: {SORTS.find((item) => item.id === sort)?.label}
              <ChevronDown size={14} />
            </button>
            <div className={`ps-popover ps-sort-pop right-0 w-56${sortOpen ? ' is-open' : ''}`} role="menu" inert={!sortOpen}>
              {SORTS.map((item) => (
                <button key={item.id} type="button" className={`ps-menu-item${sort === item.id ? ' is-active' : ''}`} onClick={() => { setSort(item.id); setSortOpen(false); }}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="ps-view-switch" role="group" aria-label="Vista de hojas">
            <button type="button" className={view === 'grid' ? 'is-active' : ''} aria-pressed={view === 'grid'} onClick={() => setView('grid')}>
              <LayoutGrid size={16} />
              <span className="ps-view-label"><span>Vista en tarjeta</span></span>
            </button>
            <button type="button" className={view === 'list' ? 'is-active' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')}>
              <List size={16} />
              <span className="ps-view-label"><span>Vista en lista</span></span>
            </button>
          </div>
        </div>
      </div>

      <div ref={sheetsRef} className="pf-sheets scroll-edge-fade">
      {loading ? (
        <div className={view === 'list' ? 'pf-list' : 'pf-grid'}>
          {Array.from({ length: 3 }, (_, index) => <div key={index} className="ps-skeleton h-56" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="ps-empty">
          <Folder size={28} />
          <h2>{sheets.length === 0 ? 'Aún no tienes hojas' : 'No hay hojas con ese filtro'}</h2>
          <p>{sheets.length === 0 ? 'Crea un documento, una presentación o un freeflow.' : 'Prueba con otra búsqueda o limpia el filtro.'}</p>
        </div>
      ) : (
        <div className={view === 'list' ? 'pf-list' : 'pf-grid'}>
          {visible.map((sheet) => (
            <article key={sheet.id} className="pf-sheet">
              <button type="button" className="pf-sheet-art" onClick={() => !sheet.deleted && navigate(`/portafolio/${sheet.id}`)} aria-label={`Abrir ${sheet.name}`}>
                <SheetThumb elements={sheet.preview || []} />
              </button>
              <div className="pf-sheet-body">
                <div className="flex items-start gap-2">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => !sheet.deleted && navigate(`/portafolio/${sheet.id}`)}>
                    <p className="pf-sheet-title truncate">{sheet.name}</p>
                    <p className="pf-kicker text-xs">{editedLabel(sheet.updatedAt)} · {sheet.ownerName || 'Sin propietario'}</p>
                    {sheet.projectName && <p className="pf-kicker text-xs">{sheet.projectName}</p>}
                  </button>
                  <button
                    type="button"
                    className={`pf-icon-btn pf-star${sheet.favorite ? ' is-on' : ''}`}
                    aria-label={sheet.favorite ? 'Quitar de favoritos' : 'Marcar como favorita'}
                    onClick={() => patch(sheet, { favorite: !sheet.favorite }).catch((err) => setError(err.message))}
                  >
                    <Star size={16} fill={sheet.favorite ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    className="pf-icon-btn pf-sheet-more"
                    aria-label={`Acciones de ${sheet.name}`}
                    aria-expanded={menuId === sheet.id}
                    onMouseDown={(event) => {
                      if (event.button === 0) event.preventDefault();
                    }}
                    onClick={(event) => openMenu(event, sheet)}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      </div>
      <TemplateGallery
        open={galleryOpen}
        templates={catalog}
        busy={busy}
        onClose={() => setGalleryOpen(false)}
        onPick={(templateId) => {
          setGalleryOpen(false);
          createSheet(templateId);
        }}
      />
      <CreateSheetModal
        open={kindOpen}
        busy={busy}
        onClose={() => setKindOpen(false)}
        onCreate={(kind, name) => {
          setKindOpen(false);
          const templateId = kind === 'document' ? 'doc-blank' : kind === 'slides' ? 'slides-blank' : 'blank';
          createSheet(templateId, name);
        }}
      />
      {menuSheet && (
        <SheetMenu key={menuSheet.id} anchorRef={menuAnchorRef} open={menuId === menuSheet.id}>
          {menuSheet.canManage && !menuSheet.deleted && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                patch(menuSheet, { name: rename }).then(() => setMenuId(null)).catch((err) => setError(err.message));
              }}
            >
              <input className="ps-quiet mb-1 w-full" value={rename} aria-label="Nuevo nombre" onChange={(event) => setRename(event.target.value)} />
            </form>
          )}
          {!menuSheet.deleted && (
            <button type="button" className="ps-menu-item" onClick={() => portfolioRepository.duplicate(menuSheet.id, user.id).then((copy) => setSheets((current) => [copy, ...current])).then(() => setMenuId(null)).catch((err) => setError(err.message))}>
              Duplicar
            </button>
          )}
          {menuSheet.canManage && !menuSheet.deleted && (
            <button type="button" className={`ps-menu-item${menuSheet.archived ? '' : ' is-muted'}`} onClick={() => patch(menuSheet, { archived: !menuSheet.archived }).then(() => setMenuId(null)).catch((err) => setError(err.message))}>
              {menuSheet.archived ? 'Restaurar' : 'Archivar'}
            </button>
          )}
          {menuSheet.canManage && menuSheet.deleted && (
            <button type="button" className="ps-menu-item" onClick={() => patch(menuSheet, { deleted: false, archived: false }).then(() => setMenuId(null)).catch((err) => setError(err.message))}>
              Restaurar
            </button>
          )}
          {menuSheet.canManage && !menuSheet.deleted && (
            <button type="button" className="ps-menu-item ps-menu-item-danger" onClick={() => patch(menuSheet, { deleted: true }).then(() => setMenuId(null)).catch((err) => setError(err.message))}>
              Eliminar
            </button>
          )}
          {menuSheet.canManage && !menuSheet.deleted && (
            <>
              <p className="px-2 pt-2 text-[11px] font-bold uppercase text-[var(--app-muted)]">Vincular a proyecto</p>
              <button type="button" className="ps-menu-item" onClick={() => patch(menuSheet, { projectId: null }).then(() => setMenuId(null)).catch((err) => setError(err.message))}>Sin proyecto</button>
              {projects.slice(0, 8).map((project) => (
                <button key={project.id} type="button" className="ps-menu-item" onClick={() => patch(menuSheet, { projectId: project.id }).then(() => setMenuId(null)).catch((err) => setError(err.message))}>
                  {project.name}
                </button>
              ))}
            </>
          )}
        </SheetMenu>
      )}
    </div>
  );
};

export default PortfolioPage;
