import { AuditAction, Prisma } from '@prisma/client';
import { Request } from 'express';
import { prisma } from '../config/prisma';

type AuditInput = {
  tenantId?: number | null;
  actorUserId?: number | null;
  actorNome: string;
  acao: AuditAction;
  entidade: string;
  /// Aceita o formato cru de req.params (que o Express tipa como string | string[]).
  entidadeId?: string | number | string[] | null;
  descricao?: string;
  antes?: unknown;
  depois?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  // Datas e tipos do Prisma não são JSON puro; o round-trip normaliza tudo.
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Registra uma entrada na trilha de auditoria.
 * Nunca lança: auditoria não pode derrubar a operação que ela está registrando.
 */
export async function registerAudit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId ?? null,
        actorUserId: input.actorUserId ?? null,
        actorNome: input.actorNome,
        acao: input.acao,
        entidade: input.entidade,
        entidadeId:
          input.entidadeId == null ? null : String(Array.isArray(input.entidadeId) ? input.entidadeId[0] : input.entidadeId),
        descricao: input.descricao,
        antes: toJson(input.antes),
        depois: toJson(input.depois),
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[audit] Falha ao registrar auditoria:', error);
  }
}

/// Extrai IP e user-agent da requisição para anexar ao registro de auditoria.
export function auditContext(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0].trim() || req.socket.remoteAddress || null;
  const userAgent = req.headers['user-agent'] ?? null;
  return { ip, userAgent };
}

/// Atalho para auditar uma ação feita por um usuário autenticado.
export async function auditFromRequest(
  req: Request,
  input: Omit<AuditInput, 'actorUserId' | 'actorNome' | 'tenantId' | 'ip' | 'userAgent'> & { actorNome?: string }
) {
  const { ip, userAgent } = auditContext(req);
  await registerAudit({
    ...input,
    tenantId: req.user?.activeTenantId ?? null,
    actorUserId: req.user?.userId ?? null,
    actorNome: input.actorNome ?? req.user?.sub ?? 'sistema',
    ip,
    userAgent,
  });
}

export const auditRepository = {
  list(params: { tenantId: number; entidade?: string; acao?: AuditAction; take: number; cursor?: number }) {
    return prisma.auditLog.findMany({
      where: {
        tenantId: params.tenantId,
        entidade: params.entidade,
        acao: params.acao,
      },
      include: { actor: { select: { id: true, nome: true, email: true } } },
      orderBy: { id: 'desc' },
      take: params.take,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
  },
};
