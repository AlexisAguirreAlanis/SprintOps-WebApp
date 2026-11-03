import ProjectActionsMenu from '../features/home/ProjectActionsMenu';
import { MemberStack, ProgressMeter, ProjectCover, StatusBadge } from '../features/home/projectBits';
import { modeLabel } from '../features/home/projectModel';

const ProjectCard = ({ project, onSelect, userId, onCoverUpdated }) => {
  const description = project.description?.trim();

  const open = () => onSelect(project);

  return (
    <article className="ps-card group/card" onClick={open}>
      <div className="ps-card-media">
        <ProjectCover project={project} />
        <StatusBadge project={project} className="ps-badge--on-media absolute left-3 top-3" />
        <div className="absolute right-3 top-3">
          <ProjectActionsMenu project={project} userId={userId} onCoverUpdated={onCoverUpdated} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3.5">
        <h3>
          <button type="button" className="ps-card-title w-full text-left" onClick={(event) => { event.stopPropagation(); open(); }}>
            {project.name}
          </button>
        </h3>
        <p className={`ps-card-desc ${description ? '' : 'ps-muted'}`}>
          {description || 'Sin descripción'}
        </p>
        <span className="ps-mode">{modeLabel(project)}</span>
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <MemberStack project={project} />
          <ProgressMeter project={project} />
        </div>
      </div>
    </article>
  );
};

export default ProjectCard;
