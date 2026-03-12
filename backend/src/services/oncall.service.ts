import { prisma } from '../config/prisma';
import { registerAudit } from './audit.service';

class OnCallService {
  getToday() {
    const now = new Date();
    return prisma.onCall.findMany({
      where: { dataInicio: { lte: now }, dataFim: { gte: now } },
      include: { colaborador: true, cliente: true },
      orderBy: { dataInicio: 'asc' },
    });
  }

  async getNowSummary() {
    const active = await this.getToday();
    const first = active[0];
    const now = new Date();
    return {
      data: now.toISOString().slice(0, 10),
      hora: now.toTimeString().slice(0, 5),
      turno: first?.descricao || 'Plantão',
      responsavel: first?.colaborador?.nome || null,
      telefone: first?.colaborador?.telefone || null,
    };
  }

  async create(input: {
    dataInicio: string;
    dataFim: string;
    colaboradorId: number;
    clienteId?: number;
    descricao?: string;
    usuario?: string;
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

    await registerAudit({
      usuario: input.usuario || 'sistema',
      acao: 'create',
      tabela: 'plantao_periodos',
      registroId: String(onCall.id),
      dadosNovos: onCall,
    });
    return onCall;
  }
}

export const onCallService = new OnCallService();
