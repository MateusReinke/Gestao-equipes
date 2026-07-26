import { z } from 'zod';
import { JwtPayload } from '../types/auth';
import { shiftRepository } from '../repositories/shift.repository';
import { scaleRepository } from '../repositories/scale.repository';
import { collaboratorRepository } from '../repositories/collaborator.repository';
import { vacationRepository } from '../repositories/vacation.repository';
import { absenceRepository } from '../repositories/absence.repository';
import { getVisibleTeamIds } from './scope.service';
import { generateShifts } from './shift-generator';
import { addDays, dayBounds, formatDateOnly, isTimeBetween, rangesOverlap, toDateOnly } from '../utils/date';

export const generateShiftsSchema = z.object({
  escalaId: z.coerce.number().int().positive('Selecione uma escala'),
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial inválida'),
  fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final inválida'),
  substituirExistentes: z.boolean().default(false),
});

export const shiftSchema = z.object({
  colaboradorId: z.coerce.number().int().positive('Selecione um colaborador'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inicial inválida (HH:MM)'),
  horaFim: z.string().regex(/^\d{2}:\d{2}$/, 'Hora final inválida (HH:MM)'),
  tipo: z.enum(['turno', 'plantao', 'sobreaviso']).default('turno'),
  escalaId: z.coerce.number().int().positive().nullable().optional(),
  clienteId: z.coerce.number().int().positive().nullable().optional(),
  observacao: z.string().trim().max(500).optional(),
});

export const shiftUpdateSchema = z.object({
  colaboradorId: z.coerce.number().int().positive().optional(),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  horaFim: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  tipo: z.enum(['turno', 'plantao', 'sobreaviso']).optional(),
  status: z.enum(['planejado', 'confirmado', 'trocado', 'cancelado']).optional(),
  observacao: z.string().trim().max(500).nullable().optional(),
});

export type GenerateShiftsInput = z.infer<typeof generateShiftsSchema>;
export type ShiftInput = z.infer<typeof shiftSchema>;
export type ShiftUpdateInput = z.infer<typeof shiftUpdateSchema>;

export class NoActiveTenantError extends Error {}
export class ScaleNotFoundError extends Error {}
export class ShiftNotFoundError extends Error {}
export class CollaboratorNotFoundError extends Error {}
export class InvalidRangeError extends Error {}

const MAX_DIAS_GERACAO = 186; // ~6 meses por geração, evita explodir a base sem querer

function requireTenant(user?: JwtPayload): number {
  if (!user || user.activeTenantId == null) {
    throw new NoActiveTenantError('Selecione uma empresa ativa para acessar turnos');
  }
  return user.activeTenantId;
}

export async function listShifts(user: JwtPayload | undefined, params: { inicio: string; fim: string; colaboradorId?: number }) {
  const tenantId = requireTenant(user);
  const teamIds = await getVisibleTeamIds(user);
  if (teamIds.length === 0) return [];

  return shiftRepository.findByRange({
    tenantId,
    inicio: toDateOnly(params.inicio),
    fim: toDateOnly(params.fim),
    teamIds,
    colaboradorId: params.colaboradorId,
  });
}

/**
 * Gera turnos a partir das regras da escala e devolve um resumo do que foi feito,
 * incluindo conflitos com férias/ausências para o gestor decidir o que fazer.
 */
export async function generateShiftsForScale(data: GenerateShiftsInput, user?: JwtPayload) {
  const tenantId = requireTenant(user);

  const inicio = toDateOnly(data.inicio);
  const fim = toDateOnly(data.fim);
  if (fim.getTime() < inicio.getTime()) throw new InvalidRangeError('A data final deve ser posterior à inicial');

  const dias = Math.round((fim.getTime() - inicio.getTime()) / 86_400_000) + 1;
  if (dias > MAX_DIAS_GERACAO) {
    throw new InvalidRangeError(`Gere no máximo ${MAX_DIAS_GERACAO} dias por vez (period solicitado: ${dias} dias)`);
  }

  const escala = await scaleRepository.findById(tenantId, data.escalaId);
  if (!escala) throw new ScaleNotFoundError('Escala não encontrada');

  if (data.substituirExistentes) {
    await shiftRepository.deleteMany(tenantId, { escalaId: escala.id, inicio, fim });
  }

  const gerados = generateShifts({
    tipo: escala.tipo,
    detalhes: escala.detalhes.map((detalhe) => ({
      diaSemana: detalhe.diaSemana,
      horaInicio: detalhe.horaInicio,
      horaFim: detalhe.horaFim,
    })),
    atribuicoes: escala.colaboradores.map((atribuicao) => ({
      colaboradorId: atribuicao.colaboradorId,
      ordem: atribuicao.ordem,
      dataInicio: atribuicao.dataInicio,
      dataFim: atribuicao.dataFim,
    })),
    inicio,
    fim,
  });

  if (gerados.length === 0) {
    return { criados: 0, conflitos: [] as Array<{ colaborador: string; data: string; motivo: string }>, total: 0 };
  }

  // Conflitos: turnos que caem em férias aprovadas ou ausências aprovadas.
  const [ferias, ausencias] = await Promise.all([
    vacationRepository.findApprovedOverlapping(tenantId, inicio, fim),
    absenceRepository.findApprovedOverlapping(tenantId, inicio, fim),
  ]);

  const nomePorColaborador = new Map(escala.colaboradores.map((a) => [a.colaboradorId, a.colaborador.nome]));
  const conflitos: Array<{ colaborador: string; data: string; motivo: string }> = [];

  for (const turno of gerados) {
    const feriasConflito = ferias.find(
      (f) => f.colaboradorId === turno.colaboradorId && rangesOverlap(f.dataInicio, f.dataFim, turno.data, turno.data)
    );
    if (feriasConflito) {
      conflitos.push({
        colaborador: nomePorColaborador.get(turno.colaboradorId) ?? `#${turno.colaboradorId}`,
        data: formatDateOnly(turno.data),
        motivo: 'Férias aprovadas',
      });
      continue;
    }
    const ausenciaConflito = ausencias.find(
      (a) => a.colaboradorId === turno.colaboradorId && rangesOverlap(a.dataInicio, a.dataFim, turno.data, turno.data)
    );
    if (ausenciaConflito) {
      conflitos.push({
        colaborador: nomePorColaborador.get(turno.colaboradorId) ?? `#${turno.colaboradorId}`,
        data: formatDateOnly(turno.data),
        motivo: `Ausência: ${ausenciaConflito.tipo}`,
      });
    }
  }

  const equipePorColaborador = new Map(escala.colaboradores.map((a) => [a.colaboradorId, a.colaborador.equipeId]));

  const resultado = await shiftRepository.createMany(
    tenantId,
    gerados.map((turno) => ({
      colaboradorId: turno.colaboradorId,
      escalaId: escala.id,
      equipeId: equipePorColaborador.get(turno.colaboradorId) ?? null,
      clienteId: escala.clienteId,
      data: turno.data,
      horaInicio: turno.horaInicio,
      horaFim: turno.horaFim,
      tipo: 'turno' as const,
      status: 'planejado' as const,
    }))
  );

  return { criados: resultado.count, total: gerados.length, conflitos };
}

export async function createShift(data: ShiftInput, user?: JwtPayload) {
  const tenantId = requireTenant(user);

  const colaborador = await collaboratorRepository.findById(tenantId, data.colaboradorId);
  if (!colaborador) throw new CollaboratorNotFoundError('Colaborador não encontrado nesta empresa');

  return shiftRepository.create(tenantId, {
    colaboradorId: data.colaboradorId,
    equipeId: colaborador.equipeId,
    escalaId: data.escalaId ?? null,
    clienteId: data.clienteId ?? null,
    data: toDateOnly(data.data),
    horaInicio: data.horaInicio,
    horaFim: data.horaFim,
    tipo: data.tipo,
    status: 'planejado',
    observacao: data.observacao,
  });
}

export async function updateShift(shiftId: number, data: ShiftUpdateInput, user?: JwtPayload) {
  const tenantId = requireTenant(user);

  const existing = await shiftRepository.findById(tenantId, shiftId);
  if (!existing) throw new ShiftNotFoundError('Turno não encontrado');

  if (data.colaboradorId != null) {
    const colaborador = await collaboratorRepository.findById(tenantId, data.colaboradorId);
    if (!colaborador) throw new CollaboratorNotFoundError('Colaborador não encontrado nesta empresa');
  }

  const updated = await shiftRepository.update(tenantId, shiftId, data);
  return { antes: existing, depois: updated };
}

/// Plantonistas/turnos ativos agora, descontando férias e ausências aprovadas.
export async function getCurrentShifts(clienteId: number | undefined, user?: JwtPayload) {
  if (!user || user.activeTenantId == null) return [];
  const tenantId = user.activeTenantId;
  const { start, end } = dayBounds();
  const teamIds = await getVisibleTeamIds(user);
  if (teamIds.length === 0) return [];

  const [ferias, ausencias] = await Promise.all([
    vacationRepository.findApprovedOverlapping(tenantId, start, start),
    absenceRepository.findApprovedOverlapping(tenantId, start, start),
  ]);
  const indisponiveis = [
    ...ferias.map((f) => f.colaboradorId),
    ...ausencias.map((a) => a.colaboradorId),
  ];

  const turnos = await shiftRepository.findForDay({
    tenantId,
    inicio: start,
    fim: end,
    teamIds,
    excludeCollaboratorIds: indisponiveis,
    clienteId,
  });

  const agora = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
  return turnos.filter((turno) => isTimeBetween(agora, turno.horaInicio, turno.horaFim));
}

export async function getUpcomingShifts(clienteId: number | undefined, user?: JwtPayload, take = 10) {
  if (!user || user.activeTenantId == null) return [];
  const teamIds = await getVisibleTeamIds(user);
  if (teamIds.length === 0) return [];
  const { start } = dayBounds();
  return shiftRepository.findUpcoming({ tenantId: user.activeTenantId, inicio: start, teamIds, take, clienteId });
}

/// Turnos dos próximos N dias de um colaborador — usado para escolher o turno numa troca.
export async function listShiftsForCollaborator(colaboradorId: number, user?: JwtPayload, dias = 60) {
  const tenantId = requireTenant(user);
  const { start } = dayBounds();
  return shiftRepository.findByRange({
    tenantId,
    inicio: start,
    fim: addDays(start, dias),
    colaboradorId,
  });
}
