import { randomBytes } from 'crypto';
import { z } from 'zod';
import { ShareAccess, ShareResourceType, ShareScope } from '@prisma/client';
import { JwtPayload } from '../types/auth';
import { shareRepository } from '../repositories/share.repository';
import { teamRepository } from '../repositories/team.repository';
import { userRepository } from '../repositories/user.repository';
import { roleRepository } from '../repositories/role.repository';

export class NoActiveTenantError extends Error {}
export class ShareTargetInvalidError extends Error {}
export class ShareNotFoundError extends Error {}
export class ShareScopeNotAllowedError extends Error {}

/// Ordem de força dos níveis de acesso. Quando duas concessões alcançam a mesma
/// pessoa (ex.: uma para a equipe dela e outra nominal), vale a mais permissiva.
const FORCA: Record<ShareAccess, number> = { leitura: 1, edicao: 2, gestao: 3 };

export function maiorAcesso(a: ShareAccess, b: ShareAccess): ShareAccess {
  return FORCA[a] >= FORCA[b] ? a : b;
}

export function permiteEditar(acesso: ShareAccess | null): boolean {
  return acesso === 'edicao' || acesso === 'gestao';
}

export function permiteGerir(acesso: ShareAccess | null): boolean {
  return acesso === 'gestao';
}

export const shareSchema = z
  .object({
    escopo: z.enum(['usuario', 'equipe', 'papel', 'tenant', 'link_publico', 'plataforma']),
    usuarioId: z.coerce.number().int().positive().optional().nullable(),
    equipeId: z.coerce.number().int().positive().optional().nullable(),
    papelId: z.coerce.number().int().positive().optional().nullable(),
    acesso: z.enum(['leitura', 'edicao', 'gestao']).default('leitura'),
    expiraEm: z.coerce.date().optional().nullable(),
  })
  .refine((data) => data.escopo !== 'usuario' || data.usuarioId != null, {
    message: 'Selecione o usuário que receberá o acesso',
    path: ['usuarioId'],
  })
  .refine((data) => data.escopo !== 'equipe' || data.equipeId != null, {
    message: 'Selecione a equipe que receberá o acesso',
    path: ['equipeId'],
  })
  .refine((data) => data.escopo !== 'papel' || data.papelId != null, {
    message: 'Selecione o papel que receberá o acesso',
    path: ['papelId'],
  })
  // Link público é sempre leitura: quem tem o link não passou por autenticação.
  .refine((data) => data.escopo !== 'link_publico' || data.acesso === 'leitura', {
    message: 'Link público só pode conceder leitura',
    path: ['acesso'],
  });

export type ShareInput = z.infer<typeof shareSchema>;

function requireTenant(user?: JwtPayload): number {
  if (!user || user.activeTenantId == null) throw new NoActiveTenantError('Selecione uma empresa ativa');
  return user.activeTenantId;
}

/**
 * Mapa `tipo:id` -> maior acesso que as concessões dão a este usuário.
 * O dono do recurso não aparece aqui: a posse é resolvida por quem chama.
 */
export async function getSharedAccessMap(
  user: JwtPayload,
  recursoTipo?: ShareResourceType
): Promise<Map<string, ShareAccess>> {
  const mapa = new Map<string, ShareAccess>();
  if (user.activeTenantId == null) return mapa;

  const tenantId = user.activeTenantId;
  const [membership, teamIds] = await Promise.all([
    userRepository.findMembership(user.userId, tenantId),
    teamRepository.findUserTeamIds(user.userId, tenantId),
  ]);

  const concessoes = await shareRepository.findReachingUser({
    tenantId,
    userId: user.userId,
    roleId: membership?.roleId ?? null,
    teamIds,
    recursoTipo,
  });

  for (const concessao of concessoes) {
    const chave = `${concessao.recursoTipo}:${concessao.recursoId}`;
    const atual = mapa.get(chave);
    mapa.set(chave, atual ? maiorAcesso(atual, concessao.acesso) : concessao.acesso);
  }

  return mapa;
}

/**
 * Acesso efetivo de um usuário a um recurso, já considerando a posse.
 * Retorna null quando ele não alcança o recurso de forma nenhuma.
 */
