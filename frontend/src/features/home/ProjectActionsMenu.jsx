import { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import ProjectSettingsView from './ProjectSettingsView';

const ProjectActionsMenu = ({ project, userId, onCoverUpdated }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="ps-icon-btn"
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
