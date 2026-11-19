import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, Columns2, Layers, Plus, RefreshCcw, Target } from 'lucide-react';
import BackButton from '../../../components/ui/BackButton';
import SprintTabs from '../../../components/ui/SprintTabs';
import '../projectHub.css';
import Modal from '../../../components/Modal';
import CreateIssueModal from '../../issues/CreateIssueModal';
import VelocityChart from '../../reflection/VelocityChart';
import SprintIndicatorCard from '../../reflection/SprintIndicatorCard';
import { useAuth } from '../../auth/hooks/useAuth';
import { useIssues } from '../../issues/hooks/useIssues';
import { sprintsRepository } from '../../../data/repositories/sprintsRepository';
import { projectsRepository } from '../../../data/repositories/projectsRepository';

const SprintSubLayout = () => {
  const { id } = useParams();
  const location = useLocation();
  const { checkPermission, refreshPermissionsForProject } = useAuth();
  const { issues, addIssue } = useIssues(id);
  const [showCreateIssue, setShowCreateIssue] = useState(false);
  const [sprintRange, setSprintRange] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [projectMode, setProjectMode] = useState('agil');
  const [velocityModalOpen, setVelocityModalOpen] = useState(false);
  const [sprintIndicatorModalOpen, setSprintIndicatorModalOpen] = useState(false);
  const openedMetrics = useRef(false);

  useEffect(() => {
    setSprintRange(null);
    setProjectId(null);
    setProjectMode('agil');
    sprintsRepository.getById(id).then(sprint => {
      setSprintRange(sprint ? { start: sprint.startDate || '', end: sprint.endDate || '' } : null);
      if (sprint?.projectId != null) setProjectId(sprint.projectId);
      if (sprint?.projectId) {
        refreshPermissionsForProject(sprint.projectId);
        projectsRepository.getById(sprint.projectId)
          .then((project) => setProjectMode(project?.modo || 'agil'))
          .catch(() => setProjectMode('agil'));
      }
    }).catch(() => {});
  }, [id]);

  /**
   * Determine page-specific header content based on route
   */
  const getHeaderInfo = () => {
    const path = location.pathname;
    if (path.includes('/planning')) {
      return { title: 'Planeación', Icon: Layers, showButton: true, tab: 'planning' };
    }
    if (path.includes('/issues')) {
      return { title: 'Kanban', Icon: Columns2, showButton: true, tab: 'issues' };
    }
    if (path.includes('/reflection')) {
      return { title: 'Reflexión', Icon: RefreshCcw, showButton: false, tab: 'reflection' };
    }
    return { title: 'Sprint', Icon: Layers, showButton: false, tab: '' };
  };

  const { title, Icon: HeaderIcon, showButton, tab } = getHeaderInfo();
  const outlet = useOutlet({ setShowCreateIssue, projectMode });
  const canCreateIssue = checkPermission('canCreateIssue');
  const canViewMetrics = checkPermission('canViewMetrics');

  useEffect(() => {
    if (tab !== 'reflection') {
      setVelocityModalOpen(false);
      setSprintIndicatorModalOpen(false);
    }
  }, [tab]);

  useEffect(() => {
    if (openedMetrics.current || tab !== 'reflection') return;
    if (location.state?.metrics && canViewMetrics) {
      openedMetrics.current = true;
      setVelocityModalOpen(true);
    }
  }, [tab, location.state, canViewMetrics]);

  const handleCreateIssue = (newIssue) => {
    addIssue({
      ...newIssue,
      sprintId: id,
      status: 'todo'
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#F0EFED] px-7 pb-5 pt-[22px] text-[var(--app-text)]">
      <div className="flex w-full min-h-0 flex-1 flex-col overflow-hidden">
        <header className="mb-6 grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 sm:gap-4">
          <div className="ph-title min-w-0">
            <BackButton to={`/sprint/${id}`} />
            <span className="ph-mark ph-mark--vista" aria-hidden="true">
              <HeaderIcon size={18} />
            </span>
            <h1>{title}</h1>
          </div>

          <div className="flex justify-center">
            <SprintTabs activeTab={tab} sprintId={id} />
          </div>

          <div className="flex min-w-0 flex-nowrap items-center justify-end gap-2 sm:gap-3">
            <AnimatePresence mode="popLayout">
              {showButton && canCreateIssue && (
                <motion.button
                  key="create-button"
                  initial={{ opacity: 0, scale: 0.9, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: 10 }}
                  onClick={() => setShowCreateIssue(true)}
                  className="btn-primary flex shrink-0 items-center gap-2"
                >
                  <Plus size={16} /> Crear Issue
                </motion.button>
              )}
            </AnimatePresence>
            {tab === 'reflection' && canViewMetrics && (
              <div className="flex shrink-0 flex-nowrap items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setVelocityModalOpen(true)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 sm:gap-2 sm:px-3 sm:text-xs"
                >
                  <Activity size={15} className="shrink-0 text-oracle-red sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Velocidad histórica</span>
                  <span className="sm:hidden">Velocidad</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSprintIndicatorModalOpen(true)}
                  title="Issues y story points enviados al siguiente sprint desde el Kanban"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 sm:gap-2 sm:px-3 sm:text-xs"
                >
                  <Target size={15} className="shrink-0 text-oracle-red sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Estimación de deuda</span>
                  <span className="sm:hidden">Deuda</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* La entrada va en CSS (fill-mode: both) para que el primer frame
            ya esté oculto. Con Framer, la vista nueva se pintaba visible
            un instante y después empezaba la animación. */}
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden pb-6">
          {/* Sin h-full: con el padding de abajo, height 100% se salía
              y overflow recortaba la esquina redondeada del backlog. */}
          <div
            key={location.pathname}
            className="sprint-tab-panel flex min-h-0 flex-1 flex-col"
          >
            {outlet}
          </div>
        </main>
      </div>

      <CreateIssueModal
        isOpen={showCreateIssue}
        onClose={() => setShowCreateIssue(false)}
        onCreate={handleCreateIssue}
        sprintIssues={issues}
        sprintRange={sprintRange}
        timeMode={projectMode === 'tiempo'}
      />

      {canViewMetrics && (
        <>
          <Modal
            isOpen={velocityModalOpen}
            onClose={() => setVelocityModalOpen(false)}
            title="Velocidad histórica"
            maxWidthClass="max-w-4xl"
            bodyClassName="p-4 sm:p-6"
          >
            <VelocityChart embedded projectId={projectId} currentSprintId={id} />
          </Modal>
          <Modal
            isOpen={sprintIndicatorModalOpen}
            onClose={() => setSprintIndicatorModalOpen(false)}
            title="Estimación de deuda"
            maxWidthClass="max-w-lg"
            bodyClassName="p-4 sm:p-6"
          >
            <SprintIndicatorCard
              embedded
              projectId={projectId}
              currentSprintId={id}
              refreshWhenOpen={sprintIndicatorModalOpen}
            />
          </Modal>
        </>
      )}
    </div>
  );
};

export default SprintSubLayout;
