import { SwapStatus } from '@prisma/client';
import { z } from 'zod';
import { JwtPayload } from '../types/auth';
import { swapRepository } from '../repositories/swap.repository';
import { shiftRepository } from '../repositories/shift.repository';
import { collaboratorRepository } from '../repositories/collaborator.repository';
import { getVisibleTeamIds } from './scope.service';
import { userHasPermission } from './permission.service';
import { PERMISSIONS } from '../types/permissions';

export const swapRequestSchema = z
  .object({
    tipo: z.enum(['troca', 'cobertura']).default('troca'),
    turnoOrigemId: z.coerce.number().int().positive('Selecione o turno que você quer trocar'),
    destinatarioId: z.coerce.number().int().positive('Selecione o colega'),
    turnoDestinoId: z.coerce.number().int().positive().nullable().optional(),
    motivo: z.string().trim().min(3, 'Descreva o motivo da troca').max(500),
  })
  .refine((data) => data.tipo === 'cobertura' || data.turnoDestinoId != null, {
    message: 'Em uma troca mútua, selecione também o turno do colega que você vai assumir',
    path: ['turnoDestinoId'],
  });

export const swapResponseSchema = z.object({
  observacao: z.string().trim().max(500).optional(),
});

export type SwapRequestInput = z.infer<typeof swapRequestSchema>;

export class NoActiveTenantError extends Error {}
export class SwapNotFoundError extends Error {}
export class ShiftNotFoundError extends Error {}
export class InvalidSwapError extends Error {}
export class SwapForbiddenError extends Error {}
export class SwapAlreadyResolvedError extends Error {}

function requireTenant(user?: JwtPayload): number {
  if (!user || user.activeTenantId == null) {
    throw new NoActiveTenantError('Selecione uma empresa ativa');
  }
  return user.activeTenantId;
}

/// Colaborador vinculado ao usuário logado neste tenant (quem "é" ele na operação).
async function getOwnCollaboratorId(user: JwtPayload, tenantId: number): Promise<number | null> {
  const membership = await collaboratorRepository.findLinkedToUser(user.userId, tenantId);
  return membership?.colaboradorId ?? null;
}

export async function listSwaps(user: JwtPayload | undefined, status?: SwapStatus) {
  const tenantId = requireTenant(user);
  const podeAprovar = await userHasPermission(user!, PERMISSIONS.SHIFT_APPROVE_SWAP);
  const teamIds = await getVisibleTeamIds(user);

  // Quem aprova enxerga as trocas das equipes que gerencia; os demais, as suas próprias.
  if (podeAprovar) {
    return swapRepository.list(tenantId, { status, teamIds });
  }

  const ownId = await getOwnCollaboratorId(user!, tenantId);
  const todas = await swapRepository.list(tenantId, { status });
  if (ownId == null) return [];
  return todas.filter((swap) => swap.solicitanteId === ownId || swap.destinatarioId === ownId);
}

export async function requestSwap(data: SwapRequestInput, user?: JwtPayload) {
  const tenantId = requireTenant(user);

  const turnoOrigem = await shiftRepository.findById(tenantId, data.turnoOrigemId);
  if (!turnoOrigem) throw new ShiftNotFoundError('Turno de origem não encontrado');

  const destinatario = await collaboratorRepository.findById(tenantId, data.destinatarioId);
  if (!destinatario) throw new InvalidSwapError('Colega informado não existe nesta empresa');

  if (turnoOrigem.colaboradorId === data.destinatarioId) {
    throw new InvalidSwapError('Não faz sentido trocar um turno com a própria pessoa');
  }

  // Quem não pode editar turnos de terceiros só pode pedir troca do próprio turno.
  const podeEditarQualquer = await userHasPermission(user!, PERMISSIONS.SHIFT_EDIT);
  if (!podeEditarQualquer) {
    const ownId = await getOwnCollaboratorId(user!, tenantId);
    if (ownId == null || turnoOrigem.colaboradorId !== ownId) {
      throw new SwapForbiddenError('Você só pode solicitar troca dos seus próprios turnos');
    }
  }

  const jaExiste = await swapRepository.findOpenBySshift(tenantId, turnoOrigem.id);
  if (jaExiste) throw new InvalidSwapError('Já existe um pedido de troca em aberto para este turno');

  let turnoDestinoId: number | null = null;
  if (data.tipo === 'troca') {
    const turnoDestino = await shiftRepository.findById(tenantId, data.turnoDestinoId!);
    if (!turnoDestino) throw new ShiftNotFoundError('Turno do colega não encontrado');
    if (turnoDestino.colaboradorId !== data.destinatarioId) {
      throw new InvalidSwapError('O turno selecionado não pertence ao colega escolhido');
    }
    if (turnoDestino.id === turnoOrigem.id) {
      throw new InvalidSwapError('Selecione dois turnos diferentes');
    }
    const destinoOcupado = await swapRepository.findOpenBySshift(tenantId, turnoDestino.id);
    if (destinoOcupado) throw new InvalidSwapError('O turno do colega já está em outro pedido de troca');
    turnoDestinoId = turnoDestino.id;
  }

  return swapRepository.create(tenantId, {
    tipo: data.tipo,
    solicitanteId: turnoOrigem.colaboradorId,
    destinatarioId: data.destinatarioId,
    turnoOrigemId: turnoOrigem.id,
    turnoDestinoId,
    motivo: data.motivo,
    status: 'pendente',
  });
}

