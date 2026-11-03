import ProjectCard from '../../components/ProjectCard';

const ProjectGrid = ({ projects, onSelect, userId, onCoverUpdated }) => {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onSelect={onSelect}
          userId={userId}
          onCoverUpdated={onCoverUpdated}
        />
      ))}
    </div>
  );
};

export default ProjectGrid;
