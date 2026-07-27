'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  LayoutPanelTop,
  LogOut,
  Menu,
  Network,
  Repeat2,
  ScrollText,
  ShieldCheck,
  Users,
  UserSquare2,
  X,
} from 'lucide-react';
import { PERMISSIONS, can, type PermissionCode, type SessionTenant, type SessionUser } from '@/lib/session-types';
import { Badge, Button, cx } from './ui';
import { NotificationBell } from './notification-bell';

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permissoes: PermissionCode[];
  grupo: string;
};

/// Cada item declara a permissão mínima que o torna visível. O menu é derivado
/// das permissões efetivas — em vez de mostrar e bloquear no clique.
const NAV: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, permissoes: [PERMISSIONS.DASHBOARD_VIEW], grupo: 'Operação' },
  { href: '/dashboards', label: 'Meus painéis', icon: LayoutPanelTop, permissoes: [PERMISSIONS.DASHBOARD_VIEW], grupo: 'Operação' },
  { href: '/turnos', label: 'Turnos', icon: CalendarClock, permissoes: [PERMISSIONS.SHIFT_VIEW], grupo: 'Operação' },
  { href: '/trocas', label: 'Trocas', icon: Repeat2, permissoes: [PERMISSIONS.SHIFT_VIEW], grupo: 'Operação' },
  { href: '/escalas', label: 'Escalas', icon: CalendarDays, permissoes: [PERMISSIONS.SCHEDULE_VIEW], grupo: 'Operação' },

  { href: '/clientes', label: 'Clientes', icon: Building2, permissoes: [PERMISSIONS.CLIENT_VIEW], grupo: 'Cadastros' },
  { href: '/equipes', label: 'Equipes', icon: Users, permissoes: [PERMISSIONS.TEAM_VIEW], grupo: 'Cadastros' },
  { href: '/colaboradores', label: 'Colaboradores', icon: UserSquare2, permissoes: [PERMISSIONS.COLLABORATOR_VIEW], grupo: 'Cadastros' },

  { href: '/rh', label: 'Férias e ausências', icon: ClipboardList, permissoes: [PERMISSIONS.HR_VACATION_VIEW, PERMISSIONS.HR_ABSENCE_VIEW], grupo: 'Pessoas' },
  { href: '/rh/ferias', label: 'Controle de férias', icon: CalendarCheck, permissoes: [PERMISSIONS.HR_VACATION_VIEW], grupo: 'Pessoas' },

  { href: '/relatorios', label: 'Relatórios', icon: BarChart3, permissoes: [PERMISSIONS.REPORT_VIEW], grupo: 'Administração' },

  { href: '/usuarios', label: 'Usuários e papéis', icon: ShieldCheck, permissoes: [PERMISSIONS.USER_VIEW, PERMISSIONS.ROLE_MANAGE], grupo: 'Administração' },
  { href: '/diretorio', label: 'Diretório', icon: Network, permissoes: [PERMISSIONS.DIRECTORY_VIEW], grupo: 'Administração' },
  { href: '/auditoria', label: 'Auditoria', icon: ScrollText, permissoes: [PERMISSIONS.AUDIT_VIEW], grupo: 'Administração' },
];

