import { useEffect, useState } from 'react';
import { Check, Coins, ShieldCheck, Sparkles } from 'lucide-react';
import BackButton from '../../components/ui/BackButton';
import { useAuth } from '../auth/hooks/useAuth';
import { loadAiSettings, purchaseCredits, updateAiPreferences, updateSharedCredits } from '../sprint/ai/aiConversations';

const MODES = [
  {
    id: 'preguntar',
    title: 'Preguntar siempre',
    hint: 'La IA solicita autorización antes de realizar cualquier modificación.',
  },
  {
    id: 'seguras',
    title: 'Permitir acciones seguras',
    hint: 'Puede ejecutar sola las acciones ya clasificadas como seguras, si además entran en el alcance del proyecto. Reescribir un documento, crear o editar un sprint, mover tareas y borrar siguen pidiendo confirmación.',
  },
  {
    id: 'todo',
    title: 'Permitir todo',
    hint: 'Ejecuta automáticamente las acciones permitidas dentro del alcance configurado en cada proyecto.',
  },
];

const formatDay = (iso) => {
  if (!iso) return '—';
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatWhen = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const Choice = ({ selected, title, hint, onClick, disabled = false }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={selected}
    className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
      selected ? 'border-[#67BFA1] bg-[#67BFA1]/12' : 'border-gray-200 bg-white hover:border-[#67BFA1]/50'
    } ${disabled ? 'cursor-not-allowed opacity-60 hover:border-gray-200' : ''}`}
  >
    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? 'border-[#1f6b52] bg-[#1f6b52] text-white' : 'border-gray-300 text-transparent'}`}>
      <Check size={12} />
    </span>
    <span>
      <span className="block text-sm font-black text-slate-800">{title}</span>
      {hint && <span className="mt-0.5 block text-xs font-medium text-slate-500">{hint}</span>}
    </span>
  </button>
);

const pesos = (price) => `$${Number(price) || 0} MXN`;

const Packs = ({ packs, onBuy }) => {
  const [picked, setPicked] = useState(null);
  const [buying, setBuying] = useState(false);
  const [note, setNote] = useState('');
  return (
    <div className="mt-4">
      <p className="mb-2 text-sm font-black text-slate-800">Recargar créditos</p>
      <p className="mb-2 text-xs font-medium text-slate-500">Preparar una recarga la deja registrada. No se cobra ni se suman créditos hasta definir el proveedor de pagos. Los créditos comprados quedan aparte de los del plan.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {packs.map((pack) => (
          <Choice
            key={pack.credits}
            selected={picked === pack.credits}
            title={pack.price > 0 ? `${pack.credits} créditos — ${pesos(pack.price)}` : `${pack.credits} créditos`}
            hint="Créditos comprados"
            onClick={() => setPicked(pack.credits)}
          />
        ))}
      </div>
      <button
        type="button"
        disabled={!picked || buying}
        onClick={async () => {
          setBuying(true);
          try {
            const message = await onBuy(picked);
            setNote(message || '');
            setPicked(null);
          } catch {
            setNote('');
          } finally {
            setBuying(false);
          }
        }}
        className="mt-2 h-9 rounded-xl bg-[#1f6b52] px-3 text-sm font-black text-white disabled:opacity-50"
      >
        Preparar recarga
      </button>
      {note && <p className="mt-2 text-xs font-semibold text-slate-600">{note}</p>}
    </div>
  );
};

