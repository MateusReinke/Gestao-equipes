'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Collaborator = { id: number; nome: string };

export function ClientResponsible({
  clientId,
  currentResponsibleId,
  collaborators,
}: {
  clientId: number;
  currentResponsibleId: number | null;
  collaborators: Collaborator[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
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

      setEditing(false);
      router.refresh();
    } catch {
      setError('Não foi possível confirmar a resposta do servidor — a lista foi atualizada, confira se a alteração já foi aplicada.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="mt-1 flex items-center gap-2">
        <select
          name="responsavelInternoId"
          defaultValue={currentResponsibleId ?? ''}
          className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
        >
          <option value="">Sem responsável</option>
          {collaborators.map((collaborator) => (
            <option key={collaborator.id} value={collaborator.id}>{collaborator.nome}</option>
          ))}
        </select>
        <button type="submit" disabled={pending} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-60">
          Salvar
        </button>
        <button type="button" onClick={() => { setEditing(false); setError(null); }} className="text-xs text-slate-400">
          Cancelar
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </form>
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="mt-1 text-xs text-sky-400 hover:text-sky-300">
      {currentResponsibleId ? 'Alterar responsável' : 'Definir responsável'}
    </button>
  );
}
