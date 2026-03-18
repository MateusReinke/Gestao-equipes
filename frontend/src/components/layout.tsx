'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Sidebar } from './sidebar';

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

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

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
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              <div className="flex items-center gap-2 font-medium"><ShieldCheck size={16} /> Deploy único via Docker Compose</div>
              <p className="mt-1 text-emerald-100/80">Seed inicial com admin padrão e dados operacionais.</p>
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
