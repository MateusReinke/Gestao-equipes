import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { fetchApi } from '@/lib/api';
import { CreateTenantForm } from './create-tenant-form';
import { TenantList } from './tenant-list';

type Tenant = { id: number; nome: string; slug: string; ativo: boolean };

export default async function ConsolePage() {
  const session = await requireSession();
  if (!session.user.isGlobalAdmin) redirect('/');

  const tenants = await fetchApi<Tenant[]>('/platform/tenants');

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100 md:p-10">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs uppercase tracking-[0.2em] text-sky-300">Console da plataforma</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Empresas (tenants)</h1>
        <p className="mt-2 text-sm text-slate-400">
          Como Administrador Global, você pode criar novas empresas e entrar em qualquer uma delas para ver os dados operacionais.
        </p>

        <div className="mt-8">
          <CreateTenantForm />
        </div>

        <div className="mt-8">
          <TenantList tenants={tenants} />
        </div>
      </div>
    </div>
  );
}
