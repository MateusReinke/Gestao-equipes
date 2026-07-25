import { prisma } from '../config/prisma';

export const managerRepository = {
  findAll(tenantId: number) {
    return prisma.tenantMembership.findMany({
      where: { tenantId, role: 'gestor' },
      include: {
        colaborador: true,
        user: {
          include: {
            gestorEquipes: { where: { tenantId }, include: { equipe: true } },
          },
        },
      },
    });
  },
};
