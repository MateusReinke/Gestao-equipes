'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Tenant = { id: number; nome: string; slug: string; ativo: boolean };

export function TenantList({ tenants }: { tenants: Tenant[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<number | null>(null);

  async function enterTenant(tenantId: number) {
    setPendingId(tenantId);
    await fetch('/api/auth/switch-tenant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    });
    router.push('/');
    router.refresh();
  }

  if (tenants.length === 0) {
    return <p className="text-sm text-slate-400">Nenhuma empresa cadastrada ainda.</p>;
  }

  return (
    <div className="grid gap-3">
      {tenants.map((tenant) => (
        <div key={tenant.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div>
            <p className="font-medium text-white">{tenant.nome}</p>
            <p className="text-xs text-slate-500">{tenant.slug} · {tenant.ativo ? 'Ativa' : 'Inativa'}</p>
          </div>
          <button
            type="button"
            onClick={() => enterTenant(tenant.id)}
            disabled={pendingId === tenant.id}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            {pendingId === tenant.id ? 'Entrando...' : 'Entrar nesta empresa'}
          </button>
        </div>
      ))}
    </div>
  );
}
