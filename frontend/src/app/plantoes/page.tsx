import { DashboardLayout } from '@/components/layout';
import { fetchApi, getCurrentUser } from '@/lib/api';
import { ROUTE_ROLES } from '@/lib/permissions';

type OnCall = { id: number; data: string; horaInicio: string; horaFim: string; tipo: string; cliente?: { nome: string } | null; colaborador: { nome: string; equipe: { nome: string } } };

export default async function PlantoesPage() {
  const allow = ROUTE_ROLES['/plantoes'];
  const user = await getCurrentUser();
  if (!user || !allow.includes(user.role)) {
    return <DashboardLayout allow={allow}>{null}</DashboardLayout>;
  }

  const onCalls = await fetchApi<OnCall[]>('/api/plantoes');
  return (
    <DashboardLayout allow={allow}>
      <div className="grid gap-4 xl:grid-cols-3">
        {onCalls.map((item) => (
          <section key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm uppercase tracking-[0.16em] text-slate-500">{new Date(item.data).toLocaleDateString('pt-BR')}</p>
            <h2 className="mt-2 text-xl font-semibold">{item.colaborador.nome}</h2>
            <p className="text-sm text-slate-400">{item.colaborador.equipe.nome} · {item.cliente?.nome ?? 'Cobertura interna'}</p>
            <p className="mt-3 text-sky-300">{item.horaInicio} às {item.horaFim}</p>
            <span className="mt-3 inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-sm text-amber-200">{item.tipo}</span>
          </section>
        ))}
      </div>
    </DashboardLayout>
  );
}
