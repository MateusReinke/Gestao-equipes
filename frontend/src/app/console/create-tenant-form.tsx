'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function CreateTenantForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined> | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setIssues(null);

    const formData = new FormData(event.currentTarget);
    const payload = { nome: String(formData.get('nome') || ''), slug: String(formData.get('slug') || '') };

    try {
      const response = await fetch('/api/platform/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Erro ao criar empresa');
        setIssues(data.issues || null);
        return;
      }

      event.currentTarget.reset();
      router.refresh();
    } catch {
      // A requisição pode ter chegado ao servidor mesmo com erro no cliente
      // (ex.: latência na primeira escrita após um deploy). Atualiza a lista
      // por garantia, em vez de deixar a tela parecendo que nada aconteceu.
      setError('Não foi possível confirmar a resposta do servidor — a lista foi atualizada, confira se a empresa já aparece abaixo.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-2">
      <h2 className="col-span-full text-base font-semibold text-white">Criar nova empresa</h2>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400" htmlFor="nome">Nome</label>
        <input id="nome" name="nome" required minLength={2} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400" htmlFor="slug">Identificador (slug)</label>
        <input id="slug" name="slug" required pattern="[a-z0-9-]+" placeholder="acme" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
      </div>

      <div className="col-span-full flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {pending ? 'Criando...' : 'Criar empresa'}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
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
