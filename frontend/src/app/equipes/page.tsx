import { DataStatus } from '@/components/data-status';
import { DashboardLayout } from '@/components/layout';
import { fetchApiSafe } from '@/lib/api';

type Team = { id: number; nome: string; ativo: boolean; cliente?: { nome: string } | null; colaboradores: Array<{ id: number; nome: string }>; gestores: Array<{ gestor: { nome: string; email: string } }> };

export default async function EquipesPage() {
  const { data: teams, error } = await fetchApiSafe<Team[]>('/api/equipes', []);
  return (
    <DashboardLayout>
      <DataStatus error={error} />
      <div className="grid gap-4 xl:grid-cols-3">
        {teams.length ? teams.map((team) => (
          <section key={team.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-xl font-semibold">{team.nome}</h2>
            <p className="mt-2 text-sm text-slate-400">Cliente: {team.cliente?.nome ?? 'Estrutura interna'}</p>
            <p className="mt-1 text-sm text-slate-400">Gestores: {team.gestores.map((item) => item.gestor.nome).join(', ')}</p>
            <div className="mt-4 space-y-2 text-sm">
              {team.colaboradores.map((collaborator) => (
                <div key={collaborator.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">{collaborator.nome}</div>
              ))}
            </div>
          </section>
        )) : <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-400">Nenhuma equipe disponível no momento.</div>}
      </div>
    </DashboardLayout>
  );
}
