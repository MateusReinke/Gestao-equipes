import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, History } from 'lucide-react';
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { fetchApi, fetchApiSafe } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { requirePermissionSession } from '@/lib/session';
import { PERMISSIONS, can } from '@/lib/session-types';
import { RestoreButton } from './restore-button';

type Versao = {
  id: number;
  versao: number;
  nota: string | null;
  createdAt: string;
  atual: boolean;
  criadoPor: { id: number; nome: string } | null;
};

type DashboardDetalhe = { id: number; nome: string; podeEditar: boolean };

export default async function VersoesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePermissionSession(PERMISSIONS.DASHBOARD_VIEW);

  let dashboard: DashboardDetalhe;
  try {
    dashboard = await fetchApi<DashboardDetalhe>(`/api/dashboards/${id}`);
  } catch {
    notFound();
  }

  const { data: versoes, error } = await fetchApiSafe<Versao[]>(`/api/dashboards/${id}/versoes`, []);
  const podeRestaurar = dashboard.podeEditar && can(session.permissoes, PERMISSIONS.DASHBOARD_EDIT);

  return (
    <>
      <PageHeader
        title={`Versões de ${dashboard.nome}`}
        description="Cada publicação vira uma versão. Restaurar não apaga nada: republica o layout escolhido como uma versão nova."
        action={
          <Link href={`/dashboards/${id}`}>
            <Button variant="secondary" size="sm">
              <ArrowLeft size={14} /> Voltar ao painel
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader title="Histórico" description={error ?? `${versoes.length} versão(ões) registrada(s)`} />
        {versoes.length === 0 ? (
          <EmptyState icon={<History size={24} />} title="Nenhuma versão registrada" />
        ) : (
          <div className="divide-y divide-line">
            {versoes.map((versao) => (
              <div key={versao.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-ink">
                    Versão {versao.versao}
                    {versao.atual ? <Badge tone="ok">em uso</Badge> : null}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {versao.nota || 'Sem nota'}
                    {versao.criadoPor ? ` · ${versao.criadoPor.nome}` : ''} · {formatDateTime(versao.createdAt)}
                  </p>
                </div>
                {podeRestaurar && !versao.atual ? (
                  <RestoreButton dashboardId={dashboard.id} versionId={versao.id} versao={versao.versao} />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
