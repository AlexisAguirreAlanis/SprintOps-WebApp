import { useEffect, useMemo, useState } from 'react';
import { Bot, Check, FileDiff, History, Info, Library, MessagesSquare, RotateCcw, Send, SpellCheck, Users, X } from 'lucide-react';
import { portfolioRepository } from '../../../../data/repositories/portfolioRepository';
import { sanitizeHtml } from '../sanitize';
import { allChanges, changeLabel } from '../engine/tracking';
import { Face } from '../../ShareSheet';

const TABS = [['comments', 'Comentarios', MessagesSquare], ['changes', 'Revisiones', FileDiff], ['props', 'Propiedades', Info], ['history', 'Historial', History], ['people', 'Colaboradores', Users], ['refs', 'Referencias', Library], ['ai', 'IA', Bot], ['grammar', 'Ortografía', SpellCheck]];

const when = (iso) => (iso ? new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '');

function Comments({ doc, user, meta, actions, activeComment, setActiveComment, api }) {
  const [filter, setFilter] = useState('open');
  const [drafts, setDrafts] = useState({});
  const [editing, setEditing] = useState(null);
  const list = doc.comments.filter((comment) => {
    if (filter === 'open') return !comment.resolved;
    if (filter === 'resolved') return comment.resolved;
    if (filter === 'mine') return String(comment.authorId) === String(user.id);
    if (filter === 'mentions') return (comment.mentions || []).includes(user.id) || (comment.replies || []).some((reply) => (reply.mentions || []).includes(user.id));
    return true;
  });
  const mine = (item) => String(item.authorId) === String(user.id);
  return (
    <div className="wd-comments">
      <div className="wd-row">
        <select className="wd-input" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filtrar comentarios">
          <option value="open">Abiertos</option><option value="resolved">Resueltos</option><option value="all">Todos</option><option value="mine">Míos</option><option value="mentions">Me mencionan</option>
        </select>
        <button type="button" className="wd-primary" disabled={!api.canComment} onClick={() => actions.comment()}>Nuevo</button>
      </div>
      {list.length === 0 && <p className="wd-muted">No hay comentarios {filter === 'open' ? 'abiertos' : ''}. Selecciona texto y pulsa Nuevo.</p>}
      {list.map((comment) => (
        <article key={comment.id} className={`wd-comment${comment.id === activeComment ? ' is-active' : ''}${comment.resolved ? ' is-resolved' : ''}`} onClick={() => { setActiveComment(comment.id); actions.focusComment(comment.id); }}>
          <blockquote>{comment.quote.slice(0, 120)}</blockquote>
          {[comment, ...(comment.replies || [])].map((item, index) => (
            <div key={item.id || index} className="wd-comment-item">
              <header><b>{item.authorName}</b><small>{when(item.createdAt)}{item.editedAt ? ' · editado' : ''}</small></header>
              {editing === (item.id || comment.id) ? (
                <form onSubmit={(event) => { event.preventDefault(); actions.editComment(comment.id, event.target.elements.text.value, index ? item.id : null); setEditing(null); }}>
                  <textarea name="text" className="wd-input" defaultValue={item.text} rows={3} />
                  <button type="submit" className="wd-primary">Guardar</button>
                </form>
              ) : <p>{item.text}</p>}
              {(mine(item) || meta?.canManage) && editing !== (item.id || comment.id) && (
                <div className="wd-comment-tools">
                  {mine(item) && <button type="button" onClick={(event) => { event.stopPropagation(); setEditing(item.id || comment.id); }}>Editar</button>}
                  <button type="button" onClick={(event) => { event.stopPropagation(); actions.deleteComment(comment.id, index ? item.id : null); }}>Eliminar</button>
                </div>
              )}
            </div>
          ))}
          <div className="wd-comment-actions">
            <button type="button" className="ps-quiet" onClick={(event) => { event.stopPropagation(); actions.resolveComment(comment.id, !comment.resolved); }}>{comment.resolved ? 'Reabrir' : <><Check size={13} /> Resolver</>}</button>
          </div>
          {!comment.resolved && api.canComment && (
            <form className="wd-reply" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); const text = (drafts[comment.id] || '').trim(); if (!text) return; actions.replyComment(comment.id, text); setDrafts((current) => ({ ...current, [comment.id]: '' })); }}>
              <input className="wd-input" placeholder="Responder… (usa @Nombre)" value={drafts[comment.id] || ''} onChange={(event) => setDrafts((current) => ({ ...current, [comment.id]: event.target.value }))} />
              <button type="submit" className="wd-btn" aria-label="Enviar respuesta"><Send size={14} /></button>
            </form>
          )}
        </article>
      ))}
    </div>
  );
}

