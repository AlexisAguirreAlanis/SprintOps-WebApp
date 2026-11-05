import { useEffect, useRef, useState } from 'react';
import { Share2, X } from 'lucide-react';
import { portfolioRepository } from '../../data/repositories/portfolioRepository';
import { useProjects } from '../project/hooks/useProjects';
import { useDismiss } from '../home/useDismiss';

export function Face({ person }) {
  const letter = (person.name || person.email || '?').trim().slice(0, 1).toUpperCase() || '?';
  if (person.avatarUrl) return <img className="pf-face" src={person.avatarUrl} alt="" />;
  return <span className="pf-face">{letter}</span>;
}

const SheetShare = ({ hojaId, user, meta, onMeta, paused = false }) => {
  const { projects } = useProjects(user?.id);
  const shareRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState(null);
  const [email, setEmail] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [note, setNote] = useState('');

  useDismiss(open, () => setOpen(false), shareRef);

  useEffect(() => {
    if (paused) setOpen(false);
  }, [paused]);

  const openShare = async () => {
    setOpen(true);
    setNote('');
    if (!meta?.canManage || !user?.id) return;
    try {
      setAccess(await portfolioRepository.access(hojaId, user.id));
    } catch (err) {
      setNote(err.message || 'No se pudo abrir el acceso.');
    }
  };

  const changeAccess = async (patch) => {
    try {
      const next = await portfolioRepository.updateAccess(hojaId, { userId: user.id, ...patch });
      setAccess(next);
      setNote('');
      if (patch.visibility) onMeta?.((current) => current && ({ ...current, visibility: patch.visibility }));
    } catch (err) {
      setNote(err.message || 'No se pudo actualizar el acceso.');
    }
  };

  const linkProject = async (projectId) => {
    const updated = await portfolioRepository.update(hojaId, { userId: user.id, projectId });
    onMeta?.(updated);
    setAccess(await portfolioRepository.access(hojaId, user.id));
  };

  return (
    <div className="pf-share-wrap" ref={shareRef}>
      <button type="button" className="pf-share" aria-expanded={open} onClick={() => (open ? setOpen(false) : openShare())}>
        <Share2 size={15} /> Compartir
      </button>
      <SharePanel
        open={open}
        meta={meta}
        access={access}
        projects={projects}
        email={email}
        memberQuery={memberQuery}
        note={note}
        hojaId={hojaId}
        onEmail={setEmail}
        onMemberQuery={setMemberQuery}
        onClose={() => setOpen(false)}
        onChange={changeAccess}
        onLinkProject={linkProject}
        onNote={setNote}
      />
    </div>
  );
};

function SharePanel({
  open, meta, access, projects, email, memberQuery, note, hojaId,
  onEmail, onMemberQuery, onChange, onLinkProject, onNote, onClose,
}) {
  const members = (access?.projectMembers || []).filter((person) => {
    const query = memberQuery.trim().toLowerCase();
    if (!query) return true;
    return `${person.name} ${person.email}`.toLowerCase().includes(query);
  });
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/portafolio/${hojaId}`);
      onNote('Enlace copiado.');
    } catch {
      onNote('No se pudo copiar el enlace.');
    }
  };
  const visibility = access?.visibility || meta?.visibility;
  return (
    <div className={`pf-pop pf-share-pop${open ? ' is-open' : ''}`} role="dialog" aria-label="Compartir hoja">
      <div className="pf-share-head">
        <strong>Compartir</strong>
        <button type="button" className="pf-icon-btn" aria-label="Cerrar compartir" onClick={onClose}><X size={14} /></button>
      </div>
      <div className="pf-share-scroll">
        <button type="button" className="ps-quiet" onClick={copyLink}>Copiar enlace</button>
        {!meta?.canManage ? (
          <p className="pf-kicker">Solo quien creó la hoja puede cambiar quién entra.</p>
        ) : (
          <>
            <section className="pf-share-block" style={{ '--i': 0 }}>
              <h3>Quién puede verla</h3>
              <div className="pf-segment" role="radiogroup" aria-label="Visibilidad">
                <button type="button" className={visibility !== 'enlace' ? 'is-active' : ''} onClick={() => onChange({ visibility: 'privada' })}>Privada</button>
                <button type="button" className={visibility === 'enlace' ? 'is-active' : ''} onClick={() => onChange({ visibility: 'enlace' })}>Con el enlace</button>
              </div>
              <p className="pf-kicker">{visibility === 'enlace' ? 'Cualquier persona con sesión y el enlace puede verla. Editar sigue siendo de invitados y del equipo elegido.' : 'Solo tú, las personas invitadas y el equipo que elijas.'}</p>
            </section>
            <section className="pf-share-block" style={{ '--i': 1 }}>
              <h3>Invitar</h3>
              <form onSubmit={(event) => { event.preventDefault(); if (!email.trim()) return; onChange({ addEmail: email.trim() }); onEmail(''); }}>
                <label>Correo
                  <span className="pf-invite">
                    <input value={email} placeholder="correo@equipo.com" onChange={(event) => onEmail(event.target.value)} />
                    <button type="submit" className="ps-quiet">Invitar</button>
                  </span>
                </label>
              </form>
              {(access?.invites || []).map((person, index) => (
                <div key={person.id} className="pf-person" style={{ '--i': index }}>
                  <Face person={person} />
                  <span className="min-w-0 flex-1 truncate">{person.name || person.email}</span>
                  <button type="button" className="pf-icon-btn" aria-label={`Quitar a ${person.name || person.email}`} onClick={() => onChange({ removeUserId: person.id })}><X size={14} /></button>
                </div>
              ))}
            </section>
            <section className="pf-share-block" style={{ '--i': 2 }}>
              <h3>Proyecto</h3>
              <label>Vinculado
                <select value={meta?.projectId || ''} onChange={(event) => onLinkProject(event.target.value ? Number(event.target.value) : null)}>
                  <option value="">Sin proyecto</option>
                  {(projects || []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </label>
              {access?.projectId ? (
                <>
                  <button type="button" className={`ps-quiet${!access.filterTeam ? ' is-active' : ''}`} onClick={() => onChange({ filterTeam: false })}>Todo el equipo</button>
                  <input value={memberQuery} placeholder="Filtrar personas del proyecto" aria-label="Filtrar personas del proyecto" onChange={(event) => onMemberQuery(event.target.value)} />
                  {members.map((person) => (
                    <label key={person.id} className="pf-check">
                      <input
                        type="checkbox"
                        checked={access.filterTeam ? Boolean(person.included) : true}
                        onChange={(event) => {
                          const ids = (access.projectMembers || [])
                            .filter((item) => (item.id === person.id ? event.target.checked : (access.filterTeam ? item.included : true)))
                            .map((item) => item.id);
                          onChange({ filterTeam: true, teamUserIds: ids });
                        }}
                      />
                      <span>{person.name || person.email}</span>
                    </label>
                  ))}
                  {members.length === 0 && <p className="pf-kicker">Nadie del proyecto coincide con el filtro.</p>}
                </>
              ) : <p className="pf-kicker">Vincula un proyecto para elegir a quién del equipo le compartes la hoja.</p>}
            </section>
          </>
        )}
        {note && <p className="pf-kicker">{note}</p>}
      </div>
    </div>
  );
}

export default SheetShare;
