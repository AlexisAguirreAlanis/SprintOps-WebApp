import { useEffect, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import ProjectSettingsView from './ProjectSettingsView';

export const CLOSE_PROJECT_SETTINGS = 'sprintops-close-project-settings';

export function closeProjectSettings() {
  window.dispatchEvent(new Event(CLOSE_PROJECT_SETTINGS));
}

const ProjectActionsMenu = ({ project, userId, onCoverUpdated }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener(CLOSE_PROJECT_SETTINGS, close);
    return () => window.removeEventListener(CLOSE_PROJECT_SETTINGS, close);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="ps-icon-btn ps-card-more"
        aria-label={`Configurar ${project.name}`}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          setOpen(true);
        }}
      >
        <MoreVertical size={16} strokeWidth={2.4} />
      </button>
      {open && (
        <ProjectSettingsView
          project={project}
          userId={userId}
          onClose={() => setOpen(false)}
          onUpdated={onCoverUpdated}
        />
      )}
    </>
  );
};

export default ProjectActionsMenu;
