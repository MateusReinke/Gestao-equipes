'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, ShieldCheck } from 'lucide-react';
import { Sidebar } from './sidebar';
import type { SessionTenant, SessionUser } from '@/lib/session-types';

const titles: Record<string, string> = {
  '/': 'Dashboard executivo',
  '/clientes': 'Gestão de clientes',
  '/equipes': 'Gestão de equipes',
  '/colaboradores': 'Gestão de colaboradores',
  '/gestores': 'Gestão de gestores',
  '/escalas': 'Escalas operacionais',
  '/plantoes': 'Plantões e cobertura',
  '/ferias': 'Férias e indisponibilidades',
};

const roleLabels: Record<'admin' | 'gestor', string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
};

function TenantSwitcher({ currentTenantId }: { currentTenantId: number | null }) {
  const router = useRouter();
  const [tenants, setTenants] = useState<SessionTenant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/platform/tenants')
      .then((response) => (response.ok ? response.json() : []))
      .then(setTenants)
      .catch(() => setTenants([]));
  }, []);

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    setLoading(true);
    await fetch('/api/auth/switch-tenant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: value === 'console' ? null : Number(value) }),
    });
    router.push(value === 'console' ? '/console' : '/');
    router.refresh();
  }

  return (
    <select
      value={currentTenantId ?? 'console'}
      onChange={handleChange}
      disabled={loading}
      className="rounded-xl border border-sky-500/30 bg-slate-950 px-3 py-1.5 text-xs text-sky-200 outline-none disabled:opacity-60"
    >
      <option value="console">Console da plataforma</option>
      {tenants.map((tenant) => (
        <option key={tenant.id} value={tenant.id}>
          {tenant.nome}
        </option>
      ))}
    </select>
  );
}

type DashboardLayoutProps = {
  children: ReactNode;
  user: SessionUser;
  tenant: SessionTenant | null;
  role: 'admin' | 'gestor' | null;
};

export function DashboardLayout({ children, user, tenant, role }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 md:flex">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8">
        <header className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-sky-300">
                Sistema de Gestão Operacional{tenant ? ` · ${tenant.nome}` : ''}
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white">{titles[pathname] ?? 'Painel operacional'}</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">Ambiente pronto para produção com PostgreSQL, Prisma, API REST e frontend corporativo integrado.</p>
            </div>
            <div className="flex flex-col items-end gap-3">
              {user.isGlobalAdmin ? <TenantSwitcher currentTenantId={tenant?.id ?? null} /> : null}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldCheck size={16} /> {user.nome} · {user.isGlobalAdmin ? 'Administrador Global' : role ? roleLabels[role] : '-'}
                </div>
                <p className="mt-1 text-emerald-100/80">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-rose-500/40 hover:text-rose-200"
              >
                <LogOut size={14} /> Sair
              </button>
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
