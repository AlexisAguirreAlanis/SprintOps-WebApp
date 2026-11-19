import React from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

function summaryLine(kind, verb, count) {
  if (kind === 'sprint') return 'Se modificó la planificación del sprint.';
  if (kind === 'documento' && verb === 'crear') {
    return count === 1 ? 'Se creó 1 documento.' : `Se crearon ${count} documentos.`;
  }
  if (kind === 'documento') {
    return count === 1 ? 'Se actualizó 1 documento.' : `Se actualizaron ${count} documentos.`;
  }
  if (kind === 'nota' && verb === 'crear') {
    return count === 1 ? 'Se creó 1 nota.' : `Se crearon ${count} notas.`;
  }
  if (kind === 'nota') {
    return count === 1 ? 'Se actualizó 1 nota.' : `Se actualizaron ${count} notas.`;
  }
  if (verb === 'crear') {
    return count === 1 ? 'Se creó 1 tarea.' : `Se crearon ${count} tareas.`;
  }
  return count === 1 ? 'Se actualizó 1 tarea.' : `Se actualizaron ${count} tareas.`;
}

function RunCard({ action, busy, busyUndo, locked, onRetry, onUndo }) {
  const done = action.phase === 'done';
  const undone = action.phase === 'undone';
  return (
    <article className={`ai-run is-${action.phase}`}>
      <h3>
        {(done || undone) && <Check size={15} aria-hidden="true" />}
        {action.headline}
      </h3>
      <p><span>Proyecto</span>{action.project}</p>
      {action.subject && <p><span>{action.subjectLabel}</span>{action.subject}</p>}
      <p><span>Estado</span>{action.status}</p>
      {action.error && <p className="ai-run-error">{action.error}</p>}
      {done && action.href && <Link to={action.href}>{action.linkLabel}</Link>}
      {done && action.undo && (
        <button type="button" disabled={busyUndo || locked} onClick={() => onUndo(action)}>
          {busyUndo ? 'Recuperando…' : 'Deshacer'}
        </button>
      )}
      {action.phase === 'failed' && action.retryId && (
        <button type="button" disabled={busy || locked} onClick={() => onRetry(action)}>
          {busy ? 'Reintentando…' : 'Reintentar'}
        </button>
      )}
    </article>
  );
}

function PlanCard({ action, busy, locked, onExecute }) {
  const ready = action.phase === 'plan' && action.steps.length > 0;
  return (
    <article className={`ai-run is-${action.phase === 'plan' ? 'plan' : 'done'}`}>
      <h3>
        {action.phase !== 'plan' && <Check size={15} aria-hidden="true" />}
        {action.headline}
      </h3>
      {action.goal && <p><span>Objetivo</span>{action.goal}</p>}
      {action.steps.length > 0 && (
        <ol>
          {action.steps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}
        </ol>
      )}
      <p><span>Estado</span>{action.status}</p>
      {ready && (
        <button type="button" disabled={busy || locked} onClick={() => onExecute(action)}>
          {busy ? 'Ejecutando…' : 'Ejecutar plan'}
        </button>
      )}
    </article>
  );
}

export default function AiRunCards({ actions, busyId, busyUndo, busyPlan, locked, onRetry, onUndo, onExecute }) {
  const list = Array.isArray(actions) ? actions : [];
  const plans = list.filter((action) => action.kind === 'plan');
  const undone = list.filter((action) => action.phase === 'undone');
  const runs = list.filter((action) => action.kind !== 'plan' && action.phase !== 'undone');
  if (plans.length + undone.length + runs.length === 0) return null;
  const running = runs.some((action) => action.phase === 'running');
  const reversible = runs.some((action) => action.undo && action.phase === 'done');
  const done = runs.filter((action) => action.phase === 'done');
  const failed = runs.filter((action) => action.phase === 'failed');
  const cards = (
    <>
      {plans.map((action) => (
        <PlanCard key={action.id} action={action} busy={busyPlan} locked={locked} onExecute={onExecute} />
      ))}
      {undone.map((action) => (
        <RunCard key={action.id} action={action} busy={busyId === action.id} busyUndo={busyUndo === action.id} locked={locked} onRetry={onRetry} onUndo={onUndo} />
      ))}
    </>
  );
  if (running || reversible || done.length + failed.length < 2) {
    return (
      <>
        {cards}
        {runs.map((action) => (
          <RunCard key={action.id} action={action} busy={busyId === action.id} busyUndo={busyUndo === action.id} locked={locked} onRetry={onRetry} onUndo={onUndo} />
        ))}
      </>
    );
  }
  const groups = new Map();
  done.forEach((action) => {
    const key = action.kind === 'sprint' ? 'sprint' : `${action.kind}:${action.verb}`;
    const current = groups.get(key) || { kind: action.kind, verb: action.verb, count: 0, links: [] };
    current.count += 1;
    if (action.href) current.links.push(action);
    groups.set(key, current);
  });
  return (
    <>
      {cards}
      {done.length > 0 && (
        <article className="ai-run is-done">
          <h3>
            <Check size={15} aria-hidden="true" />
            {done.length === 1 ? 'Se completó 1 acción' : `Se completaron ${done.length} acciones`}
          </h3>
          <ul>
            {[...groups.values()].map((group) => (
              <li key={`${group.kind}-${group.verb}`}>
                <Check size={13} aria-hidden="true" />
                {summaryLine(group.kind, group.verb, group.count)}
              </li>
            ))}
          </ul>
          {done.filter((action) => action.href).map((action) => (
            <Link key={action.id} to={action.href}>
              {action.subject ? `${action.linkLabel}: ${action.subject}` : action.linkLabel}
            </Link>
          ))}
        </article>
      )}
      {failed.map((action) => (
        <RunCard key={action.id} action={action} busy={busyId === action.id} busyUndo={false} locked={locked} onRetry={onRetry} onUndo={onUndo} />
      ))}
    </>
  );
}
