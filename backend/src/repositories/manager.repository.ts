import { prisma } from '../config/prisma';

export const managerRepository = {
  findAll() {
    return prisma.user.findMany({
      where: { role: 'gestor' },
      include: { gestorEquipes: { include: { equipe: true } }, colaborador: true },
    });
  },
};