function Changes({ desk, epoch, actions, api }) {
  const marks = useMemo(() => allChanges(desk.current || document.createElement('div')), [desk, epoch]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="wd-changes">
      <div className="wd-row">
        <button type="button" className="ps-quiet" disabled={!api.canEdit || !marks.length} onClick={() => actions.acceptAll()}>Aceptar todo</button>
        <button type="button" className="ps-quiet" disabled={!api.canEdit || !marks.length} onClick={() => actions.rejectAll()}>Rechazar todo</button>
      </div>
      {!marks.length && <p className="wd-muted">No hay cambios controlados.</p>}
      {marks.slice(0, 300).map((mark, index) => {
        const info = changeLabel(mark);
        return (
          <article key={index} className={`wd-change is-${info.kind === 'Insertó' ? 'ins' : info.kind === 'Eliminó' ? 'del' : 'fmt'}`} onClick={() => mark.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            <header><b>{info.author}</b><small>{when(info.time)}</small></header>
            <p><em>{info.kind}:</em> {info.text}</p>
            {api.canEdit && <div className="wd-row"><button type="button" className="ps-quiet" onClick={(event) => { event.stopPropagation(); actions.acceptChange(mark); }}>Aceptar</button><button type="button" className="ps-quiet" onClick={(event) => { event.stopPropagation(); actions.rejectChange(mark); }}>Rechazar</button></div>}
          </article>
        );
      })}
    </div>
  );
}

function Properties({ api, doc, meta }) {
  const el = api.object;
  if (el) {
    const rect = { w: el.offsetWidth, h: el.offsetHeight };
    return (
      <div className="wd-props">
        <h4>Objeto seleccionado</h4>
        <dl><dt>Tipo</dt><dd>{el.tagName === 'IMG' ? 'Imagen' : el.dataset.kind}</dd><dt>Tamaño</dt><dd>{rect.w} × {rect.h} px</dd><dt>Ajuste</dt><dd>{el.dataset.wrap || 'en línea'}</dd><dt>Rotación</dt><dd>{el.dataset.rotate || 0}°</dd></dl>
        <button type="button" className="ps-quiet" onClick={() => api.run('editObject')}>Editar</button>
        <button type="button" className="ps-quiet" onClick={() => api.run('deleteObject')}>Eliminar</button>
      </div>
    );
  }
  const props = doc.properties || {};
  const set = (key, value) => api.patchDoc({ properties: { ...props, [key]: value } }, { noReflow: true });
  return (
    <div className="wd-props">
      <h4>Documento</h4>
      {[['author', 'Autor'], ['subject', 'Asunto'], ['keywords', 'Palabras clave'], ['company', 'Organización']].map(([key, label]) => (
        <label key={key} className="wd-field-row"><span>{label}</span><input className="wd-input" value={props[key] || (key === 'author' ? meta?.ownerName || '' : '')} readOnly={!api.canEdit} onChange={(event) => set(key, event.target.value)} /></label>
      ))}
      <label className="wd-field-row"><span>Descripción</span><textarea className="wd-input" rows={3} value={props.description || ''} readOnly={!api.canEdit} onChange={(event) => set('description', event.target.value)} /></label>
      <dl><dt>Creado</dt><dd>{when(meta?.createdAt)}</dd><dt>Modificado</dt><dd>{when(meta?.updatedAt)}</dd><dt>Propietario</dt><dd>{meta?.ownerName}</dd><dt>Tu permiso</dt><dd>{meta?.role || (meta?.canEdit ? 'editor' : 'lector')}</dd></dl>
    </div>
  );
}

function VersionHistory({ hojaId, user, actions, api, epoch }) {
  const [versions, setVersions] = useState(null);
  const load = () => portfolioRepository.versions(hojaId, user.id).then(setVersions).catch(() => setVersions([]));
  useEffect(() => { load(); }, [hojaId, user.id, epoch > 0 && Math.floor(epoch / 50)]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="wd-history">
      <div className="wd-row">
        <button type="button" className="wd-primary" disabled={!api.canEdit} onClick={() => actions.namedVersion().then(load)}>Crear versión con nombre</button>
        <button type="button" className="ps-quiet" onClick={load}>Actualizar</button>
      </div>
      <p className="wd-muted">Se guarda una versión automática cada 10 minutos de edición.</p>
      {versions === null && <p className="wd-muted">Cargando…</p>}
      {versions?.map((version) => (
        <article key={version.id} className="wd-version">
          <header><b>{version.label || 'Versión automática'}</b><small>{when(version.createdAt)}</small></header>
          <p className="wd-muted">{version.authorName} · {Math.round(version.size / 1024)} KB</p>
          <div className="wd-row">
            <button type="button" className="ps-quiet" onClick={() => actions.previewVersion(version.id, version.label || when(version.createdAt))}>Ver</button>
            {api.canEdit && <button type="button" className="ps-quiet" onClick={() => { if (window.confirm('¿Restaurar esta versión? La actual queda guardada en el historial.')) actions.restoreVersion(version.id).then(load); }}><RotateCcw size={13} /> Restaurar</button>}
          </div>
        </article>
      ))}
    </div>
  );
}

function People({ people, meta, user, colorFor, api }) {
  return (
    <div className="wd-people-panel">
      <h4>Conectados ahora</h4>
      <div className="wd-list-row"><Face person={{ name: user.name || user.username, avatarUrl: user.avatarUrl }} /><span>{user.name || user.username} (tú)</span></div>
      {people.map((person) => (
        <div key={person.id} className="wd-list-row" style={{ '--c': colorFor(person.id) }}>
          <span className="wd-person"><Face person={person} /></span>
          <span className="wd-item-label"><b>{person.name || person.email}</b><small>{person.cursor ? `Página ${person.cursor.page + 1}${person.cursor.text ? ` · “${person.cursor.text.slice(0, 30)}”` : ''}` : 'Viendo el documento'}</small></span>
        </div>
      ))}
      {!people.length && <p className="wd-muted">Nadie más está editando. Los cambios de otras personas se sincronizan cada pocos segundos.</p>}
      {meta?.canManage && <button type="button" className="ps-quiet" onClick={() => api.run('permissions')}>Administrar permisos</button>}
    </div>
  );
}

function References({ doc, api }) {
  return (
    <div className="wd-refs-panel">
      <h4>Fuentes ({doc.sources.length})</h4>
      {doc.sources.map((source) => <p key={source.id} className="wd-muted"><b>{source.title}</b> · {source.author} ({source.year || 's.f.'})</p>)}
      <div className="wd-row">
        <button type="button" className="ps-quiet" onClick={() => api.run('manageSources')}>Administrar</button>
        <button type="button" className="ps-quiet" disabled={!api.canEdit} onClick={() => api.run('citation')}>Insertar cita</button>
      </div>
      <h4>Notas ({doc.notes.length})</h4>
      {doc.notes.map((note) => <button key={note.id} type="button" className="wd-item" onClick={() => api.run('editNote', note.id)}>{note.html.replace(/<[^>]+>/g, '').slice(0, 60)}</button>)}
      <button type="button" className="ps-quiet" onClick={() => api.run('updateToc')}>Actualizar índices y referencias</button>
    </div>
  );
}

function Assistant({ actions, api, user }) {
  const [instruction, setInstruction] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState([]);
  const [question, setQuestion] = useState('');
  const [links, setLinks] = useState(null);
  const run = async (action, options = {}) => {
    setBusy(true);
    try {
      setResult(await actions.aiRun(action, { instruction, ...options }));
    } catch (err) {
      setResult(`<p class="wd-error">${err.message}</p>`);
    } finally {
      setBusy(false);
    }
  };
  const ask = async (event, mode) => {
    event.preventDefault();
    if (!question.trim()) return;
    const q = question;
    setQuestion('');
    setChat((current) => [...current, { who: 'me', html: q }]);
    setBusy(true);
    try {
      if (mode === 'search') {
        const { html, docs } = await actions.aiSearchDocs(q);
        setChat((current) => [...current, { who: 'ai', html, docs }]);
      } else {
        const history = chat.slice(-6).map((item) => `${item.who === 'me' ? 'Pregunta' : 'Respuesta'}: ${item.html.replace(/<[^>]+>/g, ' ')}`).join('\n');
        const html = await actions.aiRun('chat', { scope: 'document', instruction: q, context: history });
        setChat((current) => [...current, { who: 'ai', html }]);
      }
    } catch (err) {
      setChat((current) => [...current, { who: 'ai', html: `<p>${err.message}</p>` }]);
    } finally {
      setBusy(false);
    }
  };
  const groups = [
    ['Escribir', [['generate', 'Generar documento'], ['expand', 'Expandir'], ['shorten', 'Acortar'], ['fix', 'Corregir redacción'], ['clarity', 'Mejorar claridad'], ['tone', 'Cambiar tono'], ['translate', 'Traducir']]],
    ['Analizar', [['summarize', 'Resumir'], ['executive', 'Resumen ejecutivo'], ['explain', 'Explicar'], ['contradictions', 'Contradicciones']]],
    ['Estructurar', [['table', 'Generar tabla'], ['list', 'Generar lista'], ['minutes', 'Generar acta'], ['techdoc', 'Documentación técnica'], ['mermaid', 'Diagrama Mermaid']]],
  ];
  return (
    <div className="wd-ai">
      <textarea className="wd-input" rows={3} value={instruction} placeholder="Instrucción (ej.: tono formal, traducir al inglés, documento sobre el plan de pruebas…)" onChange={(event) => setInstruction(event.target.value)} />
      <p className="wd-muted">Trabaja sobre la selección o, si no hay, sobre todo el documento.</p>
      {groups.map(([label, items]) => (
        <section key={label}>
          <h4>{label}</h4>
          <div className="wd-chip-row">{items.map(([action, text]) => <button key={action} type="button" className="wd-chip" disabled={busy} onClick={() => run(action, action === 'generate' ? { scope: 'document' } : {})}>{text}</button>)}</div>
        </section>
      ))}
      <section>
        <h4>SprintOps</h4>
        <div className="wd-chip-row">
          {[['tasks', 'Extraer tareas'], ['commitments', 'Detectar compromisos'], ['decisions', 'Identificar decisiones'], ['issues', 'Crear issues desde el texto']].map(([kind, text]) => <button key={kind} type="button" className="wd-chip" disabled={busy} onClick={() => actions.aiExtract(kind)}>{text}</button>)}
          <button type="button" className="wd-chip" disabled={busy} onClick={async () => { setBusy(true); try { setLinks(await actions.aiLinkIssues()); } finally { setBusy(false); } }}>Sugerir vínculos con issues</button>
        </div>
        {links && (links.length ? links.map((item) => <div key={item.id} className="wd-list-row"><span className="wd-item-label"><b>#{item.issue.id} {item.issue.title}</b><small>{item.reason}</small></span><button type="button" className="ps-quiet" disabled={!api.canEdit} onClick={() => actions.insertIssueRef(item.issue)}>Insertar</button></div>) : <p className="wd-muted">Sin sugerencias.</p>)}
      </section>
      {busy && <p className="wd-muted">Pensando…</p>}
      {result && (
        <div className="wd-ai-result">
          {/^(graph|flowchart|sequenceDiagram|gantt|classDiagram|stateDiagram|erDiagram|pie|journey|mindmap)/.test(result.trim()) ? <pre>{result}</pre> : <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(/<[a-z]/i.test(result) ? result : `<p>${result}</p>`) }} />}
          <div className="wd-row">
            <button type="button" className="wd-primary" disabled={!api.canEdit} onClick={() => (/^(graph|flowchart|sequenceDiagram|gantt|classDiagram|stateDiagram|erDiagram|pie|journey|mindmap)/.test(result.trim()) ? actions.mermaidFromCode?.(result) : actions.aiInsert(result))}>Insertar</button>
            <button type="button" className="ps-quiet" disabled={!api.canEdit} onClick={() => actions.aiInsert(result, true)}>Reemplazar selección</button>
            <button type="button" className="ps-quiet" onClick={() => navigator.clipboard?.writeText(result.replace(/<[^>]+>/g, ''))}>Copiar</button>
          </div>
        </div>
      )}
      <section className="wd-ai-chat">
        <h4>Chat con el documento</h4>
        <div className="wd-chat-log">
          {chat.map((item, index) => (
            <div key={index} className={`wd-chat is-${item.who}`}>
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.who === 'me' ? `<p>${item.html.replace(/</g, '&lt;')}</p>` : item.html) }} />
              {item.docs?.length > 0 && <small>{item.docs.map((d) => <a key={d.id} href={`/portafolio/${d.id}`}>{d.name}</a>)}</small>}
            </div>
          ))}
        </div>
        <form onSubmit={(event) => ask(event, 'doc')} className="wd-reply">
          <input className="wd-input" value={question} placeholder={`Pregunta sobre el documento, ${user.name || ''}`} onChange={(event) => setQuestion(event.target.value)} />
          <button type="submit" className="wd-btn" aria-label="Preguntar"><Send size={14} /></button>
        </form>
        <button type="button" className="ps-quiet" disabled={!question.trim()} onClick={(event) => ask(event, 'search')}>Buscar la respuesta en todos mis documentos</button>
      </section>
    </div>
  );
}

