import { BarChart3 } from 'lucide-react';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui';
import { requireTenantSession } from '@/lib/session';

const RELATORIOS_PLANEJADOS = [
  { nome: 'Escala por colaborador', descricao: 'Turnos de cada pessoa em um período, com trocas destacadas.' },
  { nome: 'Escala por equipe', descricao: 'Cobertura consolidada por time, dia a dia.' },
  { nome: 'Horas por turno', descricao: 'Total de horas planejadas versus realizadas.' },
  { nome: 'Trocas de turno', descricao: 'Histórico de pedidos, aprovações e recusas.' },
  { nome: 'Férias e ausências por período', descricao: 'Indisponibilidades agregadas por equipe.' },
];

export default async function RelatoriosPage() {
  await requireTenantSession();

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Exportações operacionais para acompanhamento e prestação de contas."
      />

      <Card>
        <CardHeader
          title="Em construção"
          description="Os dados já são registrados; a exportação entra numa próxima fase."
        />
        <CardBody>
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-info/30 bg-info-soft p-3 text-sm text-info">
            <BarChart3 size={18} className="mt-0.5 shrink-0" />
            <p>
              Turnos, trocas, férias e ausências já ficam registrados no banco com histórico completo — a exportação em
              CSV/Excel é a próxima etapa, sem necessidade de mudar o modelo de dados.
            </p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {RELATORIOS_PLANEJADOS.map((relatorio) => (
              <li key={relatorio.nome} className="rounded-lg border border-line bg-surface-raised p-3">
                <p className="text-sm font-medium text-ink">{relatorio.nome}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{relatorio.descricao}</p>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </>
  );
}
