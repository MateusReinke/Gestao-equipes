import { DashboardLayout } from '@/components/layout';

export default function Page() {
  return (
    <DashboardLayout>
      <h2 className="text-2xl font-semibold capitalize">ferias</h2>
      <div className="card mt-4">
        <p>Tela administrativa de ferias com filtros, busca e paginação (base pronta para integração completa via API).</p>
      </div>
    </DashboardLayout>
  );
}
