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

export type TeamInput = z.infer<typeof teamSchema>;

export class NoActiveTenantError extends Error {}
export class ClientNotFoundForTeamError extends Error {}

export async function listTeamsForUser(user?: JwtPayload) {
  if (!user || user.activeTenantId == null) return [];
  const teamIds = await getVisibleTeamIds(user);
  return teamRepository.findByIds(user.activeTenantId, teamIds);
}

export async function createTeam(data: TeamInput, user?: JwtPayload) {
  if (!user || user.activeTenantId == null) {
    throw new NoActiveTenantError('Selecione um tenant ativo para cadastrar equipes');
  }
  const tenantId = user.activeTenantId;

  if (data.clienteId != null) {
    const client = await clientRepository.findById(tenantId, data.clienteId);
    if (!client) throw new ClientNotFoundForTeamError('Cliente informado não existe nesta empresa');
  }

  return teamRepository.create(tenantId, data);
}
