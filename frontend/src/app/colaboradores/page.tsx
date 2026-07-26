import { DataStatus } from '@/components/data-status';
import { DashboardLayout } from '@/components/layout';
import { fetchApi, getCurrentUser } from '@/lib/api';
import { ROUTE_ROLES } from '@/lib/permissions';
import { CollaboratorForm } from './collaborator-form';

type Collaborator = { id: number; nome: string; email: string; telefone: string; cargo: string; tipoContrato: string; modeloTrabalho: string; fazPlantao: boolean; sobreAviso: boolean; ativo: boolean; equipe: { nome: string }; ferias: Array<{ id: number; status: string; dataInicio: string; dataFim: string }> };
type Team = { id: number; nome: string };

export default async function ColaboradoresPage() {
  const allow = ROUTE_ROLES['/colaboradores'];
  const user = await getCurrentUser();
  if (!user || !allow.includes(user.role)) {
    return <DashboardLayout allow={allow}>{null}</DashboardLayout>;
  }

  const [collaborators, teams] = await Promise.all([
    fetchApi<Collaborator[]>('/api/colaboradores'),
    fetchApi<Team[]>('/api/equipes'),
  ]);

  return (
    <DashboardLayout allow={allow}>
      <div className="flex flex-col gap-6">
        <CollaboratorForm teams={teams} />

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th><th className="px-4 py-3 text-left">Cargo</th><th className="px-4 py-3 text-left">Equipe</th><th className="px-4 py-3 text-left">Contrato</th><th className="px-4 py-3 text-left">Modelo</th><th className="px-4 py-3 text-left">Contato</th><th className="px-4 py-3 text-left">Escala</th><th className="px-4 py-3 text-left">Férias</th>
              </tr>
            </thead>
            <tbody>
              {collaborators.map((item) => (
                <tr key={item.id} className="border-t border-slate-800 align-top">
                  <td className="px-4 py-3"><p className="font-medium text-white">{item.nome}</p><p className="text-slate-400">{item.email}</p></td>
                  <td className="px-4 py-3">{item.cargo}</td>
                  <td className="px-4 py-3">{item.equipe.nome}</td>
                  <td className="px-4 py-3">{item.tipoContrato}</td>
                  <td className="px-4 py-3">{item.modeloTrabalho}</td>
                  <td className="px-4 py-3">{item.telefone}</td>
                  <td className="px-4 py-3">
                    {item.fazPlantao && <span className="mr-2 rounded bg-emerald-900 px-2 py-0.5 text-xs text-emerald-300">Plantão</span>}
                    {item.sobreAviso && <span className="rounded bg-amber-900 px-2 py-0.5 text-xs text-amber-300">Sobreaviso</span>}
                    {!item.fazPlantao && !item.sobreAviso && <span className="text-slate-500">-</span>}
                  </td>
                  <td className="px-4 py-3">{item.ferias.length ? item.ferias.map((vacation) => `${vacation.status}: ${new Date(vacation.dataInicio).toLocaleDateString('pt-BR')} - ${new Date(vacation.dataFim).toLocaleDateString('pt-BR')}`).join(', ') : 'Sem férias lançadas'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
