'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Tenant = { id: number; nome: string; slug: string; ativo: boolean };

function TenantRow({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enterTenant() {
    setPending(true);
    await fetch('/api/auth/switch-tenant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenant.id }),
    });
    router.push('/');
    router.refresh();
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      nome: String(formData.get('nome') || ''),
      slug: String(formData.get('slug') || ''),
      ativo: formData.get('ativo') === 'on',
    };

    try {
      const response = await fetch(`/api/platform/tenants/${tenant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Erro ao salvar empresa');
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

  async function handleRemove() {
    if (!window.confirm(`Remover definitivamente a empresa "${tenant.nome}"? Só é possível se ela ainda não tiver dados.`)) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/platform/tenants/${tenant.id}`, { method: 'DELETE' });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || 'Erro ao remover empresa');
        return;
      }

      router.refresh();
    } catch {
      setError('Não foi possível confirmar a resposta do servidor — a lista foi atualizada, confira se a empresa ainda aparece abaixo.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400" htmlFor={`nome-${tenant.id}`}>Nome</label>
            <input
              id={`nome-${tenant.id}`}
              name="nome"
              defaultValue={tenant.nome}
              required
              minLength={2}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400" htmlFor={`slug-${tenant.id}`}>Identificador (slug)</label>
            <input
              id={`slug-${tenant.id}`}
              name="slug"
              defaultValue={tenant.slug}
              required
              pattern="[a-z0-9-]+"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-white">
          <input type="checkbox" name="ativo" defaultChecked={tenant.ativo} className="rounded border-slate-700 bg-slate-950" />
          Empresa ativa
        </label>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-4 flex items-center gap-3">
          <button type="submit" disabled={pending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {pending ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setError(null); }}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300"
          >
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-white">{tenant.nome}</p>
          <p className="text-xs text-slate-500">{tenant.slug} · {tenant.ativo ? 'Ativa' : 'Inativa'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={enterTenant}
            disabled={pending}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            Entrar nesta empresa
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={pending}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-60"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={pending}
            className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs text-rose-300 disabled:opacity-60"
          >
            Remover
          </button>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function TenantList({ tenants }: { tenants: Tenant[] }) {
  if (tenants.length === 0) {
    return <p className="text-sm text-slate-400">Nenhuma empresa cadastrada ainda.</p>;
  }

  return (
    <div className="grid gap-3">
      {tenants.map((tenant) => (
        <TenantRow key={tenant.id} tenant={tenant} />
      ))}
    </div>
  );
}
