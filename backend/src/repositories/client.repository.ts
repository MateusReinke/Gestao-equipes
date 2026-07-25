import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const clientRepository = {
  findAll(tenantId: number) {
    return prisma.client.findMany({
      where: { tenantId },
      include: { responsavelInterno: { include: { equipe: true } }, equipes: true },
    });
  },
  findById(tenantId: number, id: number) {
    return prisma.client.findFirst({
      where: { tenantId, id },
      include: { responsavelInterno: { include: { equipe: true } } },
    });
  },
  findByTeamIds(tenantId: number, teamIds: number[]) {
    return prisma.client.findMany({
      where: { tenantId, equipes: { some: { id: { in: teamIds } } } },
      include: { responsavelInterno: true },
    });
  },
  create(tenantId: number, data: Omit<Prisma.ClientUncheckedCreateInput, 'tenantId'>) {
    return prisma.client.create({
      data: { ...data, tenantId },
      include: { responsavelInterno: { include: { equipe: true } }, equipes: true },
    });
  },
};
