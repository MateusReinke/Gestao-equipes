import { UserSquare2 } from 'lucide-react';
import { DataStatus } from '@/components/data-status';
import { Card, CardHeader, EmptyState, PageHeader, Table, Th } from '@/components/ui';
import { fetchApiSafe } from '@/lib/api';
import { requirePermissionSession } from '@/lib/session';
import { PERMISSIONS, can } from '@/lib/session-types';
import { CollaboratorForm } from './collaborator-form';
import { CollaboratorRow } from './collaborator-row';

type Collaborator = {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  cargo: string;
  tipoContrato: string;
  modeloTrabalho: string;
  fazPlantao: boolean;
  sobreAviso: boolean;
  ativo: boolean;
  equipe: { id: number; nome: string };
};

type Team = { id: number; nome: string };

export default async function ColaboradoresPage() {
  const session = await requirePermissionSession(PERMISSIONS.COLLABORATOR_VIEW);

  const [collaboratorsResult, teamsResult] = await Promise.all([
    fetchApiSafe<Collaborator[]>('/api/colaboradores', []),
    fetchApiSafe<Team[]>('/api/equipes', []),
  ]);

  const podeCriar = can(session.permissoes, PERMISSIONS.COLLABORATOR_CREATE);
  const podeEditar = can(session.permissoes, PERMISSIONS.COLLABORATOR_EDIT);
  const podeRemover = can(session.permissoes, PERMISSIONS.COLLABORATOR_DELETE);
  const temAcoes = podeEditar || podeRemover;
  const colunas = temAcoes ? 7 : 6;
  const ativos = collaboratorsResult.data.filter((item) => item.ativo).length;

  return (
    <>
      <PageHeader
        title="Colaboradores"
        description="Quem compõe as equipes, com disponibilidade para plantão e sobreaviso."
      />

      <DataStatus error={collaboratorsResult.error} />

      {podeCriar ? <CollaboratorForm teams={teamsResult.data} /> : null}

      <Card className="mt-4">
        <CardHeader
          title="Equipe operacional"
          description={`${collaboratorsResult.data.length} cadastrado(s) · ${ativos} ativo(s)`}
        />

        {collaboratorsResult.data.length === 0 ? (
          <EmptyState
            icon={<UserSquare2 size={24} />}
            title="Nenhum colaborador cadastrado"
            description={
              teamsResult.data.length === 0
                ? 'Crie uma equipe primeiro — todo colaborador precisa pertencer a uma.'
                : 'Cadastre o primeiro colaborador usando o botão acima.'
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Colaborador</Th>
                <Th>Cargo</Th>
                <Th>Equipe</Th>
                <Th>Contrato</Th>
                <Th>Contato</Th>
                <Th>Disponibilidade</Th>
                {temAcoes ? <Th className="text-right">Ações</Th> : null}
              </tr>
            </thead>
            <tbody>
              {collaboratorsResult.data.map((item) => (
                <CollaboratorRow
                  key={item.id}
                  colaborador={item}
                  teams={teamsResult.data}
                  podeEditar={podeEditar}
                  podeRemover={podeRemover}
                  colunas={colunas}
                />
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
