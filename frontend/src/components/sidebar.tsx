'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Briefcase, CalendarDays, LayoutDashboard, Shield, Users, UserSquare2, UserCog, Plane } from 'lucide-react';

const items = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', icon: Briefcase },
  { href: '/equipes', label: 'Equipes', icon: Users },
  { href: '/colaboradores', label: 'Colaboradores', icon: UserSquare2 },
  { href: '/gestores', label: 'Gestores', icon: UserCog },
  { href: '/escalas', label: 'Escalas', icon: CalendarDays },
  { href: '/plantoes', label: 'Plantões', icon: Shield },
  { href: '/ferias', label: 'Férias', icon: Plane },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 border-r border-slate-800 bg-slate-900/70 p-6 md:block">
      <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Operações corporativas</p>
        <h2 className="mt-2 text-xl font-semibold">Gestão Operacional</h2>
        <p className="mt-2 text-sm text-slate-400">Clientes, equipes, plantões, férias e escalas em uma única plataforma.</p>
      </div>

      <nav className="mt-6 space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${active ? 'border-sky-500/40 bg-sky-500/10 text-sky-100' : 'border-transparent bg-slate-950/40 text-slate-300 hover:border-slate-700 hover:text-white'}`}>
              <Icon size={16} /> {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
