import { Users } from 'lucide-react';
import { DataStatus } from '@/components/data-status';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { fetchApiSafe } from '@/lib/api';
import { requirePermissionSession } from '@/lib/session';
import { PERMISSIONS, can } from '@/lib/session-types';
import { TeamForm } from './team-form';

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
            <Card key={team.id} className="flex flex-col p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="min-w-0 truncate text-base font-semibold text-ink">{team.nome}</h2>
                <Badge tone={team.ativo ? 'ok' : 'neutral'}>{team.ativo ? 'Ativa' : 'Inativa'}</Badge>
              </div>

              <p className="mt-1 text-xs text-ink-muted">{team.cliente?.nome ?? 'Estrutura interna'}</p>

              {team.gestores.length > 0 ? (
                <p className="mt-2 text-xs text-ink-subtle">
                  Gestão: {team.gestores.map((item) => item.gestor.nome).join(', ')}
                </p>
              ) : null}

              <div className="mt-4 flex-1 border-t border-line pt-3">
                <p className="eyebrow mb-2">
                  {team.colaboradores.length} {team.colaboradores.length === 1 ? 'colaborador' : 'colaboradores'}
                </p>
                {team.colaboradores.length === 0 ? (
                  <p className="text-xs text-ink-subtle">Nenhum colaborador ativo nesta equipe ainda.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {team.colaboradores.map((colaborador) => (
                      <li key={colaborador.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-ink">{colaborador.nome}</span>
                        <span className="shrink-0 text-2xs text-ink-subtle">{colaborador.cargo}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
