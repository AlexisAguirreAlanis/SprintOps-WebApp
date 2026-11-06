import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Images, Link2, ListTree, Search, X } from 'lucide-react';
import { clearMatches, findAll, paintMatches, replaceAll, replaceRange, revealRange, buildPattern } from '../engine/find';
import { issueUrl } from '../sprintops';

const TABS = [['nav', 'Encabezados', ListTree], ['pages', 'Páginas', Images], ['search', 'Buscar', Search], ['linked', 'Vinculados', Link2]];

function Thumbnails({ desk, pages, epoch, metrics }) {
  const [html, setHtml] = useState([]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const nodes = [...(desk.current?.querySelectorAll('.wd-page') || [])];
      setHtml(nodes.map((node) => {
        const clone = node.cloneNode(true);
        clone.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
        clone.querySelectorAll('[data-page-body]').forEach((el) => el.removeAttribute('data-page-body'));
        clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
        clone.querySelectorAll('.wd-ink-layer, .wd-collab-tag').forEach((el) => el.remove());
        return clone.outerHTML;
      }));
    }, 500);
    return () => clearTimeout(timer);
  }, [desk, pages.length, epoch]);
  const scale = 150 / metrics.width;
  return (
    <div className="wd-thumbs">
      {html.map((page, index) => (
        <button key={index} type="button" className="wd-thumb" aria-label={`Ir a la página ${index + 1}`} onClick={() => desk.current?.querySelectorAll('.wd-page')[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          <div className="wd-thumb-frame" style={{ width: metrics.width * scale, height: metrics.height * scale }}>
            <div style={{ zoom: scale, pointerEvents: 'none' }} dangerouslySetInnerHTML={{ __html: page }} />
          </div>
          <span>{index + 1}</span>
        </button>
      ))}
    </div>
  );
}

function FindPanel({ desk, find, setFind, epoch }) {
  const rangesRef = useRef([]);
  const [results, setResults] = useState([]);
  const run = (state, step = 0) => {
    const ranges = findAll(desk.current, state);
    rangesRef.current = ranges;
    const index = ranges.length ? ((Math.max(-1, state.index) + step) % ranges.length + ranges.length) % ranges.length : -1;
    paintMatches(ranges, index);
    if (step && ranges[index]) revealRange(ranges[index]);
    setResults(ranges.slice(0, 200).map((range) => {
      const text = range.startContainer.data || '';
      return { before: text.slice(Math.max(0, range.startOffset - 30), range.startOffset), match: range.toString(), after: text.slice(range.startOffset + range.toString().length, range.startOffset + range.toString().length + 30) };
    }));
    setFind((current) => ({ ...current, ...state, results: ranges.length, index }));
  };
  useEffect(() => {
    const timer = setTimeout(() => run({ ...find, index: find.index }), 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [find.query, find.matchCase, find.wholeWord, find.regex, find.format, epoch]);
  useEffect(() => () => clearMatches(), []);
  const set = (patch) => setFind((current) => ({ ...current, ...patch, index: -1 }));
  return (
    <div className="wd-find-panel">
      <form onSubmit={(event) => { event.preventDefault(); run(find, 1); }}>
        <input className="wd-input" autoFocus value={find.query} placeholder="Buscar en el documento" aria-label="Buscar" onChange={(event) => set({ query: event.target.value })} />
        <div className="wd-row">
          <span className="wd-muted">{find.results ? `${find.index + 1 || 0} de ${find.results}` : find.query || find.format ? 'Sin resultados' : ''}</span>
          <div className="wd-status-gap" />
          <button type="button" className="wd-btn" aria-label="Anterior" onClick={() => run(find, -1)}><ChevronUp size={15} /></button>
          <button type="submit" className="wd-btn" aria-label="Siguiente"><ChevronDown size={15} /></button>
        </div>
        <div className="wd-find-options">
          <label><input type="checkbox" checked={find.matchCase} onChange={(event) => set({ matchCase: event.target.checked })} /> Mayúsculas/minúsculas</label>
          <label><input type="checkbox" checked={find.wholeWord} onChange={(event) => set({ wholeWord: event.target.checked })} /> Palabra completa</label>
          <label><input type="checkbox" checked={find.regex} onChange={(event) => set({ regex: event.target.checked })} /> Expresión regular</label>
          <label className="wd-field-inline">Formato
            <select value={find.format} onChange={(event) => set({ format: event.target.value })}>
              <option value="">Cualquiera</option><option value="bold">Negrita</option><option value="italic">Cursiva</option><option value="underline">Subrayado</option>
              <option value="highlight">Resaltado</option><option value="colored">Texto de color</option><option value="heading">En encabezados</option><option value="link">Vínculos</option><option value="comment">Comentado</option>
            </select>
          </label>
        </div>
        <button type="button" className="ps-quiet" onClick={() => setFind((current) => ({ ...current, showReplace: !current.showReplace }))}>{find.showReplace ? 'Ocultar reemplazar' : 'Reemplazar…'}</button>
        {find.showReplace && (
          <div className="wd-replace">
            <input className="wd-input" value={find.replace} placeholder="Reemplazar con" aria-label="Reemplazar con" onChange={(event) => setFind((current) => ({ ...current, replace: event.target.value }))} />
            <div className="wd-row">
              <button type="button" className="ps-quiet" onClick={() => {
                const range = rangesRef.current[find.index];
                if (!range) return run(find, 1);
                replaceRange(range, find.replace, find.regex ? buildPattern(find) : null);
                desk.current.dispatchEvent(new Event('input', { bubbles: true }));
                run({ ...find, index: find.index - 1 }, 1);
                return undefined;
              }}>Reemplazar</button>
              <button type="button" className="wd-primary" onClick={() => {
                const count = replaceAll(desk.current, find, find.replace);
                desk.current.querySelector('[data-page-body]')?.dispatchEvent(new Event('input', { bubbles: true }));
                setFind((current) => ({ ...current, results: 0, index: -1, note: `${count} reemplazos` }));
                run(find);
              }}>Reemplazar todo</button>
            </div>
            {find.note && <small className="wd-muted">{find.note}</small>}
          </div>
        )}
      </form>
      <div className="wd-list">
        {results.map((result, index) => (
          <button key={index} type="button" className={`wd-result${index === find.index ? ' is-active' : ''}`} onClick={() => { const range = rangesRef.current[index]; paintMatches(rangesRef.current, index); revealRange(range); setFind((current) => ({ ...current, index })); }}>
            …{result.before}<mark>{result.match}</mark>{result.after}…
          </button>
        ))}
      </div>
    </div>
  );
}

function Linked({ project, meta, doc, desk, epoch }) {
  const refs = useMemo(() => [...(desk.current?.querySelectorAll('a.wd-ref') || [])].map((el) => ({ kind: el.dataset.ref, id: el.dataset.id, text: el.textContent.trim(), href: el.getAttribute('href') })), [desk, epoch]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!meta?.projectId) return <p className="wd-muted wd-pad">Vincula el documento a un proyecto desde Compartir para ver sus elementos.</p>;
  const issues = project?.issues.filter((issue) => doc.links.issueIds.includes(issue.id)) || [];
  const sprints = project?.sprints.filter((sprint) => doc.links.sprintIds.includes(sprint.id)) || [];
  const people = project?.members.filter((member) => doc.links.userIds.includes(member.userId)) || [];
  const meetings = project?.meetings.filter((meeting) => doc.links.meetingIds.includes(meeting.id)) || [];
  return (
    <div className="wd-linked">
      <a className="wd-item" href={`/project/${meta.projectId}`}><b>Proyecto:</b>&nbsp;{meta.projectName}</a>
      {sprints.length > 0 && <h4>Sprints</h4>}
      {sprints.map((sprint) => <a key={sprint.id} className="wd-item" href={`/sprint/${sprint.id}/planning`}>{sprint.name}</a>)}
      {issues.length > 0 && <h4>Issues</h4>}
      {issues.map((issue) => <a key={issue.id} className="wd-item" href={issueUrl(issue)}>#{issue.id} {issue.title}</a>)}
      {people.length > 0 && <h4>Usuarios</h4>}
      {people.map((member) => <span key={member.userId} className="wd-item">{member.name}</span>)}
      {meetings.length > 0 && <h4>Reuniones</h4>}
      {meetings.map((meeting) => <span key={meeting.id} className="wd-item">{meeting.type} · {meeting.date}</span>)}
      <h4>Referencias en el texto ({refs.length})</h4>
      {refs.map((ref, index) => <a key={index} className="wd-item" href={ref.href}>{ref.text.slice(0, 60)}</a>)}
    </div>
  );
}

export default function LeftPanel({ tab, setTab, onClose, headings, pages, desk, epoch, find, setFind, project, meta, doc, metrics }) {
  return (
    <aside className="wd-side wd-side-left" aria-label="Panel de navegación">
      <div className="wd-side-tabs" role="tablist">
        {TABS.map(([id, label, Icon]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} title={label} aria-label={label} onClick={() => setTab(id)}><Icon size={15} /></button>)}
        <div className="wd-status-gap" />
        <button type="button" aria-label="Cerrar panel" onClick={onClose}><X size={15} /></button>
      </div>
      <div className="wd-side-body">
        {tab === 'nav' && (
          headings.length ? (
            <nav className="wd-outline">
              {headings.map((heading) => (
                <button key={heading.id} type="button" className={`is-l${heading.level}`} onClick={() => desk.current?.querySelector(`#${CSS.escape(heading.id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  <span>{heading.text}</span><small>{heading.page + 1}</small>
                </button>
              ))}
            </nav>
          ) : <p className="wd-muted wd-pad">Usa Encabezado 1, 2 o 3 para construir el índice del documento.</p>
        )}
        {tab === 'pages' && <Thumbnails desk={desk} pages={pages} epoch={epoch} metrics={metrics} />}
        {tab === 'search' && <FindPanel desk={desk} find={find} setFind={setFind} epoch={epoch} />}
        {tab === 'linked' && <Linked project={project} meta={meta} doc={doc} desk={desk} epoch={epoch} />}
      </div>
    </aside>
  );
}
