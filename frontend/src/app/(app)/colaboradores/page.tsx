import { UserSquare2 } from 'lucide-react';
import { DataStatus } from '@/components/data-status';
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th, Tr } from '@/components/ui';
import { fetchApiSafe } from '@/lib/api';
import { requirePermissionSession } from '@/lib/session';
import { PERMISSIONS, can } from '@/lib/session-types';
import { CONTRATO_LABELS, MODELO_LABELS, formatPhone } from '@/lib/format';
import { CollaboratorForm } from './collaborator-form';

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
              </tr>
            </thead>
            <tbody>
              {collaboratorsResult.data.map((item) => (
                <Tr key={item.id} className={item.ativo ? '' : 'opacity-55'}>
                  <Td>
                    <p className="font-medium text-ink">{item.nome}</p>
                    <p className="text-2xs text-ink-subtle">{item.email}</p>
                  </Td>
                  <Td>{item.cargo}</Td>
                  <Td>{item.equipe.nome}</Td>
                  <Td>
                    <p>{CONTRATO_LABELS[item.tipoContrato] ?? item.tipoContrato}</p>
                    <p className="text-2xs text-ink-subtle">{MODELO_LABELS[item.modeloTrabalho] ?? item.modeloTrabalho}</p>
                  </Td>
                  <Td className="tabular">{formatPhone(item.telefone)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {item.fazPlantao ? <Badge tone="accent">Plantão</Badge> : null}
                      {item.sobreAviso ? <Badge tone="warn">Sobreaviso</Badge> : null}
                      {!item.fazPlantao && !item.sobreAviso ? <span className="text-2xs text-ink-subtle">—</span> : null}
                      {!item.ativo ? <Badge tone="danger">Inativo</Badge> : null}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
