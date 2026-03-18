import { DataStatus } from '@/components/data-status';
import { DashboardLayout } from '@/components/layout';
import { fetchApiSafe } from '@/lib/api';

type DashboardData = {
  metrics: { clients: number; teams: number; collaborators: number; currentOnCall: number; activeVacations: number; activeScales: number };
  currentOnCall: Array<{ id: number; horaInicio: string; horaFim: string; tipo: string; cliente?: { nome: string } | null; colaborador: { nome: string; equipe: { nome: string } } }>;
  upcomingOnCall: Array<{ id: number; data: string; horaInicio: string; horaFim: string; cliente?: { nome: string } | null; colaborador: { nome: string; equipe: { nome: string } } }>;
  vacations: Array<{ id: number; dataInicio: string; dataFim: string; colaborador: { nome: string } }>;
  clients: Array<{ id: number; nome: string; escalation: string; responsavelInterno: { nome: string } }>;
};

const metricLabels = [
  ['Clientes ativos', 'clients'],
  ['Equipes ativas', 'teams'],
  ['Colaboradores', 'collaborators'],
  ['Plantonistas agora', 'currentOnCall'],
  ['Em férias', 'activeVacations'],
  ['Escalas configuradas', 'activeScales'],
] as const;

const emptyDashboard: DashboardData = {
  metrics: { clients: 0, teams: 0, collaborators: 0, currentOnCall: 0, activeVacations: 0, activeScales: 0 },
  currentOnCall: [],
  upcomingOnCall: [],
  vacations: [],
  clients: [],
};

export default async function HomePage() {
  const { data, error } = await fetchApiSafe<DashboardData>('/api/dashboard', emptyDashboard);

  return (
    <DashboardLayout>
      <DataStatus error={error} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {metricLabels.map(([label, key]) => (
          <section key={key} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{data.metrics[key]}</p>
          </section>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 xl:col-span-1">
          <h2 className="text-lg font-semibold">Plantonistas atuais</h2>
          <div className="mt-4 space-y-3 text-sm">
            {data.currentOnCall.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="font-medium text-white">{item.colaborador.nome}</p>
                <p className="text-slate-400">{item.colaborador.equipe.nome} · {item.cliente?.nome ?? 'Sem cliente'}</p>
                <p className="text-sky-300">{item.horaInicio} às {item.horaFim} · {item.tipo}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 xl:col-span-1">
          <h2 className="text-lg font-semibold">Próximos plantões</h2>
          <div className="mt-4 space-y-3 text-sm">
            {data.upcomingOnCall.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="font-medium text-white">{item.colaborador.nome}</p>
                <p className="text-slate-400">{new Date(item.data).toLocaleDateString('pt-BR')} · {item.colaborador.equipe.nome}</p>
                <p className="text-emerald-300">{item.horaInicio} às {item.horaFim} · {item.cliente?.nome ?? 'Cobertura interna'}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 xl:col-span-1">
          <h2 className="text-lg font-semibold">Clientes monitorados</h2>
          <div className="mt-4 space-y-3 text-sm">
            {data.clients.map((client) => (
              <div key={client.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="font-medium text-white">{client.nome}</p>
                <p className="text-slate-400">Escalation: {client.escalation}</p>
                <p className="text-amber-300">Responsável interno: {client.responsavelInterno.nome}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Férias ativas</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.vacations.map((item) => (
            <div key={item.id} className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-100">
              <p className="font-medium">{item.colaborador.nome}</p>
              <p>{new Date(item.dataInicio).toLocaleDateString('pt-BR')} até {new Date(item.dataFim).toLocaleDateString('pt-BR')}</p>
            </div>
          ))}
        </div>
      </section>
    </DashboardLayout>
  );
}
