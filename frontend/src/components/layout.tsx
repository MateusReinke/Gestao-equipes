import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { ShieldCheck, Lock } from 'lucide-react';
import { Sidebar } from './sidebar';
import { HeaderTitle } from './header-title';
import { UserMenu } from './user-menu';
import { getCurrentUser, type SessionUser } from '@/lib/api';

export async function DashboardLayout({ children, allow }: { children: ReactNode; allow?: SessionUser['role'][] }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const denied = allow && !allow.includes(user.role);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 md:flex">
      <Sidebar role={user.role} />
      <main className="flex-1 p-4 md:p-8">
        <header className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-sky-300">Sistema de Gestão Operacional</p>
              <HeaderTitle />
              <p className="mt-2 max-w-3xl text-sm text-slate-400">Ambiente pronto para produção com PostgreSQL, Prisma, API REST e frontend corporativo integrado.</p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <UserMenu user={user} />
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                <div className="flex items-center gap-2 font-medium"><ShieldCheck size={16} /> Deploy único via Docker Compose</div>
              </div>
            </div>
          </div>
        </header>
        {denied ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            <Lock className="text-slate-500" size={28} />
            <p className="text-lg font-medium text-white">Acesso não permitido</p>
            <p className="max-w-md text-sm text-slate-400">Seu perfil ({user.role}) não tem permissão para visualizar esta página. Fale com um administrador se acredita que isso é um engano.</p>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
