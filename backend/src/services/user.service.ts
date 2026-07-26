import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { userRepository } from '../repositories/user.repository';
import { roleRepository } from '../repositories/role.repository';
import { collaboratorRepository } from '../repositories/collaborator.repository';
import { invalidatePermissionCache } from './permission.service';

export const inviteUserSchema = z.object({
  nome: z.string().trim().min(3, 'Nome é obrigatório'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  senha: z.string().min(8, 'A senha deve ter ao menos 8 caracteres'),
  roleId: z.coerce.number().int().positive('Selecione um papel'),
  colaboradorId: z.coerce.number().int().positive().nullable().optional(),
});

export const updateMembershipSchema = z.object({
  roleId: z.coerce.number().int().positive().optional(),
  colaboradorId: z.coerce.number().int().positive().nullable().optional(),
  ativo: z.boolean().optional(),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>;

export class EmailInUseError extends Error {}
export class RoleUnavailableError extends Error {}
export class CollaboratorNotFoundError extends Error {}
export class MembershipNotFoundError extends Error {}

async function assertRoleAvailable(tenantId: number, roleId: number) {
  const role = await roleRepository.findById(roleId);
  if (!role || (role.tenantId !== null && role.tenantId !== tenantId)) {
    throw new RoleUnavailableError('Papel inválido para esta empresa');
  }
  return role;
}

async function assertCollaborator(tenantId: number, colaboradorId?: number | null) {
  if (colaboradorId == null) return;
  const colaborador = await collaboratorRepository.findById(tenantId, colaboradorId);
  if (!colaborador) throw new CollaboratorNotFoundError('Colaborador informado não existe nesta empresa');
}

export async function listTenantUsers(tenantId: number) {
  const memberships = await userRepository.findByTenant(tenantId);
  return memberships.map((membership) => ({
    userId: membership.user.id,
    nome: membership.user.nome,
    email: membership.user.email,
    ativo: membership.user.ativo,
    isGlobalAdmin: membership.user.isGlobalAdmin,
    role: { id: membership.role.id, codigo: membership.role.codigo, nome: membership.role.nome },
    colaborador: membership.colaborador ? { id: membership.colaborador.id, nome: membership.colaborador.nome } : null,
  }));
}

/// Cria (ou vincula, se o e-mail já existir na plataforma) um usuário neste tenant.
export async function inviteUser(tenantId: number, data: InviteUserInput) {
  await assertRoleAvailable(tenantId, data.roleId);
  await assertCollaborator(tenantId, data.colaboradorId);

  const existing = await userRepository.findByEmail(data.email);

  if (existing) {
    const membership = await userRepository.findMembership(existing.id, tenantId);
    if (membership) throw new EmailInUseError('Este usuário já faz parte desta empresa');

    // Identidade global: o mesmo login passa a ter vínculo também nesta empresa.
    const created = await userRepository.createMembership({
      userId: existing.id,
      tenantId,
      roleId: data.roleId,
      colaboradorId: data.colaboradorId ?? null,
    });
    invalidatePermissionCache(existing.id, tenantId);
    return created;
  }

  const senhaHash = await bcrypt.hash(data.senha, 10);
  const user = await userRepository.create({ nome: data.nome, email: data.email, senhaHash });
  const membership = await userRepository.createMembership({
    userId: user.id,
    tenantId,
    roleId: data.roleId,
    colaboradorId: data.colaboradorId ?? null,
  });
  invalidatePermissionCache(user.id, tenantId);
  return membership;
}

export async function updateMembership(tenantId: number, userId: number, data: UpdateMembershipInput) {
  const membership = await userRepository.findMembership(userId, tenantId);
  if (!membership) throw new MembershipNotFoundError('Usuário não encontrado nesta empresa');

  if (data.roleId != null) await assertRoleAvailable(tenantId, data.roleId);
  if (data.colaboradorId !== undefined) await assertCollaborator(tenantId, data.colaboradorId);

  if (data.ativo !== undefined) {
    await userRepository.setActive(userId, data.ativo);
  }

  const updated =
    data.roleId != null || data.colaboradorId !== undefined
      ? await userRepository.updateMembership(userId, tenantId, {
          roleId: data.roleId,
          colaboradorId: data.colaboradorId,
        })
      : await userRepository.findMembership(userId, tenantId);

  invalidatePermissionCache(userId, tenantId);
  return updated;
}
