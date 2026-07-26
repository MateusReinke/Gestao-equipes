import { z } from 'zod';
import { JwtPayload } from '../types/auth';
import { absenceRepository } from '../repositories/absence.repository';
import { collaboratorRepository } from '../repositories/collaborator.repository';
import { getVisibleTeamIds } from './scope.service';
import { toDateOnly } from '../utils/date';

export const absenceSchema = z
  .object({
    colaboradorId: z.coerce.number().int().positive('Selecione o colaborador'),
    tipo: z.enum(['falta', 'atestado', 'licenca', 'folga', 'banco_horas', 'outro']),
    dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial inválida'),
    dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final inválida'),
    motivo: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.dataFim >= data.dataInicio, {
    message: 'A data final deve ser igual ou posterior à inicial',
    path: ['dataFim'],
  });

export const absenceResponseSchema = z.object({
  status: z.enum(['aprovado', 'rejeitado']),
});

export type AbsenceInput = z.infer<typeof absenceSchema>;

export class NoActiveTenantError extends Error {}
export class AbsenceNotFoundError extends Error {}
export class CollaboratorNotFoundError extends Error {}

function requireTenant(user?: JwtPayload): number {
  if (!user || user.activeTenantId == null) throw new NoActiveTenantError('Selecione uma empresa ativa');
  return user.activeTenantId;
}

export async function listAbsences(user?: JwtPayload) {
  if (!user || user.activeTenantId == null) return [];
  const teamIds = await getVisibleTeamIds(user);
  if (teamIds.length === 0) return [];
  return absenceRepository.findByTeamIds(user.activeTenantId, teamIds);
}

export async function createAbsence(data: AbsenceInput, user?: JwtPayload) {
  const tenantId = requireTenant(user);

  const colaborador = await collaboratorRepository.findById(tenantId, data.colaboradorId);
  if (!colaborador) throw new CollaboratorNotFoundError('Colaborador não encontrado nesta empresa');

  return absenceRepository.create(tenantId, {
    colaboradorId: data.colaboradorId,
    tipo: data.tipo,
    dataInicio: toDateOnly(data.dataInicio),
    dataFim: toDateOnly(data.dataFim),
    motivo: data.motivo,
    status: 'pendente',
  });
}

export async function respondAbsence(absenceId: number, status: 'aprovado' | 'rejeitado', user?: JwtPayload) {
  const tenantId = requireTenant(user);

  const existing = await absenceRepository.findById(tenantId, absenceId);
  if (!existing) throw new AbsenceNotFoundError('Ausência não encontrada');

  const updated = await absenceRepository.update(tenantId, absenceId, {
    status,
    respondidoPorId: user!.userId,
    respondidoEm: new Date(),
  });

  return { antes: existing, depois: updated };
}
