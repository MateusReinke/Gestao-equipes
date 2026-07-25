import { prisma } from '../config/prisma';

export const teamRepository = {
  findAllIds(tenantId: number) {
    return prisma.team.findMany({ where: { tenantId }, select: { id: true } });
  },
  findManagerTeamIds(userId: number, tenantId: number) {
    return prisma.managerTeam.findMany({ where: { gestorId: userId, tenantId }, select: { equipeId: true } });
  },
  findByIds(tenantId: number, teamIds: number[]) {
    return prisma.team.findMany({
      where: { tenantId, id: { in: teamIds } },
      include: { cliente: true, colaboradores: true, gestores: { include: { gestor: true } } },
    });
  },
  countByIds(tenantId: number, teamIds: number[]) {
    return prisma.team.findMany({
      where: { tenantId, id: { in: teamIds } },
      include: { cliente: true, _count: { select: { colaboradores: true } } },
    });
  },
  findById(tenantId: number, id: number) {
    return prisma.team.findFirst({ where: { tenantId, id } });
  },
};
