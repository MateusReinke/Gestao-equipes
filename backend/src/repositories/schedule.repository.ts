import { prisma } from '../config/prisma';

export const scheduleRepository = {
  getByDate(date: Date) {
    return prisma.schedule.findMany({
      where: { data: date },
      include: { colaborador: true, turno: true, cliente: true },
      orderBy: { colaborador: { nome: 'asc' } },
    });
  },
  async create(data: {
    data: Date;
    colaboradorId: number;
    turnoId: number;
    clienteId?: number;
    observacao?: string;
  }) {
    return prisma.schedule.create({ data });
  },
};
