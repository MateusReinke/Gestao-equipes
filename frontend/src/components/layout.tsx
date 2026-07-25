'use client';

import { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, ShieldCheck } from 'lucide-react';
import { Sidebar } from './sidebar';
import type { SessionUser } from '@/lib/session-types';

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

const roleLabels: Record<SessionUser['role'], string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
};

export function DashboardLayout({ children, user }: { children: ReactNode; user: SessionUser }) {
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
              <p className="text-xs uppercase tracking-[0.2em] text-sky-300">Sistema de Gestão Operacional</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">{titles[pathname] ?? 'Painel operacional'}</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">Ambiente pronto para produção com PostgreSQL, Prisma, API REST e frontend corporativo integrado.</p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldCheck size={16} /> {user.nome} · {roleLabels[user.role]}
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
