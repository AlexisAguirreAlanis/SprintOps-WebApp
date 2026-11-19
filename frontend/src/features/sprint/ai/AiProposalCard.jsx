import React, { useState } from 'react';

const AiProposalCard = ({ proposal, busy, onAllow, onReject }) => {
  const [open, setOpen] = useState(false);
  const preview = proposal.preview || {};
  const pending = proposal.status === 'pendiente';
  const summary = preview.summary || [];
  const fields = preview.fields || [];
  const diff = preview.diff || [];

  return (
    <article className={`ai-proposal${preview.highRisk ? ' is-risk' : ''}`}>
      <h3>{preview.title || 'Cambios propuestos'}</h3>
      {preview.target && <p className="ai-proposal-target">{preview.target}</p>}
      {preview.warning && <p className="ai-proposal-warn">{preview.warning}</p>}
      {summary.length > 0 && (
        <ul>
          {summary.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}
        </ul>
      )}
      {open && (
        <div className="ai-review">
          {diff.length > 0 && (
            <>
              <p className="ai-diff-legend"><span className="ai-diff-removed">Eliminado</span><span className="ai-diff-added">Agregado</span></p>
              <p className="ai-diff">
                {diff.map((part, index) => (
                  <span key={index} className={`ai-diff-${part.type === 'removed' || part.type === 'added' ? part.type : 'same'}`}>
                    {part.text}{' '}
                  </span>
                ))}
              </p>
            </>
          )}
          {fields.map((field, index) => (
            <div key={`${field.label}-${index}`} className="ai-compare">
              <span>{field.label}</span>
              <span className="is-before">Antes: {field.before}</span>
              <span className="is-after">Después: {field.after}</span>
            </div>
          ))}
        </div>
      )}
      {!pending && <p className="ai-proposal-result">{proposal.status === 'rechazada' ? 'Rechazado' : 'Permitido'}</p>}
      {pending && proposal.result && <p className="ai-proposal-warn">{proposal.result}</p>}
      <div className="ai-proposal-actions">
        {pending && (
          <button type="button" onClick={onReject} disabled={busy}>Rechazar</button>
        )}
        <button type="button" onClick={() => setOpen((value) => !value)}>
          {open ? 'Ocultar cambios' : 'Revisar cambios'}
        </button>
        {pending && (
          <button type="button" className="is-allow" onClick={onAllow} disabled={busy}>Permitir</button>
        )}
      </div>
    </article>
  );
};

export default AiProposalCard;
