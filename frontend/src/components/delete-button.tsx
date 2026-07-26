'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, TriangleAlert } from 'lucide-react';
import { Alert, Button } from '@/components/ui';

/**
 * Botão de exclusão com confirmação no lugar.
 *
 * Sem modal: o clique troca o próprio botão por "Confirmar / Cancelar". Um
 * diálogo por cima teria que ser posicionado, receber foco e devolver — e para
 * uma decisão de uma linha isso é mais cerimônia do que ajuda.
 *
 * Quando o backend recusa (409, porque há histórico), a mensagem dele aparece
 * inteira: é ela que diz o que segura e qual é a saída.
 */
export function DeleteButton({
  url,
  rotulo = 'Remover',
  confirmacao,
  onRemovido,
}: {
  url: string;
  rotulo?: string;
  /** frase curta que aparece na confirmação, ex.: 'Remover a equipe NOC?' */
  confirmacao: string;
  onRemovido?: () => void;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [pending, setPending] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function remover() {
    setPending(true);
    setErro(null);
    try {
      const response = await fetch(url, { method: 'DELETE' });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setErro(data.error || 'Não foi possível remover.');
        setConfirmando(false);
        return;
      }

      setConfirmando(false);
      onRemovido?.();
      router.refresh();
    } catch {
      setErro('Falha de comunicação. Recarregue a página para conferir se a remoção foi feita.');
      setConfirmando(false);
    } finally {
      setPending(false);
    }
  }

  if (erro) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <Alert tone="warn">
          <span className="flex items-start gap-2">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            <span>{erro}</span>
          </span>
        </Alert>
        <Button variant="ghost" size="sm" onClick={() => setErro(null)}>
          Entendi
        </Button>
      </div>
    );
  }

  if (confirmando) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-xs text-ink-muted">{confirmacao}</span>
        <Button variant="danger" size="sm" onClick={remover} disabled={pending}>
          {pending ? 'Removendo...' : 'Confirmar'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirmando(false)} disabled={pending}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <Button variant="ghost" size="sm" onClick={() => setConfirmando(true)} title={rotulo}>
      <Trash2 size={14} /> {rotulo}
    </Button>
  );
}
