import { dateKey, projectPhase, todayKey } from '../home/projectModel';

const COMPLETED = new Set(['completed', 'finished', 'done', 'completado', 'finalizado', 'c']);
const ACTIVE = new Set(['in_progress', 'active', 'en_progreso', 'en progreso', 'en_curso', 'en curso', 'a']);
const PLANNED = new Set(['planned', 'planeado', 'upcoming', 'proximo', 'próximo', 'pr']);

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const SPRINT_PHASE_LABEL = {
  completed: 'Completado',
  active: 'En progreso',
  planned: 'Planeado',
};

export const PROJECT_PHASE_LABEL = {
  active: 'En progreso',
  upcoming: 'Planeado',
  completed: 'Completado',
  paused: 'En pausa',
  archived: 'Archivado',
};

export function sprintPhase(sprint) {
  const raw = String(sprint?.status || '').trim().toLowerCase();
  if (COMPLETED.has(raw)) return 'completed';
  if (ACTIVE.has(raw)) return 'active';
  if (PLANNED.has(raw)) return 'planned';
  const today = todayKey();
  const start = dateKey(sprint?.startDate);
  const end = dateKey(sprint?.endDate);
  if (end && end < today) return 'completed';
  if (start && start > today) return 'planned';
  if (start && start <= today && (!end || end >= today)) return 'active';
  return 'planned';
}

export function projectHubPhase(project) {
  return projectPhase(project);
}

function dateParts(value) {
  const key = dateKey(value);
  if (!key) return null;
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}

export function formatSprintRange(start, end) {
  const left = dateParts(start);
  const right = dateParts(end);
  if (!left && !right) return null;
  const single = (part) => `${part.day} ${MONTHS[part.month - 1]} ${part.year}`;
  if (left && right) {
    if (left.year === right.year && left.month === right.month) {
      return `${left.day} – ${right.day} ${MONTHS[left.month - 1]} ${left.year}`;
    }
    if (left.year === right.year) {
      return `${left.day} ${MONTHS[left.month - 1]} – ${right.day} ${MONTHS[right.month - 1]} ${left.year}`;
    }
    return `${single(left)} – ${single(right)}`;
  }
  return single(left || right);
}

export function issueStatsBySprint(issues) {
  const map = new Map();
  for (const issue of issues || []) {
    if (issue?.sprintId == null || issue.sprintId === '') continue;
    const id = String(issue.sprintId);
    const current = map.get(id) || { done: 0, total: 0 };
    current.total += 1;
    if (issue.status === 'done') current.done += 1;
    map.set(id, current);
  }
  return map;
}
