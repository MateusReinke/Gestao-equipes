import { DashboardLayout } from '@/components/layout';
import { TeamManagementPanel } from '@/components/team-management';

export default function EquipesPage() {
  return (
    <DashboardLayout>
      <h2 className="text-2xl font-semibold">Equipes</h2>
      <p className="mt-2 text-sm text-slate-300">Gerencie as equipes operacionais e mantenha a estrutura organizacional atualizada.</p>
      <div className="mt-4">
        <TeamManagementPanel section="equipes" />
      </div>
    </DashboardLayout>
  );
}
