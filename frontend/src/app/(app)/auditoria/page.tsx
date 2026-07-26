import { ScrollText } from 'lucide-react';
import { DataStatus } from '@/components/data-status';
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th, Tr, type BadgeTone } from '@/components/ui';
import { fetchApiSafe } from '@/lib/api';
import { requirePermissionSession } from '@/lib/session';
import { PERMISSIONS } from '@/lib/session-types';
import { formatDateTime } from '@/lib/format';

type Registro = {
  id: number;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  descricao: string | null;
  ip: string | null;
  createdAt: string;
  actorNome: string;
  actor: { id: number; nome: string; email: string } | null;
};

type Resposta = { registros: Registro[]; proximoCursor: number | null };

const ACAO_TONE: Record<string, BadgeTone> = {
  create: 'ok',
  update: 'info',
  delete: 'danger',
  login: 'neutral',
  login_failed: 'warn',
  permission_change: 'accent',
  swap_request: 'warn',
  swap_response: 'info',
};

const ACAO_LABELS: Record<string, string> = {
  create: 'criou',
  update: 'editou',
  delete: 'removeu',
  login: 'entrou',
  login_failed: 'login falhou',
  permission_change: 'alterou permissão',
  swap_request: 'pediu troca',
  swap_response: 'respondeu troca',
};

export default async function AuditoriaPage() {
  await requirePermissionSession(PERMISSIONS.AUDIT_VIEW);

  const { data, error } = await fetchApiSafe<Resposta>('/api/auditoria?take=100', { registros: [], proximoCursor: null });

  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Trilha do que foi feito nesta empresa: quem fez, o quê, quando e de onde."
      />

      <DataStatus error={error} />

      <Card>
        <CardHeader title="Registros recentes" description={`Últimos ${data.registros.length} eventos`} />

        {data.registros.length === 0 ? (
          <EmptyState
            icon={<ScrollText size={24} />}
            title="Nenhum registro ainda"
            description="Cadastros, edições, trocas de turno e mudanças de permissão passam a aparecer aqui."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Quando</Th>
                <Th>Quem</Th>
                <Th>Ação</Th>
                <Th>O quê</Th>
                <Th>Origem</Th>
              </tr>
            </thead>
            <tbody>
              {data.registros.map((registro) => (
                <Tr key={registro.id}>
                  <Td className="tabular whitespace-nowrap text-2xs">{formatDateTime(registro.createdAt)}</Td>
                  <Td>
                    <p className="text-ink">{registro.actor?.nome ?? registro.actorNome}</p>
                    {registro.actor ? <p className="text-2xs text-ink-subtle">{registro.actor.email}</p> : null}
                  </Td>
                  <Td>
                    <Badge tone={ACAO_TONE[registro.acao] ?? 'neutral'}>{ACAO_LABELS[registro.acao] ?? registro.acao}</Badge>
                  </Td>
                  <Td>
                    <p className="text-ink">{registro.descricao ?? registro.entidade}</p>
                    <p className="text-2xs text-ink-subtle">
                      {registro.entidade}
                      {registro.entidadeId ? ` #${registro.entidadeId}` : ''}
                    </p>
                  </Td>
                  <Td className="tabular text-2xs">{registro.ip ?? '—'}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
