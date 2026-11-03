import ProjectActionsMenu from './ProjectActionsMenu';
import { MemberStack, ProgressMeter, ProjectCover, StatusBadge } from './projectBits';
import { formatShortDate, modeLabel } from './projectModel';

const ProjectListView = ({ projects, onSelect, userId, onCoverUpdated }) => {
  return (
    <div className="ps-list">
      <div className="ps-list-head" aria-hidden="true">
        <span>Proyecto</span>
        <span>Estado</span>
        <span>Progreso</span>
        <span>Equipo</span>
        <span>Última actividad</span>
        <span className="sr-only">Acciones</span>
      </div>
      <ul>
        {projects.map((project) => (
          <li key={project.id}>
            <div
              className="ps-list-row"
              onClick={() => onSelect(project)}
            >
              <div className="flex min-w-0 items-center gap-3">
                <ProjectCover project={project} className="h-11 w-11 shrink-0 rounded-xl" />
                <div className="min-w-0 text-left">
                  <button type="button" className="block max-w-full truncate font-bold" onClick={(event) => { event.stopPropagation(); onSelect(project); }}>
                    {project.name}
                  </button>
                  <p className="ps-muted truncate text-xs">{modeLabel(project)}</p>
                </div>
              </div>
              <StatusBadge project={project} />
              <ProgressMeter project={project} compact />
              <MemberStack project={project} />
              <span className="ps-muted text-sm">{formatShortDate(project.lastActivity) || 'Sin actividad'}</span>
              <div className="justify-self-end">
                <ProjectActionsMenu project={project} userId={userId} onCoverUpdated={onCoverUpdated} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ProjectListView;
