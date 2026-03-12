import { DashboardLayout } from '@/components/layout';

export default function Page() {
  return (
    <DashboardLayout>
      <h2 className="text-2xl font-semibold capitalize">colaboradores</h2>
      <div className="card mt-4">
        <p>Tela administrativa de colaboradores com filtros, busca e paginação (base pronta para integração completa via API).</p>
      </div>
    </DashboardLayout>
  );
}
