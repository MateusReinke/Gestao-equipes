import { prisma } from '../config/prisma';

export const scaleRepository = {
  findByTeamIds(teamIds: number[]) {
    return prisma.scale.findMany({
      where: { colaboradores: { some: { colaborador: { equipeId: { in: teamIds } } } } },
      include: { cliente: true, detalhes: true, colaboradores: { include: { colaborador: { include: { equipe: true } } } } },
    });
  },
};
