import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  ChevronRight,
  Folder,
  FolderPlus,
  ChevronDown,
  History,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Sparkles,
  SquarePen,
  Trash2,
} from 'lucide-react';
import { readUiScale } from '../../../components/AppFrame';
import { sortByActivity } from './aiConversations';

function groupByDay(conversations) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const groups = new Map();
  conversations.forEach((item) => {
    const date = new Date(item.updatedAt || item.createdAt || Date.now());
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = start.getTime() - day.getTime();
    const label = diff <= 0 ? 'Hoy' : diff < 86400000 ? 'Ayer' : 'Anteriores';
    const current = groups.get(label) || [];
    current.push(item);
    groups.set(label, current);
  });
  return ['Hoy', 'Ayer', 'Anteriores'].filter((label) => groups.has(label)).map((label) => ({
    label,
    items: groups.get(label),
  }));
}

function matches(text, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return String(text || '').toLowerCase().includes(needle);
}

const AiSidebar = ({
  workspace,
  activeId,
  query,
  onQuery,
  historyOpen,
  onHistory,
  collapsed,
  onToggle,
  onNewConversation,
  onCreateFolder,
  onRenameConversation,
  onDeleteConversation,
  onMoveConversation,
  onArchiveConversation,
  onRenameFolder,
  onDeleteFolder,
  onToggleFolder,
  onSelect,
  searchRef,
  canConfigureCredits,
  onSaveCredits,
  onSaveAuthorization,
  onSavePreferences,
}) => {
  const sideRef = useRef(null);
  const [menu, setMenu] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [draftFolder, setDraftFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [over, setOver] = useState(null);
  const [confirmKey, setConfirmKey] = useState(null);
  const [limitDraft, setLimitDraft] = useState('');
  const [foldersOpen, setFoldersOpen] = useState(true);

  useEffect(() => {
    if (workspace.credits) setLimitDraft(String(workspace.credits.limit));
  }, [workspace.credits]);

  useEffect(() => {
    if (collapsed) setMenu(null);
  }, [collapsed]);

  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    const onKey = (event) => {
      if (event.key === 'Escape') setMenu(null);
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const openMenu = (event, payload) => {
    event.stopPropagation();
    const key = `${payload.type}:${payload.id}`;
    if (menu?.key === key) {
      setMenu(null);
      return;
    }
    const side = sideRef.current;
    const scale = readUiScale() || 1;
    const buttonBox = event.currentTarget.getBoundingClientRect();
    const sideBox = side.getBoundingClientRect();
    const sideHeight = sideBox.height / scale;
    let top = (buttonBox.bottom - sideBox.top) / scale + 6;
    if (top + 210 > sideHeight) top = Math.max(8, (buttonBox.top - sideBox.top) / scale - 210);
    setConfirmKey(null);
    setMenu({
      ...payload,
      key,
      top,
      right: (sideBox.right - buttonBox.right) / scale,
    });
  };

  const beginRename = (type, id, value) => {
    setMenu(null);
    setRenaming({ type, id, value });
  };

  const commitRename = () => {
    if (!renaming) return;
    if (renaming.type === 'folder') onRenameFolder(renaming.id, renaming.value);
    else onRenameConversation(renaming.id, renaming.value);
    setRenaming(null);
  };

  const submitFolder = (event) => {
    event.preventDefault();
    const name = folderName.trim();
    if (name) onCreateFolder(name);
    setFolderName('');
    setDraftFolder(false);
  };

  const onDragStart = (event, conversationId) => {
    if (event.target.closest('button, input')) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('text/plain', conversationId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const allowDrop = (event, key) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (over !== key) setOver(key);
  };

  const dropOn = (event, folderId) => {
    event.preventDefault();
    const conversationId = event.dataTransfer.getData('text/plain');
    setOver(null);
    if (!conversationId) return;
    onMoveConversation(conversationId, folderId);
    if (folderId) onToggleFolder(folderId, true);
  };

  const folders = workspace.folders;
  const visibleConversations = sortByActivity(
    workspace.conversations.filter((item) => (historyOpen ? true : !item.archived)),
  );
  const recent = visibleConversations.filter((item) => !item.folderId && matches(item.title, query));
  const history = sortByActivity(workspace.conversations.filter((item) => matches(item.title, query)));

  const renderConversation = (conversation) => {
    const menuKey = `conversation:${conversation.id}`;
    if (renaming?.type === 'conversation' && renaming.id === conversation.id) {
      return (
        <form
          key={conversation.id}
          onSubmit={(event) => {
            event.preventDefault();
            commitRename();
          }}
        >
          <input
            className="ai-rename"
            autoFocus
            value={renaming.value}
            aria-label="Nuevo nombre"
            onChange={(event) => setRenaming({ ...renaming, value: event.target.value })}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setRenaming(null);
              }
            }}
          />
        </form>
      );
    }
    return (
      <div
        key={conversation.id}
        className={`ai-row${conversation.id === activeId ? ' is-active' : ''}${menu?.key === menuKey ? ' is-menu' : ''}`}
        draggable={!historyOpen}
        onDragStart={(event) => onDragStart(event, conversation.id)}
        onDragEnd={() => setOver(null)}
      >
        <MessageSquare size={15} className="ai-row-icon" aria-hidden="true" />
        <div
          className="ai-row-title"
          role="button"
          tabIndex={0}
          onClick={() => onSelect(conversation.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(conversation.id);
            }
          }}
        >
          {conversation.title}
        </div>
        {conversation.archived && <em className="ai-archived">Archivada</em>}
        <button
          type="button"
          className="ai-row-more"
          aria-label={`Acciones de ${conversation.title}`}
          onClick={(event) => openMenu(event, { type: 'conversation', id: conversation.id })}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
    );
  };

  return (
    <aside ref={sideRef} className="ai-side" aria-label="Conversaciones">
      <div className="ai-rail">
        <button type="button" className="ai-icon-btn" aria-label="Abrir panel" onClick={onToggle}>
          <PanelLeftOpen size={18} />
        </button>
        <button type="button" className="ai-icon-btn" aria-label="Nueva conversación" onClick={onNewConversation}>
          <SquarePen size={18} />
        </button>
        <button
          type="button"
          className="ai-icon-btn"
          aria-label="Buscar"
          onClick={() => {
            onToggle();
            window.setTimeout(() => searchRef.current?.focus(), 40);
          }}
        >
          <Search size={18} />
        </button>
      </div>

      <div className="ai-side-full">
        <div className="ai-brand">
          <span className="ai-brand-mark" aria-hidden="true"><Sparkles size={16} /></span>
          <div>
            <strong>SprintOps AI ✨</strong>
            <small>Asistente del proyecto</small>
          </div>
          <button type="button" className="ai-side-collapse" aria-label="Ocultar panel" onClick={onToggle}>
            <PanelLeftClose size={15} />
          </button>
        </div>
        <button type="button" className="ai-new" onClick={onNewConversation}>
          <Plus size={16} />
          Nueva conversación
        </button>

        <label className="ai-search">
          <Search size={15} />
          <input
            ref={searchRef}
            value={query}
            placeholder="Buscar conversaciones…"
            onChange={(event) => onQuery(event.target.value)}
          />
        </label>

        <div className="ai-side-scroll" onScroll={() => setMenu(null)}>
          {historyOpen ? (
            <>
              <div className="ai-label">Historial</div>
              {history.length === 0 ? (
                <p className="ai-empty">Ninguna conversación coincide.</p>
              ) : history.map(renderConversation)}
            </>
          ) : (
            <>
              <div
                className={`ai-recent${over === 'recent' ? ' is-over' : ''}`}
                onDragOver={(event) => allowDrop(event, 'recent')}
                onDrop={(event) => dropOn(event, null)}
              >
                {recent.length === 0 ? (
                  <>
                    <div className="ai-label">Hoy</div>
                    <p className="ai-empty">
                      {query.trim() ? 'Ninguna conversación coincide.' : 'Todavía no hay conversaciones.'}
                    </p>
                  </>
                ) : groupByDay(recent).map((group) => (
                  <div key={group.label} className="ai-day-group">
                    <div className="ai-label">{group.label}</div>
                    {group.items.map(renderConversation)}
                  </div>
                ))}
              </div>

              <div className="ai-folders-block">
                <div className="ai-folders-head">
                  <button
                    type="button"
                    className="ai-folders-toggle"
                    aria-expanded={foldersOpen}
                    onClick={() => setFoldersOpen((open) => !open)}
                  >
                    Carpetas
                    <ChevronDown size={15} className={`ai-folders-chevron${foldersOpen ? ' is-open' : ''}`} />
                  </button>
                  <button
                    type="button"
                    className="ai-folders-add"
                    aria-label="Nueva carpeta"
                    onClick={() => {
                      setFoldersOpen(true);
                      setHistoryOpenSafe();
                      setDraftFolder(true);
                    }}
                  >
                    <FolderPlus size={14} />
                  </button>
                </div>
                {foldersOpen && (
                <div className="ai-folders-body">
              {draftFolder && (
                <form className="ai-folder-draft" onSubmit={submitFolder}>
                  <input
                    autoFocus
                    value={folderName}
                    placeholder="Ej. Planificación de sprints"
                    aria-label="Nombre de la carpeta"
                    onChange={(event) => setFolderName(event.target.value)}
                    onBlur={() => {
                      if (!folderName.trim()) setDraftFolder(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        setFolderName('');
                        setDraftFolder(false);
                      }
                    }}
                  />
                </form>
              )}
              {folders.map((folder) => {
                const chats = sortByActivity(
                  workspace.conversations.filter((item) => item.folderId === folder.id && !item.archived),
                );
                const nameHit = matches(folder.name, query);
                const shown = nameHit && !query.trim()
                  ? chats
                  : chats.filter((item) => nameHit || matches(item.title, query));
                if (query.trim() && !nameHit && shown.length === 0) return null;
                const menuKey = `folder:${folder.id}`;
                return (
                  <section
                    key={folder.id}
                    className={`ai-folder${over === folder.id ? ' is-over' : ''}${menu?.key === menuKey ? ' is-menu' : ''}`}
                    onDragOver={(event) => allowDrop(event, folder.id)}
                    onDrop={(event) => dropOn(event, folder.id)}
                  >
                    {renaming?.type === 'folder' && renaming.id === folder.id ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          commitRename();
                        }}
                      >
                        <input
                          className="ai-rename"
                          autoFocus
                          value={renaming.value}
                          aria-label="Nuevo nombre de la carpeta"
                          onChange={(event) => setRenaming({ ...renaming, value: event.target.value })}
                          onBlur={commitRename}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              setRenaming(null);
                            }
                          }}
                        />
                      </form>
                    ) : (
                      <div className="ai-folder-row">
                        <button type="button" className="ai-folder-main" onClick={() => onToggleFolder(folder.id, !folder.expanded)}>
                          <Folder size={15} className="ai-folder-icon" />
                          <span>{folder.name}</span>
                          <ChevronRight size={15} className={`ai-folder-chevron${folder.expanded ? ' is-open' : ''}`} />
                        </button>
                        <button
                          type="button"
                          className="ai-row-more"
                          aria-label={`Acciones de ${folder.name}`}
                          onClick={(event) => openMenu(event, { type: 'folder', id: folder.id })}
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    )}
                    <div className={`ai-folder-chats${folder.expanded ? ' is-open' : ''}`}>
                      <div>
                        {shown.length === 0 ? (
                          <p className="ai-empty">Vacía</p>
                        ) : shown.map(renderConversation)}
                      </div>
                    </div>
                  </section>
                );
              })}
                </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="ai-side-foot">
        <button type="button" className="ai-history" onClick={onHistory}>
          <History size={15} />
          {historyOpen ? 'Recientes' : 'Historial'}
        </button>
        {workspace.credits && (
          <div className="ai-credits">
            <p>
              {workspace.balance
                ? `${workspace.balance.available} créditos disponibles en este chat`
                : `Créditos de este proyecto: ${workspace.credits.remaining} de ${workspace.credits.limit}`}
            </p>
            {canConfigureCredits && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const limit = Number(limitDraft);
                  if (Number.isFinite(limit)) onSaveCredits(limit);
                }}
              >
                <input
                  type="number"
                  min="0"
                  max="100000"
                  aria-label="Límite mensual de créditos de este proyecto"
                  value={limitDraft}
                  onChange={(event) => setLimitDraft(event.target.value)}
                />
                <button type="submit">Guardar cupo</button>
              </form>
            )}
          </div>
        )}
        {workspace.authorization && (
          <div className="ai-auth">
            {workspace.preferences ? (
              <div className="ai-modes" role="radiogroup" aria-label="Autorización de acciones">
                {[
                  ['preguntar', 'Preguntar siempre'],
                  ['seguras', 'Acciones seguras'],
                  ['todo', 'Permitir todo'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={workspace.preferences.mode === id}
                    className={workspace.preferences.mode === id ? 'is-on' : ''}
                    onClick={() => onSavePreferences({ mode: id })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                className={`ai-switch${workspace.authorization.allowAll ? ' is-on' : ''}`}
                role="switch"
                aria-checked={workspace.authorization.allowAll}
                onClick={() => onSaveAuthorization({ ...workspace.authorization, allowAll: !workspace.authorization.allowAll })}
              >
                <span />
                Permitir todo
              </button>
            )}
            <div className="ai-auth-scopes">
              {[
                ['tasks', 'Tareas'],
                ['sprints', 'Sprints'],
                ['documents', 'Documentos'],
                ['notes', 'Notas'],
              ].map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={Boolean(workspace.authorization[key])}
                    onChange={(event) => onSaveAuthorization({ ...workspace.authorization, [key]: event.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p>
              {workspace.preferences?.mode === 'todo'
                ? 'Alto riesgo sigue pidiendo confirmación. No amplía tus permisos.'
                : workspace.preferences?.mode === 'seguras'
                  ? 'Solo se aplican solas las acciones seguras de este alcance.'
                  : 'Pregunta antes de modificar. El alcance aplica al cambiar el modo.'}
            </p>
            <Link to="/settings/ia" className="ai-auth-link">Ajustes de IA</Link>
            {(workspace.operations || []).length > 0 && (
              <div className="ai-log">
                {(workspace.operations || []).slice(0, 4).map((operation) => (
                  <p key={operation.id}>
                    {operation.summary}
                    {' · '}
                    {operation.mode === 'automatica' ? 'Automático' : operation.mode === 'rechazada' ? 'Rechazado' : 'Permitido'}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {menu && (
        <div className="ai-menu" style={{ top: menu.top, right: menu.right }} role="menu" onClick={(event) => event.stopPropagation()}>
          {menu.type === 'folder' ? (
            <>
              <button type="button" onClick={() => beginRename('folder', menu.id, folders.find((folder) => folder.id === menu.id)?.name || '')}>
                <Pencil size={14} /> Renombrar
              </button>
              <button
                type="button"
                className="is-danger"
                onClick={() => {
                  if (confirmKey !== menu.key) {
                    setConfirmKey(menu.key);
                    return;
                  }
                  onDeleteFolder(menu.id);
                  setMenu(null);
                }}
              >
                <Trash2 size={14} /> {confirmKey === menu.key ? 'Quitar y conservar chats' : 'Quitar carpeta'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => beginRename(
                  'conversation',
                  menu.id,
                  workspace.conversations.find((item) => item.id === menu.id)?.title || '',
                )}
              >
                <Pencil size={14} /> Renombrar
              </button>
              <div className="ai-menu-label">Mover a</div>
              <button type="button" onClick={() => { onMoveConversation(menu.id, null); setMenu(null); }}>
                Sin carpeta
              </button>
              {folders.map((folder) => (
                <button key={folder.id} type="button" onClick={() => { onMoveConversation(menu.id, folder.id); onToggleFolder(folder.id, true); setMenu(null); }}>
                  <Folder size={14} /> {folder.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const item = workspace.conversations.find((conversation) => conversation.id === menu.id);
                  onArchiveConversation(menu.id, !item?.archived);
                  setMenu(null);
                }}
              >
                <Archive size={14} /> {workspace.conversations.find((item) => item.id === menu.id)?.archived ? 'Desarchivar' : 'Archivar'}
              </button>
              <button
                type="button"
                className="is-danger"
                onClick={() => {
                  if (confirmKey !== menu.key) {
                    setConfirmKey(menu.key);
                    return;
                  }
                  onDeleteConversation(menu.id);
                  setMenu(null);
                }}
              >
                <Trash2 size={14} /> {confirmKey === menu.key ? 'Confirmar' : 'Eliminar'}
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );

  function setHistoryOpenSafe() {
    if (historyOpen) onHistory();
  }
};

export default AiSidebar;
