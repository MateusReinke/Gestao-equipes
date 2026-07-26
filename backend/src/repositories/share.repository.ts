import { Prisma, ShareAccess, ShareResourceType, ShareScope } from '@prisma/client';
import { prisma } from '../config/prisma';

const destinatarioInclude = {
  usuario: { select: { id: true, nome: true, email: true } },
  equipe: { select: { id: true, nome: true } },
  papel: { select: { id: true, nome: true, codigo: true } },
  criadoPor: { select: { id: true, nome: true } },
} satisfies Prisma.ShareGrantInclude;

export type ShareTargetInput = {
  escopo: ShareScope;
  usuarioId?: number | null;
  equipeId?: number | null;
  papelId?: number | null;
};

export const shareRepository = {
  /// Concessões de um recurso específico, para montar o painel de compartilhamento.
  listForResource(tenantId: number, recursoTipo: ShareResourceType, recursoId: number) {
    return prisma.shareGrant.findMany({
      where: { tenantId, recursoTipo, recursoId },
      include: destinatarioInclude,
      orderBy: [{ escopo: 'asc' }, { createdAt: 'asc' }],
    });
  },

  /// Tudo que foi compartilhado dentro do tenant — visão administrativa.
  listForTenant(tenantId: number, recursoTipo?: ShareResourceType) {
    return prisma.shareGrant.findMany({
      where: { tenantId, ...(recursoTipo ? { recursoTipo } : {}) },
      include: destinatarioInclude,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  },

  findById(tenantId: number, id: number) {
    return prisma.shareGrant.findFirst({ where: { id, tenantId }, include: destinatarioInclude });
  },

  findByToken(token: string) {
    return prisma.shareGrant.findUnique({ where: { token } });
  },

  /// Usada para não duplicar concessão para o mesmo destinatário: em vez de criar
  /// uma segunda linha, o serviço promove o nível de acesso da existente.
  findExistingTarget(
    tenantId: number,
    recursoTipo: ShareResourceType,
    recursoId: number,
    alvo: ShareTargetInput
  ) {
    return prisma.shareGrant.findFirst({
      where: {
        tenantId,
        recursoTipo,
        recursoId,
        escopo: alvo.escopo,
        usuarioId: alvo.usuarioId ?? null,
        equipeId: alvo.equipeId ?? null,
        papelId: alvo.papelId ?? null,
      },
    });
  },

  create(data: {
    tenantId: number;
    recursoTipo: ShareResourceType;
    recursoId: number;
    escopo: ShareScope;
    usuarioId?: number | null;
    equipeId?: number | null;
    papelId?: number | null;
    token?: string | null;
    acesso: ShareAccess;
    expiraEm?: Date | null;
    criadoPorId?: number | null;
  }) {
    return prisma.shareGrant.create({ data, include: destinatarioInclude });
  },

  updateAccess(id: number, acesso: ShareAccess, expiraEm?: Date | null) {
    return prisma.shareGrant.update({
      where: { id },
      data: { acesso, ...(expiraEm !== undefined ? { expiraEm } : {}) },
      include: destinatarioInclude,
    });
  },

  remove(tenantId: number, id: number) {
    return prisma.shareGrant.deleteMany({ where: { id, tenantId } });
  },

  removeAllForResource(tenantId: number, recursoTipo: ShareResourceType, recursoId: number) {
    return prisma.shareGrant.deleteMany({ where: { tenantId, recursoTipo, recursoId } });
  },

  /**
   * Concessões que alcançam um usuário dentro de um tenant.
   * Um usuário é alcançado por: uma concessão nominal, uma concessão para uma
   * equipe que ele gerencia ou de que participa, uma concessão para o papel que
   * ele exerce, uma concessão para o tenant inteiro, ou uma concessão de plataforma.
   * Concessões expiradas e as de link público ficam de fora — o link tem fluxo próprio.
   */
  findReachingUser(params: {
    tenantId: number;
    userId: number;
    roleId: number | null;
    teamIds: number[];
    recursoTipo?: ShareResourceType;
    agora?: Date;
  }) {
    const agora = params.agora ?? new Date();
    return prisma.shareGrant.findMany({
      where: {
        ...(params.recursoTipo ? { recursoTipo: params.recursoTipo } : {}),
        AND: [
          { OR: [{ expiraEm: null }, { expiraEm: { gt: agora } }] },
          {
            OR: [
              { tenantId: params.tenantId, escopo: 'usuario', usuarioId: params.userId },
              ...(params.teamIds.length > 0
                ? [{ tenantId: params.tenantId, escopo: 'equipe' as const, equipeId: { in: params.teamIds } }]
                : []),
              ...(params.roleId != null
                ? [{ tenantId: params.tenantId, escopo: 'papel' as const, papelId: params.roleId }]
                : []),
              { tenantId: params.tenantId, escopo: 'tenant' },
              // Escopo de plataforma vale em qualquer tenant, inclusive fora do dono do recurso.
              { escopo: 'plataforma' },
            ],
          },
        ],
      },
      select: { recursoTipo: true, recursoId: true, acesso: true, escopo: true, tenantId: true },
    });
  },
};
