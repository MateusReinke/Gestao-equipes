import { Building2 } from 'lucide-react';
import { DataStatus } from '@/components/data-status';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { fetchApiSafe } from '@/lib/api';
import { requirePermissionSession } from '@/lib/session';
import { PERMISSIONS, can } from '@/lib/session-types';
import { ClientForm } from './client-form';
import { ClientCard, type Client } from './client-card';

type Colaborador = { id: number; nome: string };

export default async function ClientesPage() {
  const session = await requirePermissionSession(PERMISSIONS.CLIENT_VIEW);

  const [clientesResult, colaboradoresResult] = await Promise.all([
    fetchApiSafe<Client[]>('/api/clientes', []),
    fetchApiSafe<Colaborador[]>('/api/colaboradores', []),
  ]);

  const podeCriar = can(session.permissoes, PERMISSIONS.CLIENT_CREATE);
  const podeEditar = can(session.permissoes, PERMISSIONS.CLIENT_EDIT);
  const podeRemover = can(session.permissoes, PERMISSIONS.CLIENT_DELETE);

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Empresas atendidas pela operação, com contato de escalation, SLA e responsável interno."
      />

      <DataStatus error={clientesResult.error} />

      {podeCriar ? <ClientForm colaboradores={colaboradoresResult.data} /> : null}

      {clientesResult.data.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<Building2 size={24} />}
            title="Nenhum cliente cadastrado"
            description={podeCriar ? 'Cadastre o primeiro cliente usando o botão acima.' : 'Ainda não há clientes cadastrados nesta empresa.'}
          />
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {clientesResult.data.map((cliente) => (
            <ClientCard
              key={cliente.id}
              cliente={cliente}
              colaboradores={colaboradoresResult.data}
              podeEditar={podeEditar}
              podeRemover={podeRemover}
            />
          ))}
        </div>
      )}
    </>
  );
}
