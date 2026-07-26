import { Repeat2 } from 'lucide-react';
import { DataStatus } from '@/components/data-status';
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { fetchApiSafe } from '@/lib/api';
import { requirePermissionSession } from '@/lib/session';
import { PERMISSIONS, can } from '@/lib/session-types';
import { RequestSwapPanel } from './request-swap-panel';
import { SwapCard, type Troca } from './swap-card';

type Colaborador = { id: number; nome: string; equipe: { nome: string } };

export default async function TrocasPage() {
  const session = await requirePermissionSession(PERMISSIONS.SHIFT_VIEW);

  const [trocasResult, colaboradoresResult] = await Promise.all([
    fetchApiSafe<Troca[]>('/api/trocas', []),
    fetchApiSafe<Colaborador[]>('/api/colaboradores', []),
  ]);

  const podePedir = can(session.permissoes, PERMISSIONS.SHIFT_REQUEST_SWAP);
  const podeAprovar = can(session.permissoes, PERMISSIONS.SHIFT_APPROVE_SWAP);

  const abertas = trocasResult.data.filter((troca) => troca.status === 'pendente' || troca.status === 'aceito_pelo_par');
  const encerradas = trocasResult.data.filter((troca) => !abertas.includes(troca));

  return (
    <>
      <PageHeader
        title="Trocas de turno"
        description="Quando duas pessoas combinam trocar um dia específico, o pedido passa por aqui: o colega aceita, a gestão aprova, e só então os turnos trocam de dono."
      />

      <DataStatus error={trocasResult.error} />

      {podePedir ? <RequestSwapPanel colaboradores={colaboradoresResult.data} /> : null}

      <Card className="mt-4">
        <CardHeader
          title="Pedidos em aberto"
          description={
            podeAprovar
              ? 'Pedidos das equipes que você gerencia, aguardando resposta'
              : 'Seus pedidos e os que aguardam sua resposta'
          }
        />
        {abertas.length === 0 ? (
          <div className="px-4 py-8 text-center sm:px-5">
            <Repeat2 size={22} className="mx-auto mb-2 text-ink-subtle" />
            <p className="text-sm font-medium text-ink">Nenhum pedido em aberto</p>
            <p className="mt-0.5 text-xs text-ink-muted">Quando alguém solicitar uma troca, ela aparece aqui.</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {abertas.map((troca) => (
              <SwapCard key={troca.id} troca={troca} podeAprovar={podeAprovar} />
            ))}
          </div>
        )}
      </Card>

      {encerradas.length > 0 ? (
        <Card className="mt-4">
          <CardHeader title="Histórico" description="Pedidos já resolvidos" />
          <div className="divide-y divide-line">
            {encerradas.map((troca) => (
              <SwapCard key={troca.id} troca={troca} podeAprovar={false} />
            ))}
          </div>
        </Card>
      ) : null}
    </>
  );
}
