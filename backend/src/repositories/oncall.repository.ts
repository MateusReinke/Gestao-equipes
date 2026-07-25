import { prisma } from '../config/prisma';

export const oncallRepository = {
  findForDay(params: { start: Date; end: Date; clientId?: number; teamIds: number[]; excludeCollaboratorIds: number[] }) {
    return prisma.onCall.findMany({
      where: {
        data: { gte: params.start, lt: params.end },
        clienteId: params.clientId,
        colaborador: {
          equipeId: { in: params.teamIds },
          ativo: true,
          id: { notIn: params.excludeCollaboratorIds },
        },
      },
      include: { cliente: true, colaborador: { include: { equipe: true } } },
    });
  },
  findUpcoming(params: { start: Date; clientId?: number; teamIds: number[]; take: number }) {
    return prisma.onCall.findMany({
      where: {
        data: { gte: params.start },
        clienteId: params.clientId,
        colaborador: { equipeId: { in: params.teamIds }, ativo: true },
      },
      include: { cliente: true, colaborador: { include: { equipe: true } } },
      orderBy: [{ data: 'asc' }, { horaInicio: 'asc' }],
      take: params.take,
    });
  },
  findByTeamIds(teamIds: number[]) {
    return prisma.onCall.findMany({
      where: { colaborador: { equipeId: { in: teamIds } } },
      include: { cliente: true, colaborador: { include: { equipe: true } } },
      orderBy: [{ data: 'asc' }, { horaInicio: 'asc' }],
    });
  },
};
