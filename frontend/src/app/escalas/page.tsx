import { DashboardLayout } from '@/components/layout';
import { TeamManagementPanel } from '@/components/team-management';

export default function EscalasPage() {
  return (
    <DashboardLayout>
      <h2 className="text-2xl font-semibold">Escalas</h2>
      <p className="mt-2 text-sm text-slate-300">Monte a escala por colaborador e acompanhe os lançamentos em ordem cronológica.</p>
      <div className="mt-4">
        <TeamManagementPanel section="escalas" />
      </div>
    </DashboardLayout>
  );
}
