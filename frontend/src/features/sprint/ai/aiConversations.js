import apiClient, { API_BASE } from '../../../data/api/apiClient';

const LEGACY_KEY = 'sprintops.ai.workspace';
const OLDER_KEY = 'sprintops.ai.conversations';

function readStore(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function stamp(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : Date.now();
}

export function mapFolder(folder, projectId) {
  return {
    id: String(folder.id),
    projectId: String(projectId),
    name: folder.name || 'Carpeta',
    expanded: folder.expanded !== false,
    createdAt: stamp(folder.createdAt),
  };
}

export function mapConversation(conversation, projectId) {
  return {
    id: String(conversation.id),
    projectId: String(projectId),
    title: conversation.title || 'Nueva conversación',
    folderId: conversation.folderId == null ? null : String(conversation.folderId),
    archived: Boolean(conversation.archived),
    createdAt: stamp(conversation.createdAt),
    updatedAt: stamp(conversation.updatedAt || conversation.createdAt),
    messages: (Array.isArray(conversation.messages) ? conversation.messages : [])
      .filter((message) => message && message.text)
      .map((message) => ({
        id: String(message.id),
        role: message.role === 'assistant' ? 'assistant' : 'user',
        text: String(message.text),
        status: message.status || 'completo',
        actions: (Array.isArray(message.actions) ? message.actions : []).map(mapAction).filter(Boolean),
        sources: (Array.isArray(message.sources) ? message.sources : []).map(mapSource).filter(Boolean),
      })),
  };
}

function mapCredits(credits) {
  if (!credits || typeof credits !== 'object') return null;
  return {
    shared: credits.shared !== false,
    limit: Number(credits.limit) || 0,
    used: Number(credits.used) || 0,
    remaining: Number.isFinite(Number(credits.remaining)) ? Number(credits.remaining) : 0,
    period: credits.period || '',
  };
}

export function mapPreferences(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    mode: value.mode === 'seguras' || value.mode === 'todo' ? value.mode : 'preguntar',
    language: value.language === 'en' ? 'en' : 'es',
    detail: value.detail === 'breve' ? 'breve' : 'detallada',
    indicators: value.indicators !== false,
    animations: value.animations !== false,
    creditPool: value.creditPool === 'shared' ? 'shared' : 'personal',
  };
}

function mapCreditBag(bag) {
  return {
    limit: Number(bag?.limit) || 0,
    used: Number(bag?.used) || 0,
    plan: bag?.plan || '',
    planLabel: bag?.planLabel || '',
    included: Number(bag?.included) || Number(bag?.limit) || 0,
    extra: Number(bag?.extra) || 0,
    monthly: Number.isFinite(Number(bag?.monthly))
      ? Number(bag.monthly)
      : Math.max(0, (Number(bag?.remaining) || 0) - (Number(bag?.extra) || 0)),
    purchased: Number.isFinite(Number(bag?.purchased)) ? Number(bag.purchased) : (Number(bag?.extra) || 0),
    remaining: Number.isFinite(Number(bag?.remaining)) ? Number(bag.remaining) : 0,
    projects: Array.isArray(bag?.projects)
      ? bag.projects.map((project) => ({
        projectId: project.projectId,
        name: project.name || 'Proyecto',
        limit: Number(project.limit) || 0,
        used: Number(project.used) || 0,
        remaining: Number.isFinite(Number(project.remaining)) ? Number(project.remaining) : 0,
      }))
      : [],
  };
}