function TenantSwitcher({ currentTenantId, onNavigate }: { currentTenantId: number | null; onNavigate?: () => void }) {
  const router = useRouter();
  const [tenants, setTenants] = useState<SessionTenant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/platform/tenants')
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setTenants(Array.isArray(data) ? data : []))
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
    onNavigate?.();
    router.push(value === 'console' ? '/console' : '/');
    router.refresh();
  }

  return (
    <div className="relative">
      <select
        aria-label="Trocar de empresa"
        value={currentTenantId ?? 'console'}
        onChange={handleChange}
        disabled={loading}
        className="input-base appearance-none py-1.5 pr-8 text-xs"
      >
        <option value="console">Console da plataforma</option>
        {tenants.map((tenant) => (
          <option key={tenant.id} value={tenant.id}>
            {tenant.nome}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
    </div>
  );
}

function NavLinks({ permissoes, onNavigate }: { permissoes: string[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const visiveis = NAV.filter((item) => can(permissoes, ...item.permissoes));
  const grupos = [...new Set(visiveis.map((item) => item.grupo))];

  return (
    <nav className="flex flex-col gap-5">
      {grupos.map((grupo) => (
        <div key={grupo}>
          <p className="eyebrow px-3 pb-1.5">{grupo}</p>
          <div className="flex flex-col gap-0.5">
            {visiveis
              .filter((item) => item.grupo === grupo)
              .map((item) => {
                const Icon = item.icon;
                const ativo = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={ativo ? 'page' : undefined}
                    className={cx(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                      ativo ? 'bg-accent-soft font-medium text-accent' : 'text-ink-muted hover:bg-surface-hover hover:text-ink'
                    )}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({
  children,
  user,
  tenant,
  roleCodigo,
  permissoes,
}: {
  children: ReactNode;
  user: SessionUser;
  tenant: SessionTenant | null;
  roleCodigo: string | null;
  permissoes: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);

  // Navegar fecha o menu mobile — senão ele fica por cima do conteúdo novo.
  useEffect(() => setMenuAberto(false), [pathname]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const papelLabel = user.isGlobalAdmin ? 'Administrador Global' : roleLabel(roleCodigo);

  const brand = (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-strong text-sm font-bold text-white">GO</span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight text-ink">Gestão Operacional</p>
        <p className="truncate text-2xs text-ink-subtle">{tenant?.nome ?? 'Sem empresa ativa'}</p>
      </div>
    </div>
  );

  const rodapeUsuario = (
    <div className="border-t border-line p-3">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-hover text-xs font-semibold text-ink">
          {iniciais(user.nome)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-ink">{user.nome}</p>
          <p className="truncate text-2xs text-ink-subtle">{user.email}</p>
        </div>
      </div>
      <div className="mb-2 px-1">
        <Badge tone={user.isGlobalAdmin ? 'accent' : 'neutral'}>{papelLabel}</Badge>
      </div>
      {user.isGlobalAdmin ? (
        <div className="mb-2 px-1">
          <TenantSwitcher currentTenantId={tenant?.id ?? null} onNavigate={() => setMenuAberto(false)} />
        </div>
      ) : null}
      <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start">
        <LogOut size={14} /> Sair
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Barra superior — só em telas pequenas */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
        {brand}
        <div className="flex items-center gap-1">
          <NotificationBell />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMenuAberto((aberto) => !aberto)}
            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuAberto}
          >
            {menuAberto ? <X size={18} /> : <Menu size={18} />}
          </Button>
        </div>
      </header>

      {/* Menu mobile */}
      {menuAberto ? (
        <div className="fixed inset-0 top-[53px] z-20 animate-fade-in overflow-y-auto bg-bg lg:hidden">
          <div className="flex min-h-full flex-col justify-between">
            <div className="p-3">
              <NavLinks permissoes={permissoes} onNavigate={() => setMenuAberto(false)} />
            </div>
            {rodapeUsuario}
          </div>
        </div>
      ) : null}

      {/* Sidebar — telas grandes */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r border-line bg-surface lg:flex">
        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-line px-4 py-4">{brand}</div>
          <div className="p-3">
            <NavLinks permissoes={permissoes} />
          </div>
        </div>
        {rodapeUsuario}
      </aside>

      <main className="min-w-0 flex-1">
        <div className="sticky top-0 z-20 hidden justify-end border-b border-line bg-bg/80 px-8 py-2 backdrop-blur lg:flex">
          <NotificationBell />
        </div>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  admin_tenant: 'Administrador da Empresa',
  gestor: 'Gestor',
  lider: 'Líder',
  analista: 'Analista',
  operador: 'Operador',
  cliente: 'Cliente',
  visitante: 'Visitante',
};

export function roleLabel(codigo: string | null) {
  if (!codigo) return 'Sem papel';
  return ROLE_LABELS[codigo] ?? codigo;
}
