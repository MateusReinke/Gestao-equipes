import { DashboardLayout } from '@/components/layout';
import { TeamManagementPanel } from '@/components/team-management';

export default function ColaboradoresPage() {
  return (
    <DashboardLayout>
      <h2 className="text-2xl font-semibold">Gestão de colaboradores, equipes e escalas</h2>
      <p className="mt-2 text-sm text-slate-300">
        Cadastre colaboradores com dados essenciais, monte equipes e crie escalas de trabalho em uma única tela.
      </p>
      <div className="mt-4">
        <TeamManagementPanel />
      </div>
    </DashboardLayout>
  );
}
