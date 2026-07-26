import { Users } from 'lucide-react';
import { DataStatus } from '@/components/data-status';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { fetchApiSafe } from '@/lib/api';
import { requirePermissionSession } from '@/lib/session';
import { PERMISSIONS, can } from '@/lib/session-types';
import { TeamForm } from './team-form';
import { TeamCard } from './team-card';

type Team = {
  id: number;
  nome: string;
  ativo: boolean;
  cliente?: { id: number; nome: string } | null;
  colaboradores: Array<{ id: number; nome: string; cargo: string }>;
  gestores: Array<{ gestor: { id: number; nome: string; email: string } }>;
};

type Client = { id: number; nome: string };

export default async function EquipesPage() {
  const session = await requirePermissionSession(PERMISSIONS.TEAM_VIEW);

  const [teamsResult, clientsResult] = await Promise.all([
    fetchApiSafe<Team[]>('/api/equipes', []),
    fetchApiSafe<Client[]>('/api/clientes', []),
  ]);

  const podeCriar = can(session.permissoes, PERMISSIONS.TEAM_CREATE);
  const podeEditar = can(session.permissoes, PERMISSIONS.TEAM_EDIT);
  const podeRemover = can(session.permissoes, PERMISSIONS.TEAM_DELETE);

  return (
    <>
      <PageHeader
        title="Equipes"
        description="Como a operação está organizada: quem faz parte de cada time e qual cliente ele atende."
      />

      <DataStatus error={teamsResult.error} />

      {podeCriar ? <TeamForm clients={clientsResult.data} /> : null}

      {teamsResult.data.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<Users size={24} />}
            title="Nenhuma equipe cadastrada"
            description={
              podeCriar
                ? 'Crie a primeira equipe — ela é o ponto de partida para cadastrar colaboradores e montar escalas.'
                : 'Você ainda não gerencia nenhuma equipe nesta empresa.'
            }
          />
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teamsResult.data.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              clients={clientsResult.data}
              podeEditar={podeEditar}
              podeRemover={podeRemover}
            />
          ))}
        </div>
      )}
    </>
  );
}
