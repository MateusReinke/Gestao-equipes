import { z } from 'zod';
import { JwtPayload } from '../types/auth';
import { teamRepository } from '../repositories/team.repository';
import { clientRepository } from '../repositories/client.repository';
import { getVisibleTeamIds } from './scope.service';

export const teamSchema = z.object({
  nome: z.string().trim().min(2, 'Nome da equipe é obrigatório'),
  clienteId: z.coerce.number().int().positive().optional().nullable(),
  ativo: z.coerce.boolean().default(true),
});

export const teamUpdateSchema = z.object({
  nome: z.string().trim().min(2, 'Nome da equipe é obrigatório').optional(),
  clienteId: z.coerce.number().int().positive().nullable().optional(),
  ativo: z.boolean().optional(),
});

export type TeamInput = z.infer<typeof teamSchema>;
export type TeamUpdateInput = z.infer<typeof teamUpdateSchema>;

export class NoActiveTenantError extends Error {}
export class ClientNotFoundForTeamError extends Error {}
export class TeamNotFoundError extends Error {}

function requireTenant(user?: JwtPayload): number {
  if (!user || user.activeTenantId == null) throw new NoActiveTenantError('Selecione uma empresa ativa');
  return user.activeTenantId;
}

export async function listTeamsForUser(user?: JwtPayload) {
  if (!user || user.activeTenantId == null) return [];
  const teamIds = await getVisibleTeamIds(user);
  return teamRepository.findByIds(user.activeTenantId, teamIds);
}

export async function createTeam(data: TeamInput, user?: JwtPayload) {
  const tenantId = requireTenant(user);

  if (data.clienteId != null) {
    const client = await clientRepository.findById(tenantId, data.clienteId);
    if (!client) throw new ClientNotFoundForTeamError('Cliente informado não existe nesta empresa');
  }

  return teamRepository.create(tenantId, data);
}

export class TeamHasHistoryError extends Error {
  constructor(message: string, readonly detalhes: { colaboradores: number; turnos: number }) {
    super(message);
  }
}

/**
 * Remove a equipe, mas só quando ela não deixa órfão.
 *
 * Equipe com colaborador, escala ou turno carrega histórico da operação —
 * apagar em cascata destruiria registro que a auditoria e os relatórios ainda
 * referenciam. Nesses casos a saída é desativar (`ativo: false`), que tira a
 * equipe do dia a dia sem reescrever o passado.
 */
export async function deleteTeam(teamId: number, user?: JwtPayload) {
  const tenantId = requireTenant(user);

  const existing = await teamRepository.findById(tenantId, teamId);
  if (!existing) throw new TeamNotFoundError('Equipe não encontrada');

  const [colaboradores, turnos] = await teamRepository.contarVinculos(tenantId, teamId);
  if (colaboradores > 0 || turnos > 0) {
    const partes = [
      colaboradores > 0 ? `${colaboradores} colaborador(es)` : null,
      turnos > 0 ? `${turnos} turno(s) no histórico` : null,
    ].filter(Boolean);

    throw new TeamHasHistoryError(
      `Esta equipe ainda tem ${partes.join(' e ')}. Mova os colaboradores para outra equipe, ou desative esta para tirá-la do dia a dia sem perder o histórico.`,
      { colaboradores, turnos }
    );
  }

  await teamRepository.remove(tenantId, teamId);
  return existing;
}

export async function updateTeam(teamId: number, data: TeamUpdateInput, user?: JwtPayload) {
  const tenantId = requireTenant(user);

  const existing = await teamRepository.findById(tenantId, teamId);
  if (!existing) throw new TeamNotFoundError('Equipe não encontrada');

  if (data.clienteId != null) {
    const client = await clientRepository.findById(tenantId, data.clienteId);
    if (!client) throw new ClientNotFoundForTeamError('Cliente informado não existe nesta empresa');
  }

  const depois = await teamRepository.update(tenantId, teamId, data);
  return { antes: existing, depois };
}
