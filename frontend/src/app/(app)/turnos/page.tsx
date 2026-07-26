import Link from 'next/link';
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';
import { DataStatus } from '@/components/data-status';
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { fetchApiSafe } from '@/lib/api';
import { requirePermissionSession } from '@/lib/session';
import { PERMISSIONS, can } from '@/lib/session-types';
import { addDays, formatDateShort, toInputDate, weekdayLabel } from '@/lib/format';
import { GenerateShiftsPanel } from './generate-shifts-panel';
import { ShiftWeekGrid, type Turno } from './shift-week-grid';

type Escala = { id: number; nome: string; tipo: string };

/// Segunda-feira da semana que contém a data informada.
function inicioDaSemana(base: Date) {
  const date = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  const diaSemana = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (diaSemana === 0 ? -6 : 1 - diaSemana));
  return date;
}

export default async function TurnosPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const session = await requirePermissionSession(PERMISSIONS.SHIFT_VIEW);
  const params = await searchParams;

  const base = params.semana ? new Date(`${params.semana}T00:00:00.000Z`) : new Date();
  const segunda = inicioDaSemana(Number.isNaN(base.getTime()) ? new Date() : base);
  const domingo = addDays(segunda, 6);

  const [turnosResult, escalasResult] = await Promise.all([
    fetchApiSafe<Turno[]>(`/api/turnos?inicio=${toInputDate(segunda)}&fim=${toInputDate(domingo)}`, []),
    fetchApiSafe<Escala[]>('/api/escalas', []),
  ]);

  const podeGerar = can(session.permissoes, PERMISSIONS.SCHEDULE_GENERATE);
  const podePedirTroca = can(session.permissoes, PERMISSIONS.SHIFT_REQUEST_SWAP);

  const semanaAnterior = toInputDate(addDays(segunda, -7));
  const proximaSemana = toInputDate(addDays(segunda, 7));
  const dias = Array.from({ length: 7 }, (_, index) => addDays(segunda, index));

  return (
    <>
      <PageHeader
        title="Turnos"
        description="Calendário da operação, semana a semana. Turnos marcados como troca mostram quem estava escalado originalmente."
        action={
          podePedirTroca ? (
            <Link href="/trocas" className="text-xs font-medium text-accent hover:underline">
              Ver pedidos de troca
            </Link>
          ) : null
        }
      />

      <DataStatus error={turnosResult.error} />

      {podeGerar ? <GenerateShiftsPanel escalas={escalasResult.data} semanaAtual={toInputDate(segunda)} /> : null}

      <Card className="mt-4">
        <CardHeader
          title={`Semana de ${formatDateShort(segunda)} a ${formatDateShort(domingo)}`}
          description={`${turnosResult.data.length} turno(s) programado(s)`}
          action={
            <div className="flex items-center gap-1">
              <Link
                href={`/turnos?semana=${semanaAnterior}`}
                aria-label="Semana anterior"
                className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
              >
                <ChevronLeft size={16} />
              </Link>
              <Link
                href="/turnos"
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
              >
                Hoje
              </Link>
              <Link
                href={`/turnos?semana=${proximaSemana}`}
                aria-label="Próxima semana"
                className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
              >
                <ChevronRight size={16} />
              </Link>
            </div>
          }
        />

        {turnosResult.data.length === 0 ? (
          <EmptyState
            icon={<CalendarClock size={24} />}
            title="Nenhum turno nesta semana"
            description={
              podeGerar
                ? 'Use o painel acima para gerar os turnos a partir de uma escala já cadastrada.'
                : 'Ainda não há turnos programados para este período.'
            }
          />
        ) : (
          <ShiftWeekGrid dias={dias.map(toInputDate)} turnos={turnosResult.data} />
        )}
      </Card>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-2xs text-ink-subtle">
        <span className="flex items-center gap-1.5">
          <Badge tone="neutral">planejado</Badge> gerado pela escala
        </span>
        <span className="flex items-center gap-1.5">
          <Badge tone="info">trocado</Badge> resultado de uma troca aprovada
        </span>
        <span className="flex items-center gap-1.5">
          <Badge tone="ok">confirmado</Badge> confirmado pelo gestor
        </span>
        <span className="flex items-center gap-1.5">
          <Badge tone="danger">cancelado</Badge> turno cancelado
        </span>
      </div>

      <p className="mt-3 text-2xs text-ink-subtle">
        Dias da semana: {dias.map((dia) => weekdayLabel(dia.getUTCDay(), true)).join(' · ')}
      </p>
    </>
  );
}
