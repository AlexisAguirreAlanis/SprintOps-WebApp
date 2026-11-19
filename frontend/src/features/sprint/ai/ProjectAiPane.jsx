import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, AtSign, BarChart3, CheckSquare, ChevronDown, Copy, FileText, Flag, ListChecks, Paperclip, Pencil, RefreshCcw, Search, Send, Sparkles, Square, StickyNote, X } from 'lucide-react';
import { issuesRepository } from '../../../data/repositories/issuesRepository';
import { notesRepository } from '../../../data/repositories/notesRepository';
import { portfolioRepository } from '../../../data/repositories/portfolioRepository';
import { sprintsRepository } from '../../../data/repositories/sprintsRepository';
import { useAuth } from '../../auth/hooks/useAuth';
import AiSidebar from './AiSidebar';
import AiMarkdown from './AiMarkdown';
import AiProposalCard from './AiProposalCard';
import AiRunCards from './AiRunCards';
import AiCreditDock from './AiCreditDock';
import {
  createConversation,
  createFolder,
  deleteConversation,
  deleteFolder,
  loadWorkspace,
  mapBalance,
  mapCredits,
  mapAction,
  mapSource,
  mapOperation,
  mapProposal,
  moveConversation,
  purchaseCredits,
  renameConversation,
  renameFolder,
  resolveProposal,
  retryAction,
  undoAction,
  setConversationArchived,
  setFolderExpanded,
  streamTurn,
  updateAiPreferences,
  updateAuthorization,
  updateProjectCredits,
} from './aiConversations';
import './aiWorkspace.css';

function mergeActions(current, incoming) {
  const list = Array.isArray(current) ? [...current] : [];
  incoming.forEach((action) => {
    const index = list.findIndex((item) => item.id === action.id);
    if (index >= 0) list[index] = action;
    else list.push(action);
  });
  return list;
}

function openKey(userId, projectId) {
  return `sprintops.ai.open.${userId}.${projectId}`;
}

const SUGGESTIONS = [
  {
    id: 'plan',
    label: 'Planificar un sprint',
    hint: 'Organiza tareas y prioridades.',
    prompt: 'Planificar mi próximo sprint',
    icon: Sparkles,
    allow: (can) => can.canCreateSprint,
  },
  {
    id: 'progress',
    label: 'Analizar el proyecto',
    hint: 'Revisa avances, bloqueos y métricas.',
    prompt: 'Analizar el progreso del proyecto',
    icon: BarChart3,
    allow: (can) => can.canViewMetrics,
  },
  {
    id: 'document',
    label: 'Crear contenido',
    hint: 'Genera documentos, notas o reportes.',
    prompt: 'Crear un documento',
    icon: FileText,
    allow: (can) => can.canCreateIssue,
  },
  {
    id: 'tasks',
    label: 'Gestionar tareas',
    hint: 'Crea, actualiza y organiza tareas.',
    prompt: 'Organizar mis tareas',
    icon: CheckSquare,
    allow: (can) => can.canEditIssue,
  },
  {
    id: 'search',
    label: 'Buscar en el proyecto',
    hint: 'Encuentra tareas, sprints y documentos.',
    prompt: 'Buscar información del proyecto',
    icon: Search,
    allow: () => true,
  },
];

const AiWelcome = ({ sending, onSend, suggestions, projectName }) => (
  <div className="ai-home">
    <div className="ai-home-copy">
      <span className="ai-home-mark" role="img" aria-label="SprintOps AI">
        <Sparkles size={22} />
      </span>
      <h2>¿Qué vamos a hacer hoy?</h2>
      <p>
        Puedo ayudarte a organizar, analizar y mejorar
        {' '}
        <strong>{projectName || 'este proyecto'}</strong>
        .
      </p>
    </div>
    {suggestions.length > 0 && (
      <div className="ai-suggestions">
        {suggestions.slice(0, 4).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className="ai-suggestion"
              disabled={sending}
              onClick={() => onSend(item.prompt || item.label)}
            >
              <span className="ai-suggestion-icon"><Icon size={16} /></span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
            </button>
          );
        })}
      </div>
    )}
  </div>
);

const MENTION_KINDS = [
  { id: 'tarea', label: 'Tarea', token: 'Tarea' },
  { id: 'sprint', label: 'Sprint', token: 'Sprint' },
  { id: 'documento', label: 'Documento', token: 'Documento' },
  { id: 'nota', label: 'Nota', token: 'Nota' },
];

function mentionAt(value, cursor) {
  const slice = value.slice(0, cursor);
  const match = /(?:^|\s)@([^\n@]*)$/.exec(slice);
  if (!match) return null;
  return { start: cursor - match[1].length - 1, query: match[1] };
}

function mentionRows(catalog, query) {
  const text = query.trim();
  const lowered = text.toLowerCase();
  const kind = MENTION_KINDS.find((item) => lowered === item.token.toLowerCase() || lowered.startsWith(`${item.token.toLowerCase()} `));
  if (!kind) {
    return MENTION_KINDS
      .filter((item) => !lowered || item.label.toLowerCase().includes(lowered))
      .map((item) => ({ id: `kind-${item.id}`, kind: item.id, label: item.label, pick: 'kind' }));
  }
  const filter = text.slice(kind.token.length).trim().toLowerCase();
  const key = kind.id === 'tarea' ? 'tasks' : kind.id === 'documento' ? 'docs' : kind.id === 'sprint' ? 'sprints' : 'notes';
  return (catalog?.[key] || [])
    .filter((item) => !filter || item.label.toLowerCase().includes(filter) || String(item.id).includes(filter))
    .slice(0, 8)
    .map((item) => ({ ...item, pick: 'item' }));
}

