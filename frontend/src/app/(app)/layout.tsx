import { ReactNode } from 'react';
import { requireTenantSession } from '@/lib/session';
import { AppShell } from '@/components/app-shell';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireTenantSession();
  return (
    <AppShell
      user={session.user}
      tenant={session.tenant}
      roleCodigo={session.roleCodigo}
      permissoes={session.permissoes}
    >
      {children}
    </AppShell>
  );
}
