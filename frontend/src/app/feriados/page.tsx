import { DashboardLayout } from '@/components/layout';

export default function Page() {
  return (
    <DashboardLayout>
      <h2 className="text-2xl font-semibold capitalize">feriados</h2>
      <div className="card mt-4">
        <p>Tela administrativa de feriados com filtros, busca e paginação (base pronta para integração completa via API).</p>
      </div>
    </DashboardLayout>
  );
}
