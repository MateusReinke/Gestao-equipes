'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Client = { id: number; nome: string };

export function TeamForm({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined> | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setIssues(null);
    setSuccess(false);

    const formData = new FormData(event.currentTarget);
    const clienteIdRaw = String(formData.get('clienteId') || '');
    const payload = {
      nome: String(formData.get('nome') || ''),
      clienteId: clienteIdRaw ? Number(clienteIdRaw) : null,
      ativo: true,
    };

    try {
      const response = await fetch('/api/equipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Erro ao adicionar equipe');
        setIssues(data.issues || null);
        return;
      }

      setSuccess(true);
      event.currentTarget.reset();
      router.refresh();
    } catch {
      setError('Não foi possível confirmar a resposta do servidor — a lista foi atualizada, confira se a equipe já aparece abaixo.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-2">
      <h2 className="col-span-full text-base font-semibold text-white">Adicionar equipe</h2>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400" htmlFor="nome">Nome da equipe</label>
        <input id="nome" name="nome" required minLength={2} placeholder="NOC 24x7" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400" htmlFor="clienteId">Cliente (opcional)</label>
        <select id="clienteId" name="clienteId" defaultValue="" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
          <option value="">Estrutura interna (sem cliente)</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.nome}</option>
          ))}
        </select>
      </div>

      <div className="col-span-full flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {pending ? 'Salvando...' : 'Adicionar equipe'}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">Equipe adicionada com sucesso.</p>}
      </div>
      {issues && (
        <ul className="col-span-full list-inside list-disc text-xs text-red-400">
          {Object.entries(issues).map(([field, messages]) =>
            messages?.map((message) => <li key={`${field}-${message}`}>{message}</li>)
          )}
        </ul>
      )}
    </form>
  );
}
