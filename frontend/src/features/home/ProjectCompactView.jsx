import ProjectActionsMenu from './ProjectActionsMenu';
import { ProgressMeter, ProjectCover, StatusBadge } from './projectBits';

const ProjectCompactView = ({ projects, onSelect, userId, onCoverUpdated }) => {
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <li key={project.id}>
          <div className="ps-compact" onClick={() => onSelect(project)}>
            <ProjectCover project={project} className="h-12 w-12 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 text-left">
              <button type="button" className="block max-w-full truncate font-bold" onClick={(event) => { event.stopPropagation(); onSelect(project); }}>
                {project.name}
              </button>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
                <StatusBadge project={project} />
                <ProgressMeter project={project} compact />
              </div>
            </div>
            <ProjectActionsMenu project={project} userId={userId} onCoverUpdated={onCoverUpdated} />
          </div>
        </li>
      ))}
    </ul>
  );
};

export default ProjectCompactView;
