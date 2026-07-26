import { z } from 'zod';
import { JwtPayload } from '../types/auth';
import { vacationRepository } from '../repositories/vacation.repository';
import { collaboratorRepository } from '../repositories/collaborator.repository';
import { getVisibleTeamIds } from './scope.service';
import { toDateOnly } from '../utils/date';

export const vacationSchema = z
  .object({
    colaboradorId: z.coerce.number().int().positive('Selecione o colaborador'),
    dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial inválida'),
    dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final inválida'),
    observacao: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.dataFim >= data.dataInicio, {
    message: 'A data final deve ser igual ou posterior à inicial',
    path: ['dataFim'],
  });

export const vacationResponseSchema = z.object({
  status: z.enum(['aprovado', 'rejeitado', 'cancelado']),
  observacao: z.string().trim().max(500).optional(),
});

export type VacationInput = z.infer<typeof vacationSchema>;

export class NoActiveTenantError extends Error {}
export class VacationNotFoundError extends Error {}
export class CollaboratorNotFoundError extends Error {}

function requireTenant(user?: JwtPayload): number {
  if (!user || user.activeTenantId == null) {
    throw new NoActiveTenantError('Selecione uma empresa ativa');
  }
  return user.activeTenantId;
}

export async function listVacationsForUser(user?: JwtPayload) {
  if (!user || user.activeTenantId == null) return [];
  const teamIds = await getVisibleTeamIds(user);
  if (teamIds.length === 0) return [];
  return vacationRepository.findByTeamIds(user.activeTenantId, teamIds);
}

export async function requestVacation(data: VacationInput, user?: JwtPayload) {
  const tenantId = requireTenant(user);

  const colaborador = await collaboratorRepository.findById(tenantId, data.colaboradorId);
  if (!colaborador) throw new CollaboratorNotFoundError('Colaborador não encontrado nesta empresa');

  return vacationRepository.create(tenantId, {
    colaboradorId: data.colaboradorId,
    dataInicio: toDateOnly(data.dataInicio),
    dataFim: toDateOnly(data.dataFim),
    status: 'pendente',
    observacao: data.observacao,
    solicitadoPorId: user!.userId,
  });
}

export async function respondVacation(
  vacationId: number,
  status: 'aprovado' | 'rejeitado' | 'cancelado',
  observacao: string | undefined,
  user?: JwtPayload
) {
  const tenantId = requireTenant(user);

  const existing = await vacationRepository.findById(tenantId, vacationId);
  if (!existing) throw new VacationNotFoundError('Registro de férias não encontrado');

  const updated = await vacationRepository.update(tenantId, vacationId, {
    status,
    observacao: observacao ?? existing.observacao,
    respondidoPorId: user!.userId,
    respondidoEm: new Date(),
  });

  return { antes: existing, depois: updated };
}
