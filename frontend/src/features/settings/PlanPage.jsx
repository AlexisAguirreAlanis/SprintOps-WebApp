import { useMemo } from 'react';
import { ChartColumn, Check, Clock3, Folder, Zap } from 'lucide-react';
import { useAuth } from '../auth/hooks/useAuth';
import { useProjects } from '../project/hooks/useProjects';
import { projectPhase } from '../home/projectModel';

const ROLE_LABEL = {
  developer: 'Developer',
  scrumMaster: 'Scrum Master',
  productOwner: 'Product Owner',
};

const PlanPage = () => {
  const { user } = useAuth();
  const { projects, isLoading, error } = useProjects(user?.id);

  const usage = useMemo(() => {
    const counts = { active: 0, upcoming: 0, completed: 0, archived: 0 };
    let issuesTotal = 0;
    let issuesDone = 0;
    let issuesKnown = false;
    for (const project of projects) {
      const phase = projectPhase(project);
      if (phase in counts) counts[phase] += 1;
      if (Number.isFinite(project.issuesTotal)) {
        issuesKnown = true;
        issuesTotal += project.issuesTotal;
        issuesDone += Number.isFinite(project.issuesDone) ? project.issuesDone : 0;
      }
    }
    return { counts, issuesTotal, issuesDone, issuesKnown };
  }, [projects]);

  const stats = [
    { label: 'Proyectos', value: projects.length, icon: Folder },
    { label: 'En curso', value: usage.counts.active, icon: Zap },
    { label: 'Próximos', value: usage.counts.upcoming, icon: Clock3 },
    { label: 'Completados', value: usage.counts.completed, icon: Check },
  ];

  return (
    <div className="px-5 py-8 sm:px-6 lg:px-10 lg:py-10" style={{ color: 'var(--app-text)' }}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div>
          <h1 className="text-3xl font-black sm:text-4xl">Plan & Uso</h1>
          <p className="mt-1 text-sm font-medium" style={{ color: 'var(--app-muted)' }}>
            Cuenta de {user?.name || 'tu usuario'} y el uso que sale de tus proyectos.
          </p>
        </div>

        <section className="ps-metric min-h-0">
          <span className="ps-metric-icon" aria-hidden="true">
            <ChartColumn size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold" style={{ color: 'var(--app-muted)' }}>Cuenta</span>
            <span className="block truncate text-lg font-black">{user?.email || 'Sin correo'}</span>
            <span className="block text-sm font-semibold" style={{ color: 'var(--app-muted)' }}>
              {ROLE_LABEL[user?.role] || user?.role || 'Sin rol'}
            </span>
          </span>
        </section>

        {error ? (
          <p className="text-sm font-semibold" style={{ color: 'var(--app-muted)' }}>
            No se pudo cargar el uso de tus proyectos.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="ps-metric">
                    <span className="ps-metric-icon" aria-hidden="true">
                      <Icon size={18} />
                    </span>
                    <span>
                      <span className="block text-2xl font-black leading-none">
                        {isLoading ? '—' : stat.value}
                      </span>
                      <span className="mt-1 block text-sm font-semibold" style={{ color: 'var(--app-muted)' }}>
                        {stat.label}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            {usage.issuesKnown && !isLoading && (
              <p className="text-sm font-semibold" style={{ color: 'var(--app-muted)' }}>
                {usage.issuesDone} de {usage.issuesTotal} issues completados en tus proyectos.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PlanPage;
