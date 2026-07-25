import { ReactNode } from 'react';
import { requireSession } from '@/lib/session';
import { DashboardLayout } from '@/components/layout';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireSession();
  return <DashboardLayout user={user}>{children}</DashboardLayout>;
}
