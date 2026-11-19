import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BaseEdge,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  CalendarDays,
  ChevronDown,
  ExternalLink,
  Filter,
  GitFork,
  Link2,
  List,
  Maximize2,
  Minus,
  MoreHorizontal,
  Orbit,
  Plus,
  Search,
  Table2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import BackButton from '../../components/ui/BackButton';
import Avatar from '../../components/Avatar';
import { issuesRepository } from '../../data/repositories/issuesRepository';
import { projectsRepository } from '../../data/repositories/projectsRepository';
import { sprintsRepository } from '../../data/repositories/sprintsRepository';
import IssueNode, { STATUS, normStatus } from './IssueNode';
import SunNode, { RingsNode } from './SunNode';
import { PROJECT_PHASE_LABEL, projectHubPhase } from '../sprint/projectHub';
import './universe.css';

const nodeTypes = { issue: IssueNode, sun: SunNode, rings: RingsNode };
const MAIN = { w: 184, h: 86 };
const SUB = { w: 126, h: 44 };
const SUN = 168;

const PRIORITY = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
  critical: 'Crítica',
};

function RadialEdge({ id, sourceX, sourceY, targetX, targetY, style }) {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const len = Math.hypot(dx, dy) || 1;
  const curve = Math.min(36, len * 0.12);
  const cx = (sourceX + targetX) / 2 + (-dy / len) * curve;
  const cy = (sourceY + targetY) / 2 + (dx / len) * curve;
  return <BaseEdge id={id} path={`M ${sourceX} ${sourceY} Q ${cx} ${cy} ${targetX} ${targetY}`} style={style} />;
}

const edgeTypes = { radial: RadialEdge };

function withCodes(issues) {
  const ids = new Set(issues.map((issue) => issue.id));
  const groups = {};
  issues.forEach((issue) => {
    const parent = issue.parentIssueId && ids.has(issue.parentIssueId) ? issue.parentIssueId : 0;
    (groups[parent] ||= []).push(issue);
  });
  Object.values(groups).forEach((list) => list.sort((a, b) => a.id - b.id));
  const codes = {};
  const walk = (parentId, prefix) => {
    (groups[parentId] || []).forEach((issue, index) => {
      const code = prefix ? `${prefix}.${index + 1}` : String(index + 1);
      codes[issue.id] = code;
      walk(issue.id, code);
    });
  };
  walk(0, '');
  return issues.map((issue) => ({ ...issue, code: codes[issue.id] || String(issue.id) }));
}

