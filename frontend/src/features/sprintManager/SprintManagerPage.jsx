import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleDot,
  Layers,
  MoreHorizontal,
  Orbit,
  Target,
  Trash2,
  Video,
} from 'lucide-react';
import BackButton from '../../components/ui/BackButton';
import Avatar from '../../components/Avatar';
import SprintFlow from './SprintFlow';
import StandupSidebar from './StandupSidebar';
import TrashModal from '../planning/TrashModal';
import { sprintsRepository } from '../../data/repositories/sprintsRepository';
import { useIssues } from '../issues/hooks/useIssues';
import { useAuth } from '../auth/hooks/useAuth';
import { useReflections } from '../reflection/hooks/useReflections';
import apiClient from '../../data/api/apiClient';
import { formatShortDate } from '../home/projectModel';
import { SPRINT_PHASE_LABEL, formatSprintRange, sprintPhase } from '../sprint/projectHub';
import '../sprint/projectHub.css';
import './sprintHome.css';

const SprintManagerPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isStandupOpen, setIsStandupOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sprint, setSprint] = useState(null);
  const [lastDaily, setLastDaily] = useState(null);
  const { issues, refetch } = useIssues(id);
  const { reflections } = useReflections(id);

  useEffect(() => {
    sprintsRepository.getById(id).then(setSprint).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = () => setMenuOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menuOpen]);

  useEffect(() => {
    let cancelled = false;
    apiClient.get(`/reuniones/daily/team/${Number(id)}`)
      .then((days) => {
        if (cancelled) return;
        const list = Array.isArray(days) ? days : [];
        setLastDaily(list[0] || null);
      })
      .catch(() => {
        if (!cancelled) setLastDaily(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isStandupOpen]);

  const projectId = sprint?.projectId || location.state?.project?.id || 'p1';

  const role = user?.role || 'developer';
  const isDev = role === 'developer';
  const relevantIssues = isDev
    ? issues.filter((issue) => issue.assigneeIds?.includes(user?.id))
    : issues;
  const totalIssues = relevantIssues.length;
  const doneIssues = relevantIssues.filter((issue) => issue.status === 'done').length;
  const progress = totalIssues > 0 ? Math.round((doneIssues / totalIssues) * 100) : 0;
  const phase = sprint ? sprintPhase(sprint) : null;
  const phaseClass = phase === 'completed' ? 'completed' : phase === 'active' ? 'active' : 'upcoming';
  const range = formatSprintRange(sprint?.startDate, sprint?.endDate);
  const planningDone = Boolean(sprint?.goal && String(sprint.goal).trim()) || totalIssues > 0;
  const reflectionDone = reflections.length > 0;
  const issueWord = totalIssues === 1 ? 'issue' : 'issues';
  const dailyLabel = lastDaily?.date
    ? `Último: ${formatShortDate(lastDaily.date)?.replace('.', '') || lastDaily.date}`
    : 'Sin registros';
  const faces = (lastDaily?.entries || []).filter((entry) => entry?.userName);
  const shownFaces = faces.slice(0, 3);
  const extraFaces = Math.max(0, faces.length - shownFaces.length);

  const openMetrics = () => {
    navigate(`/sprint/${id}/reflection`, { state: { metrics: true } });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto bg-[#F0EFED] px-7 pb-5 pt-[22px] relative text-[var(--app-text)]">
      <header className="sh-head">
        <div className="sh-identity">
          <div className="ph-title">
            <BackButton to={`/project/${projectId}/sprints`} />
            <span className="ph-mark ph-mark--vista" aria-hidden="true">
              <Layers size={18} />
            </span>
            <h1>Sprint: {sprint?.name || 'Cargando...'}</h1>
            {phase && (
              <span className={`ph-status ph-status--${phaseClass}`}>{SPRINT_PHASE_LABEL[phase]}</span>
            )}
          </div>
          <div className="sh-meta">
            {range && (
              <>
                <span><CalendarDays size={14} /> {range}</span>
                <i className="sh-dot" aria-hidden="true" />
              </>
            )}
            <span><Target size={14} /> {totalIssues} {issueWord}</span>
          </div>
        </div>

        <div className="sh-actions">
          <button
            type="button"
            className="ph-btn ph-btn--reveal"
            aria-label="Cronograma del sprint"
            onClick={() => navigate(`/project/${projectId}/timeline`)}
          >
            <CalendarDays size={16} />
            <span className="ph-btn-label"><span>Cronograma del sprint</span></span>
          </button>
          <button
            type="button"
            className="ph-btn ph-btn--reveal"
            aria-label="Papelera del sprint"
            onClick={() => setIsTrashOpen(true)}
          >
            <Trash2 size={16} />
            <span className="ph-btn-label"><span>Papelera del sprint</span></span>
          </button>
          <div className="sh-menu-wrap">
            <button
              type="button"
              className="sh-more"
              aria-label="Más acciones"
              aria-expanded={menuOpen}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="ph-menu" onMouseDown={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(`/sprint/${id}/issues`);
                  }}
                >
                  <CircleDot size={15} /> Issues del sprint
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(`/project/${projectId}/universe`);
                  }}
                >
                  <Orbit size={15} /> Universo de issues
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="sh-body">
        <div className="sh-stage">
          <SprintFlow
            sprintId={id}
            done={doneIssues}
            total={totalIssues}
            progress={progress}
            planningDone={planningDone}
            reflectionDone={reflectionDone}
          />
        </div>

        <div className="sh-dock">
          <button type="button" className="sh-dock-card" onClick={() => setIsStandupOpen(true)}>
            <span className="sh-dock-icon" aria-hidden="true"><Video size={20} /></span>
            <span className="sh-dock-copy">
              <strong>Daily Meeting</strong>
              <small>{dailyLabel}</small>
            </span>
            {shownFaces.length > 0 && (
              <span className="sh-faces" aria-hidden="true">
                {shownFaces.map((entry) => (
                  <Avatar key={entry.userId || entry.userName} name={entry.userName} size="xs" />
                ))}
                {extraFaces > 0 && <span className="sh-faces-more">+{extraFaces}</span>}
              </span>
            )}
            <ChevronRight size={18} />
          </button>
          <span className="sh-dock-split" aria-hidden="true" />
          <button type="button" className="sh-dock-card" onClick={openMetrics}>
            <span className="sh-dock-icon" aria-hidden="true"><BarChart3 size={20} /></span>
            <span className="sh-dock-copy">
              <strong>Métricas del sprint</strong>
              <small>{totalIssues} {issueWord} ({doneIssues} completados)</small>
            </span>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <StandupSidebar
        isOpen={isStandupOpen}
        onClose={() => setIsStandupOpen(false)}
        sprintId={id}
        userId={user?.id}
        projectId={sprint?.projectId}
      />

      <TrashModal
        isOpen={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
        sprintId={id}
        onRestored={refetch}
      />
    </div>
  );
};

export default SprintManagerPage;