/// O colega aceita a troca; ainda depende da aprovação de quem gerencia.
export async function acceptSwap(swapId: number, user?: JwtPayload) {
  const tenantId = requireTenant(user);
  const swap = await swapRepository.findById(tenantId, swapId);
  if (!swap) throw new SwapNotFoundError('Pedido de troca não encontrado');
  if (swap.status !== 'pendente') throw new SwapAlreadyResolvedError('Este pedido já foi respondido');

  const ownId = await getOwnCollaboratorId(user!, tenantId);
  const podeAprovar = await userHasPermission(user!, PERMISSIONS.SHIFT_APPROVE_SWAP);
  if (ownId !== swap.destinatarioId && !podeAprovar) {
    throw new SwapForbiddenError('Apenas o colega envolvido pode aceitar este pedido');
  }

  return swapRepository.update(tenantId, swapId, { status: 'aceito_pelo_par' });
}

/// Aprova e aplica a troca: os turnos efetivamente trocam de dono.
export async function approveSwap(swapId: number, observacao: string | undefined, user?: JwtPayload) {
  const tenantId = requireTenant(user);
  const swap = await swapRepository.findById(tenantId, swapId);
  if (!swap) throw new SwapNotFoundError('Pedido de troca não encontrado');
  if (swap.status === 'aprovado') throw new SwapAlreadyResolvedError('Esta troca já foi aprovada');
  if (swap.status === 'rejeitado' || swap.status === 'cancelado') {
    throw new SwapAlreadyResolvedError('Este pedido já foi encerrado');
  }

  await shiftRepository.applySwap({
    turnoOrigemId: swap.turnoOrigemId,
    turnoDestinoId: swap.turnoDestinoId,
    colaboradorOrigemId: swap.solicitanteId,
    colaboradorDestinoId: swap.destinatarioId,
  });

  return swapRepository.update(tenantId, swapId, {
    status: 'aprovado',
    respondidoPorId: user!.userId,
    respondidoEm: new Date(),
    observacaoResposta: observacao,
  });
}

export async function rejectSwap(swapId: number, observacao: string | undefined, user?: JwtPayload) {
  const tenantId = requireTenant(user);
  const swap = await swapRepository.findById(tenantId, swapId);
  if (!swap) throw new SwapNotFoundError('Pedido de troca não encontrado');
  if (swap.status === 'aprovado') throw new SwapAlreadyResolvedError('Esta troca já foi aprovada e aplicada');
  if (swap.status === 'rejeitado' || swap.status === 'cancelado') {
    throw new SwapAlreadyResolvedError('Este pedido já foi encerrado');
  }

  const ownId = await getOwnCollaboratorId(user!, tenantId);
  const podeAprovar = await userHasPermission(user!, PERMISSIONS.SHIFT_APPROVE_SWAP);
  if (ownId !== swap.destinatarioId && !podeAprovar) {
    throw new SwapForbiddenError('Você não pode recusar este pedido');
  }

  return swapRepository.update(tenantId, swapId, {
    status: 'rejeitado',
    respondidoPorId: user!.userId,
    respondidoEm: new Date(),
    observacaoResposta: observacao,
  });
}

/// O próprio solicitante desiste do pedido, antes de ser aplicado.
export async function cancelSwap(swapId: number, user?: JwtPayload) {
  const tenantId = requireTenant(user);
  const swap = await swapRepository.findById(tenantId, swapId);
  if (!swap) throw new SwapNotFoundError('Pedido de troca não encontrado');
  if (swap.status === 'aprovado') throw new SwapAlreadyResolvedError('Esta troca já foi aplicada');

  const ownId = await getOwnCollaboratorId(user!, tenantId);
  const podeAprovar = await userHasPermission(user!, PERMISSIONS.SHIFT_APPROVE_SWAP);
  if (ownId !== swap.solicitanteId && !podeAprovar) {
    throw new SwapForbiddenError('Apenas quem abriu o pedido pode cancelá-lo');
  }

  return swapRepository.update(tenantId, swapId, { status: 'cancelado' });
}