function buildGraph(issues, collapsed, onToggle) {
  const ids = new Set(issues.map((issue) => issue.id));
  const childrenOf = {};
  const roots = [];
  issues.forEach((issue) => {
    if (issue.parentIssueId && ids.has(issue.parentIssueId)) {
      (childrenOf[issue.parentIssueId] ||= []).push(issue);
    } else {
      roots.push(issue);
    }
  });
  roots.sort((a, b) => a.id - b.id);
  Object.values(childrenOf).forEach((list) => list.sort((a, b) => a.id - b.id));

  const count = Math.max(roots.length, 1);
  const radius = count === 1 ? 300 : Math.max(320, 200 / (2 * Math.sin(Math.PI / count)));
  const nodes = [
    {
      id: 'rings',
      type: 'rings',
      position: { x: 0, y: 0 },
      data: {},
      draggable: false,
      selectable: false,
      zIndex: 0,
      style: { width: 1080, height: 1080 },
    },
    {
      id: 'sun',
      type: 'sun',
      position: { x: 0, y: 0 },
      data: { label: '' },
      draggable: false,
      selectable: false,
      zIndex: 2,
      style: { width: SUN, height: SUN },
    },
  ];
  const edges = [];

  const addIssue = (issue, x, y, depth) => {
    const size = depth === 0 ? MAIN : SUB;
    nodes.push({
      id: String(issue.id),
      type: 'issue',
      position: { x, y },
      zIndex: 3,
      style: { width: size.w, height: size.h },
      data: {
        issueId: issue.id,
        code: issue.code,
        title: issue.title || 'Sin título',
        status: issue.status,
        depth,
        hasChildren: (childrenOf[issue.id] || []).length > 0,
        collapsed: collapsed.has(issue.id),
        onToggle,
      },
    });
  };

  const layoutKids = (issue, x, y, angle, depth) => {
    if (collapsed.has(issue.id)) return;
    const kids = childrenOf[issue.id] || [];
    const outward = depth === 0 ? 108 : 78;
    const gap = depth === 0 ? 136 : 112;
    kids.forEach((child, index) => {
      const offset = (index - (kids.length - 1) / 2) * gap;
      const tx = -Math.sin(angle);
      const ty = Math.cos(angle);
      const cx = x + Math.cos(angle) * outward + tx * offset;
      const cy = y + Math.sin(angle) * outward + ty * offset;
      addIssue(child, cx, cy, depth + 1);
      edges.push({
        id: `e-${issue.id}-${child.id}`,
        source: String(issue.id),
        target: String(child.id),
        type: 'radial',
      });
      layoutKids(child, cx, cy, angle, depth + 1);
    });
  };

  roots.forEach((issue, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    addIssue(issue, x, y, 0);
    edges.push({ id: `e-sun-${issue.id}`, source: 'sun', target: String(issue.id), type: 'radial' });
    layoutKids(issue, x, y, angle, 0);
  });

  return { nodes, edges };
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function dateRange(issue) {
  const start = formatDate(issue.createdAt);
  const end = formatDate(issue.completedAt);
  if (start && end) return `${start} – ${end}`;
  return start || end || 'Sin fechas';
}

function priorityKey(value) {
  const key = String(value || '').trim().toLowerCase();
  return PRIORITY[key] ? key : String(value || '');
}

function priorityLabel(value) {
  if (!value) return 'Sin prioridad';
  return PRIORITY[priorityKey(value)] || value;
}

function UniverseCanvas({ issues, projectName, selectedId, collapsed, onToggle, onSelect, onOpen, canvasApi }) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const positions = useRef(new Map());
  const layoutKey = useRef('');
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  const layout = useMemo(
    () => buildGraph(issues, collapsed, onToggle),
    [issues, collapsed, onToggle]
  );

  const fitGraph = useCallback(() => {
    const visible = layout.nodes.filter((node) => node.id !== 'rings').map((node) => ({ id: node.id }));
    fitView({ nodes: visible, padding: 0.16, duration: 450 });
  }, [fitView, layout]);

  useEffect(() => {
    canvasApi.current.fit = fitGraph;
  }, [canvasApi, fitGraph]);

  useEffect(() => {
    const key = layout.nodes.map((node) => node.id).join('|');
    if (layoutKey.current !== key) {
      positions.current = new Map();
      layoutKey.current = key;
    }
    let tries = 0;
    let timer = 0;
    const run = () => {
      fitGraph();
      tries += 1;
      if (tries < 5) timer = window.setTimeout(run, 140);
    };
    timer = window.setTimeout(run, 80);
    return () => window.clearTimeout(timer);
  }, [layout, fitGraph]);

  useEffect(() => {
    const related = new Set(['sun', 'rings']);
    if (selectedId) {
      related.add(String(selectedId));
      issues.forEach((issue) => {
        if (issue.id === selectedId || issue.parentIssueId === selectedId) related.add(String(issue.id));
        if (issue.id === selectedId && issue.parentIssueId) related.add(String(issue.parentIssueId));
      });
    }
    setNodes(layout.nodes.map((node) => ({
      ...node,
      position: positions.current.get(node.id) || node.position,
      data: {
        ...node.data,
        label: node.id === 'sun' ? (projectName || 'Proyecto') : node.data.label,
        selected: node.id === String(selectedId),
        dimmed: Boolean(selectedId) && !related.has(node.id),
      },
    })));
    setEdges(layout.edges.map((edge) => {
      const active = selectedId && (edge.source === String(selectedId) || edge.target === String(selectedId));
      const dim = selectedId && !related.has(edge.source) && !related.has(edge.target);
      return {
        ...edge,
        style: {
          stroke: active ? '#2f9a72' : '#8ecfb4',
          strokeWidth: active ? 2.4 : 1.7,
          opacity: dim ? 0.18 : 1,
        },
      };
    }));
  }, [layout, selectedId, projectName, issues]);

  const onNodesChange = useCallback((changes) => {
    setNodes((current) => applyNodeChanges(changes, current));
    changes.forEach((change) => {
      if (change.type === 'position' && change.position) positions.current.set(change.id, change.position);
    });
  }, []);

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodeOrigin={[0.5, 0.5]}
        onNodeClick={(_, node) => {
          if (node.id === 'sun' || node.id === 'rings') onSelect(null);
          else onSelect(Number(node.id));
        }}
        onNodeDoubleClick={(_, node) => {
          if (node.id !== 'sun' && node.id !== 'rings') onOpen(Number(node.id));
        }}
        onPaneClick={() => onSelect(null)}
        minZoom={0.15}
        maxZoom={2.2}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        panOnScroll={false}
        zoomOnScroll
      />
      <div className="iu-zoom">
        <div className="iu-zoom-pad">
          <button type="button" aria-label="Acercar" onClick={() => zoomIn({ duration: 200 })}><Plus size={16} /></button>
          <button type="button" aria-label="Alejar" onClick={() => zoomOut({ duration: 200 })}><Minus size={16} /></button>
        </div>
        <button type="button" className="iu-fit" aria-label="Ajustar a la pantalla" onClick={() => canvasApi.current.fit?.()}><Maximize2 size={15} /></button>
      </div>
    </>
  );
}

