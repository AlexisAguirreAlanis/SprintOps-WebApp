import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  Clock3,
  Folder,
  FolderPlus,
  Calendar,
  Filter,
  LayoutGrid,
  List,
  Plus,
  Rows3,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import ProjectGrid from './ProjectGrid';
import ProjectListView from './ProjectListView';
import ProjectCompactView from './ProjectCompactView';
import ProjectScroll from './ProjectScroll';
import FilterSelect from './FilterSelect';
import CreateProjectModal from './CreateProjectModal';
import JoinProjectModal from '../../components/ui/JoinProjectModal';
import { useAuth } from '../auth/hooks/useAuth';
import { useProjects } from '../project/hooks/useProjects';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { projectsRepository } from '../../data/repositories/projectsRepository';
import { useDismiss } from './useDismiss';
import {
  EMPTY_FILTERS,
  PHASES,
  SORTS,
  applyProjectFilters,
  filtersActive,
  projectPhase,
  sortProjects,
} from './projectModel';

const VIEWS = [
  { id: 'grid', label: 'Vista en tarjeta', icon: LayoutGrid },
  { id: 'list', label: 'Vista en lista', icon: List },
  { id: 'compact', label: 'Vista compacta', icon: Rows3 },
];

const PHASE_FILTERS = [
  { value: 'any', label: 'Cualquiera' },
  { value: 'active', label: 'En curso' },
  { value: 'upcoming', label: 'Próximo' },
  { value: 'completed', label: 'Completado' },
  { value: 'paused', label: 'En pausa' },
  { value: 'archived', label: 'Archivado' },
];

const OWNERSHIP_FILTERS = [
  { value: 'any', label: 'Todos' },
  { value: 'own', label: 'Proyectos propios' },
  { value: 'shared', label: 'Proyectos compartidos' },
];

const ROLE_LABELS = {
  developer: 'Developer',
  scrumMaster: 'Scrum Master',
  productOwner: 'Product Owner',
};

const METRICS = [
  { id: 'all', label: 'Proyectos', icon: Folder, pick: (counts) => counts.all },
  { id: 'active', label: 'En curso', icon: Zap, pick: (counts) => counts.active || 0 },
  { id: 'upcoming', label: 'Próximos', icon: Clock3, pick: (counts) => counts.upcoming || 0 },
  { id: 'completed', label: 'Completados', icon: Check, pick: (counts) => counts.completed || 0 },
];

