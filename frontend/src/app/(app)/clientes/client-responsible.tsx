'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Select } from '@/components/ui';

type Colaborador = { id: number; nome: string };

export function ClientResponsible({
  clientId,
  currentResponsibleId,
  colaboradores,
}: {
  clientId: number;
  currentResponsibleId: number | null;
  colaboradores: Colaborador[];
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const raw = String(formData.get('responsavelInternoId') || '');

    try {
      const response = await fetch(`/api/clientes/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responsavelInternoId: raw ? Number(raw) : null }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Erro ao definir responsável');
        return;
      }

      setEditando(false);
      router.refresh();
    } catch {
      setError('Não foi possível confirmar a resposta do servidor — a lista foi atualizada, confira a alteração.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (editando) {
    return (
      <form onSubmit={handleSave} className="mt-2 flex flex-wrap items-center gap-2">
        <Select name="responsavelInternoId" defaultValue={currentResponsibleId ?? ''} className="max-w-[16rem] py-1.5 text-xs">
          <option value="">Sem responsável</option>
          {colaboradores.map((colaborador) => (
            <option key={colaborador.id} value={colaborador.id}>
              {colaborador.nome}
            </option>
          ))}
        </Select>
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          {pending ? 'Salvando...' : 'Salvar'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditando(false);
            setError(null);
          }}
        >
          Cancelar
        </Button>
        {error ? <span className="w-full text-2xs text-danger">{error}</span> : null}
      </form>
    );
  }

  return (
    <button type="button" onClick={() => setEditando(true)} className="mt-1.5 text-xs font-medium text-accent hover:underline">
      {currentResponsibleId ? 'Alterar responsável' : 'Definir responsável'}
    </button>
  );
}