function MentionIcon({ kind }) {
  if (kind === 'documento') return <FileText size={14} />;
  if (kind === 'sprint') return <Flag size={14} />;
  if (kind === 'nota') return <StickyNote size={14} />;
  return <ListChecks size={14} />;
}

function growComposer(node) {
  if (!node) return;
  node.style.height = 'auto';
  node.style.height = `${Math.min(node.scrollHeight, 140)}px`;
}

const Composer = ({
  draft,
  onDraft,
  sending,
  canSend,
  onSend,
  onStop,
  composerRef,
  refs,
  onRemoveRef,
  pickerOpen,
  onTogglePicker,
  picker,
  onPickQuery,
  onPick,
  planMode,
  onTogglePlan,
  catalog,
  onNeedCatalog,
  estimate,
  projectName,
}) => {
  const [mention, setMention] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const rows = mention ? mentionRows(catalog, mention.query) : [];
  const activeIndex = Math.min(mentionIndex, Math.max(rows.length - 1, 0));

  const writeMention = (token, close) => {
    const node = composerRef?.current;
    const cursor = node ? node.selectionStart : draft.length;
    const start = mention ? mention.start : cursor;
    const before = draft.slice(0, start);
    const after = draft.slice(cursor);
    onDraft(`${before}${token}${after}`);
    const pos = before.length + token.length;
    if (close) setMention(null);
    else setMention({ start, query: token.slice(1) });
    setMentionIndex(0);
    window.requestAnimationFrame(() => {
      node?.focus();
      node?.setSelectionRange(pos, pos);
    });
  };

  const chooseMention = (row) => {
    if (!row) return;
    if (row.pick === 'kind') {
      const kind = MENTION_KINDS.find((item) => item.id === row.kind);
      writeMention(`@${kind.token} `, false);
      onNeedCatalog();
      return;
    }
    const kind = MENTION_KINDS.find((item) => item.id === row.kind);
    const label = String(row.label || '').replace(/@/g, '').trim();
    writeMention(`@${kind.token} #${row.id} ${label} `, true);
  };

  const insertAt = () => {
    const node = composerRef?.current;
    const cursor = node ? node.selectionStart : draft.length;
    const before = draft.slice(0, cursor);
    const after = draft.slice(cursor);
    const prefix = before && !/\s$/.test(before) ? ' @' : '@';
    onDraft(`${before}${prefix}${after}`);
    const pos = before.length + prefix.length;
    window.requestAnimationFrame(() => {
      node?.focus();
      node?.setSelectionRange(pos, pos);
      const next = mentionAt(`${before}${prefix}${after}`, pos);
      setMention(next);
      if (next) onNeedCatalog();
    });
  };

  return (
  <div className="ai-composer-shell">
  <form
    className="ai-composer"
    onSubmit={(event) => {
      event.preventDefault();
      setMention(null);
      if (sending) onStop();
      else onSend();
    }}
  >
    {mention && (
      <div className="ai-picker" role="listbox" aria-label="Menciones del proyecto">
        {catalog?.loading && <p>Buscando en este proyecto…</p>}
        {catalog?.error && <p>{catalog.error}</p>}
        {!catalog?.loading && rows.length === 0 && <p>Nada coincide en este proyecto.</p>}
        {rows.map((item, index) => (
          <button
            key={`${item.pick}-${item.kind}-${item.id}`}
            type="button"
            className={index === activeIndex ? 'is-active' : ''}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => chooseMention(item)}
          >
            <MentionIcon kind={item.kind} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    )}
    {pickerOpen && !mention && (
      <div className="ai-picker" role="listbox" aria-label="Referencias del proyecto">
        <input
          value={picker.query}
          placeholder="Buscar tarea o documento"
          aria-label="Buscar referencia"
          onChange={(event) => onPickQuery(event.target.value)}
        />
        {picker.loading && <p>Buscando en este proyecto…</p>}
        {picker.error && <p>{picker.error}</p>}
        {!picker.loading && !picker.error && picker.visible.length === 0 && <p>Nada coincide en este proyecto.</p>}
        {picker.visible.map((item) => (
          <button key={`${item.kind}-${item.id}`} type="button" onClick={() => onPick(item)}>
            {item.kind === 'documento' ? <FileText size={14} /> : <ListChecks size={14} />}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    )}
    {refs.length > 0 && (
      <div className="ai-refs">
        {refs.map((item) => (
          <button key={`${item.kind}-${item.id}`} type="button" onClick={() => onRemoveRef(item)}>
            {item.label}
            <X size={12} />
          </button>
        ))}
      </div>
    )}
    <div className="ai-composer-row">
      <textarea
        ref={(node) => {
          if (composerRef) composerRef.current = node;
          growComposer(node);
        }}
        rows={1}
        value={draft}
        placeholder={planMode ? `Describe el plan para ${projectName || 'este proyecto'}…` : `Pregunta lo que quieras sobre ${projectName || 'este proyecto'}…`}
        aria-label="Mensaje"
        onChange={(event) => {
          const value = event.target.value;
          onDraft(value);
          growComposer(event.target);
          const next = mentionAt(value, event.target.selectionStart);
          setMention(next);
          setMentionIndex(0);
          if (next) onNeedCatalog();
        }}
        onKeyDown={(event) => {
          if (mention && rows.length > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            setMentionIndex((current) => {
              const last = rows.length - 1;
              if (event.key === 'ArrowDown') return current >= last ? 0 : current + 1;
              return current <= 0 ? last : current - 1;
            });
            return;
          }
          if (mention && event.key === 'Escape') {
            event.preventDefault();
            setMention(null);
            return;
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (mention && rows.length > 0) {
              chooseMention(rows[activeIndex]);
              return;
            }
            if (sending) onStop();
            else onSend();
          }
        }}
      />
    </div>
    <div className="ai-composer-tools">
      <button type="button" className="ai-tool" aria-label="Adjuntar referencia" aria-expanded={pickerOpen} onClick={onTogglePicker}>
        <Paperclip size={16} />
      </button>
      <button type="button" className="ai-tool" aria-label="Mencionar un elemento" onClick={insertAt}>
        <AtSign size={16} />
      </button>
      <button
        type="button"
        className={`ai-agent${planMode ? ' is-on' : ''}`}
        aria-pressed={planMode}
        onClick={onTogglePlan}
      >
        <Sparkles size={14} />
        {planMode ? 'Plan' : 'Agente'}
        <ChevronDown size={13} />
      </button>
      <span className="ai-composer-cost">{estimate > 0 ? `~ ${estimate} créditos` : ''}</span>
      {sending ? (
        <button type="button" className="ai-send" aria-label="Detener generación" onClick={onStop}>
          <Square size={13} />
        </button>
      ) : (
        <button type="submit" className="ai-send" aria-label="Enviar" disabled={!canSend}>
          <Send size={15} />
        </button>
      )}
    </div>
  </form>
  <p className="ai-composer-note">
    {planMode
      ? 'Planificar propone los pasos y espera tu aprobación antes de cambiar el proyecto.'
      : 'La IA puede cometer errores. Revisa los cambios importantes antes de aplicarlos.'}
  </p>
  </div>
  );
};

function railKey(userId) {
  return `sprintops.ai.rail.${userId ?? 'local'}`;
}

const ContextPanel = ({ context, onClose }) => (
  <aside className="ai-context" aria-label={context.title || 'Contexto'}>
    <header>
      <h2>{context.title || 'Contexto'}</h2>
      <button type="button" className="ai-icon-btn" aria-label="Cerrar contexto" onClick={onClose}>
        <X size={16} />
      </button>
    </header>
    {context.kind && <div className="ai-kicker">{context.kind}</div>}
    <p>{context.body}</p>
  </aside>
);

const ProjectAiPane = ({ projectId, userId, projectName }) => {
  const { checkPermission } = useAuth();
  const [workspace, setWorkspace] = useState({ conversations: [], folders: [] });
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(railKey(userId)) === '1');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [showJump, setShowJump] = useState(false);
  const [editing, setEditing] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [context, setContext] = useState(null);
  const [busyProposal, setBusyProposal] = useState('');
  const [busyRetry, setBusyRetry] = useState('');
  const [creditOpen, setCreditOpen] = useState(false);
  const [estimate, setEstimate] = useState(0);
  const [pendingPack, setPendingPack] = useState(null);
  const [buyingCredits, setBuyingCredits] = useState(false);
  const [purchaseNote, setPurchaseNote] = useState('');
  const [refs, setRefs] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [catalog, setCatalog] = useState(null);
  const [pickQuery, setPickQuery] = useState('');
  const [planMode, setPlanMode] = useState(false);
  const [busyUndo, setBusyUndo] = useState('');
  const [busyPlan, setBusyPlan] = useState('');
  const catalogRef = useRef(null);
  const searchRef = useRef(null);
  const composerRef = useRef(null);

  useEffect(() => {
    growComposer(composerRef.current);
  }, [draft]);

  useEffect(() => {
    setRefs([]);
    setCatalog(null);
    catalogRef.current = null;
    setPickerOpen(false);
    setPickQuery('');
    setPlanMode(false);
  }, [projectId]);
  const threadRef = useRef(null);
  const stickRef = useRef(true);
  const abortRef = useRef(null);
  const projectRef = useRef(projectId);
  projectRef.current = projectId;

  const guard = (action) => async (...args) => {
    try {
      await action(...args);
    } catch (error) {
      setLoadError(error.message || 'No se pudo guardar el cambio.');
    }
  };

  const rememberProposal = (proposal) => {
    const next = mapProposal(proposal);
    setWorkspace((current) => ({
      ...current,
      proposals: [next, ...(current.proposals || []).filter((item) => item.id !== next.id)],
    }));
  };

  const decideProposal = async (proposal, allow) => {
    setBusyProposal(proposal.id);
    try {
      const response = await resolveProposal(userId, projectId, proposal.id, allow);
      const next = mapProposal(response.proposal);
      if (response.result && next.status === 'pendiente') next.result = response.result;
      const cards = (Array.isArray(response.actions) ? response.actions : []).map(mapAction).filter(Boolean);
      setWorkspace((current) => ({
        ...current,
        proposals: (current.proposals || []).map((item) => (item.id === next.id ? next : item)),
        operations: response.operation
          ? [mapOperation(response.operation), ...(current.operations || [])].slice(0, 12)
          : current.operations,
      }));
      if (cards.length && proposal.messageId) {
        changeConversation(proposal.conversationId || activeId, (item) => ({
          ...item,
          messages: item.messages.map((message) => (
            String(message.id) === String(proposal.messageId)
              ? { ...message, actions: mergeActions(message.actions, cards) }
              : message
          )),
        }));
      }
    } catch (error) {
      setLoadError(error.message || 'No se pudo resolver el cambio.');
    } finally {
      setBusyProposal('');
    }
  };

  const retryCard = async (conversationId, action) => {
    if (!action?.retryId || busyRetry) return;
    setBusyRetry(action.id);
    try {
      const response = await retryAction(userId, projectId, action.retryId);
      const next = mapAction({ ...(response.action || {}), id: action.id });
      if (!next) return;
      changeConversation(conversationId, (item) => ({
        ...item,
        messages: item.messages.map((message) => (
          (message.actions || []).some((card) => card.id === action.id)
            ? { ...message, actions: mergeActions(message.actions, [next]) }
            : message
        )),
      }));
    } catch (error) {
      setLoadError(error.message || 'No se pudo reintentar el cambio.');
    } finally {
      setBusyRetry('');
    }
  };

  const undoCard = async (messageId, action) => {
    if (!action?.undo || busyUndo) return;
    setBusyUndo(action.id);
    try {
      const response = await undoAction(userId, projectId, messageId, action.id);
      const next = mapAction(response);
      if (!next) return;
      changeConversation(activeId, (item) => ({
        ...item,
        messages: item.messages.map((message) => (
          (message.actions || []).some((card) => card.id === action.id)
            ? { ...message, actions: mergeActions(message.actions, [next]) }
            : message
        )),
      }));
    } catch (error) {
      setLoadError(error.message || 'No se pudo deshacer el cambio.');
    } finally {
      setBusyUndo('');
    }
  };

  const executePlan = (message, action) => {
    const steps = action.steps || [];
    if (steps.length === 0 || sending) return;
    setBusyPlan(message.id);
    const text = ['Ejecuta el plan aprobado.', ...steps.map((step, index) => `${index + 1}. ${step}`)].join('\n');
    send(text, { approvedSteps: steps, planMessageId: message.id }).finally(() => setBusyPlan(''));
  };

  const changeConversation = (conversationId, recipe) => {
    setWorkspace((current) => ({
      ...current,
      conversations: current.conversations.map((item) => (
        String(item.id) === String(conversationId) ? recipe(item) : item
      )),
    }));
  };

  useEffect(() => {
    abortRef.current?.abort();
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    setQuery('');
    setHistoryOpen(false);
    setDraft('');
    setContext(null);
    setEditing(null);
    setSending(false);
    setStatus('');
    loadWorkspace(userId, projectId).then((space) => {
      if (cancelled) return;
      setWorkspace(space);
      const saved = localStorage.getItem(openKey(userId, projectId));
      setActiveId(space.conversations.some((item) => String(item.id) === String(saved)) ? String(saved) : null);
    }).catch((error) => {
      if (cancelled) return;
      setWorkspace({ conversations: [], folders: [] });
      setActiveId(null);
      setLoadError(error.message || 'No pude cargar las conversaciones.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, projectId]);

  useEffect(() => {
    localStorage.setItem(railKey(userId), collapsed ? '1' : '0');
  }, [collapsed, userId]);

  const active = workspace.conversations.find((item) => item.id === activeId) || null;

  useEffect(() => {
    const node = threadRef.current;
    if (!node || !stickRef.current) return;
    node.scrollTop = node.scrollHeight;
  }, [active?.messages, status, sending, activeId]);

  const onThreadScroll = () => {
    const node = threadRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    stickRef.current = distance < 64;
    setShowJump(distance > 120);
  };

  const jumpToLatest = () => {
    const node = threadRef.current;
    if (!node) return;
    stickRef.current = true;
    node.scrollTop = node.scrollHeight;
    setShowJump(false);
  };

  const selectConversation = (id) => {
    const conversation = workspace.conversations.find((item) => String(item.id) === String(id));
    if (!conversation || String(conversation.projectId) !== String(projectId)) return;
    abortRef.current?.abort();
    stickRef.current = true;
    setActiveId(String(id));
    localStorage.setItem(openKey(userId, projectId), String(id));
    setDraft('');
    setEditing(null);
    setContext(null);
  };

  const startConversation = () => {
    abortRef.current?.abort();
    setActiveId(null);
    localStorage.removeItem(openKey(userId, projectId));
    setDraft('');
    setEditing(null);
    setHistoryOpen(false);
    setContext(null);
    window.setTimeout(() => composerRef.current?.focus(), 40);
  };

  const suggestions = SUGGESTIONS.filter((item) => item.allow({
    canCreateSprint: checkPermission('canCreateSprint'),
    canCreateIssue: checkPermission('canCreateIssue'),
    canEditIssue: checkPermission('canEditIssue'),
    canViewMetrics: checkPermission('canViewMetrics'),
  }));

  const stop = () => abortRef.current?.abort();

  const copyMessage = async (message) => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId((current) => (current === message.id ? null : current)), 1200);
    } catch {
      setCopiedId(null);
    }
  };

  const send = async (raw, options = {}) => {
    const mode = options.mode || 'send';
    const typed = (typeof raw === 'string' ? raw : draft).trim();
    const attached = mode === 'send' && typeof raw !== 'string'
      ? refs.map((item) => item.line).join('\n')
      : '';
    const text = [typed, attached].filter(Boolean).join('\n\n');
    if (sending || userId == null || projectId == null) return;
    if (mode !== 'regenerate' && !text) return;
    setSending(true);
    setDraft('');
    setRefs([]);
    setPickerOpen(false);
    setEditing(null);
    setStatus('Pensando…');
    stickRef.current = true;
    let conversation = active;
    if (!conversation) {
      const created = await createConversation(userId, projectId);
      conversation = created.conversation;
      setWorkspace((current) => ({
        ...current,
        conversations: [created.conversation, ...current.conversations],
      }));
      setActiveId(created.conversation.id);
      localStorage.setItem(openKey(userId, projectId), created.conversation.id);
      setHistoryOpen(false);
    }
    const conversationId = conversation.id;
    if (mode === 'send') {
      changeConversation(conversationId, (item) => ({
        ...item,
        title: item.title === 'Nueva conversación' ? text.replace(/\s+/g, ' ').slice(0, 80) : item.title,
        updatedAt: Date.now(),
        messages: [
          ...item.messages,
          { id: `local-user-${Date.now()}`, role: 'user', text },
          { id: 'live', role: 'assistant', text: '', streaming: true },
        ],
      }));
    } else if (mode === 'regenerate') {
      changeConversation(conversationId, (item) => {
        const messages = [...item.messages];
        if (messages.at(-1)?.role === 'assistant') messages.pop();
        messages.push({ id: 'live', role: 'assistant', text: '', streaming: true });
        return { ...item, messages, updatedAt: Date.now() };
      });
    } else if (mode === 'edit') {
      changeConversation(conversationId, (item) => {
        const index = item.messages.findIndex((message) => String(message.id) === String(options.messageId));
        if (index < 0) return item;
        const messages = item.messages.slice(0, index + 1).map((message, position) => (
          position === index ? { ...message, text } : message
        ));
        messages.push({ id: 'live', role: 'assistant', text: '', streaming: true });
        return { ...item, messages, updatedAt: Date.now() };
      });
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const pending = { text: '' };
    let frame = 0;
    const flush = () => {
      frame = 0;
      const chunk = pending.text;
      if (!chunk || String(projectRef.current) !== String(projectId)) return;
      pending.text = '';
      changeConversation(conversationId, (item) => ({
        ...item,
        messages: item.messages.map((message) => (
          message.streaming ? { ...message, text: message.text + chunk } : message
        )),
      }));
    };
    const enqueue = (chunk) => {
      pending.text += chunk;
      if (!frame) frame = requestAnimationFrame(flush);
    };

    try {
      const done = await streamTurn({
        projectId,
        conversationId,
        userId,
        message: text,
        mode,
        messageId: options.messageId,
        requestId: crypto.randomUUID(),
        plan: !options.planMessageId && planMode && mode === 'send',
        approvedSteps: options.approvedSteps,
        planMessageId: options.planMessageId,
        signal: controller.signal,
        onStatus: (label) => {
          if (String(projectRef.current) === String(projectId)) setStatus(label || '');
        },
        onReady: (ready) => {
          if (String(projectRef.current) !== String(projectId)) return;
          changeConversation(conversationId, (item) => ({
            ...item,
            title: ready.title || item.title,
            messages: item.messages.map((message) => {
              if (message.streaming) return { ...message, id: String(ready.assistantMessageId) };
              if (String(message.id).startsWith('local-user-')) return { ...message, id: String(ready.userMessageId) };
              return message;
            }),
          }));
        },
        onDelta: (chunk) => {
          if (chunk) setStatus('');
          enqueue(chunk);
        },
        onProposal: (proposal) => {
          if (String(projectRef.current) === String(projectId)) rememberProposal(proposal);
        },
        onSources: (sources) => {
          const next = (Array.isArray(sources) ? sources : []).map(mapSource).filter(Boolean);
          if (String(projectRef.current) !== String(projectId)) return;
          changeConversation(conversationId, (item) => ({
            ...item,
            messages: item.messages.map((message) => (
              message.streaming ? { ...message, sources: next } : message
            )),
          }));
        },
        onAction: (action) => {
          const next = mapAction(action);
          if (!next || String(projectRef.current) !== String(projectId)) return;
          changeConversation(conversationId, (item) => ({
            ...item,
            messages: item.messages.map((message) => (
              message.streaming
                ? { ...message, actions: mergeActions(message.actions, [next]) }
                : message
            )),
          }));
        },
        onEstimate: (credits) => {
          if (String(projectRef.current) === String(projectId)) setEstimate(credits);
        },
        onNotice: () => {
          if (String(projectRef.current) === String(projectId)) setEstimate(0);
        },
      });
      if (frame) cancelAnimationFrame(frame);
      flush();
      if (String(projectRef.current) !== String(projectId)) return;
      changeConversation(conversationId, (item) => ({
        ...item,
        title: done?.title || item.title,
        updatedAt: Date.now(),
        messages: item.messages.map((message) => (
          message.streaming || (done && String(message.id) === String(done.assistantMessageId))
            ? {
              ...message,
              id: String(done?.assistantMessageId || message.id),
              text: done?.text || message.text,
              status: done?.status || 'completo',
              actions: Array.isArray(done?.actions)
                ? done.actions.map(mapAction).filter(Boolean)
                : message.actions,
              sources: Array.isArray(done?.sources)
                ? done.sources.map(mapSource).filter(Boolean)
                : message.sources,
              streaming: false,
            }
            : message
        )),
      }));
      if (options.planMessageId) {
        changeConversation(conversationId, (item) => ({
          ...item,
          messages: item.messages.map((message) => (
            String(message.id) === String(options.planMessageId)
              ? {
                ...message,
                actions: (message.actions || []).map((action) => (
                  action.kind === 'plan'
                    ? { ...action, phase: 'done', headline: 'Plan ejecutado', status: 'Ejecutado' }
                    : action
                )),
              }
              : message
          )),
        }));
      }
      setEstimate(0);
      if (done?.credits || done?.balance) {
        const credits = done?.credits ? mapCredits(done.credits) : undefined;
        const balance = mapBalance(done?.balance);
        setWorkspace((current) => ({
          ...current,
          credits: credits || current.credits,
          balance: balance || current.balance,
        }));
      }
    } catch (error) {
      if (frame) cancelAnimationFrame(frame);
      flush();
      if (String(projectRef.current) !== String(projectId)) return;
      if (error?.name === 'AbortError') {
        changeConversation(conversationId, (item) => ({
          ...item,
          messages: item.messages.map((message) => (
            message.streaming
              ? {
                ...message,
                streaming: false,
                status: 'interrumpido',
                text: message.text || 'La respuesta se interrumpió.',
              }
              : message
          )),
        }));
      } else {
        const note = error?.message || 'No pude contactar al asistente.';
        changeConversation(conversationId, (item) => ({
          ...item,
          messages: item.messages.map((message) => (
            message.streaming ? { ...message, streaming: false, text: message.text || note } : message
          )),
        }));
      }
    } finally {
      if (String(projectRef.current) === String(projectId)) {
        setSending(false);
        setStatus('');
      }
      abortRef.current = null;
    }
  };

  const loadCatalog = async () => {
    if (catalogRef.current || userId == null || projectId == null) return;
    catalogRef.current = { loading: true };
    setCatalog({ loading: true, error: '', tasks: [], docs: [], sprints: [], notes: [] });
    try {
      const [tasks, docs, sprints, notes] = await Promise.all([
        issuesRepository.getByProjectId(projectId).catch(() => []),
        portfolioRepository.list(userId).catch(() => []),
        sprintsRepository.getByProjectId(projectId).catch(() => []),
        notesRepository.list(projectId).catch(() => []),
      ]);
      const next = {
        loading: false,
        error: '',
        tasks: (Array.isArray(tasks) ? tasks : []).slice(0, 80).map((issue) => ({
          kind: 'tarea',
          id: String(issue.id),
          label: issue.title || `Tarea #${issue.id}`,
          line: `Referencia: Tarea #${issue.id}${issue.sprintId ? ` del sprint ${issue.sprintId}` : ''}: ${issue.title || 'sin título'}`,
        })),
        docs: (Array.isArray(docs) ? docs : [])
          .filter((sheet) => !sheet.deleted && !sheet.archived && String(sheet.projectId) === String(projectId))
          .slice(0, 40)
          .map((sheet) => ({
            kind: 'documento',
            id: String(sheet.id),
            label: sheet.name || `Documento #${sheet.id}`,
            line: `Referencia: Documento «${sheet.name || 'sin nombre'}»`,
          })),
        sprints: (Array.isArray(sprints) ? sprints : [])
          .filter((sprint) => String(sprint.projectId) === String(projectId))
          .slice(0, 40)
          .map((sprint) => ({
            kind: 'sprint',
            id: String(sprint.id),
            label: sprint.name || `Sprint #${sprint.id}`,
          })),
        notes: (Array.isArray(notes) ? notes : []).slice(0, 40).map((note) => ({
          kind: 'nota',
          id: String(note.id),
          label: String(note.text || `Nota #${note.id}`).replace(/\s+/g, ' ').slice(0, 80),
        })),
      };
      catalogRef.current = next;
      setCatalog(next);
    } catch (error) {
      const failed = { loading: false, error: error.message || 'No se pudieron cargar las referencias.', tasks: [], docs: [], sprints: [], notes: [] };
      catalogRef.current = null;
      setCatalog(failed);
    }
  };

  const togglePicker = () => {
    if (pickerOpen) {
      setPickerOpen(false);
      return;
    }
    setPickerOpen(true);
    loadCatalog();
  };

  const visiblePicker = (() => {
    const source = catalog || { loading: pickerOpen, error: '', tasks: [], docs: [] };
    const query = pickQuery.trim().toLowerCase();
    const items = [...(source.tasks || []), ...(source.docs || [])];
    const visible = (query ? items.filter((item) => item.label.toLowerCase().includes(query)) : items).slice(0, 8);
    return { ...source, query: pickQuery, visible };
  })();

  const addRef = (item) => {
    setRefs((current) => (
      current.some((ref) => ref.kind === item.kind && ref.id === item.id) ? current : [...current, item].slice(0, 6)
    ));
    setPickerOpen(false);
    setPickQuery('');
  };

  return (
    <div className={`ai-workspace${collapsed ? ' is-rail' : ''}${workspace.preferences?.animations === false ? ' is-still' : ''}`}>
      <AiSidebar
        key={`${userId ?? ''}:${projectId ?? ''}`}
        workspace={workspace}
        activeId={activeId}
        query={query}
        onQuery={setQuery}
        historyOpen={historyOpen}
        onHistory={() => setHistoryOpen((open) => !open)}
        collapsed={collapsed}
        onToggle={() => setCollapsed((open) => !open)}
        onNewConversation={startConversation}
        onCreateFolder={guard(async (name) => {
          const folder = await createFolder(userId, projectId, name);
          setWorkspace((current) => ({ ...current, folders: [...current.folders, folder] }));
        })}
        onRenameConversation={guard(async (id, title) => {
          const updated = await renameConversation(userId, projectId, id, title);
          changeConversation(id, (item) => ({ ...item, title: updated.title }));
        })}
        onDeleteConversation={guard(async (id) => {
          await deleteConversation(userId, projectId, id);
          setWorkspace((current) => ({
            ...current,
            conversations: current.conversations.filter((item) => String(item.id) !== String(id)),
          }));
          if (String(activeId) === String(id)) {
            setActiveId(null);
            localStorage.removeItem(openKey(userId, projectId));
          }
        })}
        onMoveConversation={guard(async (id, folderId) => {
          const updated = await moveConversation(userId, projectId, id, folderId);
          changeConversation(id, (item) => ({ ...item, folderId: updated.folderId, updatedAt: updated.updatedAt }));
        })}
        onArchiveConversation={guard(async (id, archived) => {
          const updated = await setConversationArchived(userId, projectId, id, archived);
          changeConversation(id, (item) => ({ ...item, archived: updated.archived, updatedAt: updated.updatedAt }));
        })}
        onRenameFolder={guard(async (id, name) => {
          const updated = await renameFolder(userId, projectId, id, name);
          setWorkspace((current) => ({
            ...current,
            folders: current.folders.map((folder) => (String(folder.id) === String(id) ? updated : folder)),
          }));
        })}
        onDeleteFolder={guard(async (id) => {
          await deleteFolder(userId, projectId, id);
          setWorkspace((current) => ({
            folders: current.folders.filter((folder) => String(folder.id) !== String(id)),
            conversations: current.conversations.map((item) => (
              String(item.folderId) === String(id) ? { ...item, folderId: null } : item
            )),
          }));
        })}
        onToggleFolder={guard(async (id, expanded) => {
          const updated = await setFolderExpanded(userId, projectId, id, expanded);
          setWorkspace((current) => ({
            ...current,
            folders: current.folders.map((folder) => (String(folder.id) === String(id) ? updated : folder)),
          }));
        })}
        onSelect={selectConversation}
        searchRef={searchRef}
        canConfigureCredits={checkPermission('canManageMembers')}
        onSaveCredits={guard(async (limit) => {
          const credits = await updateProjectCredits(userId, projectId, limit);
          setWorkspace((current) => ({ ...current, credits }));
        })}
        onSaveAuthorization={guard(async (policy) => {
          const authorization = await updateAuthorization(userId, projectId, policy);
          setWorkspace((current) => ({ ...current, authorization }));
        })}
        onSavePreferences={guard(async (patch) => {
          const saved = await updateAiPreferences(userId, patch);
          setWorkspace((current) => ({ ...current, preferences: saved.preferences }));
        })}
      />

      <section className="ai-chat" aria-label="Chat">
        <div className="ai-chat-tools">
        <AiCreditDock
          balance={workspace.balance}
          estimate={estimate}
          open={creditOpen}
          onToggle={() => setCreditOpen((value) => !value)}
          pendingPack={pendingPack}
          onPick={setPendingPack}
          buying={buyingCredits}
          purchaseNote={purchaseNote}
          onConfirm={async () => {
            if (!pendingPack) return;
            setBuyingCredits(true);
            try {
              const saved = await purchaseCredits(userId, pendingPack, projectId, crypto.randomUUID());
              setWorkspace((current) => ({ ...current, balance: saved.balance || current.balance }));
              setPurchaseNote(saved.transaction?.message || 'Recarga preparada. No se realizó ningún cargo.');
              setPendingPack(null);
            } catch (error) {
              setLoadError(error.message || 'No se pudo preparar la recarga.');
            } finally {
              setBuyingCredits(false);
            }
          }}
        />
        <Link to="/settings/ia" className="ai-settings-link">Ajustes de IA</Link>
        </div>
        {active ? (
          <>
            <div className="ai-chat-head">
              <h2>{active.title}</h2>
            </div>
            <div className="ai-thread" ref={threadRef} onScroll={onThreadScroll}>
              {active.messages.length === 0 && !sending && (
                <div className="ai-empty-state">
                  <p>Esta conversación está vacía.</p>
                  <p>Escribe abajo para preguntar por el proyecto.</p>
                </div>
              )}
              {active.messages.map((message, index) => {
                const isLastAssistant = message.role === 'assistant'
                  && !active.messages.slice(index + 1).some((item) => item.role === 'assistant');
                const isEditing = editing?.id === message.id;
                return (
                  <div key={message.id} className={`ai-turn is-${message.role === 'user' ? 'user' : 'assistant'}`}>
                    {isEditing ? (
                      <form
                        className="ai-edit"
                        onSubmit={(event) => {
                          event.preventDefault();
                          send(editing.value, { mode: 'edit', messageId: message.id });
                        }}
                      >
                        <textarea
                          value={editing.value}
                          aria-label="Editar mensaje"
                          onChange={(event) => setEditing({ ...editing, value: event.target.value })}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              send(editing.value, { mode: 'edit', messageId: message.id });
                            }
                          }}
                        />
                        <div>
                          <button type="button" onClick={() => setEditing(null)}>Cancelar</button>
                          <button type="submit" disabled={!editing.value.trim() || sending}>Enviar</button>
                        </div>
                      </form>
                    ) : (
                      <div className={`ai-bubble is-${message.role === 'user' ? 'user' : 'assistant'}${message.streaming ? ' is-streaming' : ''}`}>
                        {message.role === 'assistant' ? <AiMarkdown text={message.text} /> : message.text}
                        {message.status === 'interrumpido' && message.text !== 'La respuesta se interrumpió.' && (
                          <p className="ai-stream-note">Respuesta interrumpida. Lo ya hecho queda guardado y no se vuelve a ejecutar.</p>
                        )}
                        {message.status === 'error' && (
                          <p className="ai-stream-note">La respuesta no se completó.</p>
                        )}
                        {message.streaming && <span className="ai-caret" aria-hidden="true" />}
                      </div>
                    )}
                    {!message.streaming && !isEditing && message.text && (
                      <div className="ai-actions">
                        {message.role === 'assistant' && (
                          <button type="button" aria-label="Copiar respuesta" onClick={() => copyMessage(message)}>
                            <Copy size={14} /> {copiedId === message.id ? 'Copiado' : 'Copiar'}
                          </button>
                        )}
                        {message.role === 'assistant' && isLastAssistant && (
                          <button type="button" aria-label="Regenerar respuesta" disabled={sending} onClick={() => send('', { mode: 'regenerate' })}>
                            <RefreshCcw size={14} /> Regenerar
                          </button>
                        )}
                        {message.role === 'user' && (
                          <button type="button" aria-label="Editar mensaje" disabled={sending} onClick={() => setEditing({ id: message.id, value: message.text })}>
                            <Pencil size={14} /> Editar
                          </button>
                        )}
                      </div>
                    )}
                    {(message.role === 'assistant' && message.sources?.length > 0) && (
                      <div className="ai-sources">
                        <p>Fuentes</p>
                        <ul>
                          {message.sources.map((source) => (
                            <li key={source.id}>
                              {source.href ? <Link to={source.href}>{source.label}</Link> : source.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <AiRunCards
                      actions={message.actions}
                      busyId={busyRetry}
                      busyUndo={busyUndo}
                      busyPlan={busyPlan === message.id}
                      locked={Boolean(message.streaming)}
                      onRetry={(action) => retryCard(active.id, action)}
                      onUndo={(action) => undoCard(message.id, action)}
                      onExecute={(action) => executePlan(message, action)}
                    />
                    {(workspace.proposals || []).filter((proposal) => proposal.status === 'pendiente' && String(proposal.messageId) === String(message.id)).map((proposal) => (
                      <AiProposalCard
                        key={proposal.id}
                        proposal={proposal}
                        busy={busyProposal === proposal.id}
                        onAllow={() => decideProposal(proposal, true)}
                        onReject={() => decideProposal(proposal, false)}
                      />
                    ))}
                  </div>
                );
              })}
              {(workspace.proposals || []).filter((proposal) => (
                proposal.status === 'pendiente'
                && (proposal.conversationId == null || String(proposal.conversationId) === String(active.id))
                && !active.messages.some((message) => String(message.id) === String(proposal.messageId))
              )).map((proposal) => (
                <AiProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  busy={busyProposal === proposal.id}
                  onAllow={() => decideProposal(proposal, true)}
                  onReject={() => decideProposal(proposal, false)}
                />
              ))}
            </div>
            {showJump && (
              <button type="button" className="ai-jump" onClick={jumpToLatest}>
                <ArrowDown size={14} /> Mensaje reciente
              </button>
            )}
          </>
        ) : loading ? (
          <div className="ai-empty-state">
            <p>Cargando conversaciones…</p>
          </div>
        ) : (
          <AiWelcome sending={sending} onSend={send} suggestions={suggestions} projectName={projectName} />
        )}
        {loadError && (
          <div className="ai-banner" role="alert">
            <p>{loadError}</p>
            <button type="button" onClick={() => setLoadError('')}>Cerrar</button>
          </div>
        )}
        {status && workspace.preferences?.indicators !== false && (
          <p className="ai-live" role="status">{status}</p>
        )}
        <Composer
          draft={draft}
          onDraft={setDraft}
          sending={sending}
          canSend={Boolean(draft.trim() || refs.length)}
          onSend={send}
          onStop={stop}
          composerRef={composerRef}
          refs={refs}
          onRemoveRef={(item) => setRefs((current) => current.filter((ref) => ref.id !== item.id || ref.kind !== item.kind))}
          pickerOpen={pickerOpen}
          onTogglePicker={togglePicker}
          picker={visiblePicker}
          onPickQuery={setPickQuery}
          onPick={addRef}
          planMode={planMode}
          onTogglePlan={() => setPlanMode((current) => !current)}
          catalog={catalog}
          onNeedCatalog={loadCatalog}
          estimate={estimate}
          projectName={projectName}
        />
      </section>

      {context && <ContextPanel context={context} onClose={() => setContext(null)} />}
    </div>
  );
};

export default ProjectAiPane;
