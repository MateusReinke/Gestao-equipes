import { prisma } from '../config/prisma';

export const teamRepository = {
  findAllIds() {
    return prisma.team.findMany({ select: { id: true } });
  },
  findManagerTeamIds(userId: number) {
    return prisma.managerTeam.findMany({ where: { gestorId: userId }, select: { equipeId: true } });
  },
  findByIds(teamIds: number[]) {
    return prisma.team.findMany({
      where: { id: { in: teamIds } },
      include: { cliente: true, colaboradores: true, gestores: { include: { gestor: true } } },
    });
  },
  countByIds(teamIds: number[]) {
    return prisma.team.findMany({
      where: { id: { in: teamIds } },
      include: { cliente: true, _count: { select: { colaboradores: true } } },
    });
  },
  findById(id: number) {
    return prisma.team.findUnique({ where: { id } });
  },
};