const ManagedPool = ({ project, onSave }) => {
  const [enabled, setEnabled] = useState(project.enabled);
  const [limit, setLimit] = useState(String(project.limit));
  const [add, setAdd] = useState('');
  const [members, setMembers] = useState(project.members);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const extra = Number(add);
      await onSave({
        enabled,
        limit: Number(limit) || 0,
        ...(Number.isFinite(extra) && extra > 0 ? { add: extra, requestId: crypto.randomUUID() } : {}),
        collaborators: members.filter((member) => member.authorized).map((member) => member.id),
      });
      setAdd('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <p className="text-sm font-black text-slate-800">{project.name}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">Saldo compartido: {project.balance}</p>
      <label className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-700">
        <input type="checkbox" className="h-4 w-4 accent-[#1f6b52]" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        Uso compartido activo
      </label>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-500">
          Límite mensual
          <input className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-bold text-slate-800" type="number" min="0" max="100000" value={limit} onChange={(event) => setLimit(event.target.value)} />
        </label>
        <label className="text-xs font-bold text-slate-500">
          Agregar créditos
          <input className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-bold text-slate-800" type="number" min="0" max="100000" value={add} onChange={(event) => setAdd(event.target.value)} />
        </label>
      </div>
      {members.length > 0 && (
        <div className="mt-2 grid gap-1">
          <p className="text-xs font-bold text-slate-500">Colaboradores autorizados</p>
          {members.map((member) => (
            <label key={member.id} className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#1f6b52]"
                checked={member.authorized}
                onChange={(event) => setMembers((current) => current.map((item) => (
                  item.id === member.id ? { ...item, authorized: event.target.checked } : item
                )))}
              />
              {member.name}
            </label>
          ))}
        </div>
      )}
      {project.consumption.length > 0 && (
        <ul className="mt-2 grid gap-1">
          {project.consumption.map((item) => (
            <li key={item.id} className="text-xs font-semibold text-slate-500">
              {item.name}: {item.action} · {item.credits}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs font-medium text-slate-500">Autorizar a alguien no le abre información restringida. Solo puede gastar créditos en lo que ya tiene permiso de ver.</p>
      <button type="button" disabled={saving} onClick={save} className="mt-2 h-8 rounded-lg bg-[#1f6b52] px-3 text-xs font-black text-white disabled:opacity-50">
        Guardar créditos compartidos
      </button>
    </div>
  );
};

const AiSettingsPage = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return undefined;
    let active = true;
    loadAiSettings(user.id)
      .then((next) => {
        if (active) setSettings(next);
      })
      .catch((reason) => {
        if (active) setError(reason.message || 'No se pudieron cargar los ajustes de IA.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const save = async (patch) => {
    setError('');
    try {
      setSettings(await updateAiPreferences(user.id, patch));
    } catch (reason) {
      setError(reason.message || 'No se pudo guardar el ajuste.');
    }
  };

  const preferences = settings?.preferences;
  const credits = settings?.credits;
  const pool = credits?.canUseShared ? preferences?.creditPool : 'personal';

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-[#F0EFED] px-5 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col">
        <div className="mb-3 flex shrink-0 items-center gap-3">
          <BackButton />
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-slate-800">Ajustes de IA</h1>
            <p className="text-sm font-medium text-slate-500">Autorización, respuestas y créditos del asistente.</p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-6">
          {loading && <p className="text-sm font-semibold text-slate-500">Cargando ajustes…</p>}
          {error && <p className="text-sm font-semibold text-[#9a3412]">{error}</p>}
          {preferences && (
            <>
              <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-[#67BFA1]" />
                  <h2 className="text-base font-black text-slate-800">Autorización de acciones</h2>
                </div>
                <div className="grid gap-2">
                  {MODES.map((mode) => (
                    <Choice
                      key={mode.id}
                      selected={preferences.mode === mode.id}
                      title={mode.title}
                      hint={mode.hint}
                      onClick={() => save({ mode: mode.id })}
                    />
                  ))}
                </div>
                {preferences.mode === 'todo' && (
                  <p className="mt-3 rounded-xl bg-[#fff7ed] px-3 py-2 text-xs font-semibold text-[#9a3412]">
                    Algunas acciones de alto riesgo seguirán pidiendo autorización: borrar de forma permanente, cambiar roles, crear o editar un proyecto y cualquier pago. Este modo no amplía tus permisos ni abre información restringida.
                  </p>
                )}
                <p className="mt-3 text-xs font-medium text-slate-500">
                  El alcance de cada proyecto —tareas, sprints, documentos y notas— se elige en el asistente de ese proyecto. La confirmación de acciones es este modo.
                </p>
              </section>

              <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles size={16} className="text-[#67BFA1]" />
                  <h2 className="text-base font-black text-slate-800">Preferencias del asistente</h2>
                </div>
                <div className="grid gap-4">
                  <div>
                    <p className="mb-2 text-sm font-black text-slate-800">Idioma de respuestas</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Choice selected={preferences.language === 'es'} title="Español" hint="El asistente responde en español." onClick={() => save({ language: 'es' })} />
                      <Choice selected={preferences.language === 'en'} title="English" hint="The assistant answers in English." onClick={() => save({ language: 'en' })} />
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-black text-slate-800">Extensión de las respuestas</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Choice selected={preferences.detail === 'breve'} title="Breves" hint="Pocas frases, sin secciones de más." onClick={() => save({ detail: 'breve' })} />
                      <Choice selected={preferences.detail === 'detallada'} title="Detalladas" hint="El detalle necesario, con listas cuando ayudan." onClick={() => save({ detail: 'detallada' })} />
                    </div>
                  </div>
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-3">
                    <span>
                      <span className="block text-sm font-black text-slate-800">Mostrar indicadores de actividad</span>
                      <span className="mt-0.5 block text-xs font-medium text-slate-500">Pensando, consultando tareas, buscando documentos y el resto de estados reales.</span>
                    </span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#1f6b52]"
                      checked={preferences.indicators}
                      onChange={(event) => save({ indicators: event.target.checked })}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-3">
                    <span>
                      <span className="block text-sm font-black text-slate-800">Animaciones de generación</span>
                      <span className="mt-0.5 block text-xs font-medium text-slate-500">El cursor que parpadea mientras llega la respuesta.</span>
                    </span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#1f6b52]"
                      checked={preferences.animations}
                      onChange={(event) => save({ animations: event.target.checked })}
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Coins size={16} className="text-[#67BFA1]" />
                  <h2 className="text-base font-black text-slate-800">Créditos</h2>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 px-3 py-3">
                    <p className="text-xs font-bold text-slate-500">Créditos personales disponibles</p>
                    <p className="mt-1 text-2xl font-black text-slate-800">{credits.personal.remaining}</p>
                    <p className="text-xs font-medium text-slate-500">
                      Del plan: {credits.personal.monthly} de {credits.personal.included} · Comprados: {credits.personal.purchased}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-200 px-3 py-3">
                    <p className="text-xs font-bold text-slate-500">Créditos compartidos disponibles</p>
                    <p className="mt-1 text-2xl font-black text-slate-800">{credits.shared.remaining}</p>
                    <p className="text-xs font-medium text-slate-500">
                      {credits.canUseShared ? `de ${credits.shared.limit} entre tus proyectos` : 'Sin proyectos donde puedas usarlos'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-200 px-3 py-3">
                    <p className="text-xs font-bold text-slate-500">Consumo del mes</p>
                    <p className="mt-1 text-2xl font-black text-slate-800">{credits.monthUsed}</p>
                    <p className="text-xs font-medium text-slate-500">créditos usados este mes</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 px-3 py-3">
                    <p className="text-xs font-bold text-slate-500">Fecha de renovación</p>
                    <p className="mt-1 text-lg font-black text-slate-800">{formatDay(credits.renewal)}</p>
                    <p className="text-xs font-medium text-slate-500">Se renuevan los del plan. Los comprados se quedan.</p>
                  </div>
                </div>
                {credits.shared.projects.length > 0 && (
                  <ul className="mt-3 grid gap-1">
                    {credits.shared.projects.map((project) => (
                      <li key={project.projectId} className="text-xs font-semibold text-slate-500">
                        {project.name}: {project.remaining} de {project.limit}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4">
                  <p className="mb-2 text-sm font-black text-slate-800">Preferencia de uso de créditos</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Choice
                      selected={pool === 'personal'}
                      title="Personales primero"
                      hint="Si se agotan, usa los compartidos del proyecto abierto."
                      onClick={() => save({ creditPool: 'personal' })}
                    />
                    <Choice
                      selected={pool === 'shared'}
                      title="Compartidos primero"
                      disabled={!credits.canUseShared}
                      hint={credits.canUseShared
                        ? 'Si se agotan los del proyecto, usa tus créditos personales.'
                        : 'Disponible cuando el propietario te autoriza.'}
                      onClick={() => save({ creditPool: 'shared' })}
                    />
                  </div>
                  {!credits.canUseShared && (
                    <p className="mt-2 text-xs font-medium text-slate-500">El propietario del proyecto tiene que autorizarte para usar los créditos compartidos.</p>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-sm font-black text-slate-800">Historial de consumo</p>
                  {credits.history.length === 0 ? (
                    <p className="mt-1 text-xs font-medium text-slate-500">Sin consumo este mes.</p>
                  ) : (
                    <ul className="mt-2 grid gap-1">
                      {credits.history.map((item) => (
                        <li key={item.id} className="flex items-baseline justify-between gap-3 text-xs font-semibold text-slate-500">
                          <span>{item.action || (item.pool === 'shared' ? 'Compartidos' : 'Personales')} · {item.credits || 1}</span>
                          <span>{formatWhen(item.at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-sm font-black text-slate-800">Transacciones</p>
                  {(credits.transactions || []).length === 0 ? (
                    <p className="mt-1 text-xs font-medium text-slate-500">Aún no hay recargas.</p>
                  ) : (
                    <ul className="mt-2 grid gap-1">
                      {(credits.transactions || []).map((item) => (
                        <li key={item.id} className="flex items-baseline justify-between gap-3 text-xs font-semibold text-slate-500">
                          <span>{item.credits} créditos · {pesos(item.price)} · {item.statusLabel || item.status}</span>
                          <span>{formatWhen(item.at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-sm font-black text-slate-800">Movimientos de créditos</p>
                  {(credits.movements || []).length === 0 ? (
                    <p className="mt-1 text-xs font-medium text-slate-500">Aún no hay movimientos.</p>
                  ) : (
                    <ul className="mt-2 grid gap-1">
                      {(credits.movements || []).map((item) => (
                        <li key={item.id} className="flex items-baseline justify-between gap-3 text-xs font-semibold text-slate-500">
                          <span>{item.label}{item.detail ? ` · ${item.detail}` : ''} · {item.credits}</span>
                          <span>{formatWhen(item.at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {credits.packs.length > 0 && (
                  <Packs
                    packs={credits.packs}
                    onBuy={async (amount) => {
                      try {
                        setError('');
                        const saved = await purchaseCredits(user.id, amount, null, crypto.randomUUID());
                        setSettings(saved);
                        return saved.transaction?.message || '';
                      } catch (reason) {
                        setError(reason.message || 'No se pudo preparar la recarga.');
                        throw reason;
                      }
                    }}
                  />
                )}
                {credits.managed.length > 0 && (
                  <div className="mt-4 grid gap-3">
                    <p className="text-sm font-black text-slate-800">Créditos compartidos que administras</p>
                    {credits.managed.map((project) => (
                      <ManagedPool
                        key={project.projectId}
                        project={project}
                        onSave={async (patch) => {
                          try {
                            setError('');
                            setSettings(await updateSharedCredits(user.id, project.projectId, patch));
                          } catch (reason) {
                            setError(reason.message || 'No se pudieron guardar los créditos compartidos.');
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiSettingsPage;