const HomePage = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [openField, setOpenField] = useState(null);
  const [tab, setTab] = useState('all');
  const [sortId, setSortId] = useState('activity');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [view, setView] = useLocalStorage('sprintops.projects.view', 'grid');
  const createRef = useRef(null);
  const sortRef = useRef(null);
  const filterRef = useRef(null);
  useDismiss(createOpen, () => setCreateOpen(false), createRef);
  useDismiss(sortOpen, () => setSortOpen(false), sortRef);
  useDismiss(filterOpen, () => setFilterOpen(false), filterRef);

  useEffect(() => {
    if (!filterOpen) setOpenField(null);
  }, [filterOpen]);

  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects, isLoading, error, addProject, refetch } = useProjects(user?.id);
  const { searchQuery, setSearchQuery } = useOutletContext() || {};
  const activeView = VIEWS.some((item) => item.id === view) ? view : 'grid';

  const roles = useMemo(() => {
    const found = new Set(projects.map((project) => project.myRole).filter(Boolean));
    return [...found];
  }, [projects]);

  const filtered = applyProjectFilters(projects, {
    query: searchQuery,
    tab,
    filters,
    userId: user?.id,
  });
  const counts = filtered.counts;
  const visible = sortProjects(filtered.visible, sortId);

  const summary = { all: projects.length, active: 0, upcoming: 0, completed: 0 };
  projects.forEach((project) => {
    const phase = projectPhase(project);
    if (summary[phase] != null && phase !== 'all') summary[phase] += 1;
  });

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setTab('all');
    setSearchQuery?.('');
  };

  const openProject = (project) => navigate(`/project/${project.id}/sprints`);

  return (
    <div className="ps-page flex h-full min-h-0 flex-col px-4 py-5 md:px-6 lg:px-8">
      <div className="mb-5 flex shrink-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">Proyectos</h1>
          <p className="ps-muted mt-1 text-sm md:text-base">Gestiona tus proyectos, equipos y sprints en un solo lugar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="ps-view-switch" role="group" aria-label="Vista de proyectos">
            {VIEWS.map((item) => {
              const Icon = item.icon;
              const selected = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={selected ? 'is-active' : ''}
                  aria-pressed={selected}
                  onClick={() => setView(item.id)}
                >
                  <Icon size={16} />
                  <span className="ps-view-label"><span>{item.label}</span></span>
                </button>
              );
            })}
          </div>
          <div className="relative" ref={createRef}>
            <div className="ps-split">
              <button type="button" className="ps-primary" onClick={() => setShowCreateModal(true)}>
                <Plus size={16} />
                Crear Proyecto
              </button>
              <button
                type="button"
                className={`ps-primary-caret${createOpen ? ' is-open' : ''}`}
                aria-label="Más acciones de proyecto"
                aria-expanded={createOpen}
                onClick={() => setCreateOpen((open) => !open)}
              >
                <ChevronDown size={16} />
              </button>
            </div>
            <div
              className={`ps-popover ps-join-pop right-0 w-56${createOpen ? ' is-open' : ''}`}
              role="menu"
              aria-hidden={!createOpen}
              inert={!createOpen}
            >
              <button
                type="button"
                role="menuitem"
                className="ps-menu-item"
                tabIndex={createOpen ? 0 : -1}
                onClick={() => {
                  setCreateOpen(false);
                  setShowJoinModal(true);
                }}
              >
                <FolderPlus size={16} />
                Unirse a un proyecto
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-5 grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }, (_, index) => <div key={index} className="ps-skeleton h-[92px]" />)
        ) : (
          METRICS.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.id} className="ps-metric">
                <span className="ps-metric-icon"><Icon size={18} /></span>
                <div>
                  <p className="text-2xl font-black tabular-nums leading-none">{item.pick(summary)}</p>
                  <p className="ps-muted mt-1 text-sm font-medium">{item.label}</p>
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="mb-4 flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="ps-tabs" role="tablist" aria-label="Filtrar por estado">
          {PHASES.map((phase) => (
            <button
              key={phase.id}
              type="button"
              role="tab"
              aria-selected={tab === phase.id}
              className={tab === phase.id ? 'is-active' : ''}
              onClick={() => setTab(phase.id)}
            >
              {phase.label}
              <span>{counts[phase.id] || 0}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={sortRef}>
            <button
              type="button"
              className={`ps-quiet ps-sort-toggle${sortOpen ? ' is-open' : ''}`}
              aria-expanded={sortOpen}
              onClick={() => setSortOpen((open) => !open)}
            >
              Ordenar: {SORTS.find((item) => item.id === sortId)?.label}
              <ChevronDown size={14} />
            </button>
            <div
              className={`ps-popover ps-sort-pop right-0 w-56${sortOpen ? ' is-open' : ''}`}
              role="menu"
              aria-hidden={!sortOpen}
              inert={!sortOpen}
            >
              {SORTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={sortId === item.id}
                  tabIndex={sortOpen ? 0 : -1}
                  className={`ps-menu-item ${sortId === item.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setSortId(item.id);
                    setSortOpen(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              className={`ps-quiet ${filtersActive(filters) ? 'is-active' : ''}`}
              aria-expanded={filterOpen}
              aria-label="Filtros avanzados"
              onClick={() => setFilterOpen((open) => !open)}
            >
              <Filter size={16} />
            </button>
            <div
              className={`ps-popover ps-filter-pop right-0 w-80 p-3${filterOpen ? ' is-open' : ''}`}
              aria-hidden={!filterOpen}
              inert={!filterOpen}
              onMouseDown={(event) => {
                if (!event.target.closest('.ps-filter-field')) setOpenField(null);
              }}
            >
              <FilterSelect
                label="Estado"
                value={filters.phase}
                options={PHASE_FILTERS}
                open={openField === 'phase'}
                onToggle={() => setOpenField((current) => (current === 'phase' ? null : 'phase'))}
                onChange={(phase) => {
                  setFilters((prev) => ({ ...prev, phase }));
                  setOpenField(null);
                }}
              />
              <FilterSelect
                label="Rol en el proyecto"
                value={filters.role}
                options={[
                  { value: 'any', label: 'Cualquiera' },
                  ...roles.map((role) => ({ value: role, label: ROLE_LABELS[role] || role })),
                ]}
                open={openField === 'role'}
                onToggle={() => setOpenField((current) => (current === 'role' ? null : 'role'))}
                onChange={(role) => {
                  setFilters((prev) => ({ ...prev, role }));
                  setOpenField(null);
                }}
              />
              <FilterSelect
                label="Pertenencia"
                value={filters.ownership}
                options={OWNERSHIP_FILTERS}
                open={openField === 'ownership'}
                onToggle={() => setOpenField((current) => (current === 'ownership' ? null : 'ownership'))}
                onChange={(ownership) => {
                  setFilters((prev) => ({ ...prev, ownership }));
                  setOpenField(null);
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="ps-field">
                  Desde
                  <span className="ps-filter-date">
                    <input
                      type="date"
                      className={filters.from ? 'has-value' : ''}
                      value={filters.from}
                      onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
                    />
                    <span className="ps-filter-date-hint">Cualquiera</span>
                    <Calendar size={14} />
                  </span>
                </label>
                <label className="ps-field">
                  Hasta
                  <span className="ps-filter-date">
                    <input
                      type="date"
                      className={filters.to ? 'has-value' : ''}
                      value={filters.to}
                      onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
                    />
                    <span className="ps-filter-date-hint">Cualquiera</span>
                    <Calendar size={14} />
                  </span>
                </label>
              </div>
              <button
                type="button"
                className="ps-quiet mt-2 w-full justify-center"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setOpenField(null);
                }}
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>
      </div>

      <ProjectScroll>
        {isLoading ? (
          <div className={activeView === 'list' ? 'space-y-3' : 'grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3'}>
            {Array.from({ length: activeView === 'compact' ? 6 : 3 }, (_, index) => (
              <div key={index} className={`ps-skeleton ${activeView === 'grid' ? 'h-[340px]' : 'h-20'}`} />
            ))}
          </div>
        ) : error && projects.length === 0 ? (
          <div className="ps-empty">
            <Folder size={28} />
            <h2>No se pudieron cargar los proyectos</h2>
            <p>Revisa tu conexión e inténtalo de nuevo.</p>
            <button type="button" className="ps-primary" onClick={refetch}>Reintentar</button>
          </div>
        ) : projects.length === 0 ? (
          <div className="ps-empty">
            <Folder size={28} />
            <h2>Aún no tienes proyectos</h2>
            <p>Crea un proyecto o únete a uno con su código.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="ps-primary" onClick={() => setShowCreateModal(true)}>
                <Plus size={16} /> Crear Proyecto
              </button>
              <button type="button" className="ps-quiet" onClick={() => setShowJoinModal(true)}>Unirse a un proyecto</button>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <div className="ps-empty">
            <SlidersHorizontal size={28} />
            <h2>No hay proyectos con esos filtros</h2>
            <p>Prueba con otro término o limpia la búsqueda y los filtros.</p>
            <button type="button" className="ps-quiet" onClick={clearFilters}>Limpiar filtros</button>
          </div>
        ) : activeView === 'list' ? (
          <ProjectListView projects={visible} onSelect={openProject} userId={user?.id} onCoverUpdated={refetch} />
        ) : activeView === 'compact' ? (
          <ProjectCompactView projects={visible} onSelect={openProject} userId={user?.id} onCoverUpdated={refetch} />
        ) : (
          <ProjectGrid projects={visible} onSelect={openProject} userId={user?.id} onCoverUpdated={refetch} />
        )}
      </ProjectScroll>

      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={(project) => addProject(project)}
      />
      <JoinProjectModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoin={async (code) => {
          const project = await projectsRepository.getByCodigo(code, user?.id);
          await projectsRepository.joinProject(project.id, user.id);
          refetch();
          return project.name;
        }}
      />
    </div>
  );
};

export default HomePage;
