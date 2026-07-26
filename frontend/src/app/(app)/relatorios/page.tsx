import { DataStatus } from '@/components/data-status';
import { PageHeader } from '@/components/ui';
import { fetchApiSafe } from '@/lib/api';
import { requirePermissionSession } from '@/lib/session';
import { PERMISSIONS, can } from '@/lib/session-types';
import { ReportWorkbench, type ReportMeta } from './report-workbench';

type Catalogo = {
  relatorios: ReportMeta[];
  periodoPadrao: { inicio: string; fim: string };
};

type Equipe = { id: number; nome: string };

const vazio: Catalogo = { relatorios: [], periodoPadrao: { inicio: '', fim: '' } };

export default async function RelatoriosPage() {
  const session = await requirePermissionSession(PERMISSIONS.REPORT_VIEW);

  const [catalogo, equipes] = await Promise.all([
    fetchApiSafe<Catalogo>('/api/relatorios', vazio),
    fetchApiSafe<Equipe[]>('/api/equipes', []),
  ]);

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Escolha o relatório e o período, confira na tela e exporte em CSV quando estiver certo."
      />

      <DataStatus error={catalogo.error} />

      <ReportWorkbench
        relatorios={catalogo.data.relatorios}
        periodoPadrao={catalogo.data.periodoPadrao}
        equipes={equipes.data.map((equipe) => ({ id: equipe.id, nome: equipe.nome }))}
        podeExportar={can(session.permissoes, PERMISSIONS.REPORT_EXPORT)}
      />
    </>
  );
}
