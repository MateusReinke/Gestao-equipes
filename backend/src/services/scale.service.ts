import { z } from 'zod';
import { JwtPayload } from '../types/auth';
import { scaleRepository } from '../repositories/scale.repository';
import { collaboratorRepository } from '../repositories/collaborator.repository';
import { getVisibleTeamIds } from './scope.service';
import { toDateOnly } from '../utils/date';

const detalheSchema = z.object({
  diaSemana: z.coerce.number().int().min(0).max(6),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inicial inválida (HH:MM)'),
  horaFim: z.string().regex(/^\d{2}:\d{2}$/, 'Hora final inválida (HH:MM)'),
});

const atribuicaoSchema = z.object({
  colaboradorId: z.coerce.number().int().positive(),
  ordem: z.coerce.number().int().min(0).default(0),
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de início inválida'),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const scaleSchema = z.object({
  nome: z.string().trim().min(2, 'Nome da escala é obrigatório'),
  tipo: z.enum(['doze_por_trinta_seis', 'cinco_por_dois', 'personalizada']),
  descricao: z.string().trim().min(2, 'Descrição é obrigatória'),
  clienteId: z.coerce.number().int().positive().nullable().optional(),
  detalhes: z.array(detalheSchema).min(1, 'Defina ao menos uma faixa de horário'),
  atribuicoes: z.array(atribuicaoSchema).default([]),
});

export const scaleUpdateSchema = scaleSchema.partial();

export type ScaleInput = z.infer<typeof scaleSchema>;
export type ScaleUpdateInput = z.infer<typeof scaleUpdateSchema>;

export class NoActiveTenantError extends Error {}
export class ScaleNotFoundError extends Error {}
export class InvalidAssignmentError extends Error {}

function requireTenant(user?: JwtPayload): number {
  if (!user || user.activeTenantId == null) throw new NoActiveTenantError('Selecione uma empresa ativa');
  return user.activeTenantId;
}

export async function listScalesForUser(user?: JwtPayload) {
  if (!user || user.activeTenantId == null) return [];
  const teamIds = await getVisibleTeamIds(user);
  if (teamIds.length === 0) return [];

  // Escalas sem colaborador atribuído ainda não aparecem no filtro por equipe;
  // por isso o admin da empresa enxerga todas, para conseguir montá-las.
  const todas = await scaleRepository.findAll(user.activeTenantId);
  return todas.filter(
    (escala) =>
      escala.colaboradores.length === 0 ||
      escala.colaboradores.some((atribuicao) => teamIds.includes(atribuicao.colaborador.equipeId))
  );
}

export async function getScale(scaleId: number, user?: JwtPayload) {
  const tenantId = requireTenant(user);
  const escala = await scaleRepository.findById(tenantId, scaleId);
  if (!escala) throw new ScaleNotFoundError('Escala não encontrada');
  return escala;
}

async function assertCollaborators(tenantId: number, atribuicoes: ScaleInput['atribuicoes']) {
  for (const atribuicao of atribuicoes) {
    const colaborador = await collaboratorRepository.findById(tenantId, atribuicao.colaboradorId);
    if (!colaborador) throw new InvalidAssignmentError('Um dos colaboradores informados não existe nesta empresa');
  }
}

export async function createScale(data: ScaleInput, user?: JwtPayload) {
  const tenantId = requireTenant(user);
  await assertCollaborators(tenantId, data.atribuicoes);

  const escala = await scaleRepository.create(tenantId, {
    nome: data.nome,
    tipo: data.tipo,
    descricao: data.descricao,
    clienteId: data.clienteId ?? null,
  });

  await scaleRepository.replaceDetails(tenantId, escala.id, data.detalhes);
  if (data.atribuicoes.length > 0) {
    await scaleRepository.replaceAssignments(
      tenantId,
      escala.id,
      data.atribuicoes.map((a) => ({
        colaboradorId: a.colaboradorId,
        ordem: a.ordem,
        dataInicio: toDateOnly(a.dataInicio),
        dataFim: a.dataFim ? toDateOnly(a.dataFim) : null,
      }))
    );
  }

  return scaleRepository.findById(tenantId, escala.id);
}

export async function updateScale(scaleId: number, data: ScaleUpdateInput, user?: JwtPayload) {
  const tenantId = requireTenant(user);
  const existing = await scaleRepository.findById(tenantId, scaleId);
  if (!existing) throw new ScaleNotFoundError('Escala não encontrada');

  if (data.atribuicoes) await assertCollaborators(tenantId, data.atribuicoes);

  if (data.nome || data.tipo || data.descricao || data.clienteId !== undefined) {
    await scaleRepository.update(tenantId, scaleId, {
      nome: data.nome,
      tipo: data.tipo,
      descricao: data.descricao,
      clienteId: data.clienteId,
    });
  }

  if (data.detalhes) await scaleRepository.replaceDetails(tenantId, scaleId, data.detalhes);
  if (data.atribuicoes) {
    await scaleRepository.replaceAssignments(
      tenantId,
      scaleId,
      data.atribuicoes.map((a) => ({
        colaboradorId: a.colaboradorId,
        ordem: a.ordem,
        dataInicio: toDateOnly(a.dataInicio),
        dataFim: a.dataFim ? toDateOnly(a.dataFim) : null,
      }))
    );
  }

  const depois = await scaleRepository.findById(tenantId, scaleId);
  return { antes: existing, depois };
}

export async function deleteScale(scaleId: number, user?: JwtPayload) {
  const tenantId = requireTenant(user);
  const existing = await scaleRepository.findById(tenantId, scaleId);
  if (!existing) throw new ScaleNotFoundError('Escala não encontrada');
  await scaleRepository.remove(tenantId, scaleId);
  return existing;
}
