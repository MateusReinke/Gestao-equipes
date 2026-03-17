import { DashboardLayout } from '@/components/layout';
import { ClientManagementPanel } from '@/components/client-management';

export default function Page() {
  return (
    <DashboardLayout>
      <h2 className="text-2xl font-semibold">Clientes</h2>
      <p className="mt-2 text-sm text-slate-300">
        Controle os clientes, o tipo de atendimento (remoto/presencial/híbrido) e os colaboradores responsáveis.
      </p>
      <div className="mt-4">
        <ClientManagementPanel />
      </div>
    </DashboardLayout>
  );
}
