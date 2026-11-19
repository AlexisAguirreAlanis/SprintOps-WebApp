import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Check, ChevronDown, Code2, Database, Flag, Layers } from 'lucide-react';

const handleStyle = { opacity: 0, left: '50%', top: '50%', width: 1, height: 1, border: 0 };

export const STATUS = {
  todo: { label: 'Por comenzar', tone: 'idle' },
  in_progress: { label: 'En progreso', tone: 'progress' },
  done: { label: 'Completada', tone: 'done' },
  blocked: { label: 'Bloqueada', tone: 'blocked' },
};

export function normStatus(status) {
  const value = String(status || '').toLowerCase();
  if (['done', 'completed', 'completada', 'completado'].includes(value)) return 'done';
  if (['in_progress', 'in progress', 'progreso', 'en_progreso', 'doing'].includes(value)) return 'in_progress';
  if (['blocked', 'bloqueada', 'bloqueado'].includes(value)) return 'blocked';
  return 'todo';
}

function IssueIcon({ status, id }) {
  if (status === 'done') return <Check size={14} />;
  if (status === 'blocked') return <Flag size={13} />;
  if (status === 'in_progress') return Number(id) % 2 === 0 ? <Code2 size={13} /> : <Layers size={13} />;
  return <Database size={13} />;
}

const IssueNode = ({ data }) => {
  const status = normStatus(data.status);
  const meta = STATUS[status];
  const selected = data.selected ? ' is-selected' : '';
  const dim = data.dimmed ? ' is-dim' : '';

  if (data.depth > 0) {
    return (
      <div className={`iu-card is-sub${selected}${dim}`}>
        <div className="iu-sub-line">
          <b>#{data.code}</b>
          <span>{data.title}</span>
        </div>
        <div className="iu-tip">{data.title} · {meta.label}</div>
        {data.hasChildren && (
          <button
            type="button"
            className="iu-fold"
            aria-label={data.collapsed ? 'Mostrar subissues' : 'Ocultar subissues'}
            onClick={(event) => {
              event.stopPropagation();
              data.onToggle(data.issueId);
            }}
          >
            <ChevronDown size={11} style={{ transform: data.collapsed ? 'none' : 'rotate(180deg)' }} />
          </button>
        )}
        <Handle type="target" position={Position.Left} style={handleStyle} />
        <Handle type="source" position={Position.Right} style={handleStyle} />
      </div>
    );
  }

  return (
    <div className={`iu-card is-${meta.tone}${selected}${dim}`}>
      <div className="iu-card-top">
        <span>#{data.code}</span>
        <span className="iu-bubble"><IssueIcon status={status} id={data.issueId} /></span>
      </div>
      <div className="iu-card-title">{data.title}</div>
      <span className={`iu-status ${meta.tone}`}>{meta.label}</span>
      <div className="iu-tip">{data.title} · {meta.label}</div>
      {data.hasChildren && (
        <button
          type="button"
          className="iu-fold"
          aria-label={data.collapsed ? 'Mostrar subissues' : 'Ocultar subissues'}
          onClick={(event) => {
            event.stopPropagation();
            data.onToggle(data.issueId);
          }}
        >
          <ChevronDown size={11} style={{ transform: data.collapsed ? 'none' : 'rotate(180deg)' }} />
        </button>
      )}
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  );
};

export default memo(IssueNode);
