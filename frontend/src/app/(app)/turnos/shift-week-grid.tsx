import { Badge, type BadgeTone } from '@/components/ui';
import { formatDateShort, weekdayLabel } from '@/lib/format';
import { ShiftActions } from './shift-actions';

export type Turno = {
  id: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  tipo: string;
  status: string;
  observacao?: string | null;
  cliente?: { nome: string } | null;
  equipe?: { nome: string } | null;
  colaborador: { id: number; nome: string; equipe: { nome: string } };
  colaboradorOriginal?: { id: number; nome: string } | null;
};

const STATUS_TONE: Record<string, BadgeTone> = {
  planejado: 'neutral',
  confirmado: 'ok',
  trocado: 'info',
  cancelado: 'danger',
};

const TIPO_TONE: Record<string, BadgeTone> = {
  turno: 'neutral',
  plantao: 'accent',
  sobreaviso: 'warn',
};

/// Grade semanal: uma coluna por dia. Rola na horizontal dentro do card em telas
/// pequenas, para a página nunca rolar de lado.
export function ShiftWeekGrid({
  dias,
  turnos,
  podeEditar = false,
  colaboradores = [],
}: {
  dias: string[];
  turnos: Turno[];
  podeEditar?: boolean;
  colaboradores?: Array<{ id: number; nome: string }>;
}) {
  const hoje = new Date().toISOString().slice(0, 10);

  const porDia = new Map<string, Turno[]>();
  for (const dia of dias) porDia.set(dia, []);
  for (const turno of turnos) {
    const chave = turno.data.slice(0, 10);
    if (!porDia.has(chave)) porDia.set(chave, []);
    porDia.get(chave)!.push(turno);
  }
  for (const lista of porDia.values()) {
    lista.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio) || a.colaborador.nome.localeCompare(b.colaborador.nome));
  }

  return (
    <div className="scroll-x p-3 sm:p-4">
      <div className="grid min-w-[52rem] grid-cols-7 gap-2">
        {dias.map((dia) => {
          const doDia = porDia.get(dia) ?? [];
          const ehHoje = dia === hoje;
          const data = new Date(`${dia}T00:00:00.000Z`);

          return (
            <div key={dia} className="min-w-0">
              <div
                className={`mb-2 rounded-lg px-2 py-1.5 text-center ${
                  ehHoje ? 'bg-accent-soft text-accent' : 'text-ink-muted'
                }`}
              >
                <p className="text-2xs font-medium uppercase tracking-wider">{weekdayLabel(data.getUTCDay(), true)}</p>
                <p className="tabular text-sm font-semibold">{formatDateShort(dia)}</p>
              </div>

              <div className="flex flex-col gap-1.5">
                {doDia.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-line px-2 py-3 text-center text-2xs text-ink-subtle">
                    sem turno
                  </p>
                ) : (
                  doDia.map((turno) => (
                    <article
                      key={turno.id}
                      className={`card-raised p-2 ${turno.status === 'cancelado' ? 'opacity-55' : ''}`}
                    >
                      <p className="tabular text-2xs font-semibold text-ink">
                        {turno.horaInicio}–{turno.horaFim}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink" title={turno.colaborador.nome}>
                        {turno.colaborador.nome}
                      </p>
                      <p className="truncate text-2xs text-ink-subtle" title={turno.cliente?.nome ?? 'Interno'}>
                        {turno.cliente?.nome ?? 'Interno'}
                      </p>

                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {turno.tipo !== 'turno' ? <Badge tone={TIPO_TONE[turno.tipo] ?? 'neutral'}>{turno.tipo}</Badge> : null}
                        {turno.status !== 'planejado' ? (
                          <Badge tone={STATUS_TONE[turno.status] ?? 'neutral'}>{turno.status}</Badge>
                        ) : null}
                      </div>

                      {turno.colaboradorOriginal ? (
                        <p className="mt-1 truncate text-2xs text-info" title={`Originalmente: ${turno.colaboradorOriginal.nome}`}>
                          era {turno.colaboradorOriginal.nome.split(' ')[0]}
                        </p>
                      ) : null}

                      {podeEditar ? (
                        <ShiftActions
                          turnoId={turno.id}
                          colaboradorAtualId={turno.colaborador.id}
                          status={turno.status}
                          colaboradores={colaboradores}
                        />
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
