import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Box,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Presentation,
  Spline,
  Orbit,
  StickyNote,
  LayoutGrid,
  Layers,
  List,
  MoreHorizontal,
  Plus,
  Settings,
  Sparkles,
  Target,
  Users,
  Waypoints,
} from 'lucide-react';
import SprintFlow from './SprintFlow';
import BackButton from '../../components/ui/BackButton';
import ProjectConfigView from '../project/ProjectConfigView';
import ProjectSettingsView from '../home/ProjectSettingsView';
import { useAuth } from '../auth/hooks/useAuth';
import { useSprints } from './hooks/useSprints';
import { useProjects } from '../project/hooks/useProjects';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import Avatar from '../../components/Avatar';
import { issuesRepository } from '../../data/repositories/issuesRepository';
import { projectsRepository } from '../../data/repositories/projectsRepository';
import { toast } from 'sonner';
import { portfolioRepository } from '../../data/repositories/portfolioRepository';
import CreateSheetModal from '../portfolio/CreateSheetModal';
import { templateDocument } from '../portfolio/portfolioDocument';
import ProjectNotes from './ProjectNotes';
import ProjectAiPane from './ai/ProjectAiPane';
import ProjectScroll from '../home/ProjectScroll';
import { formatShortDate, modeLabel, progressInfo } from '../home/projectModel';
import { issueStatsBySprint, PROJECT_PHASE_LABEL, projectHubPhase } from './projectHub';
import './projectHub.css';

const SHEET_KINDS = {
  document: { label: 'Documento', Icon: FileText },
  slides: { label: 'Presentación', Icon: Presentation },
  canvas: { label: 'Freeflow', Icon: Spline },
};

const sheetKind = (sheet) => SHEET_KINDS[sheet?.kind] || SHEET_KINDS.canvas;

const TABS = [
  ['sprints', 'Sprints', Layers],
  ['documents', 'Documentos', FileText],
  ['notes', 'Notas', StickyNote],
  ['team', 'Equipo', Users],
  ['metrics', 'Métricas', BarChart3],
  ['ai', 'IA', Sparkles],
];

const VIEWS = [
  ['flow', 'Vista sucesiva', Waypoints],
  ['grid', 'Vista de tarjetas', LayoutGrid],
  ['list', 'Vista de lista', List],
];

const SprintsPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [showConfig, setShowConfig] = useState(false);
  const [focusSprintsInConfig, setFocusSprintsInConfig] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState('sprints');
  const [visibleTab, setVisibleTab] = useState('sprints');
  const [leaving, setLeaving] = useState(false);
  const [layout, setLayout] = useState('flow');
  const [issues, setIssues] = useState([]);
  const [issuesLoaded, setIssuesLoaded] = useState(false);
  const [members, setMembers] = useState(null);
  const [sheets, setSheets] = useState(null);
  const [sheetModal, setSheetModal] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);
  const stageRef = useRef(null);

  const { checkPermission, user } = useAuth();
  const { sprints, isLoading: isLoadingSprints, addSprint, updateSprint, refetch: refetchSprints } = useSprints(projectId);
  const { projects, isLoading: isLoadingProjects, refetch: refetchProjects } = useProjects();
  const isLoading = isLoadingSprints || isLoadingProjects;
  const canManageProject = checkPermission('canManageSprints');
  const canCreateSprint = checkPermission('canCreateSprint');

  useEffect(() => {
    setMembers(null);
    setSheets(null);
    setMenuOpen(false);
  }, [projectId]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = () => setMenuOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menuOpen]);

  useEffect(() => {
    if (tab === visibleTab) return undefined;
    setLeaving(true);
    const timer = window.setTimeout(() => {
      setVisibleTab(tab);
      setLeaving(false);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [tab, visibleTab]);

  useEffect(() => {
    if (stageRef.current) stageRef.current.scrollTop = 0;
  }, [visibleTab]);

  useEffect(() => {
    const st = location.state;
    if (!st?.openProjectConfig) return;
    setShowConfig(true);
    setFocusSprintsInConfig(Boolean(st.focusSprints));
    navigate(`${location.pathname}${location.search || ''}`, { replace: true, state: {} });
  }, [location.state, location.pathname, location.search, navigate]);

  useEffect(() => {
    let cancelled = false;
    setIssuesLoaded(false);
    issuesRepository.getByProjectId(projectId)
      .then((data) => {
        if (!cancelled) setIssues(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setIssues([]);
      })
      .finally(() => {
        if (!cancelled) setIssuesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (tab !== 'team' || members) return undefined;
    let cancelled = false;
    projectsRepository.getMembers(projectId)
      .then((data) => { if (!cancelled) setMembers(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setMembers([]); });
    return () => { cancelled = true; };
  }, [tab, members, projectId]);

  useEffect(() => {
    if (tab !== 'documents' || sheets || !user?.id) return undefined;
    let cancelled = false;
    portfolioRepository.list(user.id)
      .then((data) => { if (!cancelled) setSheets(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setSheets([]); });
    return () => { cancelled = true; };
  }, [tab, sheets, projectId, user?.id]);

  const project = projects.find((item) => String(item.id) === String(projectId)) || { name: 'Cargando proyecto...' };
  const phase = projectHubPhase(project);
  const stats = useMemo(() => issueStatsBySprint(issues), [issues]);
  const statsFor = (sprint) => (issuesLoaded ? (stats.get(String(sprint.id)) || { done: 0, total: 0 }) : null);
  const doneIssues = issues.filter((issue) => issue.status === 'done').length;
  const progress = progressInfo(project) || (issuesLoaded && issues.length > 0
    ? { percent: Math.round((doneIssues / issues.length) * 100), done: doneIssues, total: issues.length }
    : null);
  const issueTotal = Number.isFinite(project.issuesTotal) ? project.issuesTotal : (issuesLoaded ? issues.length : null);
  const memberTotal = Number.isFinite(project.memberCount) ? project.memberCount : (members ? members.length : null);
  const projectSheets = (sheets || []).filter((sheet) => !sheet.deleted && !sheet.archived && String(sheet.projectId) === String(projectId));

  const handleSprintClick = (sprintId) => {
    navigate(`/sprint/${sprintId}`);
  };

  const createProjectSheet = async (kind, name) => {
    if (!user?.id || sheetBusy) return;
    setSheetBusy(true);
    try {
      const templateId = kind === 'document' ? 'doc-blank' : kind === 'slides' ? 'slides-blank' : 'blank';
      const built = templateDocument(templateId);
      const sheet = await portfolioRepository.create({
        userId: user.id,
        projectId: Number(projectId),
        name: name?.trim() || (templateId === 'blank' ? 'Sin título' : built.name),
        document: built.document,
      });
      setSheetModal(false);
      navigate(`/portafolio/${sheet.id}`);
    } catch (err) {
      toast.error(err.message || 'No se pudo crear la hoja.');
      setSheetBusy(false);
    }
  };

  return (
    <div className="ph">
      <header className="ph-head">
        <div className="ph-title">
          <BackButton to="/home" />
          <span className="ph-mark ph-mark--vista" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <defs>
                <mask id="ph-vista-cube">
                  <rect width="24" height="24" fill="#fff" />
                  <g fill="none" stroke="#000" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                    <path d="m3.3 7 8.7 5 8.7-5" />
                    <path d="M12 22V12" />
                  </g>
                </mask>
              </defs>
              <path
                fill="#fff"
                mask="url(#ph-vista-cube)"
                d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
              />
            </svg>
          </span>
          <h1>Vista general</h1>
          <span className={`ph-status ph-status--${phase}`}>{PROJECT_PHASE_LABEL[phase] || 'Sin estado'}</span>
        </div>
        <div className="ph-actions">
          <button type="button" className="ph-btn ph-btn--reveal" aria-label="Cronograma" onClick={() => navigate(`/project/${projectId}/timeline`)}>
            <CalendarDays size={16} />
            <span className="ph-btn-label"><span>Cronograma</span></span>
          </button>
          <button type="button" className="ph-btn ph-btn--reveal" aria-label="Universo de issues" onClick={() => navigate(`/project/${projectId}/universe`)}>
            <Orbit size={16} />
            <span className="ph-btn-label"><span>Universo de issues</span></span>
          </button>
          <button
            type="button"
            className="ph-btn ph-btn--ghost"
            onClick={() => {
              setFocusSprintsInConfig(false);
              setShowConfig(true);
            }}
          >
            <Settings size={16} /> Configurar Proyecto
          </button>
          <div style={{ position: 'relative' }}>
            <button type="button" className="ph-icon-btn" aria-label="Más acciones" aria-expanded={menuOpen} onMouseDown={(event) => event.stopPropagation()} onClick={() => setMenuOpen((open) => !open)}>
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="ph-menu" onMouseDown={(event) => event.stopPropagation()}>
                {project.modo === 'tiempo' && (
                  <button type="button" onClick={() => { setMenuOpen(false); navigate(`/project/${projectId}/tiempo`); }}>
                    <Clock size={15} /> Horas y esfuerzo
                  </button>
                )}
                <button type="button" onClick={() => { setMenuOpen(false); setShowSettings(true); }}>
                  <Settings size={15} /> Ajustes de la tarjeta
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="ph-toolbar">
        <div className="ph-tabs" role="tablist">
          {TABS.map(([id, label, Icon]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        {tab === 'sprints' && (
          <div className="ps-view-switch" role="group" aria-label="Vista de sprints">
            {VIEWS.map(([id, label, Icon]) => (
              <button key={id} type="button" className={layout === id ? 'is-active' : ''} aria-label={label} aria-pressed={layout === id} onClick={() => setLayout(id)}>
                <Icon size={16} />
                <span className="ps-view-label"><span>{label}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ph-stage" ref={stageRef}>
        <div key={visibleTab} className={`ph-pane${leaving ? ' is-leaving' : ' is-entering'}${visibleTab === 'notes' ? ' is-notes' : ''}${visibleTab === 'documents' || visibleTab === 'ai' ? ' is-top' : ''}`}>
        {isLoading ? (
          <LoadingSpinner label="Cargando el proyecto..." />
        ) : visibleTab === 'sprints' ? (
          sprints.length > 0 ? (
            <SprintFlow
              sprints={sprints}
              onSprintClick={handleSprintClick}
              projectId={projectId}
              layout={layout}
              statsFor={statsFor}
              onAddSprint={canCreateSprint ? () => {
                setFocusSprintsInConfig(true);
                setShowConfig(true);
              } : null}
            />
          ) : (
            <div className="max-w-xl w-full">
              <EmptyState
                title="No hay sprints planificados"
                description="Agrega el primer sprint para ver el recorrido del proyecto."
                actionButton={canManageProject && (
                  <button type="button" onClick={() => setShowConfig(true)} className="ph-btn">
                    Configurar sprints
                  </button>
                )}
              />
            </div>
          )
        ) : visibleTab === 'documents' ? (
          <div className="ph-docs-scroll">
          <ProjectScroll>
          <section className="ph-panel">
            {sheets == null ? (
              <LoadingSpinner label="Cargando hojas..." />
            ) : projectSheets.length === 0 ? (
              <p className="ph-empty">
                Ninguna hoja del portafolio está vinculada a este proyecto.{' '}
                <button type="button" className="ph-linkish" onClick={() => navigate('/portafolio')}>Abrir portafolio</button>
              </p>
            ) : (
              projectSheets.map((sheet) => {
                const kind = sheetKind(sheet);
                const KindIcon = kind.Icon;
                return (
                  <button key={sheet.id} type="button" className="ph-doc" onClick={() => navigate(`/portafolio/${sheet.id}`)}>
                    <span className={`ph-doc-mark is-${sheet.kind || 'canvas'}`} aria-hidden="true">
                      <KindIcon size={18} />
                    </span>
                    <span className="ph-doc-copy">
                      <strong>{sheet.name || 'Sin título'}</strong>
                      <span className="ph-doc-meta">
                        <span>{kind.label}</span>
                        <span>Creado {formatShortDate(sheet.createdAt) || '—'}</span>
                        <span>Modificado {formatShortDate(sheet.updatedAt) || '—'}</span>
                      </span>
                    </span>
                  </button>
                );
              })
            )}
            {sheets != null && (
              <button type="button" className="ph-add ph-add--row" onClick={() => { setSheetBusy(false); setSheetModal(true); }}>
                <Plus size={16} /> Agregar hoja
              </button>
            )}
          </section>
          </ProjectScroll>
          </div>
        ) : visibleTab === 'notes' ? (
          <ProjectNotes projectId={projectId} userId={user?.id} />
        ) : visibleTab === 'ai' ? (
          <ProjectAiPane projectId={projectId} userId={user?.id} projectName={project?.name || 'este proyecto'} />
        ) : visibleTab === 'team' ? (
          <section className="ph-panel">
            <h2>Equipo</h2>
            {members == null ? (
              <LoadingSpinner label="Cargando equipo..." />
            ) : members.length === 0 ? (
              <p className="ph-empty">Este proyecto todavía no tiene integrantes.</p>
            ) : (
              members.map((member) => (
                <div key={member.userId || member.email} className="ph-row" style={{ cursor: 'default' }}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={member.name} avatarUrl={member.avatarUrl} size="sm" />
                    {member.name || 'Sin nombre'}
                  </strong>
                  <span>{member.role || 'Sin rol'}</span>
                  <span>{member.email || ''}</span>
                  <span />
                </div>
              ))
            )}
          </section>
        ) : (
          <section className="ph-panel">
            <h2>Métricas</h2>
            <div className="ph-metrics">
              <article className="ph-metric">
                <span>Sprints</span>
                <b>{sprints.length}</b>
              </article>
              <article className="ph-metric">
                <span>Issues completados</span>
                <b>{progress ? `${progress.done}/${progress.total}` : '—'}</b>
              </article>
              <article className="ph-metric">
                <span>Avance</span>
                <b>{progress ? `${progress.percent}%` : '—'}</b>
              </article>
            </div>
            {!issuesLoaded && <p className="ph-empty">Cargando el detalle de issues...</p>}
          </section>
        )}
        </div>
      </div>

      <footer className="ph-summary">
        <div className="ph-meta" style={{ gap: 12, minWidth: 0 }}>
          <span className="ph-mark" aria-hidden="true"><Box size={16} /></span>
          <div style={{ minWidth: 0 }}>
            <h2>{project.name}</h2>
            <p>{project.description || modeLabel(project)}</p>
          </div>
        </div>
        <div className="ph-stats">
          <div className="ph-stat"><span className="ph-stat-icon" aria-hidden="true"><Target size={16} /></span><span><b>{sprints.length}</b><small>Sprints</small></span></div>
          <div className="ph-stat"><span className="ph-stat-icon" aria-hidden="true"><CheckCircle2 size={16} /></span><span><b>{issueTotal == null ? '—' : issueTotal}</b><small>Issues</small></span></div>
          <div className="ph-stat"><span className="ph-stat-icon" aria-hidden="true"><Users size={16} /></span><span><b>{memberTotal == null ? '—' : memberTotal}</b><small>Miembros</small></span></div>
        </div>
        <div className="ph-progress">
          <b className="ph-progress-value">{progress ? `${progress.percent}%` : '—'}</b>
          <div className="ph-progress-copy">
            <span>Progreso del proyecto</span>
            <div
              className="ph-bar-track"
              role="progressbar"
              aria-valuenow={progress?.percent || 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progreso del proyecto"
            >
              <span style={{ width: `${progress?.percent || 0}%` }} />
            </div>
          </div>
        </div>
      </footer>

      {showConfig && (
        <ProjectConfigView
          projectId={projectId}
          project={project}
          onClose={() => {
            setShowConfig(false);
            setFocusSprintsInConfig(false);
          }}
          focusSprintsSection={focusSprintsInConfig}
          sprints={sprints}
          sprintActions={{ addSprint, updateSprint, refetchSprints }}
          onProjectUpdated={refetchProjects}
        />
      )}

      {showSettings && project.id && (
        <ProjectSettingsView
          project={project}
          userId={user?.id}
          onClose={() => setShowSettings(false)}
          onUpdated={refetchProjects}
        />
      )}

      <CreateSheetModal
        open={sheetModal}
        busy={sheetBusy}
        onClose={() => { if (!sheetBusy) setSheetModal(false); }}
        onCreate={createProjectSheet}
      />
    </div>
  );
};

export default SprintsPage;
