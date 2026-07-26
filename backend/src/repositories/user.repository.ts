import { prisma } from '../config/prisma';

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  findById(id: number) {
    return prisma.user.findUnique({ where: { id } });
  },
  findByEmailWithMemberships(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { tenant: true, role: true } } },
    });
  },
  /// Usuários vinculados a um tenant (com papel e colaborador).
  findByTenant(tenantId: number) {
    return prisma.tenantMembership.findMany({
      where: { tenantId },
      include: { user: true, role: true, colaborador: true },
      orderBy: [{ role: { ordem: 'asc' } }, { user: { nome: 'asc' } }],
    });
  },
  findMembership(userId: number, tenantId: number) {
    return prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: { user: true, role: true, colaborador: true },
    });
  },
  create(data: { nome: string; email: string; senhaHash: string }) {
    return prisma.user.create({ data });
  },
  createMembership(data: { userId: number; tenantId: number; roleId: number; colaboradorId?: number | null }) {
    return prisma.tenantMembership.create({
      data,
      include: { user: true, role: true, colaborador: true },
    });
  },
  updateMembership(userId: number, tenantId: number, data: { roleId?: number; colaboradorId?: number | null }) {
    return prisma.tenantMembership.update({
      where: { userId_tenantId: { userId, tenantId } },
      data,
      include: { user: true, role: true, colaborador: true },
    });
  },
  setActive(userId: number, ativo: boolean) {
    return prisma.user.update({ where: { id: userId }, data: { ativo } });
  },
};
