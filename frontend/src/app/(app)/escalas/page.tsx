import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { DataStatus } from '@/components/data-status';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { fetchApiSafe } from '@/lib/api';
import { requirePermissionSession } from '@/lib/session';
import { PERMISSIONS, can } from '@/lib/session-types';
import { ESCALA_DESCRICOES, ESCALA_LABELS, weekdayLabel } from '@/lib/format';
import { ScaleForm } from './scale-form';
import { DeleteButton } from '@/components/delete-button';

type Escala = {
  id: number;
  nome: string;
  tipo: string;
  descricao: string;
  cliente?: { id: number; nome: string } | null;
  detalhes: Array<{ id: number; diaSemana: number; horaInicio: string; horaFim: string }>;
  colaboradores: Array<{ id: number; ordem: number; colaborador: { id: number; nome: string; equipe: { nome: string } } }>;
};

type Colaborador = { id: number; nome: string; equipe: { nome: string } };
type Cliente = { id: number; nome: string };

/// Agrupa as faixas por dia da semana para exibir "Seg 07:00–19:00" em vez de uma linha por registro.
function janelasPorDia(detalhes: Escala['detalhes']) {
  const mapa = new Map<number, string[]>();
  for (const detalhe of detalhes) {
    const lista = mapa.get(detalhe.diaSemana) ?? [];
    lista.push(`${detalhe.horaInicio}–${detalhe.horaFim}`);
    mapa.set(detalhe.diaSemana, lista);
  }
  return [...mapa.entries()].sort(([a], [b]) => a - b);
}

export default async function EscalasPage() {
  const session = await requirePermissionSession(PERMISSIONS.SCHEDULE_VIEW);

  const [escalasResult, colaboradoresResult, clientesResult] = await Promise.all([
    fetchApiSafe<Escala[]>('/api/escalas', []),
    fetchApiSafe<Colaborador[]>('/api/colaboradores', []),
    fetchApiSafe<Cliente[]>('/api/clientes', []),
  ]);

  const podeCriar = can(session.permissoes, PERMISSIONS.SCHEDULE_CREATE);
  const podeRemover = can(session.permissoes, PERMISSIONS.SCHEDULE_DELETE);
  const podeGerar = can(session.permissoes, PERMISSIONS.SCHEDULE_GENERATE);

  return (
    <>
      <PageHeader
        title="Escalas"
        description="A regra que define quem trabalha em quais dias e horários. A partir dela os turnos são gerados no calendário."
        action={
          podeGerar ? (
            <Link href="/turnos" className="text-xs font-medium text-accent hover:underline">
              Gerar turnos
            </Link>
          ) : null
        }
      />

      <DataStatus error={escalasResult.error} />

      {podeCriar ? <ScaleForm colaboradores={colaboradoresResult.data} clientes={clientesResult.data} /> : null}

      {escalasResult.data.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<CalendarDays size={24} />}
            title="Nenhuma escala cadastrada"
            description={
              podeCriar
                ? 'Crie uma escala definindo os horários e quem participa do revezamento.'
                : 'Ainda não há escalas cadastradas nesta empresa.'
            }
          />
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {escalasResult.data.map((escala) => (
            <Card key={escala.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-ink">{escala.nome}</h2>
                  <p className="text-xs text-ink-muted">{escala.cliente?.nome ?? 'Uso interno'}</p>
                </div>
                <Badge tone="accent">{ESCALA_LABELS[escala.tipo] ?? escala.tipo}</Badge>
              </div>

              <p className="mt-2 text-sm text-ink-muted">{escala.descricao}</p>

              <p className="mt-2 rounded-lg bg-surface-raised px-3 py-2 text-2xs text-ink-subtle">
                {ESCALA_DESCRICOES[escala.tipo]}
              </p>

              <div className="mt-4 border-t border-line pt-3">
                <p className="eyebrow mb-2">Horários</p>
                <ul className="flex flex-wrap gap-1.5">
                  {janelasPorDia(escala.detalhes).map(([dia, janelas]) => (
                    <li key={dia}>
                      <Badge>
                        <span className="font-semibold">{weekdayLabel(dia, true)}</span> {janelas.join(' / ')}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 border-t border-line pt-3">
                <p className="eyebrow mb-2">Revezamento ({escala.colaboradores.length})</p>
                {escala.colaboradores.length === 0 ? (
                  <p className="text-xs text-ink-subtle">Nenhum colaborador atribuído — a escala ainda não gera turnos.</p>
                ) : (
                  <ol className="flex flex-col gap-1">
                    {escala.colaboradores.map((atribuicao, index) => (
                      <li key={atribuicao.id} className="flex items-center gap-2 text-sm">
                        <span className="tabular flex h-5 w-5 shrink-0 items-center justify-center rounded bg-surface-hover text-2xs text-ink-subtle">
                          {index + 1}
                        </span>
                        <span className="truncate text-ink">{atribuicao.colaborador.nome}</span>
                        <span className="shrink-0 text-2xs text-ink-subtle">{atribuicao.colaborador.equipe.nome}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {podeRemover ? (
                <div className="mt-3 flex justify-end border-t border-line pt-3">
                  <DeleteButton
                    url={`/api/escalas/${escala.id}`}
                    confirmacao={`Remover a escala ${escala.nome}? Os turnos já gerados continuam.`}
                  />
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
