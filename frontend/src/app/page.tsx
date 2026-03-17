import { DashboardLayout } from '@/components/layout';
import { fetchApi } from '@/lib/api';

type DashboardData = {
  onCallToday: Array<{ id: number; colaborador: { nome: string }; cliente?: { nome: string } | null }>;
  workingNow: Array<{ id: number; colaborador: { nome: string }; turno: { nome: string } }>;
  nextShifts: Array<{ id: number; data: string; colaborador: { nome: string }; turno: { nome: string } }>;
  vacations: Array<{ id: number; colaborador: { nome: string }; dataInicio: string; dataFim: string }>;
  holidays: Array<{ id: number; data: string; descricao: string; tipo: string }>;
};

export default async function HomePage() {
  const data = await fetchApi<DashboardData>('/api/dashboard');

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <section className="card">
          <p className="text-sm text-slate-400">Plantonistas hoje</p>
          <p className="mt-2 text-3xl font-semibold text-white">{(data?.onCallToday || []).length}</p>
        </section>
        <section className="card">
          <p className="text-sm text-slate-400">Trabalhando agora</p>
          <p className="mt-2 text-3xl font-semibold text-white">{(data?.workingNow || []).length}</p>
        </section>
        <section className="card">
          <p className="text-sm text-slate-400">Em férias</p>
          <p className="mt-2 text-3xl font-semibold text-white">{(data?.vacations || []).length}</p>
        </section>
        <section className="card">
          <p className="text-sm text-slate-400">Feriados cadastrados</p>
          <p className="mt-2 text-3xl font-semibold text-white">{(data?.holidays || []).length}</p>
        </section>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="card xl:col-span-1">
          <h3 className="mb-3 font-semibold text-white">Plantonistas hoje</h3>
          <div className="space-y-2 text-sm text-slate-300">
            {(data?.onCallToday || []).map((p) => (
              <p key={p.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                {p.colaborador.nome} · {p.cliente?.nome || 'Sem cliente'}
              </p>
            ))}
          </div>
        </section>

        <section className="card xl:col-span-1">
          <h3 className="mb-3 font-semibold text-white">Trabalhando agora</h3>
          <div className="space-y-2 text-sm text-slate-300">
            {(data?.workingNow || []).map((w) => (
              <p key={w.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                {w.colaborador.nome} · {w.turno.nome}
              </p>
            ))}
          </div>
        </section>

        <section className="card xl:col-span-1">
          <h3 className="mb-3 font-semibold text-white">Em férias</h3>
          <div className="space-y-2 text-sm text-slate-300">
            {(data?.vacations || []).map((v) => (
              <p key={v.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                {v.colaborador.nome}
              </p>
            ))}
          </div>
        </section>

        <section className="card xl:col-span-2">
          <h3 className="mb-3 font-semibold text-white">Próximas escalas</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {(data?.nextShifts || []).map((s) => (
              <p key={s.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-sm text-slate-300">
                {new Date(s.data).toLocaleDateString('pt-BR')} · {s.colaborador.nome} ({s.turno.nome})
              </p>
            ))}
          </div>
        </section>

        <section className="card xl:col-span-1">
          <h3 className="mb-3 font-semibold text-white">Feriados</h3>
          <div className="space-y-2 text-sm">
            {(data?.holidays || []).map((h) => (
              <p key={h.id} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-amber-200">
                {new Date(h.data).toLocaleDateString('pt-BR')} · {h.descricao}
              </p>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
