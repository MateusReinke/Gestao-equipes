'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { Badge, Button, type BadgeTone } from '@/components/ui';
import { AUSENCIA_LABELS, formatDate, formatDateTime } from '@/lib/format';

export type Ferias = {
  id: number;
  dataInicio: string;
  dataFim: string;
  status: string;
  observacao?: string | null;
  respondidoEm?: string | null;
  respondidoPor?: { nome: string } | null;
  colaborador: { id: number; nome: string; equipe: { nome: string } };
};

export type Ausencia = {
  id: number;
  tipo: string;
  dataInicio: string;
  dataFim: string;
  motivo?: string | null;
  status: string;
  respondidoEm?: string | null;
  respondidoPor?: { nome: string } | null;
  colaborador: { id: number; nome: string; equipe: { nome: string } };
};

const STATUS_TONE: Record<string, BadgeTone> = {
  pendente: 'warn',
  aprovado: 'ok',
  rejeitado: 'danger',
  cancelado: 'neutral',
};

function diasEntre(inicio: string, fim: string) {
  const dias = Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 86_400_000) + 1;
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

function useResponder(endpoint: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function responder(body: Record<string, unknown>) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Não foi possível registrar a resposta');
        return;
      }
      router.refresh();
    } catch {
      setError('Não foi possível confirmar a resposta do servidor. Atualize a página para conferir.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return { responder, pending, error };
}

export function VacationRow({ ferias, podeAprovar }: { ferias: Ferias; podeAprovar: boolean }) {
  const { responder, pending, error } = useResponder(`/api/ferias/${ferias.id}`);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-ink">{ferias.colaborador.nome}</p>
          <Badge tone={STATUS_TONE[ferias.status] ?? 'neutral'}>{ferias.status}</Badge>
        </div>
        <p className="tabular mt-0.5 text-xs text-ink-muted">
          {formatDate(ferias.dataInicio)} até {formatDate(ferias.dataFim)} · {diasEntre(ferias.dataInicio, ferias.dataFim)} ·{' '}
          {ferias.colaborador.equipe.nome}
        </p>
        {ferias.observacao ? <p className="mt-1 text-xs text-ink-subtle">{ferias.observacao}</p> : null}
        {ferias.respondidoEm ? (
          <p className="mt-1 text-2xs text-ink-subtle">
            Respondido por {ferias.respondidoPor?.nome ?? 'sistema'} em {formatDateTime(ferias.respondidoEm)}
          </p>
        ) : null}
        {error ? <p className="mt-1 text-2xs text-danger">{error}</p> : null}
      </div>

      {podeAprovar && ferias.status === 'pendente' ? (
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="success" disabled={pending} onClick={() => responder({ status: 'aprovado' })}>
            <Check size={14} /> Aprovar
          </Button>
          <Button size="sm" variant="danger" disabled={pending} onClick={() => responder({ status: 'rejeitado' })}>
            <X size={14} /> Rejeitar
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function AbsenceRow({ ausencia, podeGerir }: { ausencia: Ausencia; podeGerir: boolean }) {
  const { responder, pending, error } = useResponder(`/api/ausencias/${ausencia.id}`);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-ink">{ausencia.colaborador.nome}</p>
          <Badge tone="info">{AUSENCIA_LABELS[ausencia.tipo] ?? ausencia.tipo}</Badge>
          <Badge tone={STATUS_TONE[ausencia.status] ?? 'neutral'}>{ausencia.status}</Badge>
        </div>
        <p className="tabular mt-0.5 text-xs text-ink-muted">
          {formatDate(ausencia.dataInicio)} até {formatDate(ausencia.dataFim)} · {diasEntre(ausencia.dataInicio, ausencia.dataFim)} ·{' '}
          {ausencia.colaborador.equipe.nome}
        </p>
        {ausencia.motivo ? <p className="mt-1 text-xs text-ink-subtle">{ausencia.motivo}</p> : null}
        {ausencia.respondidoEm ? (
          <p className="mt-1 text-2xs text-ink-subtle">
            Respondido por {ausencia.respondidoPor?.nome ?? 'sistema'} em {formatDateTime(ausencia.respondidoEm)}
          </p>
        ) : null}
        {error ? <p className="mt-1 text-2xs text-danger">{error}</p> : null}
      </div>

      {podeGerir && ausencia.status === 'pendente' ? (
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="success" disabled={pending} onClick={() => responder({ status: 'aprovado' })}>
            <Check size={14} /> Aprovar
          </Button>
          <Button size="sm" variant="danger" disabled={pending} onClick={() => responder({ status: 'rejeitado' })}>
            <X size={14} /> Rejeitar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
