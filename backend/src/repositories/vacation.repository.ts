import { prisma } from '../config/prisma';

export const vacationRepository = {
  findApprovedInRange(tenantId: number, start: Date, end: Date) {
    return prisma.vacation.findMany({
      where: { tenantId, status: 'aprovado', dataInicio: { lt: end }, dataFim: { gte: start } },
      select: { colaboradorId: true },
    });
  },
  findApprovedInRangeForTeams(tenantId: number, teamIds: number[], start: Date, end: Date) {
    return prisma.vacation.findMany({
      where: {
        tenantId,
        status: 'aprovado',
        dataInicio: { lt: end },
        dataFim: { gte: start },
        colaborador: { equipeId: { in: teamIds } },
      },
      include: { colaborador: true },
    });
  },
  findByTeamIds(tenantId: number, teamIds: number[]) {
    return prisma.vacation.findMany({
      where: { tenantId, colaborador: { equipeId: { in: teamIds } } },
      include: { colaborador: { include: { equipe: true } } },
    });
  },
};
