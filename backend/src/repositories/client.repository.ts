import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

const clientInclude = {
  responsavelInterno: { include: { equipe: true } },
  equipes: { select: { id: true, nome: true } },
} satisfies Prisma.ClientInclude;

export const clientRepository = {
  findAll(tenantId: number) {
    return prisma.client.findMany({ where: { tenantId }, include: clientInclude, orderBy: { nome: 'asc' } });
  },
  findById(tenantId: number, id: number) {
    return prisma.client.findFirst({ where: { tenantId, id }, include: clientInclude });
  },
  findByTeamIds(tenantId: number, teamIds: number[]) {
    return prisma.client.findMany({
      where: { tenantId, equipes: { some: { id: { in: teamIds } } } },
      include: { responsavelInterno: { select: { id: true, nome: true } } },
      orderBy: { nome: 'asc' },
    });
  },
  create(tenantId: number, data: Omit<Prisma.ClientUncheckedCreateInput, 'tenantId'>) {
    return prisma.client.create({ data: { ...data, tenantId }, include: clientInclude });
  },
  async update(tenantId: number, id: number, data: Partial<Omit<Prisma.ClientUncheckedUpdateInput, 'tenantId'>>) {
    await prisma.client.updateMany({ where: { id, tenantId }, data });
    return prisma.client.findFirst({ where: { id, tenantId }, include: clientInclude });
  },
  remove(tenantId: number, id: number) {
    return prisma.client.deleteMany({ where: { id, tenantId } });
  },
};
