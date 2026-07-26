import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const teamRepository = {
  findAllIds(tenantId: number) {
    return prisma.team.findMany({ where: { tenantId }, select: { id: true } });
  },
  findManagerTeamIds(userId: number, tenantId: number) {
    return prisma.managerTeam.findMany({ where: { gestorId: userId, tenantId }, select: { equipeId: true } });
  },
  /// Equipes às quais o usuário pertence de fato: as que ele gerencia e a do
  /// colaborador vinculado ao seu login. É o alcance de um compartilhamento
  /// com escopo "equipe" — diferente de `getVisibleTeamIds`, que responde
  /// "o que ele pode enxergar" e se abre por completo para quem administra.
  async findUserTeamIds(userId: number, tenantId: number): Promise<number[]> {
    const [gerenciadas, membership] = await Promise.all([
      prisma.managerTeam.findMany({ where: { gestorId: userId, tenantId }, select: { equipeId: true } }),
      prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
        select: { colaborador: { select: { equipeId: true } } },
      }),
    ]);

    const ids = new Set(gerenciadas.map((item) => item.equipeId));
    if (membership?.colaborador?.equipeId != null) ids.add(membership.colaborador.equipeId);
    return [...ids];
  },
  findByIds(tenantId: number, teamIds: number[]) {
    return prisma.team.findMany({
      where: { tenantId, id: { in: teamIds } },
      include: {
        cliente: { select: { id: true, nome: true } },
        colaboradores: { where: { ativo: true }, select: { id: true, nome: true, cargo: true } },
        gestores: { include: { gestor: { select: { id: true, nome: true, email: true } } } },
      },
      orderBy: { nome: 'asc' },
    });
  },
  countByIds(tenantId: number, teamIds: number[]) {
    return prisma.team.findMany({
      where: { tenantId, id: { in: teamIds } },
      include: { cliente: { select: { nome: true } }, _count: { select: { colaboradores: true } } },
    });
  },
  findById(tenantId: number, id: number) {
    return prisma.team.findFirst({ where: { tenantId, id } });
  },
  create(tenantId: number, data: { nome: string; clienteId?: number | null; ativo?: boolean }) {
    return prisma.team.create({ data: { ...data, tenantId }, include: { cliente: true } });
  },
  async update(tenantId: number, id: number, data: Prisma.TeamUncheckedUpdateInput) {
    await prisma.team.updateMany({ where: { id, tenantId }, data });
    return prisma.team.findFirst({ where: { id, tenantId }, include: { cliente: true } });
  },
  /// O que segura a exclusão de uma equipe.
  /// Escala não entra na conta: ela não aponta para a equipe, e sim para os
  /// colaboradores — se não sobrou colaborador, não sobrou atribuição.
  contarVinculos(tenantId: number, id: number) {
    return prisma.$transaction([
      prisma.collaborator.count({ where: { tenantId, equipeId: id } }),
      prisma.shift.count({ where: { tenantId, equipeId: id } }),
    ]);
  },
  async remove(tenantId: number, id: number) {
    // Gestores da equipe e compartilhamentos apontados a ela são vínculos
    // administrativos: somem junto, sem bloquear a exclusão.
    return prisma.$transaction([
      prisma.managerTeam.deleteMany({ where: { tenantId, equipeId: id } }),
      prisma.shareGrant.deleteMany({ where: { tenantId, equipeId: id } }),
      prisma.team.deleteMany({ where: { id, tenantId } }),
    ]);
  },
};