export function mapAiSettings(data) {
  const credits = data?.credits || {};
  return {
    preferences: mapPreferences(data?.preferences),
    credits: {
      personal: mapCreditBag(credits.personal),
      shared: mapCreditBag(credits.shared),
      monthUsed: Number(credits.monthUsed) || 0,
      renewal: credits.renewal || '',
      period: credits.period || '',
      history: Array.isArray(credits.history)
        ? credits.history.map((item) => ({
          id: item.id,
          pool: item.pool,
          projectName: item.projectName || 'Proyecto',
          action: item.action || '',
          credits: Number(item.credits) || 1,
          at: item.at || '',
        }))
        : [],
      plans: Array.isArray(credits.plans) ? credits.plans : [],
      packs: mapPacks(credits.packs),
      transactions: Array.isArray(credits.transactions) ? credits.transactions.map(mapTransaction) : [],
      movements: Array.isArray(credits.movements) ? credits.movements.map(mapMovement) : [],
      managed: Array.isArray(credits.managed) ? credits.managed.map(mapManaged) : [],
      canUseShared: Boolean(credits.canUseShared),
    },
  };
}

function mapManaged(project) {
  return {
    projectId: project.projectId,
    name: project.name || 'Proyecto',
    enabled: Boolean(project.enabled ?? project.shared),
    explicit: Boolean(project.explicit),
    limit: Number(project.limit) || 0,
    extra: Number(project.extra) || 0,
    balance: Number(project.balance) || 0,
    members: Array.isArray(project.members)
      ? project.members.map((member) => ({
        id: member.id,
        name: member.name || 'Usuario',
        authorized: Boolean(member.authorized),
      }))
      : [],
    consumption: Array.isArray(project.consumption) ? project.consumption : [],
  };
}

export function mapBalance(balance) {
  if (!balance || typeof balance !== 'object') return null;
  return {
    available: Number(balance.available) || 0,
    personal: Number(balance.personal) || 0,
    shared: Number(balance.shared) || 0,
    plan: balance.plan || 'free',
    planLabel: balance.planLabel || 'Free',
    included: Number(balance.included) || 0,
    extra: Number(balance.extra) || 0,
    monthly: Number.isFinite(Number(balance.monthly)) ? Number(balance.monthly) : 0,
    purchased: Number.isFinite(Number(balance.purchased)) ? Number(balance.purchased) : (Number(balance.extra) || 0),
    renewal: balance.renewal || '',
    packs: mapPacks(balance.packs),
    canUseShared: Boolean(balance.canUseShared),
    owner: Boolean(balance.owner),
  };
}

export function mapAuthorization(policy) {
  if (!policy || typeof policy !== 'object') return null;
  return {
    allowAll: Boolean(policy.allowAll),
    tasks: policy.tasks !== false,
    sprints: policy.sprints !== false,
    documents: policy.documents !== false,
    notes: policy.notes !== false,
  };
}

export function mapProposal(proposal) {
  const preview = proposal?.preview || {};
  return {
    id: String(proposal.id),
    conversationId: proposal.conversationId == null ? null : String(proposal.conversationId),
    messageId: proposal.messageId == null ? null : String(proposal.messageId),
    status: proposal.status || 'pendiente',
    result: proposal.result || '',
    preview: {
      title: preview.title || 'Cambios propuestos',
      target: preview.target || '',
      summary: Array.isArray(preview.summary) ? preview.summary.map(String) : [],
      fields: Array.isArray(preview.fields) ? preview.fields : [],
      diff: Array.isArray(preview.diff) ? preview.diff : [],
      highRisk: Boolean(preview.highRisk),
      warning: preview.warning || '',
    },
  };
}

export function mapOperation(operation) {
  return {
    id: String(operation.id),
    summary: operation.summary || 'Cambio',
    mode: operation.mode || '',
  };
}

function mapWorkspace(data, projectId) {
  return {
    folders: (data?.folders || []).map((folder) => mapFolder(folder, projectId)),
    conversations: (data?.conversations || []).map((conversation) => mapConversation(conversation, projectId)),
    credits: mapCredits(data?.credits),
    balance: mapBalance(data?.balance),
    preferences: mapPreferences(data?.preferences),
    authorization: mapAuthorization(data?.authorization),
    proposals: (data?.proposals || []).map(mapProposal),
    operations: (data?.operations || []).map(mapOperation),
  };
}

