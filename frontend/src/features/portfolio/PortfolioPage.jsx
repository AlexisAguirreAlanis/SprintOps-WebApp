import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  ChevronDown,
  Folder,
  LayoutGrid,
  Link2,
  List,
  Plus,
  Star,
  Users,
  MoreHorizontal,
} from 'lucide-react';
import { useAuth } from '../auth/hooks/useAuth';
import { useProjects } from '../project/hooks/useProjects';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { portfolioRepository } from '../../data/repositories/portfolioRepository';
import { useDismiss } from '../home/useDismiss';
import { editedLabel, listTemplates, templateDocument } from './portfolioDocument';
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

const METRICS = [
  { id: 'all', label: 'Hojas', icon: Briefcase, pick: (items) => items.filter((sheet) => !sheet.deleted && !sheet.archived).length },
  { id: 'shared', label: 'Compartidas', icon: Link2, pick: (items) => items.filter((sheet) => !sheet.deleted && !sheet.archived && sheet.shared).length },
  { id: 'team', label: 'En equipo', icon: Users, pick: (items) => items.filter((sheet) => !sheet.deleted && !sheet.archived && sheet.team).length },
  { id: 'favorites', label: 'Favoritas', icon: Star, pick: (items) => items.filter((sheet) => !sheet.deleted && !sheet.archived && sheet.favorite).length },
];

const PortfolioPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects } = useProjects(user?.id);
  const templates = useMemo(() => listTemplates(), []);
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('activity');
  const [sortOpen, setSortOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useLocalStorage('sprintops.portfolio.view', 'grid');
  const [menuId, setMenuId] = useState(null);
  const [rename, setRename] = useState('');
  const [busy, setBusy] = useState(false);
  const createRef = useRef(null);
  const sortRef = useRef(null);
  const stripRef = useRef(null);
  useDismiss(createOpen, () => setCreateOpen(false), createRef);
  useDismiss(sortOpen, () => setSortOpen(false), sortRef);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      setSheets(await portfolioRepository.list(user.id));
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las hojas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  useEffect(() => {
    if (!menuId) return undefined;
    const close = (event) => {
      if (!event.target.closest('.pf-sheet')) setMenuId(null);
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

  const createSheet = async (templateId) => {
    if (!user?.id || busy) return;
    setBusy(true);
    setError('');
    try {
      const built = templateDocument(templateId);
      const sheet = await portfolioRepository.create({
        userId: user.id,
        name: templateId === 'blank' ? 'Sin título' : built.name,
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
    setMenuId((current) => (current === sheet.id ? null : sheet.id));
    setRename(sheet.name);
  };

  return (
    <div className="pf-page flex h-full min-h-0 flex-col px-4 py-5 md:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">Portafolio</h1>
          <p className="pf-kicker mt-1 max-w-2xl text-sm md:text-base">
            Crea, organiza y comparte ideas, presentaciones, diseños y proyectos en un lienzo sin límites.
          </p>
        </div>
        <div className="relative" ref={createRef}>
          <div className="ps-split">
            <button type="button" className="ps-primary" disabled={busy} onClick={() => createSheet('blank')}>
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
            <button type="button" className="ps-menu-item" onClick={() => createSheet('blank')}>Lienzo en blanco</button>
            <button
              type="button"
              className="ps-menu-item"
              onClick={() => {
                setCreateOpen(false);
                stripRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }}
            >
              Crear desde plantilla
            </button>
          </div>
        </div>
      </div>

      {error && <p className="pf-error mb-4 text-sm font-semibold">{error}</p>}

      <div className="pf-metrics mb-6">
        {METRICS.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" className={`ps-metric pf-metric ${filter === item.id ? 'is-active' : ''}`} onClick={() => setFilter(item.id)}>
              <span className="ps-metric-icon"><Icon size={18} /></span>
              <div>
                <p className="text-2xl font-black tabular-nums leading-none">{loading ? '—' : item.pick(sheets)}</p>
                <p className="pf-kicker mt-1 text-sm font-medium">{item.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mb-6" ref={stripRef}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black">Crear desde una plantilla</h2>
          <button type="button" className="ps-quiet" onClick={() => stripRef.current?.querySelector('.pf-templates')?.scrollBy({ left: 360, behavior: 'smooth' })}>
            Ver más
          </button>
        </div>
        <div className="pf-templates no-scrollbar">
          {templates.map((template) => (
            <button key={template.id} type="button" className="pf-template" disabled={busy} onClick={() => createSheet(template.id)}>
              <div className="pf-template-art"><SheetThumb elements={template.elements} /></div>
              <span>{template.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="ps-tabs" role="tablist">
          {FILTERS.map((item) => (
            <button key={item.id} type="button" className={filter === item.id ? 'is-active' : ''} onClick={() => setFilter(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            className="ps-quiet"
            value={query}
            placeholder="Buscar hojas"
            aria-label="Buscar hojas"
            onChange={(event) => setQuery(event.target.value)}
          />
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
            <button type="button" className={view === 'grid' ? 'is-active' : ''} aria-pressed={view === 'grid'} onClick={() => setView('grid')} title="Cuadrícula"><LayoutGrid size={16} /></button>
            <button type="button" className={view === 'list' ? 'is-active' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')} title="Lista"><List size={16} /></button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={view === 'list' ? 'pf-list' : 'pf-grid'}>
          {Array.from({ length: 3 }, (_, index) => <div key={index} className="ps-skeleton h-56" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="ps-empty">
          <Folder size={28} />
          <h2>{sheets.length === 0 ? 'Aún no tienes hojas' : 'No hay hojas con ese filtro'}</h2>
          <p>{sheets.length === 0 ? 'Crea un lienzo en blanco o empieza desde una plantilla.' : 'Prueba con otra búsqueda o limpia el filtro.'}</p>
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
                  <div className="relative">
                    <button type="button" className="pf-icon-btn" aria-label={`Acciones de ${sheet.name}`} onClick={(event) => openMenu(event, sheet)}>
                      <MoreHorizontal size={16} />
                    </button>
                    {menuId === sheet.id && (
                      <div className="ps-popover right-0 w-56" role="menu">
                        {sheet.canManage && !sheet.deleted && (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              patch(sheet, { name: rename }).then(() => setMenuId(null)).catch((err) => setError(err.message));
                            }}
                          >
                            <input className="ps-quiet mb-1 w-full" value={rename} aria-label="Nuevo nombre" onChange={(event) => setRename(event.target.value)} />
                          </form>
                        )}
                        {!sheet.deleted && (
                          <button type="button" className="ps-menu-item" onClick={() => portfolioRepository.duplicate(sheet.id, user.id).then((copy) => setSheets((current) => [copy, ...current])).then(() => setMenuId(null)).catch((err) => setError(err.message))}>
                            Duplicar
                          </button>
                        )}
                        {sheet.canManage && !sheet.deleted && (
                          <button type="button" className="ps-menu-item" onClick={() => patch(sheet, { archived: !sheet.archived }).then(() => setMenuId(null)).catch((err) => setError(err.message))}>
                            {sheet.archived ? 'Restaurar' : 'Archivar'}
                          </button>
                        )}
                        {sheet.canManage && sheet.deleted && (
                          <button type="button" className="ps-menu-item" onClick={() => patch(sheet, { deleted: false, archived: false }).then(() => setMenuId(null)).catch((err) => setError(err.message))}>
                            Restaurar
                          </button>
                        )}
                        {sheet.canManage && !sheet.deleted && (
                          <button type="button" className="ps-menu-item" onClick={() => patch(sheet, { deleted: true }).then(() => setMenuId(null)).catch((err) => setError(err.message))}>
                            Eliminar
                          </button>
                        )}
                        {sheet.canManage && !sheet.deleted && (
                          <>
                            <p className="px-2 pt-2 text-[11px] font-bold uppercase text-[var(--app-muted)]">Vincular a proyecto</p>
                            <button type="button" className="ps-menu-item" onClick={() => patch(sheet, { projectId: null }).then(() => setMenuId(null)).catch((err) => setError(err.message))}>Sin proyecto</button>
                            {projects.slice(0, 8).map((project) => (
                              <button key={project.id} type="button" className="ps-menu-item" onClick={() => patch(sheet, { projectId: project.id }).then(() => setMenuId(null)).catch((err) => setError(err.message))}>
                                {project.name}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortfolioPage;
