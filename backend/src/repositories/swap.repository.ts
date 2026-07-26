import { Prisma, SwapStatus } from '@prisma/client';
import { prisma } from '../config/prisma';

const swapInclude = {
  solicitante: { select: { id: true, nome: true, equipeId: true } },
  destinatario: { select: { id: true, nome: true, equipeId: true } },
  turnoOrigem: { include: { colaborador: { select: { id: true, nome: true } } } },
  turnoDestino: { include: { colaborador: { select: { id: true, nome: true } } } },
  respondidoPor: { select: { id: true, nome: true, email: true } },
} satisfies Prisma.ShiftSwapInclude;

export const swapRepository = {
  list(tenantId: number, params: { status?: SwapStatus; teamIds?: number[] }) {
    return prisma.shiftSwap.findMany({
      where: {
        tenantId,
        status: params.status,
        ...(params.teamIds
          ? { OR: [{ solicitante: { equipeId: { in: params.teamIds } } }, { destinatario: { equipeId: { in: params.teamIds } } }] }
          : {}),
      },
      include: swapInclude,
      orderBy: [{ status: 'asc' }, { id: 'desc' }],
    });
  },
  findById(tenantId: number, id: number) {
    return prisma.shiftSwap.findFirst({ where: { tenantId, id }, include: swapInclude });
  },
  /// Existe outro pedido em aberto envolvendo este turno?
  findOpenBySshift(tenantId: number, turnoId: number) {
    return prisma.shiftSwap.findFirst({
      where: {
        tenantId,
        status: { in: ['pendente', 'aceito_pelo_par'] },
        OR: [{ turnoOrigemId: turnoId }, { turnoDestinoId: turnoId }],
      },
    });
  },
  create(tenantId: number, data: Omit<Prisma.ShiftSwapUncheckedCreateInput, 'tenantId'>) {
    return prisma.shiftSwap.create({ data: { ...data, tenantId }, include: swapInclude });
  },
  async update(tenantId: number, id: number, data: Prisma.ShiftSwapUncheckedUpdateInput) {
    await prisma.shiftSwap.updateMany({ where: { id, tenantId }, data });
    return prisma.shiftSwap.findFirst({ where: { id, tenantId }, include: swapInclude });
  },
};
