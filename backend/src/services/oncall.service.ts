import { prisma } from '../config/prisma';
import { registerAudit } from './audit.service';

class OnCallService {
  getToday() {
    const now = new Date();
    return prisma.onCall.findMany({
      where: { dataInicio: { lte: now }, dataFim: { gte: now } },
      include: { colaborador: true, cliente: true },
    });
  }

  getNow() {
    return this.getToday();
  }

  async create(input: {
    dataInicio: string;
    dataFim: string;
    colaboradorId: number;
    clienteId?: number;
    descricao?: string;
  }) {
    const onCall = await prisma.onCall.create({
      data: {
        dataInicio: new Date(input.dataInicio),
        dataFim: new Date(input.dataFim),
        colaboradorId: input.colaboradorId,
        clienteId: input.clienteId,
        descricao: input.descricao,
      },
      include: { colaborador: true, cliente: true },
    });

    await registerAudit('plantao', 'create', onCall);
    return onCall;
  }
}

export const onCallService = new OnCallService();
