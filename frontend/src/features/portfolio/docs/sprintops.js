// Integración con SprintOps: datos del proyecto, referencias dinámicas (@issue, @usuario, sprint)
// y bloques vivos (tablas de issues, métricas, progreso, fechas, tareas, calendario).

import apiClient from '../../../data/api/apiClient';
import { issuesRepository } from '../../../data/repositories/issuesRepository';
import { sprintsRepository } from '../../../data/repositories/sprintsRepository';
import { projectsRepository } from '../../../data/repositories/projectsRepository';
import { escapeHtml } from './sanitize';

export const STATUS = {
  todo: { label: 'Por hacer', color: '#64748b' },
  in_progress: { label: 'En progreso', color: '#d97706' },
  done: { label: 'Finalizado', color: '#2f6f5e' },
};

export const PRIORITY = {
  High: { label: 'Alta', color: '#be123c' },
  Medium: { label: 'Media', color: '#d97706' },
  Low: { label: 'Baja', color: '#2f6f5e' },
};

const cache = new Map();
const TTL = 30_000;

export async function loadProject(projectId, force = false) {
  if (!projectId) return null;
  const hit = cache.get(projectId);
  if (hit && !force && Date.now() - hit.at < TTL) return hit.data;
  const [issues, sprints, members] = await Promise.all([
    issuesRepository.getByProjectId(projectId).catch(() => []),
    sprintsRepository.getByProjectId(projectId).catch(() => []),
    projectsRepository.getMembers(projectId).catch(() => []),
  ]);
  const meetings = (await Promise.all((sprints || []).slice(-6).map((sprint) => apiClient.get(`/reuniones/sprint/${sprint.id}`).catch(() => [])))).flat();
  const data = { projectId, issues: issues || [], sprints: sprints || [], members: members || [], meetings };
  cache.set(projectId, { at: Date.now(), data });
  return data;
}

export function invalidateProject(projectId) {
  cache.delete(projectId);
}

const memberName = (data, id) => data.members.find((member) => member.userId === id)?.name || `Usuario ${id}`;
const sprintOf = (data, issue) => data.sprints.find((sprint) => String(sprint.id) === String(issue.sprintId));
const fmtDate = (value) => (value ? new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : '—');

export function issueUrl(issue) {
  return issue?.sprintId ? `/sprint/${issue.sprintId}/planning/task/${issue.id}` : `/project/${issue?.projectId}`;
}

const pill = (meta, fallback) => `<span class="wd-pill" style="--pill:${meta?.color || '#64748b'}">${escapeHtml(meta?.label || fallback || '—')}</span>`;

export function refHtml(kind, item, data) {
  if (kind === 'issue') {
    const assignees = (item.assigneeIds || []).map((id) => memberName(data, id)).join(', ');
    const sprint = sprintOf(data, item);
    return `<a class="wd-ref is-issue" contenteditable="false" data-ref="issue" data-id="${item.id}" href="${issueUrl(item)}" title="${escapeHtml(item.title)}"><b>#${item.id}</b> ${escapeHtml(item.title)} ${pill(STATUS[item.status], item.status)}${item.priority ? pill(PRIORITY[item.priority], item.priority) : ''}${assignees ? `<em>${escapeHtml(assignees)}</em>` : ''}${sprint?.endDate ? `<em>${fmtDate(sprint.endDate)}</em>` : ''}</a>&nbsp;`;
  }
  if (kind === 'user') return `<a class="wd-ref is-user" contenteditable="false" data-ref="user" data-id="${item.userId}" href="/profile">@${escapeHtml(item.name)}</a>&nbsp;`;
  if (kind === 'sprint') return `<a class="wd-ref is-sprint" contenteditable="false" data-ref="sprint" data-id="${item.id}" href="/sprint/${item.id}/planning"><b>${escapeHtml(item.name)}</b> ${pill(STATUS[item.status === 'active' ? 'in_progress' : item.status === 'completed' ? 'done' : 'todo'], item.status)} <em>${fmtDate(item.startDate)} – ${fmtDate(item.endDate)}</em></a>&nbsp;`;
  return '';
}