export async function getEffectiveAccess(params: {
  user: JwtPayload;
  recursoTipo: ShareResourceType;
  recursoId: number;
  ownerUserId: number;
  recursoTenantId: number;
}): Promise<ShareAccess | null> {
  // Dono manda no próprio recurso.
  if (params.ownerUserId === params.user.userId) return 'gestao';
  // O Administrador Global enxerga qualquer tenant por definição do papel.
  if (params.user.isGlobalAdmin) return 'gestao';

  const mapa = await getSharedAccessMap(params.user, params.recursoTipo);
  return mapa.get(`${params.recursoTipo}:${params.recursoId}`) ?? null;
}

export async function listResourceShares(
  recursoTipo: ShareResourceType,
  recursoId: number,
  user?: JwtPayload
) {
  const tenantId = requireTenant(user);
  return shareRepository.listForResource(tenantId, recursoTipo, recursoId);
}

export async function listTenantShares(recursoTipo: ShareResourceType | undefined, user?: JwtPayload) {
  const tenantId = requireTenant(user);
  return shareRepository.listForTenant(tenantId, recursoTipo);
}

/// Valida que o destinatário existe dentro do tenant — impede compartilhar
/// com um usuário/equipe/papel de outra empresa passando o id na mão.
async function validarDestinatario(tenantId: number, data: ShareInput) {
  if (data.escopo === 'usuario') {
    const membership = await userRepository.findMembership(data.usuarioId!, tenantId);
    if (!membership) throw new ShareTargetInvalidError('Usuário não pertence a esta empresa');
  }
  if (data.escopo === 'equipe') {
    const equipe = await teamRepository.findById(tenantId, data.equipeId!);
    if (!equipe) throw new ShareTargetInvalidError('Equipe não encontrada nesta empresa');
  }
  if (data.escopo === 'papel') {
    const papel = await roleRepository.findAvailableById(tenantId, data.papelId!);
    if (!papel) throw new ShareTargetInvalidError('Papel não encontrado nesta empresa');
  }
}

export async function shareResource(params: {
  recursoTipo: ShareResourceType;
  recursoId: number;
  data: ShareInput;
  user?: JwtPayload;
}) {
  const tenantId = requireTenant(params.user);
  const { data } = params;

  // Compartilhar com toda a plataforma cruza a fronteira entre empresas —
  // é decisão de quem administra a plataforma, não de um tenant.
  if (data.escopo === 'plataforma' && !params.user?.isGlobalAdmin) {
    throw new ShareScopeNotAllowedError('Apenas o Administrador Global pode compartilhar com toda a plataforma');
  }

  await validarDestinatario(tenantId, data);

  const alvo = {
    escopo: data.escopo as ShareScope,
    usuarioId: data.escopo === 'usuario' ? data.usuarioId ?? null : null,
    equipeId: data.escopo === 'equipe' ? data.equipeId ?? null : null,
    papelId: data.escopo === 'papel' ? data.papelId ?? null : null,
  };

  // Link público é o único escopo que pode se repetir: cada link é um segredo
  // distinto, e revogar um não deve derrubar os outros.
  if (data.escopo !== 'link_publico') {
    const existente = await shareRepository.findExistingTarget(tenantId, params.recursoTipo, params.recursoId, alvo);
    if (existente) {
      return shareRepository.updateAccess(existente.id, data.acesso as ShareAccess, data.expiraEm ?? null);
    }
  }

  return shareRepository.create({
    tenantId,
    recursoTipo: params.recursoTipo,
    recursoId: params.recursoId,
    ...alvo,
    token: data.escopo === 'link_publico' ? randomBytes(24).toString('base64url') : null,
    acesso: data.acesso as ShareAccess,
    expiraEm: data.expiraEm ?? null,
    criadoPorId: params.user?.userId ?? null,
  });
}

export async function revokeShare(shareId: number, user?: JwtPayload) {
  const tenantId = requireTenant(user);
  const existente = await shareRepository.findById(tenantId, shareId);
  if (!existente) throw new ShareNotFoundError('Compartilhamento não encontrado');
  await shareRepository.remove(tenantId, shareId);
  return existente;
}

export async function revokeAllForResource(
  recursoTipo: ShareResourceType,
  recursoId: number,
  tenantId: number
) {
  return shareRepository.removeAllForResource(tenantId, recursoTipo, recursoId);
}

/// Resolve um link público em um recurso, se o token existir e não tiver expirado.
export async function resolvePublicToken(token: string) {
  const concessao = await shareRepository.findByToken(token);
  if (!concessao || concessao.escopo !== 'link_publico') return null;
  if (concessao.expiraEm && concessao.expiraEm <= new Date()) return null;
  return concessao;
}
