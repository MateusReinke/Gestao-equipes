import { ShieldCheck } from 'lucide-react';
import { DataStatus } from '@/components/data-status';
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th, Tr } from '@/components/ui';
import { fetchApiSafe } from '@/lib/api';
import { requirePermissionSession } from '@/lib/session';
import { PERMISSIONS, can } from '@/lib/session-types';
import { InviteUserPanel } from './invite-user-panel';
import { RolesPanel, type Papel, type Permissao } from './roles-panel';
import { UserRoleSelect } from './user-role-select';

type Usuario = {
  userId: number;
  nome: string;
  email: string;
  ativo: boolean;
  isGlobalAdmin: boolean;
  role: { id: number; codigo: string; nome: string };
  colaborador: { id: number; nome: string } | null;
};

type Colaborador = { id: number; nome: string };

export default async function UsuariosPage() {
  const session = await requirePermissionSession(PERMISSIONS.USER_VIEW, PERMISSIONS.ROLE_MANAGE);

  const podeVerUsuarios = can(session.permissoes, PERMISSIONS.USER_VIEW);
  const podeConvidar = can(session.permissoes, PERMISSIONS.USER_INVITE);
  const podeGerirPapeis = can(session.permissoes, PERMISSIONS.USER_MANAGE_ROLES);
  const podeAdministrarPapeis = can(session.permissoes, PERMISSIONS.ROLE_MANAGE);

  const [usuariosResult, papeisResult, permissoesResult, colaboradoresResult] = await Promise.all([
    podeVerUsuarios ? fetchApiSafe<Usuario[]>('/api/usuarios', []) : Promise.resolve({ data: [] as Usuario[], error: null }),
    fetchApiSafe<Papel[]>('/api/papeis', []),
    podeAdministrarPapeis
      ? fetchApiSafe<Permissao[]>('/api/permissoes', [])
      : Promise.resolve({ data: [] as Permissao[], error: null }),
    fetchApiSafe<Colaborador[]>('/api/colaboradores', []),
  ]);

  return (
    <>
      <PageHeader
        title="Usuários e papéis"
        description="Quem tem acesso ao sistema nesta empresa e o que cada papel permite fazer."
      />

      <DataStatus error={usuariosResult.error} />

      {podeConvidar ? (
        <InviteUserPanel papeis={papeisResult.data} colaboradores={colaboradoresResult.data} />
      ) : null}

      {podeVerUsuarios ? (
        <Card className="mt-4">
          <CardHeader title="Usuários" description={`${usuariosResult.data.length} com acesso a esta empresa`} />
          {usuariosResult.data.length === 0 ? (
            <EmptyState icon={<ShieldCheck size={24} />} title="Nenhum usuário vinculado" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Usuário</Th>
                  <Th>Papel</Th>
                  <Th>Colaborador vinculado</Th>
                  <Th>Situação</Th>
                </tr>
              </thead>
              <tbody>
                {usuariosResult.data.map((usuario) => (
                  <Tr key={usuario.userId}>
                    <Td>
                      <p className="font-medium text-ink">{usuario.nome}</p>
                      <p className="text-2xs text-ink-subtle">{usuario.email}</p>
                    </Td>
                    <Td>
                      {podeGerirPapeis && !usuario.isGlobalAdmin ? (
                        <UserRoleSelect userId={usuario.userId} papelAtualId={usuario.role.id} papeis={papeisResult.data} />
                      ) : (
                        <Badge tone={usuario.isGlobalAdmin ? 'accent' : 'neutral'}>
                          {usuario.isGlobalAdmin ? 'Administrador Global' : usuario.role.nome}
                        </Badge>
                      )}
                    </Td>
                    <Td>{usuario.colaborador?.nome ?? <span className="text-ink-subtle">—</span>}</Td>
                    <Td>
                      <Badge tone={usuario.ativo ? 'ok' : 'danger'}>{usuario.ativo ? 'Ativo' : 'Inativo'}</Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : null}

      <RolesPanel
        papeis={papeisResult.data}
        permissoes={permissoesResult.data}
        podeAdministrar={podeAdministrarPapeis}
      />
    </>
  );
}
