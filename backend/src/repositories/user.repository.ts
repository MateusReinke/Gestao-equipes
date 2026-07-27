import { prisma } from '../config/prisma';

/**
 * Campos do usuário que podem sair do backend.
 *
 * `include: { user: true }` traz `senhaHash` junto, e as respostas de vínculo
 * vão direto para a tela — foi assim que o hash da senha de um usuário recém
 * convidado acabava no corpo do POST /api/usuarios. Hash não é senha, mas é
 * material para ataque offline e não tem por que trafegar.
 *
 * O login não passa por aqui: usa `findByEmailWithMemberships`, que é o único
 * lugar que legitimamente precisa do hash.
 */
const USUARIO_PUBLICO = {
  id: true,
  nome: true,
  email: true,
  ativo: true,
  isGlobalAdmin: true,
  createdAt: true,
  updatedAt: true,
} as const;

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
      include: { user: { select: USUARIO_PUBLICO }, role: true, colaborador: true },
      orderBy: [{ role: { ordem: 'asc' } }, { user: { nome: 'asc' } }],
    });
  },
  findMembership(userId: number, tenantId: number) {
    return prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: { user: { select: USUARIO_PUBLICO }, role: true, colaborador: true },
    });
  },
  /// Quais dos ids informados são membros ATIVOS desta empresa.
  /// Usado antes de conceder qualquer vínculo que amplie visibilidade: passar
  /// um id de outro tenant não pode virar acesso aos dados deste.
  async findActiveMemberIds(tenantId: number, userIds: number[]): Promise<number[]> {
    if (userIds.length === 0) return [];
    const membros = await prisma.tenantMembership.findMany({
      where: { tenantId, userId: { in: userIds }, user: { ativo: true } },
      select: { userId: true },
    });
    return membros.map((membro) => membro.userId);
  },
  create(data: { nome: string; email: string; senhaHash: string }) {
    return prisma.user.create({ data });
  },
  createMembership(data: { userId: number; tenantId: number; roleId: number; colaboradorId?: number | null }) {
    return prisma.tenantMembership.create({
      data,
      include: { user: { select: USUARIO_PUBLICO }, role: true, colaborador: true },
    });
  },
  updateMembership(userId: number, tenantId: number, data: { roleId?: number; colaboradorId?: number | null }) {
    return prisma.tenantMembership.update({
      where: { userId_tenantId: { userId, tenantId } },
      data,
      include: { user: { select: USUARIO_PUBLICO }, role: true, colaborador: true },
    });
  },
  setActive(userId: number, ativo: boolean) {
    return prisma.user.update({ where: { id: userId }, data: { ativo } });
  },
};
