import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button, PageHeader } from '@/components/ui';
import { fetchApi, fetchApiSafe } from '@/lib/api';
import { requirePermissionSession } from '@/lib/session';
import { PERMISSIONS } from '@/lib/session-types';
import type { DashboardLayout } from '@/lib/widgets';
import { DashboardBuilder } from './dashboard-builder';

type DashboardDetalhe = {
  id: number;
  nome: string;
  descricao: string | null;
  podeEditar: boolean;
  layout: DashboardLayout;
};

type Equipe = { id: number; nome: string };

export default async function EditarDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermissionSession(PERMISSIONS.DASHBOARD_EDIT);

  let dashboard: DashboardDetalhe;
  try {
    dashboard = await fetchApi<DashboardDetalhe>(`/api/dashboards/${id}`);
  } catch {
    notFound();
  }

  // A permissão dá direito a editar dashboards em geral; o acesso ao painel
  // específico vem do compartilhamento, e é o backend quem decide.
  if (!dashboard.podeEditar) redirect(`/dashboards/${id}`);

  const { data: equipes } = await fetchApiSafe<Equipe[]>('/api/equipes', []);

  return (
    <>
      <PageHeader
        title={`Editar ${dashboard.nome}`}
        description="Adicione widgets, ajuste as opções de cada um e publique. Cada publicação vira uma versão."
        action={
          <Link href={`/dashboards/${id}`}>
            <Button variant="secondary" size="sm">
              <ArrowLeft size={14} /> Voltar ao painel
            </Button>
          </Link>
        }
      />

      <DashboardBuilder
        dashboardId={dashboard.id}
        nomeInicial={dashboard.nome}
        descricaoInicial={dashboard.descricao}
        layoutInicial={dashboard.layout?.widgets ?? []}
        equipes={equipes.map((equipe) => ({ id: equipe.id, nome: equipe.nome }))}
      />
    </>
  );
}
