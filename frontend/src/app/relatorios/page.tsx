import { DashboardLayout } from '@/components/layout';

export default function RelatoriosPage() {
  return (
    <DashboardLayout>
      <h2 className="text-2xl font-semibold">Relatórios</h2>
      <div className="card mt-4 space-y-2">
        <p>Relatórios disponíveis para exportação CSV/Excel:</p>
        <ul className="list-disc pl-5 text-slate-300">
          <li>Escala por colaborador</li>
          <li>Escala por equipe</li>
          <li>Horas por turno</li>
          <li>Plantões realizados</li>
          <li>Férias por período</li>
        </ul>
      </div>
    </DashboardLayout>
  );
}
