import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const collaboratorRepository = {
  findByEmail(tenantId: number, email: string) {
    return prisma.collaborator.findFirst({ where: { tenantId, email } });
  },
  findByTeamIds(tenantId: number, teamIds: number[]) {
    return prisma.collaborator.findMany({
      where: { tenantId, equipeId: { in: teamIds } },
      include: { equipe: true, ferias: true },
    });
  },
  findActiveByTeamIds(tenantId: number, teamIds: number[]) {
    return prisma.collaborator.findMany({
      where: { tenantId, equipeId: { in: teamIds }, ativo: true },
      include: { equipe: true },
    });
  },
  create(tenantId: number, data: Omit<Prisma.CollaboratorUncheckedCreateInput, 'tenantId'>) {
    return prisma.collaborator.create({ data: { ...data, tenantId }, include: { equipe: true } });
  },
};