function FilterMenu({
  query, setQuery, statuses, priorities, assignees, sprints,
  statusOn, priorityOn, assigneeOn, sprintOn,
  onlyBlocked, onlyWithChildren, hideDone, toggle, setFlag,
}) {
  return (
    <div className="iu-pop">
      <label className="iu-search">
        <Search size={14} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre o identificador"
        />
      </label>
      <FilterGroup label="Estado" options={statuses} selected={statusOn} onToggle={(value) => toggle('status', value)} />
      <FilterGroup label="Prioridad" options={priorities} selected={priorityOn} onToggle={(value) => toggle('priority', value)} />
      <FilterGroup label="Responsable" options={assignees} selected={assigneeOn} onToggle={(value) => toggle('assignee', value)} />
      <FilterGroup label="Sprint" options={sprints} selected={sprintOn} onToggle={(value) => toggle('sprint', value)} />
      <button type="button" className={`iu-check${onlyBlocked ? ' is-on' : ''}`} onClick={() => setFlag('blocked')}>
        <i /> Solo issues bloqueados
      </button>
      <button type="button" className={`iu-check${onlyWithChildren ? ' is-on' : ''}`} onClick={() => setFlag('children')}>
        <i /> Solo issues con subissues
      </button>
      <button type="button" className={`iu-check${hideDone ? ' is-on' : ''}`} onClick={() => setFlag('done')}>
        <i /> Ocultar issues completados
      </button>
    </div>
  );
}

