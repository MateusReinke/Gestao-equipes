import Link from 'next/link';
import { LayoutDashboard, Share2, Star, Users } from 'lucide-react';
import { DataStatus } from '@/components/data-status';
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { fetchApiSafe } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { requirePermissionSession } from '@/lib/session';
import { PERMISSIONS, can } from '@/lib/session-types';
import { SHARE_ACCESS_LABELS } from '@/lib/widgets';
import { CreateDashboardForm } from './create-dashboard-form';

type DashboardResumo = {
  id: number;
  nome: string;
  descricao: string | null;
  owner: { id: number; nome: string };
  versaoAtual: { id: number; versao: number; createdAt: string } | null;
  tenant?: { id: number; nome: string } | null;
  acesso?: string;
  _count: { versoes: number };
};

type Lista = {
  meus: DashboardResumo[];
  compartilhados: DashboardResumo[];
  favoritosIds: number[];
};

const vazio: Lista = { meus: [], compartilhados: [], favoritosIds: [] };

function DashboardRow({ dashboard, favorito }: { dashboard: DashboardResumo; favorito: boolean }) {
  return (
    <Link
      href={`/dashboards/${dashboard.id}`}
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-hover/50 sm:px-5"
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
          {favorito ? <Star size={13} className="shrink-0 fill-warn text-warn" /> : null}
          {dashboard.nome}
        </p>
        <p className="truncate text-xs text-ink-muted">
          {dashboard.descricao || `Por ${dashboard.owner.nome}`}
          {dashboard.versaoAtual ? ` · v${dashboard.versaoAtual.versao} de ${formatDateTime(dashboard.versaoAtual.createdAt)}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {dashboard.tenant ? <Badge tone="neutral">{dashboard.tenant.nome}</Badge> : null}
        {dashboard.acesso ? (
          <Badge tone={dashboard.acesso === 'leitura' ? 'neutral' : 'accent'}>
            {SHARE_ACCESS_LABELS[dashboard.acesso] ?? dashboard.acesso}
          </Badge>
        ) : null}
      </div>
    </Link>
  );
}

export default async function DashboardsPage() {
  const session = await requirePermissionSession(PERMISSIONS.DASHBOARD_VIEW);
  const { data, error } = await fetchApiSafe<Lista>('/api/dashboards', vazio);

  const podeCriar = can(session.permissoes, PERMISSIONS.DASHBOARD_CREATE);
  const favoritos = new Set(data.favoritosIds);

  return (
    <>
      <PageHeader
        title="Dashboards"
        description="Monte painéis com os widgets que importam para a sua operação e compartilhe com quem precisa acompanhar."
      />

      <DataStatus error={error} />

      {podeCriar ? <CreateDashboardForm /> : null}

      <Card className="mt-4">
        <CardHeader
          title="Meus dashboards"
          description={data.meus.length === 0 ? 'Você ainda não criou nenhum' : `${data.meus.length} painel(éis)`}
        />
        {data.meus.length === 0 ? (
          <EmptyState
            icon={<LayoutDashboard size={24} />}
            title="Nenhum dashboard criado"
            description={
              podeCriar
                ? 'Crie um painel e escolha os widgets que a sua equipe precisa ver todos os dias.'
                : 'Peça a alguém da gestão para compartilhar um painel com você.'
            }
          />
        ) : (
          <div className="divide-y divide-line">
            {data.meus.map((dashboard) => (
              <DashboardRow key={dashboard.id} dashboard={dashboard} favorito={favoritos.has(dashboard.id)} />
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Compartilhados comigo"
          description="Painéis que chegaram até você por pessoa, equipe, papel ou empresa"
          action={<Share2 size={15} className="text-ink-subtle" />}
        />
        {data.compartilhados.length === 0 ? (
          <div className="px-4 py-8 text-center sm:px-5">
            <Users size={22} className="mx-auto mb-2 text-ink-subtle" />
            <p className="text-sm font-medium text-ink">Nada compartilhado com você ainda</p>
            <p className="mt-0.5 text-xs text-ink-muted">Painéis compartilhados com você aparecem aqui automaticamente.</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {data.compartilhados.map((dashboard) => (
              <DashboardRow key={dashboard.id} dashboard={dashboard} favorito={favoritos.has(dashboard.id)} />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
