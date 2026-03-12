import { prisma } from '../config/prisma';
import { toDateOnly } from '../utils/date';

class DashboardService {
  async summary() {
    const now = new Date();
    const today = toDateOnly(now);

    const [onCallToday, workingNow, nextShifts, vacations, holidays] = await Promise.all([
      prisma.onCall.findMany({
        where: { dataInicio: { lte: now }, dataFim: { gte: now } },
        include: { colaborador: true, cliente: true },
      }),
      prisma.schedule.findMany({
        where: { data: today },
        include: { colaborador: true, turno: true, cliente: true },
      }),
      prisma.schedule.findMany({
        where: { data: { gte: today } },
        include: { colaborador: true, turno: true },
        orderBy: [{ data: 'asc' }],
        take: 10,
      }),
      prisma.vacation.findMany({
        where: {
          aprovado: true,
          dataInicio: { lte: today },
          dataFim: { gte: today },
        },
        include: { colaborador: true },
      }),
      prisma.holiday.findMany({ where: { data: { gte: today } }, orderBy: { data: 'asc' }, take: 15 }),
    ]);

    return { onCallToday, workingNow, nextShifts, vacations, holidays };
  }
}

export const dashboardService = new DashboardService();
