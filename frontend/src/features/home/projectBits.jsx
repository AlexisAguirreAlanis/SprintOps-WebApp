import { Archive, Check, Clock3, Pause, Zap } from 'lucide-react';
import { useState } from 'react';
import Avatar from '../../components/Avatar';
import { phaseLabel, progressInfo, projectPhase } from './projectModel';

const ICONS = {
  active: Zap,
  upcoming: Clock3,
  completed: Check,
  paused: Pause,
  archived: Archive,
  other: Zap,
};

const PATTERN_COUNT = 6;

export function ProjectCover({ project, className = '' }) {
  const [broken, setBroken] = useState(false);
  const custom = Boolean(project.cardCoverCustom && project.image && !broken);
  if (!custom) {
    const variant = Math.abs(Number(project.id) || 0) % PATTERN_COUNT;
    return <span className={`ps-cover ps-cover--${variant} ${className}`} aria-hidden="true" />;
  }
  return (
    <span className={`ps-cover ps-cover--photo ${className}`}>
      <img src={project.image} alt="" onError={() => setBroken(true)} />
      <span className="ps-card-shade" />
    </span>
  );
}

export function StatusBadge({ project, className = '' }) {
  const phase = projectPhase(project);
  const Icon = ICONS[phase] || Zap;
  return (
    <span className={`ps-badge ps-badge--${phase} ${className}`}>
      <Icon size={12} strokeWidth={2.4} aria-hidden="true" />
      {phaseLabel(project)}
    </span>
  );
}

export function MemberStack({ project }) {
  const people = project.membersPreview || [];
  const total = project.memberCount || people.length;
  const shown = people.slice(0, 3);
  const extra = Math.max(0, total - shown.length);
  if (shown.length === 0) {
    return <span className="ps-muted text-xs">Sin equipo</span>;
  }
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((person) => (
          <span key={person.userId || person.name} title={person.name || 'Integrante'} className="ps-avatar-ring">
            <Avatar name={person.name} avatarUrl={person.avatarUrl} size="xs" />
          </span>
        ))}
      </div>
      {extra > 0 && <span className="ps-avatar-more" title={`${extra} integrantes más`}>+{extra}</span>}
    </div>
  );
}

export function ProgressMeter({ project, compact = false }) {
  const info = progressInfo(project);
  if (!info) {
    return <span className={`ps-muted ${compact ? 'text-xs' : 'text-[13px]'}`}>Sin progreso disponible</span>;
  }
  return (
    <div className={`flex min-w-0 items-center gap-2 ${compact ? 'w-28' : 'w-[148px]'}`} title={`${info.done} de ${info.total} issues completados`}>
      <div className="ps-progress min-w-0 flex-1" aria-hidden="true">
        <span style={{ width: `${info.percent}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums">{info.percent}%</span>
      <span className="sr-only">{info.percent}% de issues completados</span>
    </div>
  );
}