function Grammar({ grammar, setGrammar, actions }) {
  if (!grammar) return <div className="wd-pad"><p className="wd-muted">Pulsa “Ortografía y gramática” para revisar.</p><button type="button" className="wd-primary" onClick={() => actions.grammar()}>Revisar ahora</button></div>;
  const drop = (index) => setGrammar(grammar.filter((_, i) => i !== index));
  return (
    <div className="wd-grammar">
      <p className="wd-muted">{grammar.length} sugerencias</p>
      {grammar.map((item, index) => (
        <article key={index} className="wd-suggestion">
          <p><del>{item.wrong}</del> → <ins>{item.right}</ins></p>
          {item.reason && <small>{item.reason}</small>}
          <div className="wd-row">
            <button type="button" className="wd-primary" onClick={() => { if (actions.applyFix(item)) drop(index); }}>Aplicar</button>
            <button type="button" className="ps-quiet" onClick={() => drop(index)}>Ignorar</button>
            <button type="button" className="ps-quiet" onClick={() => { actions.addToDictionary(item.wrong); drop(index); }}>Agregar al diccionario</button>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function RightPanel({ tab, setTab, onClose, api, actions, doc, user, meta, people, activeComment, setActiveComment, grammar, setGrammar, epoch, desk, hojaId, colorFor }) {
  return (
    <aside className="wd-side wd-side-right" aria-label="Panel lateral">
      <div className="wd-side-tabs" role="tablist">
        {TABS.map(([id, label, Icon]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} title={label} aria-label={label} onClick={() => setTab(id)}><Icon size={15} /></button>)}
        <div className="wd-status-gap" />
        <button type="button" aria-label="Cerrar panel" onClick={onClose}><X size={15} /></button>
      </div>
      <h3 className="wd-side-title">{TABS.find(([id]) => id === tab)?.[1]}</h3>
      <div className="wd-side-body">
        {tab === 'comments' && <Comments doc={doc} user={user} meta={meta} actions={actions} activeComment={activeComment} setActiveComment={setActiveComment} api={api} />}
        {tab === 'changes' && <Changes desk={desk} epoch={epoch} actions={actions} api={api} />}
        {tab === 'props' && <Properties api={api} doc={doc} meta={meta} />}
        {tab === 'history' && <VersionHistory hojaId={hojaId} user={user} actions={actions} api={api} epoch={epoch} />}
        {tab === 'people' && <People people={people} meta={meta} user={user} colorFor={colorFor} api={api} />}
        {tab === 'refs' && <References doc={doc} api={api} />}
        {tab === 'ai' && <Assistant actions={actions} api={api} user={user} />}
        {tab === 'grammar' && <Grammar grammar={grammar} setGrammar={setGrammar} actions={actions} />}
      </div>
    </aside>
  );
}
