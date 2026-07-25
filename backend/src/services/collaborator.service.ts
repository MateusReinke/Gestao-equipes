import { z } from 'zod';
import { JwtPayload } from '../types/auth';
import { collaboratorRepository } from '../repositories/collaborator.repository';
import { teamRepository } from '../repositories/team.repository';
import { getVisibleTeamIds } from './scope.service';

export const collaboratorSchema = z.object({
  nome: z.string().trim().min(3, 'Nome deve ter ao menos 3 caracteres'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  telefone: z
    .string()
    .trim()
    .regex(/^\d{10,11}$/, 'Telefone deve conter DDD + número (10 ou 11 dígitos)'),
  cargo: z.string().trim().min(2, 'Cargo/função é obrigatório'),
  equipeId: z.coerce.number().int().positive('Selecione uma equipe válida'),
  tipoContrato: z.enum(['clt', 'pj', 'terceirizado', 'estagio']),
  modeloTrabalho: z.enum(['presencial', 'hibrido', 'remoto']),
  fazPlantao: z.coerce.boolean().default(false),
  sobreAviso: z.coerce.boolean().default(false),
  ativo: z.coerce.boolean().default(true),
});

export type CollaboratorInput = z.infer<typeof collaboratorSchema>;

export class ForbiddenTeamError extends Error {}
export class DuplicateEmailError extends Error {}
export class TeamNotFoundError extends Error {}

export async function listCollaboratorsForUser(user?: JwtPayload) {
  const teamIds = await getVisibleTeamIds(user);
  return collaboratorRepository.findByTeamIds(teamIds);
}

export async function createCollaborator(data: CollaboratorInput, user?: JwtPayload) {
  const teamIds = await getVisibleTeamIds(user);
  if (!teamIds.includes(data.equipeId)) {
    throw new ForbiddenTeamError('Você não tem permissão para cadastrar colaboradores nesta equipe');
  }

  const existing = await collaboratorRepository.findByEmail(data.email);
  if (existing) {
    throw new DuplicateEmailError('Já existe um colaborador com este e-mail');
  }

  const team = await teamRepository.findById(data.equipeId);
  if (!team) {
    throw new TeamNotFoundError('Equipe informada não existe');
  }

  return collaboratorRepository.create(data);
}
