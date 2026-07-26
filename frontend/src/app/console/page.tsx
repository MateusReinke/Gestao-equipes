import { redirect } from 'next/navigation';
import { Building2, LogOut } from 'lucide-react';
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { fetchApiSafe } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { CreateTenantForm } from './create-tenant-form';
import { LogoutButton } from './logout-button';
import { TenantList, type Tenant } from './tenant-list';

export default async function ConsolePage() {
  const session = await requireSession();
  if (!session.user.isGlobalAdmin) redirect('/');

  const { data: tenants, error } = await fetchApiSafe<Tenant[]>('/platform/tenants', []);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-strong text-sm font-bold text-white">
              GO
            </span>
            <div>
              <p className="eyebrow">Console da plataforma</p>
              <p className="text-sm font-medium text-ink">{session.user.nome}</p>
            </div>
          </div>
          <LogoutButton />
        </div>

        <PageHeader
          title="Empresas"
          description="Como Administrador Global, você cria empresas e entra em qualquer uma delas para ver e operar os dados — sem precisar deslogar."
        />

        {error ? (
          <div className="mb-4 rounded-lg border border-warn/30 bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
            Não foi possível carregar a lista de empresas: {error}
          </div>
        ) : null}

        <CreateTenantForm />

        <Card className="mt-4">
          <CardHeader title="Empresas cadastradas" description={`${tenants.length} no total`} />
          {tenants.length === 0 ? (
            <EmptyState
              icon={<Building2 size={24} />}
              title="Nenhuma empresa ainda"
              description="Crie a primeira empresa para começar a operar."
            />
          ) : (
            <TenantList tenants={tenants} />
          )}
        </Card>
      </div>
    </div>
  );
}
