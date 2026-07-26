import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

const absenceInclude = {
  colaborador: { include: { equipe: true } },
  respondidoPor: { select: { id: true, nome: true, email: true } },
} satisfies Prisma.AbsenceInclude;

export const absenceRepository = {
  findByTeamIds(tenantId: number, teamIds: number[]) {
    return prisma.absence.findMany({
      where: { tenantId, colaborador: { equipeId: { in: teamIds } } },
      include: absenceInclude,
      orderBy: [{ dataInicio: 'desc' }],
    });
  },
  findById(tenantId: number, id: number) {
    return prisma.absence.findFirst({ where: { tenantId, id }, include: absenceInclude });
  },
  /// Ausências aprovadas que cruzam o período — usadas para detectar conflito com turnos.
  findApprovedOverlapping(tenantId: number, inicio: Date, fim: Date) {
    return prisma.absence.findMany({
      where: { tenantId, status: 'aprovado', dataInicio: { lte: fim }, dataFim: { gte: inicio } },
      select: { id: true, colaboradorId: true, dataInicio: true, dataFim: true, tipo: true },
    });
  },
  create(tenantId: number, data: Omit<Prisma.AbsenceUncheckedCreateInput, 'tenantId'>) {
    return prisma.absence.create({ data: { ...data, tenantId }, include: absenceInclude });
  },
  async update(tenantId: number, id: number, data: Prisma.AbsenceUncheckedUpdateInput) {
    await prisma.absence.updateMany({ where: { id, tenantId }, data });
    return prisma.absence.findFirst({ where: { id, tenantId }, include: absenceInclude });
  },
};
