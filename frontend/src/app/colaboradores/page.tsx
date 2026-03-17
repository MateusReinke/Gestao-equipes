import { DashboardLayout } from '@/components/layout';
import { TeamManagementPanel } from '@/components/team-management';

export default function ColaboradoresPage() {
  return (
    <DashboardLayout>
      <h2 className="text-2xl font-semibold">Gestão operacional</h2>
      <p className="mt-2 text-sm text-slate-300">
        Cadastre, edite e exclua equipes, colaboradores e escalas com dados integrados à tela de clientes.
      </p>
      <div className="mt-4">
        <TeamManagementPanel />
      </div>
    </DashboardLayout>
  );
}
