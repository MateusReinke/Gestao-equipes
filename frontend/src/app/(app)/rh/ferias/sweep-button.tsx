'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BellPlus } from 'lucide-react';
import { Button } from '@/components/ui';

/**
 * Dispara a varredura que transforma alertas em notificações.
 *
 * Existe porque a rotina automática roda uma vez por dia — quem acabou de
 * corrigir uma data de admissão não quer esperar até amanhã para os gestores
 * serem avisados. Rodar aqui é seguro: a varredura é idempotente, então
 * apertar duas vezes não duplica notificação.
 */
export function SweepButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  async function varrer() {
    setPending(true);
    setResultado(null);
    try {
      const response = await fetch('/api/ferias/varredura', { method: 'POST' });
      const dados = await response.json().catch(() => ({}));

      if (!response.ok) {
        setResultado(dados.error || 'Falhou');
        return;
      }

      setResultado(
        dados.notificacoes === 0
          ? 'Nenhum aviso novo — os gestores já foram notificados'
          : `${dados.notificacoes} notificação(ões) enviada(s)`
      );
      router.refresh();
    } catch {
      setResultado('Falha de comunicação');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {resultado ? <span className="text-2xs text-ink-subtle">{resultado}</span> : null}
      <Button variant="secondary" size="sm" onClick={varrer} disabled={pending}>
        <BellPlus size={14} /> {pending ? 'Enviando...' : 'Notificar gestores'}
      </Button>
    </div>
  );
}
