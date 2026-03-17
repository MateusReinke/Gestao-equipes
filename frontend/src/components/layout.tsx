'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, Search } from 'lucide-react';
import { Sidebar } from './sidebar';

function pageTitle(pathname: string) {
  if (pathname === '/') return 'Dashboard';
  return pathname.slice(1).replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 text-slate-100 md:flex">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8">
        <header className="mb-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Painel administrativo</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">{pageTitle(pathname)}</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-400 lg:flex">
                <Search size={15} />
                Busca rápida
              </div>
              <button className="rounded-xl border border-slate-700 bg-slate-950/70 p-2 text-slate-300 hover:text-white" type="button">
                <Bell size={16} />
              </button>
              <div className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm">
                <p className="font-medium text-white">Admin</p>
                <p className="text-xs text-slate-400">Operações</p>
              </div>
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