/** Actualiza las referencias del documento con los datos más recientes del proyecto. */
export function hydrateRefs(root, data) {
  if (!data) return;
  root.querySelectorAll('a.wd-ref[data-ref]').forEach((el) => {
    const id = el.dataset.id;
    const kind = el.dataset.ref;
    const item = kind === 'issue' ? data.issues.find((issue) => String(issue.id) === id)
      : kind === 'user' ? data.members.find((member) => String(member.userId) === id)
        : data.sprints.find((sprint) => String(sprint.id) === id);
    if (!item) {
      el.classList.add('is-missing');
      return;
    }
    const holder = document.createElement('div');
    holder.innerHTML = refHtml(kind, item, data);
    const fresh = holder.firstElementChild;
    if (fresh && fresh.innerHTML !== el.innerHTML) el.innerHTML = fresh.innerHTML;
    el.classList.remove('is-missing');
  });
}

export const LIVE_BLOCKS = {
  issues: 'Tabla de issues',
  metrics: 'Métricas del proyecto',
  progress: 'Gráfico de progreso',
  dates: 'Fechas importantes',
  people: 'Responsables',
  tasks: 'Lista de tareas',
  calendar: 'Calendario',
  status: 'Indicadores de estado',
};

function filterIssues(data, options) {
  return data.issues.filter((issue) => (!options.sprint || String(issue.sprintId) === String(options.sprint)) && (!options.status || issue.status === options.status) && (!options.assignee || (issue.assigneeIds || []).includes(Number(options.assignee))));
}

function renderLive(kind, data, options) {
  const issues = filterIssues(data, options);
  const done = issues.filter((issue) => issue.status === 'done');
  const points = issues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
  const donePoints = done.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
  const sprint = data.sprints.find((item) => String(item.id) === String(options.sprint));
  const caption = `<div class="wd-live-head"><strong>${escapeHtml(LIVE_BLOCKS[kind])}</strong><span>${sprint ? escapeHtml(sprint.name) : 'Todo el proyecto'} · actualizado ${new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}</span></div>`;
  if (kind === 'issues') {
    const rows = issues.map((issue) => `<tr><td><a href="${issueUrl(issue)}">#${issue.id}</a></td><td>${escapeHtml(issue.title)}</td><td>${pill(STATUS[issue.status], issue.status)}</td><td>${pill(PRIORITY[issue.priority], issue.priority)}</td><td>${escapeHtml((issue.assigneeIds || []).map((id) => memberName(data, id)).join(', ') || '—')}</td><td>${issue.storyPoints ?? 0}</td></tr>`).join('');
    return `${caption}<table class="wd-tbl-accent"><tbody><tr><th>ID</th><th>Título</th><th>Estado</th><th>Prioridad</th><th>Responsables</th><th>Puntos</th></tr>${rows || '<tr><td colspan="6">Sin issues</td></tr>'}</tbody></table>`;
  }
  if (kind === 'metrics' || kind === 'status') {
    const by = (status) => issues.filter((issue) => issue.status === status).length;
    const pct = issues.length ? Math.round((done.length / issues.length) * 100) : 0;
    const cards = kind === 'metrics'
      ? [['Issues', issues.length], ['Completados', done.length], ['En progreso', by('in_progress')], ['Por hacer', by('todo')], ['Puntos', `${donePoints}/${points}`], ['Avance', `${pct}%`]]
      : Object.entries(STATUS).map(([key, meta]) => [meta.label, by(key), meta.color]);
    return `${caption}<div class="wd-metrics">${cards.map(([label, value, color]) => `<div class="wd-metric"${color ? ` style="--pill:${color}"` : ''}><b>${value}</b><span>${label}</span></div>`).join('')}</div>`;
  }
  if (kind === 'progress') {
    const rows = (options.sprint ? [sprint].filter(Boolean) : data.sprints).map((item) => {
      const list = data.issues.filter((issue) => String(issue.sprintId) === String(item.id));
      const pct = list.length ? Math.round((list.filter((issue) => issue.status === 'done').length / list.length) * 100) : 0;
      return `<div class="wd-progress-row"><span>${escapeHtml(item.name)}</span><div class="wd-progress"><span style="width:${pct}%"></span></div><em>${pct}%</em></div>`;
    }).join('');
    return `${caption}${rows || '<p>Sin sprints.</p>'}`;
  }
  if (kind === 'dates') {
    const events = [
      ...data.sprints.flatMap((item) => [[item.startDate, `Inicio de ${item.name}`], [item.endDate, `Cierre de ${item.name}`]]),
      ...data.meetings.map((meeting) => [meeting.date, `Reunión ${meeting.type || ''}`.trim()]),
    ].filter(([date]) => date).sort(([a], [b]) => a.localeCompare(b));
    return `${caption}<ul class="wd-dates">${events.map(([date, label]) => `<li><b>${fmtDate(date)}</b> ${escapeHtml(label)}</li>`).join('') || '<li>Sin fechas.</li>'}</ul>`;
  }
  if (kind === 'people') {
    const rows = data.members.map((member) => {
      const own = issues.filter((issue) => (issue.assigneeIds || []).includes(member.userId));
      return `<tr><td>${escapeHtml(member.name)}</td><td>${escapeHtml(member.role || '—')}</td><td>${own.length}</td><td>${own.filter((issue) => issue.status === 'done').length}</td></tr>`;
    }).join('');
    return `${caption}<table class="wd-tbl-minimal"><tbody><tr><th>Persona</th><th>Rol</th><th>Asignados</th><th>Completados</th></tr>${rows}</tbody></table>`;
  }
  if (kind === 'tasks') {
    return `${caption}<ul class="wd-checklist">${issues.map((issue) => `<li data-checked="${issue.status === 'done'}"><a href="${issueUrl(issue)}">#${issue.id}</a> ${escapeHtml(issue.title)} <em>${escapeHtml((issue.assigneeIds || []).map((id) => memberName(data, id)).join(', '))}</em></li>`).join('') || '<li data-checked="false">Sin tareas</li>'}</ul>`;
  }
  if (kind === 'calendar') {
    const base = options.month ? new Date(`${options.month}-01T12:00:00`) : new Date();
    return caption + calendarHtml(base.getFullYear(), base.getMonth(), [
      ...data.sprints.flatMap((item) => [[item.startDate, `▶ ${item.name}`], [item.endDate, `■ ${item.name}`]]),
      ...data.meetings.map((meeting) => [meeting.date, `● ${meeting.type || 'Reunión'}`]),
      ...data.issues.filter((issue) => issue.completedAt).map((issue) => [issue.completedAt, `✓ #${issue.id}`]),
    ]);
  }
  return caption;
}

