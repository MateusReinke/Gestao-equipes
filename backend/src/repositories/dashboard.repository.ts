import { Prisma, DashboardVisibility } from '@prisma/client';
import { prisma } from '../config/prisma';

const listInclude = {
  owner: { select: { id: true, nome: true } },
  versaoAtual: { select: { id: true, versao: true, createdAt: true } },
  _count: { select: { versoes: true } },
} satisfies Prisma.DashboardInclude;

export const dashboardRepository = {
  /// Dashboards de que o usuário é dono, dentro do tenant.
  findOwnedBy(tenantId: number, ownerUserId: number) {
    return prisma.dashboard.findMany({
      where: { tenantId, ownerUserId },
      include: listInclude,
      orderBy: { nome: 'asc' },
    });
  },

  /// Dashboards alcançados por compartilhamento. Os ids vêm resolvidos do
  /// share.service — aqui só materializamos. Sem filtro de tenant: uma concessão
  /// de escopo `plataforma` alcança dashboards de outra empresa de propósito.
  findByIds(ids: number[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return prisma.dashboard.findMany({
      where: { id: { in: ids } },
      include: { ...listInclude, tenant: { select: { id: true, nome: true } } },
      orderBy: { nome: 'asc' },
    });
  },

  findById(id: number) {
    return prisma.dashboard.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, nome: true } },
        tenant: { select: { id: true, nome: true } },
        versaoAtual: true,
      },
    });
  },

  findVersions(dashboardId: number) {
    return prisma.dashboardVersion.findMany({
      where: { dashboardId },
      select: {
        id: true,
        versao: true,
        nota: true,
        createdAt: true,
        criadoPor: { select: { id: true, nome: true } },
      },
      orderBy: { versao: 'desc' },
      take: 50,
    });
  },

  findVersion(dashboardId: number, versionId: number) {
    return prisma.dashboardVersion.findFirst({ where: { id: versionId, dashboardId } });
  },

  /// Cria o dashboard e a versão 1 numa transação, deixando `versaoAtualId`
  /// já apontando para ela — nunca existe dashboard sem versão publicada.
  async createWithFirstVersion(data: {
    tenantId: number;
    nome: string;
    descricao?: string | null;
    ownerUserId: number;
    layout: Prisma.InputJsonValue;
  }) {
    return prisma.$transaction(async (tx) => {
      const dashboard = await tx.dashboard.create({
        data: {
          tenantId: data.tenantId,
          nome: data.nome,
          descricao: data.descricao ?? null,
          ownerUserId: data.ownerUserId,
        },
      });

      const versao = await tx.dashboardVersion.create({
        data: {
          dashboardId: dashboard.id,
          versao: 1,
          layout: data.layout,
          nota: 'Versão inicial',
          criadoPorId: data.ownerUserId,
        },
      });

      return tx.dashboard.update({
        where: { id: dashboard.id },
        data: { versaoAtualId: versao.id },
        include: { owner: { select: { id: true, nome: true } }, versaoAtual: true },
      });
    });
  },

  updateMeta(id: number, data: { nome?: string; descricao?: string | null; visibilidade?: DashboardVisibility }) {
    return prisma.dashboard.update({
      where: { id },
      data,
      include: { owner: { select: { id: true, nome: true } }, versaoAtual: true },
    });
  },

  /// Publica um novo layout como versão seguinte. O número da versão é lido
  /// dentro da transação para não colidir com uma publicação concorrente.
  async publishVersion(data: {
    dashboardId: number;
    layout: Prisma.InputJsonValue;
    nota?: string | null;
    criadoPorId: number;
  }) {
    return prisma.$transaction(async (tx) => {
      const ultima = await tx.dashboardVersion.findFirst({
        where: { dashboardId: data.dashboardId },
        orderBy: { versao: 'desc' },
        select: { versao: true },
      });

      const versao = await tx.dashboardVersion.create({
        data: {
          dashboardId: data.dashboardId,
          versao: (ultima?.versao ?? 0) + 1,
          layout: data.layout,
          nota: data.nota ?? null,
          criadoPorId: data.criadoPorId,
        },
      });

      return tx.dashboard.update({
        where: { id: data.dashboardId },
        data: { versaoAtualId: versao.id },
        include: { owner: { select: { id: true, nome: true } }, versaoAtual: true },
      });
    });
  },

  async remove(id: number) {
    // A versão atual é referenciada pelo dashboard; soltar o ponteiro antes
    // evita que o delete em cascata esbarre na FK.
    await prisma.dashboard.update({ where: { id }, data: { versaoAtualId: null } });
    return prisma.dashboard.delete({ where: { id } });
  },

  findFavoriteIds(userId: number) {
    return prisma.dashboardFavorite.findMany({ where: { userId }, select: { dashboardId: true } });
  },

  addFavorite(dashboardId: number, userId: number) {
    return prisma.dashboardFavorite.upsert({
      where: { dashboardId_userId: { dashboardId, userId } },
      create: { dashboardId, userId },
      update: {},
    });
  },

  removeFavorite(dashboardId: number, userId: number) {
    return prisma.dashboardFavorite.deleteMany({ where: { dashboardId, userId } });
  },
};
