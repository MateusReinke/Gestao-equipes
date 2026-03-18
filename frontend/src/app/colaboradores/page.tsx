import { DataStatus } from '@/components/data-status';
import { DashboardLayout } from '@/components/layout';
import { fetchApiSafe } from '@/lib/api';

type Collaborator = { id: number; nome: string; email: string; telefone: string; tipoContrato: string; modeloTrabalho: string; ativo: boolean; equipe: { nome: string }; ferias: Array<{ id: number; status: string; dataInicio: string; dataFim: string }> };

export default async function ColaboradoresPage() {
  const { data: collaborators, error } = await fetchApiSafe<Collaborator[]>('/api/colaboradores', []);
  return (
    <DashboardLayout>
      <DataStatus error={error} />
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-950 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th><th className="px-4 py-3 text-left">Equipe</th><th className="px-4 py-3 text-left">Contrato</th><th className="px-4 py-3 text-left">Modelo</th><th className="px-4 py-3 text-left">Contato</th><th className="px-4 py-3 text-left">Férias</th>
            </tr>
          </thead>
          <tbody>
            {collaborators.length ? collaborators.map((item) => (
              <tr key={item.id} className="border-t border-slate-800 align-top">
                <td className="px-4 py-3"><p className="font-medium text-white">{item.nome}</p><p className="text-slate-400">{item.email}</p></td>
                <td className="px-4 py-3">{item.equipe.nome}</td>
                <td className="px-4 py-3">{item.tipoContrato}</td>
                <td className="px-4 py-3">{item.modeloTrabalho}</td>
                <td className="px-4 py-3">{item.telefone}</td>
                <td className="px-4 py-3">{item.ferias.length ? item.ferias.map((vacation) => `${vacation.status}: ${new Date(vacation.dataInicio).toLocaleDateString('pt-BR')} - ${new Date(vacation.dataFim).toLocaleDateString('pt-BR')}`).join(', ') : 'Sem férias lançadas'}</td>
              </tr>
            )) : <tr><td colSpan={6} className="px-4 py-6 text-slate-400">Nenhum colaborador disponível no momento.</td></tr>}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
