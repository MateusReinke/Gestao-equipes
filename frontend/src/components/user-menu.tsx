'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import type { SessionUser } from '@/lib/api';

const roleLabels: Record<SessionUser['role'], string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  rh: 'RH',
  monitoramento: 'Monitoramento',
  cliente: 'Cliente',
};

export function UserMenu({ user }: { user: SessionUser }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
      <div className="text-right">
        <p className="font-medium text-white">{user.nome}</p>
        <p className="text-xs text-slate-400">{roleLabels[user.role]}</p>
      </div>
      <button onClick={handleLogout} title="Sair" className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-red-500/50 hover:text-red-300">
        <LogOut size={16} />
      </button>
    </div>
  );
}
