'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Pencil, Trash2 } from 'lucide-react';
import { Badge, Button, Field, Input } from '@/components/ui';

export type Tenant = { id: number; nome: string; slug: string; ativo: boolean };

function TenantRow({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function entrar() {
    setPending(true);
    await fetch('/api/auth/switch-tenant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenant.id }),
    });
    router.push('/');
    router.refresh();
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
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
        setError(data.error || 'Erro ao salvar');
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

  async function remover() {
    if (!window.confirm(`Remover a empresa "${tenant.nome}"? Só é possível se ela ainda não tiver dados.`)) return;

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
      setError('Não foi possível confirmar a resposta do servidor — a lista foi atualizada, confira abaixo.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (editando) {
    return (
      <form onSubmit={salvar} className="px-4 py-4 sm:px-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" htmlFor={`nome-${tenant.id}`}>
            <Input id={`nome-${tenant.id}`} name="nome" defaultValue={tenant.nome} required minLength={2} />
          </Field>
          <Field label="Identificador (slug)" htmlFor={`slug-${tenant.id}`}>
            <Input id={`slug-${tenant.id}`} name="slug" defaultValue={tenant.slug} required pattern="[a-z0-9-]+" />
          </Field>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="ativo" defaultChecked={tenant.ativo} className="rounded border-line bg-bg" />
          Empresa ativa
        </label>

        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

        <div className="mt-4 flex gap-2">
          <Button type="submit" variant="primary" size="sm" disabled={pending}>
            {pending ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setEditando(false); setError(null); }}>
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-ink">{tenant.nome}</p>
            <Badge tone={tenant.ativo ? 'ok' : 'neutral'}>{tenant.ativo ? 'Ativa' : 'Inativa'}</Badge>
          </div>
          <p className="text-2xs text-ink-subtle">{tenant.slug}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" onClick={entrar} disabled={pending}>
            {pending ? 'Entrando...' : 'Entrar'} <ArrowRight size={14} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setEditando(true)} disabled={pending} aria-label="Editar empresa">
            <Pencil size={14} />
          </Button>
          <Button variant="danger" size="sm" onClick={remover} disabled={pending} aria-label="Remover empresa">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export function TenantList({ tenants }: { tenants: Tenant[] }) {
  return (
    <div className="divide-y divide-line">
      {tenants.map((tenant) => (
        <TenantRow key={tenant.id} tenant={tenant} />
      ))}
    </div>
  );
}
