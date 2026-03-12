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
      <h2 className="mb-6 text-2xl font-semibold">Dashboard de Escalas</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <section className="card">
          <h3 className="mb-2 font-semibold">Plantonistas Hoje</h3>
          {(data?.onCallToday || []).map((p) => (
            <p key={p.id}>{p.colaborador.nome} · {p.cliente?.nome || 'Sem cliente'}</p>
          ))}
        </section>
        <section className="card">
          <h3 className="mb-2 font-semibold">Trabalhando Agora</h3>
          {(data?.workingNow || []).map((w) => (
            <p key={w.id}>{w.colaborador.nome} · {w.turno.nome}</p>
          ))}
        </section>
        <section className="card">
          <h3 className="mb-2 font-semibold">Em Férias</h3>
          {(data?.vacations || []).map((v) => (
            <p key={v.id}>{v.colaborador.nome}</p>
          ))}
        </section>
        <section className="card md:col-span-2 xl:col-span-3">
          <h3 className="mb-2 font-semibold">Próximas Trocas / Calendário</h3>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {(data?.nextShifts || []).map((s) => (
              <p key={s.id}>{new Date(s.data).toLocaleDateString('pt-BR')} - {s.colaborador.nome} ({s.turno.nome})</p>
            ))}
          </div>
          <h4 className="mt-4 font-semibold">Feriados</h4>
          {(data?.holidays || []).map((h) => (
            <p key={h.id} className="text-amber-300">{new Date(h.data).toLocaleDateString('pt-BR')} · {h.descricao} ({h.tipo})</p>
          ))}
        </section>
      </div>
    </DashboardLayout>
  );
}
