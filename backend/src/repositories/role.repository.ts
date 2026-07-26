import { prisma } from '../config/prisma';

export const roleRepository = {
  /// Papéis disponíveis para um tenant: os de sistema (tenantId null) + os próprios.
  findAvailable(tenantId: number) {
    return prisma.role.findMany({
      where: { OR: [{ tenantId: null }, { tenantId }] },
      include: { permissoes: { include: { permission: true } } },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    });
  },
  findById(id: number) {
    return prisma.role.findUnique({
      where: { id },
      include: { permissoes: { include: { permission: true } } },
    });
  },
  findByCodigo(tenantId: number | null, codigo: string) {
    return prisma.role.findFirst({ where: { tenantId, codigo } });
  },
  findSystemByCodigo(codigo: string) {
    return prisma.role.findFirst({ where: { tenantId: null, codigo } });
  },
  create(data: { tenantId: number; codigo: string; nome: string; descricao: string; ordem?: number }) {
    return prisma.role.create({ data });
  },
  update(id: number, data: { nome?: string; descricao?: string; ordem?: number }) {
    return prisma.role.update({ where: { id }, data });
  },
  async replacePermissions(roleId: number, permissionIds: number[]) {
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        skipDuplicates: true,
      }),
    ]);
  },
  countMemberships(roleId: number) {
    return prisma.tenantMembership.count({ where: { roleId } });
  },
  remove(id: number) {
    return prisma.role.delete({ where: { id } });
  },
};