export function calendarHtml(year, month, events = []) {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const title = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(first);
  const cells = [];
  for (let index = 0; index < offset; index += 1) cells.push('<td></td>');
  for (let day = 1; day <= days; day += 1) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const list = events.filter(([date]) => date === key).map(([, label]) => `<small>${escapeHtml(label)}</small>`).join('');
    cells.push(`<td><b>${day}</b>${list}</td>`);
  }
  while (cells.length % 7) cells.push('<td></td>');
  const rows = [];
  for (let index = 0; index < cells.length; index += 7) rows.push(`<tr>${cells.slice(index, index + 7).join('')}</tr>`);
  return `<table class="wd-calendar"><caption>${escapeHtml(title)}</caption><tbody><tr>${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => `<th>${day}</th>`).join('')}</tr>${rows.join('')}</tbody></table>`;
}

export function liveBlockHtml(kind, data, options = {}) {
  const attrs = Object.entries(options).filter(([, value]) => value).map(([key, value]) => ` data-${key}="${escapeHtml(value)}"`).join('');
  return `<div class="wd-live" contenteditable="false" data-live="${kind}"${attrs}>${data ? renderLive(kind, data, options) : '<p>Vincula un proyecto para ver datos.</p>'}</div><p><br></p>`;
}

export function hydrateLiveBlocks(root, data) {
  if (!data) return;
  root.querySelectorAll('div.wd-live[data-live]').forEach((el) => {
    const options = { sprint: el.dataset.sprint, status: el.dataset.status, assignee: el.dataset.assignee, month: el.dataset.month };
    el.innerHTML = renderLive(el.dataset.live, data, options);
  });
}

export function projectReport(data, projectName) {
  const sprint = data.sprints.find((item) => item.status === 'active') || data.sprints[data.sprints.length - 1];
  return `<h1>Reporte del proyecto ${escapeHtml(projectName || '')}</h1><p>Generado el ${new Intl.DateTimeFormat('es', { dateStyle: 'long' }).format(new Date())}.</p><h2>Métricas</h2>${liveBlockHtml('metrics', data)}<h2>Progreso por sprint</h2>${liveBlockHtml('progress', data)}${sprint ? `<h2>Sprint actual: ${escapeHtml(sprint.name)}</h2><p><strong>Objetivo:</strong> ${escapeHtml(sprint.goal || '—')}</p>${liveBlockHtml('issues', data, { sprint: String(sprint.id) })}` : ''}<h2>Responsables</h2>${liveBlockHtml('people', data)}<h2>Fechas importantes</h2>${liveBlockHtml('dates', data)}`;
}
