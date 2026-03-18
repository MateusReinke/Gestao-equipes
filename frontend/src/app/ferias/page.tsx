import { DataStatus } from '@/components/data-status';
import { DashboardLayout } from '@/components/layout';
import { fetchApiSafe } from '@/lib/api';

type Vacation = { id: number; dataInicio: string; dataFim: string; status: string; colaborador: { nome: string; equipe: { nome: string } } };

export default async function FeriasPage() {
  const { data: vacations, error } = await fetchApiSafe<Vacation[]>('/api/ferias', []);
  return (
    <DashboardLayout>
      <DataStatus error={error} />
      <div className="grid gap-4 xl:grid-cols-2">
        {vacations.length ? vacations.map((item) => (
          <section key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-xl font-semibold">{item.colaborador.nome}</h2>
            <p className="mt-1 text-sm text-slate-400">{item.colaborador.equipe.nome}</p>
            <p className="mt-3 text-sm text-white">{new Date(item.dataInicio).toLocaleDateString('pt-BR')} até {new Date(item.dataFim).toLocaleDateString('pt-BR')}</p>
            <span className="mt-3 inline-flex rounded-full bg-rose-500/10 px-3 py-1 text-sm text-rose-200">{item.status}</span>
          </section>
        )) : <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-400">Nenhuma férias disponível no momento.</div>}
      </div>
    </DashboardLayout>
  );
}
