import { prisma } from '../config/prisma';
import { registerAudit } from './audit.service';
import { toDateOnly } from '../utils/date';

class ScheduleService {
  async createSchedule(input: {
    data: string;
    colaboradorId: number;
    turnoId: number;
    clienteId?: number;
    observacao?: string;
    usuario?: string;
  }) {
    const date = toDateOnly(input.data);
    const vacation = await prisma.vacation.findFirst({
      where: {
        colaboradorId: input.colaboradorId,
        status: 'aprovado',
        dataInicio: { lte: date },
        dataFim: { gte: date },
      },
    });

    if (vacation) throw new Error('Colaborador está de férias nesta data');

    const existing = await prisma.schedule.findUnique({
      where: { data_colaboradorId: { data: date, colaboradorId: input.colaboradorId } },
    });

    if (existing) throw new Error('Colaborador já possui turno definido para esta data');

    const schedule = await prisma.schedule.create({
      data: {
        data: date,
        colaboradorId: input.colaboradorId,
        turnoId: input.turnoId,
        clienteId: input.clienteId,
        observacao: input.observacao,
      },
      include: { colaborador: true, turno: true, cliente: true },
    });

    await registerAudit({
      usuario: input.usuario || 'sistema',
      acao: 'create',
      tabela: 'escalas',
      registroId: String(schedule.id),
      dadosNovos: schedule,
    });
    return schedule;
  }

  getByDate(date: string) {
    return prisma.schedule.findMany({
      where: { data: toDateOnly(date) },
      include: { colaborador: true, turno: true, cliente: true },
      orderBy: [{ colaborador: { nome: 'asc' } }],
    });
  }

  getByCollaborator(colaboradorId: number) {
    return prisma.schedule.findMany({
      where: { colaboradorId },
      include: { colaborador: true, turno: true, cliente: true },
      orderBy: [{ data: 'asc' }],
    });
  }
}

export const scheduleService = new ScheduleService();