function legacySpace(userId, projectId) {
  const current = readStore(LEGACY_KEY)?.[String(userId)]?.[String(projectId)];
  const list = Array.isArray(current?.conversations)
    ? current.conversations
    : Array.isArray(current)
      ? current
      : readStore(OLDER_KEY)?.[String(userId)]?.[String(projectId)];
  return {
    folders: Array.isArray(current?.folders) ? current.folders : [],
    conversations: Array.isArray(list) ? list : [],
  };
}

async function migrateLocal(userId, projectId, local) {
  const folderIds = new Map();
  for (const folder of local.folders) {
    const created = await createFolder(userId, projectId, folder.name);
    if (folder.id != null) folderIds.set(String(folder.id), created.id);
  }
  for (const conversation of local.conversations) {
    const created = await createConversation(userId, projectId);
    const id = created.conversation.id;
    if (conversation.title && conversation.title !== 'Nueva conversación') {
      await renameConversation(userId, projectId, id, conversation.title);
    }
    if (conversation.folderId && folderIds.has(String(conversation.folderId))) {
      await moveConversation(userId, projectId, id, folderIds.get(String(conversation.folderId)));
    }
    if (conversation.archived) {
      await setConversationArchived(userId, projectId, id, true);
    }
    if (Array.isArray(conversation.messages) && conversation.messages.length > 0) {
      await apiClient.post(`/ai/projects/${projectId}/conversations/${id}/import`, {
        userId: Number(userId),
        messages: conversation.messages.map((message) => ({
          role: message.role === 'assistant' ? 'assistant' : 'user',
          text: message.text,
        })),
      });
    }
  }
}

export async function loadWorkspace(userId, projectId) {
  if (userId == null || projectId == null) return { conversations: [], folders: [] };
  const data = await apiClient.get(`/ai/projects/${projectId}?userId=${Number(userId)}`);
  let space = mapWorkspace(data, projectId);
  const flag = `sprintops.ai.server.${userId}.${projectId}`;
  if (!localStorage.getItem(flag)) {
    const local = legacySpace(userId, projectId);
    if (space.conversations.length === 0 && space.folders.length === 0
      && (local.conversations.length > 0 || local.folders.length > 0)) {
      await migrateLocal(userId, projectId, local);
      space = mapWorkspace(await apiClient.get(`/ai/projects/${projectId}?userId=${Number(userId)}`), projectId);
    }
    localStorage.setItem(flag, '1');
  }
  return space;
}

export async function createConversation(userId, projectId) {
  const raw = await apiClient.post(`/ai/projects/${projectId}/conversations`, { userId: Number(userId) });
  return { conversation: mapConversation({ ...raw, messages: raw.messages || [] }, projectId) };
}

async function patchConversation(userId, projectId, conversationId, body) {
  return mapConversation(await apiClient.patch(`/ai/projects/${projectId}/conversations/${conversationId}`, {
    userId: Number(userId),
    ...body,
  }), projectId);
}

export async function renameConversation(userId, projectId, conversationId, title) {
  return patchConversation(userId, projectId, conversationId, { title });
}

export async function moveConversation(userId, projectId, conversationId, folderId) {
  return patchConversation(userId, projectId, conversationId, {
    folderId: folderId == null ? null : Number(folderId),
  });
}

export async function setConversationArchived(userId, projectId, conversationId, archived) {
  return patchConversation(userId, projectId, conversationId, { archived: Boolean(archived) });
}

export async function deleteConversation(userId, projectId, conversationId) {
  await apiClient.delete(`/ai/projects/${projectId}/conversations/${conversationId}?userId=${Number(userId)}`);
}

export async function createFolder(userId, projectId, name) {
  return mapFolder(await apiClient.post(`/ai/projects/${projectId}/folders`, {
    userId: Number(userId),
    name,
  }), projectId);
}

