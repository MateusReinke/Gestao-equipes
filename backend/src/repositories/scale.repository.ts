import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

const scaleInclude = {
  cliente: { select: { id: true, nome: true } },
  detalhes: { orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }] },
  colaboradores: {
    include: { colaborador: { include: { equipe: true } } },
    orderBy: { ordem: 'asc' },
  },
} satisfies Prisma.ScaleInclude;

export const scaleRepository = {
  findAll(tenantId: number) {
    return prisma.scale.findMany({ where: { tenantId }, include: scaleInclude, orderBy: { nome: 'asc' } });
  },
  findByTeamIds(tenantId: number, teamIds: number[]) {
    return prisma.scale.findMany({
      where: { tenantId, colaboradores: { some: { colaborador: { equipeId: { in: teamIds } } } } },
      include: scaleInclude,
      orderBy: { nome: 'asc' },
    });
  },
  findById(tenantId: number, id: number) {
    return prisma.scale.findFirst({ where: { tenantId, id }, include: scaleInclude });
  },
  create(tenantId: number, data: Omit<Prisma.ScaleUncheckedCreateInput, 'tenantId'>) {
    return prisma.scale.create({ data: { ...data, tenantId }, include: scaleInclude });
  },
  async update(tenantId: number, id: number, data: Prisma.ScaleUncheckedUpdateInput) {
    await prisma.scale.updateMany({ where: { id, tenantId }, data });
    return prisma.scale.findFirst({ where: { id, tenantId }, include: scaleInclude });
  },
  async replaceDetails(tenantId: number, escalaId: number, detalhes: Array<{ diaSemana: number; horaInicio: string; horaFim: string }>) {
    await prisma.$transaction([
      prisma.scaleDetail.deleteMany({ where: { escalaId, tenantId } }),
      prisma.scaleDetail.createMany({ data: detalhes.map((d) => ({ ...d, escalaId, tenantId })) }),
    ]);
  },
  async replaceAssignments(
    tenantId: number,
    escalaId: number,
    atribuicoes: Array<{ colaboradorId: number; ordem: number; dataInicio: Date; dataFim?: Date | null }>
  ) {
    await prisma.$transaction([
      prisma.scaleAssignment.deleteMany({ where: { escalaId, tenantId } }),
      prisma.scaleAssignment.createMany({
        data: atribuicoes.map((a) => ({ ...a, escalaId, tenantId, dataFim: a.dataFim ?? null })),
      }),
    ]);
  },
  remove(tenantId: number, id: number) {
    return prisma.scale.deleteMany({ where: { id, tenantId } });
  },
};