function FilterGroup({ label, options, selected, onToggle }) {
  if (!options.length) return null;
  return (
    <>
      <div className="iu-filter-label">{label}</div>
      <div className="iu-chips">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={selected.includes(option.id) ? 'is-on' : ''}
            onClick={() => onToggle(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </>
  );
}

function SidePanel({ issue, issues, members, onClose, onOpen, onSelect, onStatus }) {
  const [tab, setTab] = useState('resumen');
  const [depsOpen, setDepsOpen] = useState(false);
  const status = normStatus(issue.status);
  const children = issues.filter((item) => item.parentIssueId === issue.id);
  const parent = issues.find((item) => item.id === issue.parentIssueId);
  const people = (issue.assigneeIds || [])
    .map((id) => members.find((member) => Number(member.userId ?? member.id) === Number(id)))
    .filter(Boolean);

  useEffect(() => {
    setTab('resumen');
    setDepsOpen(false);
  }, [issue.id]);

  return (
    <aside className="iu-panel">
      <div className="iu-panel-head">
        <div>
          <p className="iu-kicker">#{issue.code}</p>
          <h2>{issue.title || 'Sin título'}</h2>
        </div>
        <div className="iu-panel-actions">
          <button type="button" aria-label="Abrir issue completo" onClick={() => onOpen(issue.id)}><ExternalLink size={16} /></button>
          <button type="button" aria-label="Cerrar" onClick={onClose}><X size={16} /></button>
        </div>
      </div>
      <div className="iu-panel-body">
        <select
          className={`iu-state ${STATUS[status].tone}`}
          value={status}
          aria-label="Estado"
          onChange={(event) => onStatus(issue, event.target.value)}
        >
          {Object.entries(STATUS).map(([value, meta]) => (
            <option key={value} value={value}>{meta.label}</option>
          ))}
        </select>
        <div className="iu-meta"><CalendarDays size={15} /> {dateRange(issue)}</div>
        <div className="iu-assignees">
          {people.length === 0 && <span className="iu-empty">Sin responsables</span>}
          {people.slice(0, 4).map((member) => (
            <Avatar key={member.userId ?? member.id} name={member.name} avatarUrl={member.avatarUrl} size="sm" />
          ))}
          {people.length > 4 && <span className="iu-empty">+{people.length - 4}</span>}
        </div>
        <button type="button" className="iu-depend" onClick={() => setDepsOpen((open) => !open)}>
          <span><Link2 size={15} /> {parent ? 'Depende de 1 issue' : 'Sin dependencias'}</span>
          <ChevronDown size={15} style={{ transform: depsOpen ? 'rotate(180deg)' : 'none' }} />
        </button>
        {depsOpen && parent && (
          <button type="button" className="iu-child" onClick={() => onSelect(parent.id)}>
            <span><b>#{parent.code}</b> {parent.title}</span>
          </button>
        )}
        <div className="iu-tabs">
          <button type="button" className={tab === 'resumen' ? 'is-on' : ''} onClick={() => setTab('resumen')}>Resumen</button>
          <button type="button" className={tab === 'subissues' ? 'is-on' : ''} onClick={() => setTab('subissues')}>Subissues ({children.length})</button>
          <button type="button" className={tab === 'actividad' ? 'is-on' : ''} onClick={() => setTab('actividad')}>Actividad</button>
        </div>
        {tab === 'resumen' && (
          <>
            <div className="iu-copy">Descripción</div>
            <p>{issue.description || issue.purpose || 'Sin descripción'}</p>
            <div className="iu-copy">Archivos (0)</div>
            <p className="iu-empty">Este issue no tiene archivos adjuntos.</p>
          </>
        )}
        {tab === 'subissues' && (
          children.length === 0
            ? <p className="iu-empty">Este issue no tiene subissues.</p>
            : children.map((child) => (
              <button key={child.id} type="button" className="iu-child" onClick={() => onSelect(child.id)}>
                <span><b>#{child.code}</b> {child.title}</span>
                <small className={`iu-status ${STATUS[normStatus(child.status)].tone}`}>{STATUS[normStatus(child.status)].label}</small>
              </button>
            ))
        )}
        {tab === 'actividad' && (
          <ul className="iu-activity">
            <li><time>{formatDate(issue.createdAt) || 'Sin fecha'}</time><p>Issue creado</p></li>
            <li><time>Estado</time><p>{STATUS[status].label}</p></li>
            {issue.completedAt && <li><time>{formatDate(issue.completedAt)}</time><p>Marcado como completado</p></li>}
          </ul>
        )}
      </div>
      <button type="button" className="iu-open" onClick={() => onOpen(issue.id)}>Ver issue completo →</button>
    </aside>
  );
}

const IssueUniversePage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const canvasApi = useRef({});
  const [issues, setIssues] = useState([]);
  const [project, setProject] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('graph');
  const [selectedId, setSelectedId] = useState(null);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusOn, setStatusOn] = useState([]);
  const [priorityOn, setPriorityOn] = useState([]);
  const [assigneeOn, setAssigneeOn] = useState([]);
  const [sprintOn, setSprintOn] = useState([]);
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [onlyWithChildren, setOnlyWithChildren] = useState(false);
  const [hideDone, setHideDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      issuesRepository.getByProjectId(projectId).catch(() => []),
      projectsRepository.getById(projectId).catch(() => null),
      sprintsRepository.getByProjectId(projectId).catch(() => []),
      projectsRepository.getMembers(projectId).catch(() => []),
    ]).then(([issueData, project, sprintData, memberData]) => {
      if (cancelled) return;
      setIssues(withCodes(Array.isArray(issueData) ? issueData : []));
      setProject(project);
      setSprints(Array.isArray(sprintData) ? sprintData : []);
      setMembers(Array.isArray(memberData) ? memberData : []);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    const close = (event) => {
      if (event.key === 'Escape') {
        setSelectedId(null);
        setFiltersOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  const childCounts = useMemo(() => {
    const counts = {};
    issues.forEach((issue) => {
      if (issue.parentIssueId) counts[issue.parentIssueId] = (counts[issue.parentIssueId] || 0) + 1;
    });
    return counts;
  }, [issues]);

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return issues.filter((issue) => {
      const status = normStatus(issue.status);
      if (hideDone && status === 'done') return false;
      if (onlyBlocked && status !== 'blocked') return false;
      if (onlyWithChildren && !childCounts[issue.id]) return false;
      if (statusOn.length && !statusOn.includes(status)) return false;
      if (priorityOn.length && !priorityOn.includes(priorityKey(issue.priority))) return false;
      if (sprintOn.length && !sprintOn.includes(String(issue.sprintId || ''))) return false;
      if (assigneeOn.length && !(issue.assigneeIds || []).some((id) => assigneeOn.includes(String(id)))) return false;
      if (text && !`${issue.title || ''} ${issue.code} ${issue.id}`.toLowerCase().includes(text)) return false;
      return true;
    });
  }, [issues, query, hideDone, onlyBlocked, onlyWithChildren, statusOn, priorityOn, sprintOn, assigneeOn, childCounts]);

  const selected = issues.find((issue) => issue.id === selectedId) || null;
  const filtersActive = Boolean(query || statusOn.length || priorityOn.length || assigneeOn.length || sprintOn.length || onlyBlocked || onlyWithChildren || hideDone);

  const toggleCollapsed = useCallback((id) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleFilter = (kind, value) => {
    const update = (current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
    if (kind === 'status') setStatusOn(update);
    if (kind === 'priority') setPriorityOn(update);
    if (kind === 'assignee') setAssigneeOn(update);
    if (kind === 'sprint') setSprintOn(update);
  };

  const openIssue = (id) => {
    const issue = issues.find((item) => item.id === id);
    if (!issue?.sprintId) {
      toast.error('Este issue no tiene un sprint para abrirlo');
      return;
    }
    navigate(`/sprint/${issue.sprintId}/planning/task/${issue.id}`);
  };

  const changeStatus = async (issue, status) => {
    setIssues((current) => current.map((item) => (
      item.id === issue.id
        ? { ...item, status, completedAt: status === 'done' ? new Date().toISOString().slice(0, 10) : item.completedAt }
        : item
    )));
    try {
      await issuesRepository.update(issue.id, { status });
    } catch {
      toast.error('No se pudo actualizar el estado');
    }
  };

  const projectName = project?.name || 'Proyecto';
  const phase = projectHubPhase(project);
  const sprintName = (id) => sprints.find((sprint) => String(sprint.id) === String(id))?.name || 'Sin sprint';
  const peopleLabel = (issue) => {
    const names = (issue.assigneeIds || [])
      .map((id) => members.find((member) => Number(member.userId ?? member.id) === Number(id))?.name)
      .filter(Boolean);
    return names.length ? names.join(', ') : 'Sin responsable';
  };

  const roots = visible.filter((issue) => !issue.parentIssueId || !visible.some((item) => item.id === issue.parentIssueId));
  const subCount = visible.length - roots.length;

  const statusOptions = Object.entries(STATUS).map(([id, meta]) => ({ id, label: meta.label }));
  const priorityOptions = [...new Set(issues.map((issue) => priorityKey(issue.priority)).filter(Boolean))].map((id) => ({ id, label: priorityLabel(id) }));
  const assigneeOptions = members
    .filter((member) => issues.some((issue) => (issue.assigneeIds || []).map(Number).includes(Number(member.userId ?? member.id))))
    .map((member) => ({ id: String(member.userId ?? member.id), label: member.name || 'Sin nombre' }));
  const sprintOptions = sprints
    .filter((sprint) => issues.some((issue) => String(issue.sprintId) === String(sprint.id)))
    .map((sprint) => ({ id: String(sprint.id), label: sprint.name || `Sprint ${sprint.id}` }));

  return (
    <div className="iu">
        <header className="iu-head">
          <div className="iu-title">
            <BackButton to={`/project/${projectId}/sprints`} />
            <div>
              <div className="iu-name-row">
                <span className="iu-mark" aria-hidden="true"><Orbit size={18} /></span>
                <h1>Universo de Issues</h1>
                <span className={`iu-project iu-project--${phase}`}>{PROJECT_PHASE_LABEL[phase] || 'Sin estado'}</span>
              </div>
            </div>
          </div>
          <div className="iu-tools">
            <div className="iu-switch" role="tablist">
              <button type="button" className={view === 'graph' ? 'is-on' : ''} onClick={() => setView('graph')}><GitFork size={14} className="rotate-180" /> Grafo</button>
              <button type="button" className={view === 'list' ? 'is-on' : ''} onClick={() => setView('list')}><List size={14} /> Lista</button>
              <button type="button" className={view === 'table' ? 'is-on' : ''} onClick={() => setView('table')}><Table2 size={14} /> Tabla</button>
            </div>
            <button type="button" className={`iu-ghost${filtersOpen || filtersActive ? ' is-on' : ''}`} onClick={() => { setFiltersOpen((open) => !open); setMenuOpen(false); }}>
              <Filter size={14} /> Filtros
            </button>
            <button type="button" className="iu-icon" aria-label="Más opciones" onClick={() => { setMenuOpen((open) => !open); setFiltersOpen(false); }}>
              <MoreHorizontal size={16} />
            </button>
          </div>

        {filtersOpen && (
          <FilterMenu
            query={query}
            setQuery={setQuery}
            statuses={statusOptions}
            priorities={priorityOptions}
            assignees={assigneeOptions}
            sprints={sprintOptions}
            statusOn={statusOn}
            priorityOn={priorityOn}
            assigneeOn={assigneeOn}
            sprintOn={sprintOn}
            onlyBlocked={onlyBlocked}
            onlyWithChildren={onlyWithChildren}
            hideDone={hideDone}
            toggle={toggleFilter}
            setFlag={(flag) => {
              if (flag === 'blocked') setOnlyBlocked((value) => !value);
              if (flag === 'children') setOnlyWithChildren((value) => !value);
              if (flag === 'done') setHideDone((value) => !value);
            }}
          />
        )}
        {menuOpen && (
          <div className="iu-pop iu-menu">
            <button type="button" onClick={() => { setView('graph'); setMenuOpen(false); setTimeout(() => canvasApi.current.fit?.(), 60); }}>Ajustar a la pantalla</button>
            <button type="button" onClick={() => { setCollapsed(new Set()); setMenuOpen(false); }}>Mostrar subissues</button>
            <button type="button" onClick={() => { setCollapsed(new Set(issues.filter((issue) => childCounts[issue.id]).map((issue) => issue.id))); setMenuOpen(false); }}>Ocultar subissues</button>
          </div>
        )}
        </header>

        <div className={`iu-stage${selected && view === 'graph' ? ' has-panel' : ''}`}>
          {loading ? (
            <div className="iu-blank">Cargando universo…</div>
          ) : visible.length === 0 ? (
            <div className="iu-blank">No hay issues para mostrar con estos filtros.</div>
          ) : view === 'graph' ? (
            <div className="iu-flow">
              <ReactFlowProvider>
                <UniverseCanvas
                  issues={visible}
                  projectName={projectName}
                  selectedId={selectedId}
                  collapsed={collapsed}
                  onToggle={toggleCollapsed}
                  onSelect={setSelectedId}
                  onOpen={openIssue}
                  canvasApi={canvasApi}
                />
              </ReactFlowProvider>
            </div>
          ) : view === 'list' ? (
            <div className="iu-scroll">
              {visible
                .slice()
                .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
                .map((issue) => {
                  const depth = issue.code.split('.').length - 1;
                  const status = normStatus(issue.status);
                  return (
                    <button
                      key={issue.id}
                      type="button"
                      className={`iu-row${issue.id === selectedId ? ' is-selected' : ''}`}
                      style={{ marginLeft: depth * 22, width: `calc(100% - ${depth * 22}px)` }}
                      onClick={() => setSelectedId(issue.id)}
                      onDoubleClick={() => openIssue(issue.id)}
                    >
                      <span className="iu-row-main">
                        <b>#{issue.code} {issue.title}</b>
                        <small>{sprintName(issue.sprintId)} · {peopleLabel(issue)}</small>
                      </span>
                      <span className={`iu-status ${STATUS[status].tone}`}>{STATUS[status].label}</span>
                    </button>
                  );
                })}
            </div>
          ) : (
            <div className="iu-scroll">
              <table className="iu-table">
                <thead>
                  <tr>
                    <th>Issue</th>
                    <th>Estado</th>
                    <th>Prioridad</th>
                    <th>Responsable</th>
                    <th>Fechas</th>
                    <th>Sprint</th>
                  </tr>
                </thead>
                <tbody>
                  {visible
                    .slice()
                    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
                    .map((issue) => {
                      const status = normStatus(issue.status);
                      return (
                        <tr key={issue.id} onClick={() => setSelectedId(issue.id)} onDoubleClick={() => openIssue(issue.id)}>
                          <td>#{issue.code} {issue.title}</td>
                          <td><span className={`iu-status ${STATUS[status].tone}`}>{STATUS[status].label}</span></td>
                          <td>{priorityLabel(issue.priority)}</td>
                          <td>{peopleLabel(issue)}</td>
                          <td>{dateRange(issue)}</td>
                          <td>{sprintName(issue.sprintId)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {view === 'graph' && !loading && visible.length > 0 && (
            <div className="iu-legend">
              <div className="iu-legend-row"><span><i className="iu-dot" /> Proyecto</span><b>1</b></div>
              <div className="iu-legend-row"><span><i className="iu-dot issue" /> Issue principal</span><b>{roots.length}</b></div>
              <div className="iu-legend-row"><span><i className="iu-dot sub" /> Subissue</span><b>{subCount}</b></div>
            </div>
          )}
          {selected && (
            <SidePanel
              issue={selected}
              issues={issues}
              members={members}
              onClose={() => setSelectedId(null)}
              onOpen={openIssue}
              onSelect={setSelectedId}
              onStatus={changeStatus}
            />
          )}
        </div>
    </div>
  );
};

export default IssueUniversePage;
