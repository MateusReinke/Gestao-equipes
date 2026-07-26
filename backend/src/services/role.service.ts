import { z } from 'zod';
import { roleRepository } from '../repositories/role.repository';
import { permissionRepository } from '../repositories/permission.repository';
import { invalidatePermissionCache } from './permission.service';

export const roleSchema = z.object({
  nome: z.string().trim().min(2, 'Nome do papel é obrigatório'),
  descricao: z.string().trim().min(2, 'Descrição é obrigatória'),
  permissoes: z.array(z.string()).default([]),
});

export const roleUpdateSchema = z.object({
  nome: z.string().trim().min(2, 'Nome do papel é obrigatório').optional(),
  descricao: z.string().trim().min(2, 'Descrição é obrigatória').optional(),
  permissoes: z.array(z.string()).optional(),
});

export type RoleInput = z.infer<typeof roleSchema>;
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;

export class RoleNotFoundError extends Error {}
export class SystemRoleImmutableError extends Error {}
export class RoleInUseError extends Error {}
export class DuplicateRoleError extends Error {}

function slugifyCodigo(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export async function listRoles(tenantId: number) {
  const roles = await roleRepository.findAvailable(tenantId);
  return roles.map((role) => ({
    id: role.id,
    codigo: role.codigo,
    nome: role.nome,
    descricao: role.descricao,
    isSystem: role.isSystem,
    ordem: role.ordem,
    tenantId: role.tenantId,
    permissoes: role.permissoes.map((rp) => rp.permission.codigo),
  }));
}

export async function listPermissions() {
  return permissionRepository.findAll();
}

export async function createRole(tenantId: number, data: RoleInput) {
  const codigo = slugifyCodigo(data.nome);
  if (!codigo) throw new DuplicateRoleError('Nome de papel inválido');

  const existing = await roleRepository.findByCodigo(tenantId, codigo);
  if (existing) throw new DuplicateRoleError('Já existe um papel com esse nome nesta empresa');

  const role = await roleRepository.create({
    tenantId,
    codigo,
    nome: data.nome,
    descricao: data.descricao,
    ordem: 200,
  });

  if (data.permissoes.length > 0) {
    const permissions = await permissionRepository.findByCodes(data.permissoes);
    await roleRepository.replacePermissions(role.id, permissions.map((p) => p.id));
  }

  invalidatePermissionCache();
  return roleRepository.findById(role.id);
}

export async function updateRole(tenantId: number, roleId: number, data: RoleUpdateInput) {
  const role = await roleRepository.findById(roleId);
  if (!role) throw new RoleNotFoundError('Papel não encontrado');
  if (role.tenantId !== tenantId) {
    // Papéis de sistema (tenantId null) e de outros tenants não podem ser editados aqui.
    throw new SystemRoleImmutableError('Papéis padrão da plataforma não podem ser editados. Crie um papel próprio da empresa.');
  }

  if (data.nome || data.descricao) {
    await roleRepository.update(roleId, { nome: data.nome, descricao: data.descricao });
  }

  if (data.permissoes) {
    const permissions = await permissionRepository.findByCodes(data.permissoes);
    await roleRepository.replacePermissions(roleId, permissions.map((p) => p.id));
  }

  invalidatePermissionCache();
  return roleRepository.findById(roleId);
}

export async function deleteRole(tenantId: number, roleId: number) {
  const role = await roleRepository.findById(roleId);
  if (!role) throw new RoleNotFoundError('Papel não encontrado');
  if (role.tenantId !== tenantId) {
    throw new SystemRoleImmutableError('Papéis padrão da plataforma não podem ser removidos');
  }

  const emUso = await roleRepository.countMemberships(roleId);
  if (emUso > 0) {
    throw new RoleInUseError(`Este papel está atribuído a ${emUso} usuário(s). Troque o papel deles antes de remover.`);
  }

  await roleRepository.remove(roleId);
  invalidatePermissionCache();
}
