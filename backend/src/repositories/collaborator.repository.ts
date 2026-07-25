import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const collaboratorRepository = {
  findByEmail(email: string) {
    return prisma.collaborator.findUnique({ where: { email } });
  },
  findByTeamIds(teamIds: number[]) {
    return prisma.collaborator.findMany({
      where: { equipeId: { in: teamIds } },
      include: { equipe: true, ferias: true },
    });
  },
  findActiveByTeamIds(teamIds: number[]) {
    return prisma.collaborator.findMany({
      where: { equipeId: { in: teamIds }, ativo: true },
      include: { equipe: true },
    });
  },
  create(data: Prisma.CollaboratorUncheckedCreateInput) {
    return prisma.collaborator.create({ data, include: { equipe: true } });
  },
};
