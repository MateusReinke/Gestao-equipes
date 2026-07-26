import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

const shiftInclude = {
  colaborador: { include: { equipe: true } },
  colaboradorOriginal: { select: { id: true, nome: true } },
  escala: { select: { id: true, nome: true, tipo: true } },
  equipe: { select: { id: true, nome: true } },
  cliente: { select: { id: true, nome: true } },
} satisfies Prisma.ShiftInclude;

export const shiftRepository = {
  findByRange(params: { tenantId: number; inicio: Date; fim: Date; teamIds?: number[]; colaboradorId?: number }) {
    return prisma.shift.findMany({
      where: {
        tenantId: params.tenantId,
        data: { gte: params.inicio, lte: params.fim },
        colaboradorId: params.colaboradorId,
        ...(params.teamIds ? { colaborador: { equipeId: { in: params.teamIds } } } : {}),
      },
      include: shiftInclude,
      orderBy: [{ data: 'asc' }, { horaInicio: 'asc' }],
    });
  },

  findById(tenantId: number, id: number) {
    return prisma.shift.findFirst({ where: { tenantId, id }, include: shiftInclude });
  },

  findManyByIds(tenantId: number, ids: number[]) {
    return prisma.shift.findMany({ where: { tenantId, id: { in: ids } }, include: shiftInclude });
  },

  /// Turnos ativos agora (do dia), já descontando quem está de férias/ausente.
  findForDay(params: { tenantId: number; inicio: Date; fim: Date; teamIds: number[]; excludeCollaboratorIds: number[]; clienteId?: number }) {
    return prisma.shift.findMany({
      where: {
        tenantId: params.tenantId,
        data: { gte: params.inicio, lt: params.fim },
        clienteId: params.clienteId,
        status: { not: 'cancelado' },
        colaborador: {
          equipeId: { in: params.teamIds },
          ativo: true,
          id: { notIn: params.excludeCollaboratorIds },
        },
      },
      include: shiftInclude,
      orderBy: [{ horaInicio: 'asc' }],
    });
  },

  findUpcoming(params: { tenantId: number; inicio: Date; teamIds: number[]; take: number; clienteId?: number }) {
    return prisma.shift.findMany({
      where: {
        tenantId: params.tenantId,
        data: { gte: params.inicio },
        clienteId: params.clienteId,
        status: { not: 'cancelado' },
        colaborador: { equipeId: { in: params.teamIds }, ativo: true },
      },
      include: shiftInclude,
      orderBy: [{ data: 'asc' }, { horaInicio: 'asc' }],
      take: params.take,
    });
  },

  create(tenantId: number, data: Omit<Prisma.ShiftUncheckedCreateInput, 'tenantId'>) {
    return prisma.shift.create({ data: { ...data, tenantId }, include: shiftInclude });
  },

  createMany(tenantId: number, data: Array<Omit<Prisma.ShiftUncheckedCreateInput, 'tenantId'>>) {
    return prisma.shift.createMany({
      data: data.map((item) => ({ ...item, tenantId })),
      skipDuplicates: true,
    });
  },

  async update(tenantId: number, id: number, data: Prisma.ShiftUncheckedUpdateInput) {
    await prisma.shift.updateMany({ where: { id, tenantId }, data });
    return prisma.shift.findFirst({ where: { id, tenantId }, include: shiftInclude });
  },

  deleteMany(tenantId: number, params: { escalaId?: number; inicio: Date; fim: Date }) {
    return prisma.shift.deleteMany({
      where: {
        tenantId,
        escalaId: params.escalaId,
        data: { gte: params.inicio, lte: params.fim },
        // Nunca apaga turnos que já foram trocados: eles carregam uma decisão humana.
        status: { notIn: ['trocado'] },
      },
    });
  },

  /// Aplica a troca em uma transação: os dois turnos trocam de dono de uma vez só.
  applySwap(params: {
    turnoOrigemId: number;
    turnoDestinoId: number | null;
    colaboradorOrigemId: number;
    colaboradorDestinoId: number;
  }) {
    const operations: Prisma.PrismaPromise<unknown>[] = [
      prisma.shift.update({
        where: { id: params.turnoOrigemId },
        data: {
          colaboradorId: params.colaboradorDestinoId,
          colaboradorOriginalId: params.colaboradorOrigemId,
          status: 'trocado',
        },
      }),
    ];

    if (params.turnoDestinoId != null) {
      operations.push(
        prisma.shift.update({
          where: { id: params.turnoDestinoId },
          data: {
            colaboradorId: params.colaboradorOrigemId,
            colaboradorOriginalId: params.colaboradorDestinoId,
            status: 'trocado',
          },
        })
      );
    }

    return prisma.$transaction(operations);
  },
};