export async function renameFolder(userId, projectId, folderId, name) {
  return mapFolder(await apiClient.patch(`/ai/projects/${projectId}/folders/${folderId}`, {
    userId: Number(userId),
    name,
  }), projectId);
}

export async function setFolderExpanded(userId, projectId, folderId, expanded) {
  return mapFolder(await apiClient.patch(`/ai/projects/${projectId}/folders/${folderId}`, {
    userId: Number(userId),
    expanded: Boolean(expanded),
  }), projectId);
}

export async function deleteFolder(userId, projectId, folderId) {
  await apiClient.delete(`/ai/projects/${projectId}/folders/${folderId}?userId=${Number(userId)}`);
}

export async function updateProjectCredits(userId, projectId, limit) {
  return mapCredits(await apiClient.patch(`/ai/projects/${projectId}/credits`, {
    userId: Number(userId),
    limit: Number(limit),
  }));
}

export async function updateAuthorization(userId, projectId, policy) {
  return mapAuthorization(await apiClient.patch(`/ai/projects/${projectId}/authorization`, {
    userId: Number(userId),
    allowAll: Boolean(policy.allowAll),
    tasks: Boolean(policy.tasks),
    sprints: Boolean(policy.sprints),
    documents: Boolean(policy.documents),
    notes: Boolean(policy.notes),
  }));
}

export async function purchaseCredits(userId, credits, projectId, requestId) {
  const data = await apiClient.post('/ai/settings/purchase', {
    userId: Number(userId),
    credits: Number(credits),
    confirm: true,
    requestId,
    projectId: projectId == null ? null : Number(projectId),
  });
  const settings = mapAiSettings(data);
  settings.balance = mapBalance(data?.balance);
  settings.transaction = mapTransaction(data?.transaction);
  return settings;
}

function mapPacks(packs) {
  if (!Array.isArray(packs)) return [];
  return packs.map((pack) => (
    pack && typeof pack === 'object'
      ? { credits: Number(pack.credits) || 0, price: Number(pack.price) || 0, currency: pack.currency || 'MXN' }
      : { credits: Number(pack) || 0, price: 0, currency: 'MXN' }
  )).filter((pack) => pack.credits > 0);
}

function mapTransaction(tx) {
  if (!tx || typeof tx !== 'object') return null;
  return {
    id: tx.id,
    credits: Number(tx.credits) || 0,
    price: Number(tx.price) || 0,
    currency: tx.currency || 'MXN',
    status: tx.status || '',
    statusLabel: tx.statusLabel || '',
    message: tx.message || '',
    at: tx.at || '',
  };
}

function mapMovement(item) {
  return {
    id: item.id,
    type: item.type || '',
    label: item.label || '',
    detail: item.detail || '',
    credits: Number(item.credits) || 0,
    at: item.at || '',
  };
}

export async function updateSharedCredits(userId, projectId, patch) {
  await apiClient.patch(`/ai/projects/${projectId}/credits`, {
    userId: Number(userId),
    ...patch,
  });
  return loadAiSettings(userId);
}

export async function loadAiSettings(userId) {
  return mapAiSettings(await apiClient.get(`/ai/settings?userId=${encodeURIComponent(userId)}`));
}

export async function updateAiPreferences(userId, patch) {
  return mapAiSettings(await apiClient.patch('/ai/settings', {
    userId: Number(userId),
    ...patch,
  }));
}

export function mapSource(source) {
  if (!source || typeof source !== 'object' || !source.label) return null;
  const href = typeof source.href === 'string' && source.href.startsWith('/') ? source.href : '';
  return {
    id: String(source.id || source.label),
    kind: source.kind || 'tarea',
    label: String(source.label),
    href,
  };
}

