'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Briefcase,
  CalendarCog,
  LayoutDashboard,
  ShieldCheck,
  Users,
  UserSquare2,
} from 'lucide-react';

const menuSections = [
  {
    title: 'Visão geral',
    items: [{ label: 'Dashboard', href: '/', icon: LayoutDashboard }],
  },
  {
    title: 'Operação',
    items: [
      { label: 'Equipes', href: '/equipes', icon: Users },
      { label: 'Clientes', href: '/clientes', icon: Briefcase },
      { label: 'Colaboradores', href: '/colaboradores', icon: UserSquare2 },
      { label: 'Escalas', href: '/escalas', icon: CalendarCog },
    ],
  },
  {
    title: 'Análises',
    items: [{ label: 'Relatórios', href: '/relatorios', icon: BarChart3 }],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-72 flex-col border-r border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur md:flex">
      <div className="mb-8 rounded-2xl border border-slate-700/70 bg-slate-950/80 p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Gestão de Equipes</p>
        <h1 className="mt-2 text-xl font-semibold text-white">Painel Operacional</h1>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
          <ShieldCheck size={14} /> Ambiente em produção
        </div>
      </div>

      <nav className="space-y-6">
        {menuSections.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-slate-500">{section.title}</p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                      isActive
                        ? 'border border-blue-500/30 bg-blue-500/15 text-blue-100'
                        : 'border border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
