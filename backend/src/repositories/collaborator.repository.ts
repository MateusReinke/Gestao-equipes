import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export const collaboratorRepository = {
  findByEmail(tenantId: number, email: string) {
    return prisma.collaborator.findFirst({ where: { tenantId, email } });
  },
  findById(tenantId: number, id: number) {
    return prisma.collaborator.findFirst({ where: { tenantId, id }, include: { equipe: true } });
  },
  findAll(tenantId: number) {
    return prisma.collaborator.findMany({
      where: { tenantId },
      include: { equipe: true },
      orderBy: { nome: 'asc' },
    });
  },
  findByTeamIds(tenantId: number, teamIds: number[]) {
    return prisma.collaborator.findMany({
      where: { tenantId, equipeId: { in: teamIds } },
      include: { equipe: true, ferias: true, ausencias: true },
      orderBy: { nome: 'asc' },
    });
  },
  findActiveByTeamIds(tenantId: number, teamIds: number[]) {
    return prisma.collaborator.findMany({
      where: { tenantId, equipeId: { in: teamIds }, ativo: true },
      include: { equipe: true },
      orderBy: { nome: 'asc' },
    });
  },
  /// Colaborador vinculado a um usuário dentro do tenant (via TenantMembership).
  findLinkedToUser(userId: number, tenantId: number) {
    return prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { colaboradorId: true },
    });
  },
  create(tenantId: number, data: Omit<Prisma.CollaboratorUncheckedCreateInput, 'tenantId'>) {
    return prisma.collaborator.create({ data: { ...data, tenantId }, include: { equipe: true } });
  },
  async update(tenantId: number, id: number, data: Prisma.CollaboratorUncheckedUpdateInput) {
    await prisma.collaborator.updateMany({ where: { id, tenantId }, data });
    return prisma.collaborator.findFirst({ where: { id, tenantId }, include: { equipe: true } });
  },
};
