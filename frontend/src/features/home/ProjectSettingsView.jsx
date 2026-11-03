import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ImagePlus, Layers, ListTodo, RotateCcw, Users } from 'lucide-react';
import { useAuth } from '../auth/hooks/useAuth';
import { issuesRepository } from '../../data/repositories/issuesRepository';
import { projectsRepository } from '../../data/repositories/projectsRepository';
import { sprintsRepository } from '../../data/repositories/sprintsRepository';
import Avatar from '../../components/Avatar';
import { formatShortDate, modeLabel } from './projectModel';
import { ProjectCover, StatusBadge } from './projectBits';

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif';

function isImageFile(file) {
  const name = (file.name || '').toLowerCase();
  return (file.type && file.type.startsWith('image/')) || /\.(jpe?g|png|webp|gif|heic|heif)$/.test(name);
}

const ProjectSettingsView = ({ project, userId, onClose, onUpdated }) => {
  const { user } = useAuth();
  const fileRef = useRef(null);
  const previewRef = useRef(null);
  const [host, setHost] = useState(null);
  const [name, setName] = useState(project.name || '');
  const [description, setDescription] = useState(project.description || '');
  const [localCover, setLocalCover] = useState(null);
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const coverKey = `${project.cardCoverCustom}|${project.image}|${project.cardCoverVersion}`;
  const seenCover = useRef(coverKey);

  useEffect(() => {
    setHost(document.querySelector('.app-panel'));
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  useEffect(() => {
    if (seenCover.current === coverKey) return;
    seenCover.current = coverKey;
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setLocalCover(null);
  }, [coverKey]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [sprints, memberList] = await Promise.all([
          sprintsRepository.getByProjectId(project.id),
          projectsRepository.getMembers(project.id).catch(() => []),
        ]);
        const allIssues = (await Promise.all(
          (sprints || []).map((sprint) => issuesRepository.getBySprintId(sprint.id)),
        )).flat();
        if (cancelled) return;
        const role = user?.role || 'developer';
        const relevant = role === 'developer'
          ? allIssues.filter((issue) => issue.assigneeIds?.includes(user?.id))
          : allIssues;
        const total = relevant.length;
        const completed = relevant.filter((issue) => issue.status === 'done').length;
        setMembers(memberList || []);
        setStats({
          sprintCount: (sprints || []).length,
          issuesTotal: allIssues.length,
          progress: total > 0 ? Math.round((completed / total) * 100) : 0,
        });
        setStatsError(false);
      } catch {
        if (cancelled) return;
        setMembers([]);
        setStats({ sprintCount: 0, issuesTotal: 0, progress: 0 });
        setStatsError(true);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [project.id, user?.id, user?.role]);

  const shown = localCover ? { ...project, ...localCover } : project;
  const customCover = Boolean(shown.cardCoverCustom && shown.image);
  const dirty = name.trim() !== (project.name || '') || description.trim() !== (project.description || '').trim();

  const creator = useMemo(() => {
    const id = project.creadorId;
    if (id == null) return null;
    return members.find((member) => Number(member.userId) === Number(id)) || null;
  }, [members, project.creadorId]);

  const rememberPreview = (file) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setLocalCover({ cardCoverCustom: true, image: url });
  };

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!isImageFile(file)) {
      setError('Selecciona una imagen (JPEG, PNG, WebP, GIF o HEIC).');
      return;
    }
    if (!userId) {
      setError('Inicia sesión para cambiar la imagen del proyecto.');
      return;
    }
    setError('');
    setBusy(true);
    rememberPreview(file);
    try {
      await projectsRepository.uploadProjectCardCover(project.id, userId, file);
      onUpdated?.();
    } catch (err) {
      setLocalCover(null);
      setError(err?.message || 'No se pudo subir la imagen');
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!userId) {
      setError('Inicia sesión para restaurar la imagen.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await projectsRepository.deleteProjectCardCover(project.id, userId);
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = null;
      }
      setLocalCover({ cardCoverCustom: false, image: null });
      onUpdated?.();
    } catch (err) {
      setError(err?.message || 'No se pudo restaurar la imagen');
    } finally {
      setBusy(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) {
      setError('Escribe un nombre para el proyecto.');
      return;
    }
    if (nextName.length > 250) {
      setError('El nombre puede tener hasta 250 caracteres.');
      return;
    }
    setError('');
    setSaving(true);
    setSaved(false);
    try {
      await projectsRepository.update(project.id, {
        name: nextName,
        description: description.trim(),
      });
      onUpdated?.();
      setSaved(true);
    } catch (err) {
      setError(err?.message || 'No se pudo guardar el proyecto');
    } finally {
      setSaving(false);
    }
  };

  const metrics = [
    { label: 'Metodología', value: modeLabel(shown), icon: null },
    { label: 'Sprints', value: stats ? stats.sprintCount : '—', icon: Layers },
    { label: 'Issues', value: stats ? stats.issuesTotal : '—', icon: ListTodo },
    { label: 'Equipo', value: stats ? members.length : '—', icon: Users },
  ];

  if (!host) return null;

  return createPortal(
    <div
      className="ps-settings-view"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-settings-title"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex items-center gap-3">
          <button type="button" className="ps-quiet" onClick={onClose}>
            <ArrowLeft size={16} />
            Volver
          </button>
          <h1 id="project-settings-title" className="text-2xl font-black sm:text-3xl">Información del Proyecto</h1>
        </div>

        <div className="ps-settings-cover">
          <ProjectCover project={shown} />
          <StatusBadge project={shown} className="ps-badge--on-media absolute left-4 top-4" />
          <div className="ps-settings-cover-bar">
            <button
              type="button"
              className="ps-settings-cover-btn"
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                fileRef.current?.click();
              }}
            >
              <ImagePlus size={16} />
              {busy ? 'Subiendo…' : 'Subir foto'}
            </button>
            <button type="button" className="ps-settings-cover-btn" disabled={busy || !customCover} onClick={restore}>
              <RotateCcw size={16} />
              Imagen predeterminada
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              onClick={(event) => event.stopPropagation()}
              onChange={upload}
            />
          </div>
        </div>

        <form className="grid gap-4" onSubmit={save}>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted)' }}>Nombre</span>
            <input
              className="ps-settings-input text-lg font-bold"
              value={name}
              maxLength={250}
              onChange={(event) => {
                setName(event.target.value);
                setSaved(false);
              }}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted)' }}>Descripción</span>
            <textarea
              className="ps-settings-input min-h-24 resize-y"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setSaved(false);
              }}
            />
          </label>
          <div className="flex items-center gap-3">
            <button type="submit" className="ps-primary" disabled={!dirty || saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            {saved && !dirty && <span className="text-sm font-semibold" style={{ color: 'var(--app-accent)' }}>Guardado</span>}
          </div>
        </form>

        {error && <p className="text-sm font-semibold text-[#c74634]">{error}</p>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="ps-metric">
                {Icon && (
                  <span className="ps-metric-icon" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted)' }}>{metric.label}</span>
                  <span className="block truncate text-lg font-black">{metric.value}</span>
                </span>
              </div>
            );
          })}
        </div>
        {shown.modo === 'tiempo' && (
          <p className="text-sm font-medium" style={{ color: 'var(--app-muted)' }}>
            {shown.cotizacionHabilitada
              ? 'Incluye métricas de horas y recomendaciones de cotización.'
              : 'Incluye métricas de horas, sin recomendaciones de precio.'}
          </p>
        )}
        {statsError && (
          <p className="text-sm font-semibold" style={{ color: 'var(--app-muted)' }}>
            No se pudieron cargar los sprints, issues y el equipo.
          </p>
        )}

        <section className="grid gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted)' }}>Equipo</h2>
          {members.length === 0 ? (
            <p className="text-sm font-semibold" style={{ color: 'var(--app-muted)' }}>Sin equipo</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {members.map((member) => (
                <li key={member.userId || member.email} className="ps-metric min-h-0">
                  <Avatar name={member.name} avatarUrl={member.avatarUrl} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{member.name || 'Integrante'}</span>
                    <span className="block truncate text-xs font-semibold uppercase" style={{ color: 'var(--app-accent)' }}>
                      {member.role || 'Developer'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {(creator || project.creadorName) && (
            <p className="text-sm" style={{ color: 'var(--app-muted)' }}>
              Creador: <span className="font-bold" style={{ color: 'var(--app-text)' }}>{creator?.name || project.creadorName}</span>
            </p>
          )}
        </section>

        <section className="grid gap-2">
          <div className="flex items-end justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted)' }}>Progreso</h2>
            <span className="text-2xl font-black" style={{ color: 'var(--app-accent)' }}>{stats ? `${stats.progress}%` : '—'}</span>
          </div>
          <div className="ps-progress h-3">
            <span style={{ width: `${stats?.progress || 0}%` }} />
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted)' }}>Fecha inicio</p>
            <p className="mt-1 font-bold">{formatShortDate(project.start) || project.start || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted)' }}>Fecha fin</p>
            <p className="mt-1 font-bold">{formatShortDate(project.end) || project.end || '—'}</p>
          </div>
        </div>
      </div>
    </div>,
    host,
  );
};

export default ProjectSettingsView;