export function mapAction(action) {
  if (!action || typeof action !== 'object') return null;
  const href = typeof action.href === 'string' && action.href.startsWith('/') ? action.href : '';
  const phase = ['running', 'failed', 'plan', 'undone'].includes(action.phase) ? action.phase : 'done';
  const kind = ['documento', 'sprint', 'nota', 'tarea', 'plan'].includes(action.kind) ? action.kind : 'tarea';
  return {
    id: String(action.id || ''),
    phase,
    kind,
    verb: action.verb === 'crear' ? 'crear' : 'actualizar',
    headline: String(action.headline || (kind === 'plan' ? 'Plan listo para revisar' : 'Cambio aplicado')),
    project: String(action.project || 'Este proyecto'),
    subjectLabel: String(action.subjectLabel || 'Título'),
    subject: String(action.subject || ''),
    status: String(action.status || ''),
    error: action.error ? String(action.error) : '',
    href,
    linkLabel: String(action.linkLabel || 'Abrir'),
    retryId: action.retryId == null ? null : String(action.retryId),
    goal: String(action.goal || ''),
    steps: Array.isArray(action.steps) ? action.steps.map((step) => String(step)).slice(0, 8) : [],
    undo: Boolean(action.undo && action.undo.kind === 'documento'),
  };
}

export async function undoAction(userId, projectId, messageId, actionId) {
  return apiClient.post(`/ai/projects/${projectId}/messages/${messageId}/undo`, {
    userId: Number(userId),
    actionId,
  });
}

export async function retryAction(userId, projectId, retryId) {
  return apiClient.post(`/ai/projects/${projectId}/actions/${retryId}/retry`, {
    userId: Number(userId),
  });
}

export async function resolveProposal(userId, projectId, proposalId, allow) {
  return apiClient.post(`/ai/projects/${projectId}/proposals/${proposalId}/${allow ? 'allow' : 'reject'}`, {
    userId: Number(userId),
  });
}

export { patchConversation, mapCredits };

export function sortByActivity(list) {
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

function takeEvents(buffer) {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() || '';
  const events = [];
  for (const part of parts) {
    let event = 'message';
    const data = [];
    for (const line of part.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trim());
    }
    if (data.length > 0) events.push({ event, data: data.join('\n') });
  }
  return { events, rest };
}

export async function streamTurn({
  projectId,
  conversationId,
  userId,
  message,
  mode = 'send',
  messageId,
  requestId,
  plan = false,
  approvedSteps,
  planMessageId,
  signal,
  onStatus,
  onDelta,
  onReady,
  onProposal,
  onAction,
  onSources,
  onEstimate,
  onNotice,
}) {
  const response = await fetch(`${API_BASE}/ai/projects/${projectId}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      userId: Number(userId),
      message: message || '',
      mode,
      messageId: messageId == null ? null : Number(messageId),
      requestId: requestId || null,
      plan: Boolean(plan),
      approvedSteps: Array.isArray(approvedSteps) ? approvedSteps.slice(0, 8) : [],
      planMessageId: planMessageId == null ? null : Number(planMessageId),
    }),
    signal,
  });
  if (!response.ok || !response.body) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || err.message || `HTTP ${response.status}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let donePayload = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = takeEvents(buffer);
    buffer = parsed.rest;
    for (const item of parsed.events) {
      const data = JSON.parse(item.data);
      if (item.event === 'ready') onReady?.(data);
      else if (item.event === 'status') onStatus?.(data.label || '');
      else if (item.event === 'delta') onDelta?.(data.text || '');
      else if (item.event === 'proposal') onProposal?.(data);
      else if (item.event === 'action') onAction?.(data);
      else if (item.event === 'sources') onSources?.(data.sources || []);
      else if (item.event === 'estimate') onEstimate?.(Number(data.credits) || 0);
      else if (item.event === 'notice') onNotice?.(data);
      else if (item.event === 'done') donePayload = data;
      else if (item.event === 'error') throw new Error(data.message || 'No pude contactar al asistente.');
    }
  }
  return donePayload;
}
