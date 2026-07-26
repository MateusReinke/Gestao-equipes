'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, X } from 'lucide-react';
import { Badge, Button, type BadgeTone } from '@/components/ui';
import { SWAP_STATUS_LABELS, formatDate, formatDateTime, weekdayName } from '@/lib/format';

export type Troca = {
  id: number;
  tipo: 'troca' | 'cobertura';
  status: string;
  motivo: string;
  observacaoResposta?: string | null;
  respondidoEm?: string | null;
  respondidoPor?: { nome: string } | null;
  createdAt: string;
  solicitante: { id: number; nome: string };
  destinatario: { id: number; nome: string };
  turnoOrigem: { id: number; data: string; horaInicio: string; horaFim: string };
  turnoDestino?: { id: number; data: string; horaInicio: string; horaFim: string } | null;
};

const STATUS_TONE: Record<string, BadgeTone> = {
  pendente: 'warn',
  aceito_pelo_par: 'info',
  aprovado: 'ok',
  rejeitado: 'danger',
  cancelado: 'neutral',
};

export function SwapCard({ troca, podeAprovar }: { troca: Troca; podeAprovar: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function acao(caminho: string) {
    setPending(caminho);
    setError(null);
    try {
      const response = await fetch(`/api/trocas/${troca.id}/${caminho}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Não foi possível concluir a ação');
        return;
      }
      router.refresh();
    } catch {
      setError('Não foi possível confirmar a resposta do servidor. Atualize a página para conferir.');
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  const emAberto = troca.status === 'pendente' || troca.status === 'aceito_pelo_par';

  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[troca.status] ?? 'neutral'}>{SWAP_STATUS_LABELS[troca.status] ?? troca.status}</Badge>
            <Badge tone={troca.tipo === 'cobertura' ? 'accent' : 'neutral'}>
              {troca.tipo === 'cobertura' ? 'Cobertura' : 'Troca mútua'}
            </Badge>
          </div>

          {/* O que está sendo trocado, em linguagem de operação */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <div className="rounded-lg border border-line bg-surface-raised px-2.5 py-1.5">
              <p className="text-xs font-medium text-ink">{troca.solicitante.nome}</p>
              <p className="tabular text-2xs text-ink-muted">
                {weekdayName(troca.turnoOrigem.data, true)} {formatDate(troca.turnoOrigem.data)} ·{' '}
                {troca.turnoOrigem.horaInicio}–{troca.turnoOrigem.horaFim}
              </p>
            </div>

            <ArrowRight size={16} className="text-ink-subtle" />

            <div className="rounded-lg border border-line bg-surface-raised px-2.5 py-1.5">
              <p className="text-xs font-medium text-ink">{troca.destinatario.nome}</p>
              {troca.turnoDestino ? (
                <p className="tabular text-2xs text-ink-muted">
                  {weekdayName(troca.turnoDestino.data, true)} {formatDate(troca.turnoDestino.data)} ·{' '}
                  {troca.turnoDestino.horaInicio}–{troca.turnoDestino.horaFim}
                </p>
              ) : (
                <p className="text-2xs text-ink-muted">assume o turno, sem contrapartida</p>
              )}
            </div>
          </div>

          <p className="mt-3 text-xs text-ink-muted">
            <span className="text-ink-subtle">Motivo:</span> {troca.motivo}
          </p>

          {troca.respondidoEm ? (
            <p className="mt-1.5 text-2xs text-ink-subtle">
              Respondido por {troca.respondidoPor?.nome ?? 'sistema'} em {formatDateTime(troca.respondidoEm)}
              {troca.observacaoResposta ? ` — "${troca.observacaoResposta}"` : ''}
            </p>
          ) : null}
        </div>

        {emAberto ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {troca.status === 'pendente' ? (
              <Button size="sm" variant="secondary" disabled={pending !== null} onClick={() => acao('aceitar')}>
                <Check size={14} /> Aceitar
              </Button>
            ) : null}
            {podeAprovar ? (
              <Button size="sm" variant="success" disabled={pending !== null} onClick={() => acao('aprovar')}>
                <Check size={14} /> {pending === 'aprovar' ? 'Aprovando...' : 'Aprovar'}
              </Button>
            ) : null}
            <Button size="sm" variant="danger" disabled={pending !== null} onClick={() => acao('rejeitar')}>
              <X size={14} /> Recusar
            </Button>
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
