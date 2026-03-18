import { DataStatus } from '@/components/data-status';
import { DashboardLayout } from '@/components/layout';
import { fetchApiSafe } from '@/lib/api';

type Manager = { id: number; nome: string; email: string; colaborador?: { nome: string } | null; gestorEquipes: Array<{ equipe: { id: number; nome: string } }> };

export default async function GestoresPage() {
  const { data: managers, error } = await fetchApiSafe<Manager[]>('/api/gestores', []);
  return (
    <DashboardLayout>
      <DataStatus error={error} />
      <div className="grid gap-4 xl:grid-cols-2">
        {managers.length ? managers.map((manager) => (
          <section key={manager.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-xl font-semibold">{manager.nome}</h2>
            <p className="mt-1 text-sm text-slate-400">{manager.email}</p>
            <p className="mt-1 text-sm text-slate-400">Colaborador vinculado: {manager.colaborador?.nome ?? 'Não vinculado'}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {manager.gestorEquipes.map((item) => (
                <span key={item.equipe.id} className="rounded-full bg-sky-500/10 px-3 py-1 text-sm text-sky-200">{item.equipe.nome}</span>
              ))}
            </div>
          </section>
        )) : <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-400">Nenhum gestor disponível no momento.</div>}
      </div>
    </DashboardLayout>
  );
}
