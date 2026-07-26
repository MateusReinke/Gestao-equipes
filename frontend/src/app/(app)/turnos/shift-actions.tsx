'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button, Select } from '@/components/ui';

type Colaborador = { id: number; nome: string };

/**
 * Ajuste pontual de um turno já gerado.
 *
 * Existe para o caso que a escala não prevê: alguém não pode assumir e a troca
 * formal não se aplica (não há contrapartida nem tempo para o fluxo de
 * aprovação). Aqui a gestão remaneja direto — e a alteração fica na auditoria.
 *
 * Regerar a escala não desfaz isto: turnos com status diferente de `planejado`
 * são preservados pelo gerador.
 */
export function ShiftActions({
  turnoId,
  colaboradorAtualId,
  status,
  colaboradores,
}: {
  turnoId: number;
  colaboradorAtualId: number;
  status: string;
  colaboradores: Colaborador[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pending, setPending] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(payload: Record<string, unknown>) {
    setPending(true);
    setErro(null);
    try {
      const response = await fetch(`/api/turnos/${turnoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setErro(data.error || 'Não foi possível alterar o turno.');
        return;
      }

      setAberto(false);
      router.refresh();
    } catch {
      setErro('Falha de comunicação.');
    } finally {
      setPending(false);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-1.5 flex w-full items-center justify-center gap-1 rounded border border-line px-1.5 py-1 text-2xs text-ink-subtle transition-colors hover:border-line-strong hover:text-ink"
        title="Ajustar este turno"
      >
        <Pencil size={11} /> ajustar
      </button>
    );
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1.5 border-t border-line pt-1.5">
      <Select
        aria-label="Trocar o colaborador deste turno"
        defaultValue={String(colaboradorAtualId)}
        disabled={pending}
        className="px-1.5 py-1 text-2xs"
        onChange={(event) => {
          const novo = Number(event.target.value);
          if (novo !== colaboradorAtualId) salvar({ colaboradorId: novo });
        }}
      >
        {colaboradores.map((colaborador) => (
          <option key={colaborador.id} value={colaborador.id}>
            {colaborador.nome}
          </option>
        ))}
      </Select>

      <div className="flex gap-1">
        {status === 'cancelado' ? (
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 px-1 py-0.5 text-2xs"
            disabled={pending}
            onClick={() => salvar({ status: 'planejado' })}
          >
            Reativar
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 px-1 py-0.5 text-2xs"
            disabled={pending}
            onClick={() => salvar({ status: 'cancelado' })}
          >
            Cancelar
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="px-1 py-0.5 text-2xs"
          disabled={pending}
          onClick={() => setAberto(false)}
        >
          Fechar
        </Button>
      </div>

      {erro ? <p className="text-2xs text-danger">{erro}</p> : null}
    </div>
  );
}
