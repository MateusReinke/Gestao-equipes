import { ReactNode } from 'react';
import { requireTenantSession } from '@/lib/session';
import { DashboardLayout } from '@/components/layout';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireTenantSession();
  return (
    <DashboardLayout user={session.user} tenant={session.tenant} role={session.role}>
      {children}
    </DashboardLayout>
  );
}
