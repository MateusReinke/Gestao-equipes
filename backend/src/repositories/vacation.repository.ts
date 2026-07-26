import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

const vacationInclude = {
  colaborador: { include: { equipe: true } },
  solicitadoPor: { select: { id: true, nome: true, email: true } },
  respondidoPor: { select: { id: true, nome: true, email: true } },
} satisfies Prisma.VacationInclude;

export const vacationRepository = {
  findByTeamIds(tenantId: number, teamIds: number[]) {
    return prisma.vacation.findMany({
      where: { tenantId, colaborador: { equipeId: { in: teamIds } } },
      include: vacationInclude,
      orderBy: [{ dataInicio: 'desc' }],
    });
  },
  findById(tenantId: number, id: number) {
    return prisma.vacation.findFirst({ where: { tenantId, id }, include: vacationInclude });
  },
  /// Férias aprovadas que cruzam o período — base para detectar indisponibilidade.
  findApprovedOverlapping(tenantId: number, inicio: Date, fim: Date) {
    return prisma.vacation.findMany({
      where: { tenantId, status: 'aprovado', dataInicio: { lte: fim }, dataFim: { gte: inicio } },
      select: { id: true, colaboradorId: true, dataInicio: true, dataFim: true },
    });
  },
  findApprovedInRangeForTeams(tenantId: number, teamIds: number[], inicio: Date, fim: Date) {
    return prisma.vacation.findMany({
      where: {
        tenantId,
        status: 'aprovado',
        dataInicio: { lte: fim },
        dataFim: { gte: inicio },
        colaborador: { equipeId: { in: teamIds } },
      },
      include: { colaborador: true },
    });
  },
  create(tenantId: number, data: Omit<Prisma.VacationUncheckedCreateInput, 'tenantId'>) {
    return prisma.vacation.create({ data: { ...data, tenantId }, include: vacationInclude });
  },
  async update(tenantId: number, id: number, data: Prisma.VacationUncheckedUpdateInput) {
    await prisma.vacation.updateMany({ where: { id, tenantId }, data });
    return prisma.vacation.findFirst({ where: { id, tenantId }, include: vacationInclude });
  },
};
