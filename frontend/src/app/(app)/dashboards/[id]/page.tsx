import Link from 'next/link';
import { notFound } from 'next/navigation';
import { History, LayoutDashboard, Pencil } from 'lucide-react';
import { Button, Card, EmptyState, PageHeader } from '@/components/ui';
import { WidgetCard } from '@/components/widgets/widget-card';
import { fetchApi } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { requirePermissionSession } from '@/lib/session';
import { PERMISSIONS, can } from '@/lib/session-types';
import { WIDTH_CLASSES, type WidgetResult } from '@/lib/widgets';
import { FavoriteButton } from './favorite-button';
import { SharePanel } from './share-panel';

type DashboardDetalhe = {
  id: number;
  nome: string;
  descricao: string | null;
  tenantNome: string | null;
  owner: { id: number; nome: string };
  ehDono: boolean;
  podeEditar: boolean;
  podeGerir: boolean;
  favorito: boolean;
  versaoAtual: { id: number; versao: number; createdAt: string } | null;
  widgets: WidgetResult[];
};

export default async function DashboardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePermissionSession(PERMISSIONS.DASHBOARD_VIEW);

  let dashboard: DashboardDetalhe;
  try {
    dashboard = await fetchApi<DashboardDetalhe>(`/api/dashboards/${id}`);
  } catch {
    // O backend devolve 404 tanto para inexistente quanto para "você não alcança
    // este painel" — de propósito, para não revelar que ele existe.
    notFound();
  }

  const podeEditar = dashboard.podeEditar && can(session.permissoes, PERMISSIONS.DASHBOARD_EDIT);
  const podeCompartilhar = dashboard.podeGerir && can(session.permissoes, PERMISSIONS.DASHBOARD_SHARE);

  return (
    <>
      <PageHeader
        title={dashboard.nome}
        description={
          dashboard.descricao ||
          `Painel de ${dashboard.owner.nome}${dashboard.versaoAtual ? ` · versão ${dashboard.versaoAtual.versao}, publicada em ${formatDateTime(dashboard.versaoAtual.createdAt)}` : ''}`
        }
        action={
          <>
            <FavoriteButton dashboardId={dashboard.id} favorito={dashboard.favorito} />
            {podeEditar ? (
              <>
                <Link href={`/dashboards/${dashboard.id}/versoes`}>
                  <Button variant="secondary" size="sm">
                    <History size={14} /> Versões
                  </Button>
                </Link>
                <Link href={`/dashboards/${dashboard.id}/editar`}>
                  <Button variant="primary" size="sm">
                    <Pencil size={14} /> Editar
                  </Button>
                </Link>
              </>
            ) : null}
          </>
        }
      />

      {dashboard.widgets.length === 0 ? (
        <Card>
          <EmptyState
            icon={<LayoutDashboard size={24} />}
            title="Este painel ainda não tem widgets"
            description={
              podeEditar
                ? 'Abra o editor e escolha o que deve aparecer aqui.'
                : 'Quem administra este painel ainda não montou o conteúdo.'
            }
            action={
              podeEditar ? (
                <Link href={`/dashboards/${dashboard.id}/editar`}>
                  <Button variant="primary" size="sm">
                    <Pencil size={14} /> Montar painel
                  </Button>
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {dashboard.widgets.map((widget) => (
            <WidgetCard key={widget.id} widget={widget} className={WIDTH_CLASSES[widget.largura] ?? WIDTH_CLASSES[2]} />
          ))}
        </div>
      )}

      {podeCompartilhar ? <SharePanel dashboardId={dashboard.id} /> : null}
    </>
  );
}
