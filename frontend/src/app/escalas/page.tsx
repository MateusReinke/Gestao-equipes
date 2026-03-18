import { DataStatus } from '@/components/data-status';
import { DashboardLayout } from '@/components/layout';
import { fetchApiSafe } from '@/lib/api';

type Scale = { id: number; nome: string; tipo: string; descricao: string; cliente?: { nome: string } | null; detalhes: Array<{ id: number; diaSemana: number; horaInicio: string; horaFim: string }>; colaboradores: Array<{ id: number; colaborador: { nome: string; equipe: { nome: string } } }> };
const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default async function EscalasPage() {
  const { data: scales, error } = await fetchApiSafe<Scale[]>('/api/escalas', []);
  return (
    <DashboardLayout>
      <DataStatus error={error} />
      <div className="space-y-4">
        {scales.length ? scales.map((scale) => (
          <section key={scale.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold">{scale.nome}</h2>
                <p className="text-sm text-slate-400">{scale.tipo} · {scale.cliente?.nome ?? 'Uso interno'}</p>
                <p className="mt-2 text-sm text-slate-300">{scale.descricao}</p>
              </div>
              <div className="text-sm text-slate-300">{scale.colaboradores.map((item) => item.colaborador.nome).join(', ')}</div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {scale.detalhes.map((detail) => (
                <div key={detail.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm">
                  <p className="font-medium text-white">{weekdays[detail.diaSemana]}</p>
                  <p className="text-slate-400">{detail.horaInicio} às {detail.horaFim}</p>
                </div>
              ))}
            </div>
          </section>
        )) : <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-400">Nenhuma escala disponível no momento.</div>}
      </div>
    </DashboardLayout>
  );
}
