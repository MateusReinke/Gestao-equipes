import { DashboardLayout } from '@/components/layout';
import { TeamManagementPanel } from '@/components/team-management';

export default function ColaboradoresPage() {
  return (
    <DashboardLayout>
      <h2 className="text-2xl font-semibold">Colaboradores</h2>
      <p className="mt-2 text-sm text-slate-300">Cadastre e atualize os colaboradores com vínculo de equipe, gestores e clientes atendidos.</p>
      <div className="mt-4">
        <TeamManagementPanel section="colaboradores" />
      </div>
    </DashboardLayout>
  );
}
