import { prisma } from '../config/prisma';

export const permissionRepository = {
  findAll() {
    return prisma.permission.findMany({ orderBy: [{ categoria: 'asc' }, { codigo: 'asc' }] });
  },
  findByCodes(codigos: string[]) {
    return prisma.permission.findMany({ where: { codigo: { in: codigos } } });
  },
  /// Permissões que vêm do papel do usuário dentro do tenant.
  findRolePermissionsForMembership(userId: number, tenantId: number) {
    return prisma.permission.findMany({
      where: {
        roles: {
          some: {
            role: {
              memberships: { some: { userId, tenantId } },
            },
          },
        },
      },
      select: { codigo: true },
    });
  },
  /// Concessões/revogações pontuais do usuário naquele tenant.
  findOverrides(userId: number, tenantId: number) {
    return prisma.userPermissionOverride.findMany({
      where: { userId, tenantId },
      include: { permission: { select: { codigo: true } } },
    });
  },
};
