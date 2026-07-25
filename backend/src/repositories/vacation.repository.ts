import { prisma } from '../config/prisma';

export const vacationRepository = {
  findApprovedInRange(start: Date, end: Date) {
    return prisma.vacation.findMany({
      where: { status: 'aprovado', dataInicio: { lt: end }, dataFim: { gte: start } },
      select: { colaboradorId: true },
    });
  },
  findApprovedInRangeForTeams(teamIds: number[], start: Date, end: Date) {
    return prisma.vacation.findMany({
      where: { status: 'aprovado', dataInicio: { lt: end }, dataFim: { gte: start }, colaborador: { equipeId: { in: teamIds } } },
      include: { colaborador: true },
    });
  },
  findByTeamIds(teamIds: number[]) {
    return prisma.vacation.findMany({
      where: { colaborador: { equipeId: { in: teamIds } } },
      include: { colaborador: { include: { equipe: true } } },
    });
  },
};
