import { prisma } from '../config/prisma';

export const scaleRepository = {
  findByTeamIds(tenantId: number, teamIds: number[]) {
    return prisma.scale.findMany({
      where: { tenantId, colaboradores: { some: { colaborador: { equipeId: { in: teamIds } } } } },
      include: { cliente: true, detalhes: true, colaboradores: { include: { colaborador: { include: { equipe: true } } } } },
    });
  },
};
