import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Columns2, Layers, RefreshCcw } from 'lucide-react';

const SprintCard = ({ title, kicker, description, icon: Icon, done, progress, main, onClick }) => (
  <button type="button" className={`sh-card${main ? ' sh-card--main' : ''}`} onClick={onClick}>
    <div className="sh-card-top">
      <span className="sh-glyph" aria-hidden="true">
        <Icon size={22} />
      </span>
      <span className={`sh-check ${done ? 'sh-check--on' : 'sh-check--off'}`} aria-hidden="true">
        {done ? <Check size={14} strokeWidth={3} /> : null}
      </span>
    </div>
    <h2>{title}</h2>
    <span className="sh-kicker">{kicker}</span>
    <p>{description}</p>
    <div className="sh-meter">
      <div className="sh-bar" aria-hidden="true">
        <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
      </div>
      <b>{progress}%</b>
    </div>
  </button>
);

const Join = () => (
  <span className="sh-join" aria-hidden="true">
    <ChevronRight size={16} />
  </span>
);

const SprintFlow = ({ sprintId, done = 0, total = 0, progress = 0, planningDone = false, reflectionDone = false }) => {
  const navigate = useNavigate();
  const backlogDone = total > 0 && done === total;

  return (
    <div className="sh-flow">
      <SprintCard
        title="Planeación"
        kicker="Backlog"
        description="Definir objetivo, alcance y tareas del sprint."
        icon={Layers}
        done={planningDone}
        progress={planningDone ? 100 : 0}
        onClick={() => navigate(`/sprint/${sprintId}/planning`)}
      />
      <Join />
      <SprintCard
        main
        title="Desarrollo"
        kicker="Kanban"
        description="Ejecutar y dar seguimiento a las tareas."
        icon={Columns2}
        done={backlogDone}
        progress={progress}
        onClick={() => navigate(`/sprint/${sprintId}/issues`)}
      />
      <Join />
      <SprintCard
        title="Reflexión"
        kicker="Retrospectiva"
        description="Evaluar resultados y aprendizajes."
        icon={RefreshCcw}
        done={reflectionDone}
        progress={reflectionDone ? 100 : 0}
        onClick={() => navigate(`/sprint/${sprintId}/reflection`)}
      />
    </div>
  );
};

export default SprintFlow;
