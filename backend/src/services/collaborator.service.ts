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

export const collaboratorUpdateSchema = collaboratorSchema.partial();

export type CollaboratorInput = z.infer<typeof collaboratorSchema>;
export type CollaboratorUpdateInput = z.infer<typeof collaboratorUpdateSchema>;

export class ForbiddenTeamError extends Error {}
export class DuplicateEmailError extends Error {}
export class TeamNotFoundError extends Error {}
export class NoActiveTenantError extends Error {}
export class CollaboratorNotFoundError extends Error {}

function requireTenant(user?: JwtPayload): number {
  if (!user || user.activeTenantId == null) throw new NoActiveTenantError('Selecione uma empresa ativa');
  return user.activeTenantId;
}

export async function listCollaboratorsForUser(user?: JwtPayload) {
  if (!user || user.activeTenantId == null) return [];
  const teamIds = await getVisibleTeamIds(user);
  if (teamIds.length === 0) return [];
  return collaboratorRepository.findByTeamIds(user.activeTenantId, teamIds);
}

export async function createCollaborator(data: CollaboratorInput, user?: JwtPayload) {
  const tenantId = requireTenant(user);

  const teamIds = await getVisibleTeamIds(user);
  if (!teamIds.includes(data.equipeId)) {
    throw new ForbiddenTeamError('Você não tem permissão para cadastrar colaboradores nesta equipe');
  }

  const existing = await collaboratorRepository.findByEmail(tenantId, data.email);
  if (existing) throw new DuplicateEmailError('Já existe um colaborador com este e-mail nesta empresa');

  const team = await teamRepository.findById(tenantId, data.equipeId);
  if (!team) throw new TeamNotFoundError('Equipe informada não existe');

  return collaboratorRepository.create(tenantId, data);
}

export async function updateCollaborator(collaboratorId: number, data: CollaboratorUpdateInput, user?: JwtPayload) {
  const tenantId = requireTenant(user);

  const existing = await collaboratorRepository.findById(tenantId, collaboratorId);
  if (!existing) throw new CollaboratorNotFoundError('Colaborador não encontrado');

  const teamIds = await getVisibleTeamIds(user);
  if (!teamIds.includes(existing.equipeId)) {
    throw new ForbiddenTeamError('Você não tem permissão para editar colaboradores desta equipe');
  }

  if (data.equipeId != null) {
    if (!teamIds.includes(data.equipeId)) {
      throw new ForbiddenTeamError('Você não tem permissão para mover o colaborador para essa equipe');
    }
    const team = await teamRepository.findById(tenantId, data.equipeId);
    if (!team) throw new TeamNotFoundError('Equipe informada não existe');
  }

  if (data.email && data.email !== existing.email) {
    const duplicate = await collaboratorRepository.findByEmail(tenantId, data.email);
    if (duplicate) throw new DuplicateEmailError('Já existe um colaborador com este e-mail nesta empresa');
  }

  const depois = await collaboratorRepository.update(tenantId, collaboratorId, data);
  return { antes: existing, depois };
}

export class CollaboratorHasHistoryError extends Error {
  constructor(
    message: string,
    readonly detalhes: { turnos: number; escalas: number; ferias: number; ausencias: number; clientes: number; usuario: number }
  ) {
    super(message);
  }
}

/**
 * Remove o colaborador, mas só quando ele não deixa órfão.
 *
 * Quem já apareceu numa escala, tirou férias ou responde por um cliente tem
 * histórico que a auditoria e os relatórios referenciam — apagar reescreveria
 * o passado. Para quem saiu da empresa o caminho certo é desativar
 * (`ativo: false`): ele some da geração de turnos e das listas de seleção, e
 * os registros antigos continuam íntegros.
 */
export async function deleteCollaborator(collaboratorId: number, user?: JwtPayload) {
  const tenantId = requireTenant(user);

  const existing = await collaboratorRepository.findById(tenantId, collaboratorId);
  if (!existing) throw new CollaboratorNotFoundError('Colaborador não encontrado');

  const teamIds = await getVisibleTeamIds(user);
  if (!teamIds.includes(existing.equipeId)) {
    throw new ForbiddenTeamError('Você não tem permissão para remover colaboradores desta equipe');
  }

  const [turnos, escalas, ferias, ausencias, clientes, usuario] = await collaboratorRepository.contarVinculos(
    tenantId,
    collaboratorId
  );

  if (turnos + escalas + ferias + ausencias + clientes + usuario > 0) {
    const partes = [
      turnos > 0 ? `${turnos} turno(s)` : null,
      escalas > 0 ? `${escalas} atribuição(ões) de escala` : null,
      ferias > 0 ? `${ferias} registro(s) de férias` : null,
      ausencias > 0 ? `${ausencias} ausência(s)` : null,
      clientes > 0 ? `${clientes} cliente(s) sob sua responsabilidade` : null,
      usuario > 0 ? 'um usuário vinculado' : null,
    ].filter(Boolean);

    throw new CollaboratorHasHistoryError(
      `${existing.nome} tem ${partes.join(', ')} e não pode ser apagado sem quebrar o histórico. Desative o cadastro: ele sai da escala e das listas, e os registros antigos continuam válidos.`,
      { turnos, escalas, ferias, ausencias, clientes, usuario }
    );
  }

  await collaboratorRepository.remove(tenantId, collaboratorId);
  return existing;
}
