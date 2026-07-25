import { prisma } from '../config/prisma';

export const clientRepository = {
  findAll() {
    return prisma.client.findMany({ include: { responsavelInterno: { include: { equipe: true } }, equipes: true } });
  },
  findById(id: number) {
    return prisma.client.findUnique({ where: { id }, include: { responsavelInterno: { include: { equipe: true } } } });
  },
  findByTeamIds(teamIds: number[]) {
    return prisma.client.findMany({
      where: { equipes: { some: { id: { in: teamIds } } } },
      include: { responsavelInterno: true },
    });
  },
};
