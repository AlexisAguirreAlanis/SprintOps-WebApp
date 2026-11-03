const COMPLETED = new Set(['c', 'completado', 'completed', 'done', 'finalizado', 'terminado']);
const ARCHIVED = new Set(['ar', 'archivado', 'archived', 'archive']);
const PAUSED = new Set(['pa', 'pausa', 'paused', 'pausado', 'en_pausa', 'en pausa']);
const UPCOMING = new Set(['pr', 'proximo', 'próximo', 'upcoming', 'planeado', 'planned']);
const ACTIVE = new Set(['a', 'activo', 'active', 'en_curso', 'en curso', 'encurso']);

export const PHASES = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'En curso' },
  { id: 'upcoming', label: 'Próximos' },
  { id: 'completed', label: 'Completados' },
  { id: 'archived', label: 'Archivados' },
];

export const PHASE_LABEL = {
  active: 'En curso',
  upcoming: 'Próximo',
  completed: 'Completado',
  paused: 'En pausa',
  archived: 'Archivado',
  other: 'Sin clasificar',
};

export const SORTS = [
  { id: 'activity', label: 'Última actividad' },
  { id: 'name-asc', label: 'Nombre A-Z' },
  { id: 'name-desc', label: 'Nombre Z-A' },
  { id: 'start', label: 'Fecha de inicio' },
  { id: 'end', label: 'Fecha de finalización' },
];

export function dateKey(value) {
  if (value == null || value === '') return null;
  const key = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

export function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function formatShortDate(value) {
  const key = dateKey(value);
  if (!key) return null;
  const date = new Date(`${key}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function projectPhase(project) {
  const raw = String(project?.status || '').trim().toLowerCase();
  if (ARCHIVED.has(raw)) return 'archived';
  if (COMPLETED.has(raw)) return 'completed';
  if (PAUSED.has(raw)) return 'paused';
  if (UPCOMING.has(raw)) return 'upcoming';
  if (ACTIVE.has(raw) || raw === '') {
    const start = dateKey(project?.start);
    if (start && start > todayKey()) return 'upcoming';
    return 'active';
  }
  return 'other';
}

export function phaseLabel(project) {
  const phase = projectPhase(project);
  if (phase === 'other') {
    const raw = String(project?.status || '').trim();
    return raw || PHASE_LABEL.other;
  }
  return PHASE_LABEL[phase];
}

export function modeLabel(project) {
  if (project?.modo === 'tiempo') {
    return project.cotizacionHabilitada ? 'Gestión por tiempo · Cotización' : 'Gestión por tiempo';
  }
  return 'Modo ágil';
}

export function progressInfo(project) {
  const total = Number(project?.issuesTotal);
  const done = Number(project?.issuesDone);
  if (!Number.isFinite(total) || total <= 0) return null;
  const percent = Number.isFinite(project?.progress)
    ? Math.max(0, Math.min(100, Math.round(project.progress)))
    : Math.round((done / total) * 100);
  return { percent, done, total };
}

function compareText(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'es', { sensitivity: 'base' });
}

function compareDate(a, b, direction) {
  const left = dateKey(a);
  const right = dateKey(b);
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return direction * (left < right ? -1 : left > right ? 1 : 0);
}

export function sortProjects(projects, sortId) {
  const list = [...projects];
  list.sort((a, b) => {
    if (sortId === 'name-asc') return compareText(a.name, b.name);
    if (sortId === 'name-desc') return compareText(b.name, a.name);
    if (sortId === 'start') return compareDate(a.start, b.start, 1) || compareText(a.name, b.name);
    if (sortId === 'end') return compareDate(a.end, b.end, 1) || compareText(a.name, b.name);
    return compareDate(a.lastActivity, b.lastActivity, -1) || compareText(a.name, b.name);
  });
  return list;
}

export const EMPTY_FILTERS = {
  phase: 'any',
  role: 'any',
  ownership: 'any',
  from: '',
  to: '',
};

export function filtersActive(filters) {
  return filters.phase !== 'any'
    || filters.role !== 'any'
    || filters.ownership !== 'any'
    || Boolean(filters.from)
    || Boolean(filters.to);
}

function overlapsRange(project, from, to) {
  if (!from && !to) return true;
  const start = dateKey(project.start);
  const end = dateKey(project.end) || start;
  if (!start && !end) return false;
  const left = start || end;
  const right = end || start;
  if (from && right < from) return false;
  if (to && left > to) return false;
  return true;
}

export function applyProjectFilters(projects, { query, tab, filters, userId }) {
  const text = String(query || '').trim().toLowerCase();
  const matched = projects.filter((project) => {
    if (text) {
      const haystack = `${project.name || ''} ${project.description || ''}`.toLowerCase();
      if (!haystack.includes(text)) return false;
    }
    if (filters.phase !== 'any' && projectPhase(project) !== filters.phase) return false;
    if (filters.role !== 'any' && project.myRole !== filters.role) return false;
    if (filters.ownership === 'own' && Number(project.creadorId) !== Number(userId)) return false;
    if (filters.ownership === 'shared' && Number(project.creadorId) === Number(userId)) return false;
    if (!overlapsRange(project, filters.from, filters.to)) return false;
    return true;
  });

  const counts = { all: matched.length, active: 0, upcoming: 0, completed: 0, archived: 0, paused: 0, other: 0 };
  matched.forEach((project) => {
    const phase = projectPhase(project);
    counts[phase] = (counts[phase] || 0) + 1;
  });

  const visible = tab === 'all'
    ? matched
    : matched.filter((project) => projectPhase(project) === tab);

  return { matched, counts, visible };
}
