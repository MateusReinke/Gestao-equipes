import { Request, Response } from 'express';
import {
  listRoles,
  listPermissions,
  createRole,
  updateRole,
  deleteRole,
  roleSchema,
  roleUpdateSchema,
  RoleNotFoundError,
  SystemRoleImmutableError,
  RoleInUseError,
  DuplicateRoleError,
} from '../services/role.service';
import {
  listTenantUsers,
  inviteUser,
  updateMembership,
  inviteUserSchema,
  updateMembershipSchema,
  EmailInUseError,
  RoleUnavailableError,
  CollaboratorNotFoundError,
  MembershipNotFoundError,
} from '../services/user.service';
import { listEffectivePermissions } from '../services/permission.service';
import { auditFromRequest } from '../services/audit.service';

function handleRoleError(error: unknown, res: Response) {
  if (error instanceof RoleNotFoundError) return res.status(404).json({ error: error.message });
  if (error instanceof SystemRoleImmutableError) return res.status(403).json({ error: error.message });
  if (error instanceof RoleInUseError || error instanceof DuplicateRoleError) {
    return res.status(409).json({ error: error.message });
  }
  throw error;
}

function handleUserError(error: unknown, res: Response) {
  if (error instanceof MembershipNotFoundError) return res.status(404).json({ error: error.message });
  if (error instanceof EmailInUseError) return res.status(409).json({ error: error.message });
  if (error instanceof RoleUnavailableError || error instanceof CollaboratorNotFoundError) {
    return res.status(400).json({ error: error.message });
  }
  throw error;
}

export const rbacController = {
  /// Permissões efetivas do usuário logado — o frontend usa para montar menu e ações.
  async me(req: Request, res: Response) {
    const permissoes = await listEffectivePermissions(req.user!);
    return res.json({
      userId: req.user!.userId,
      email: req.user!.sub,
      isGlobalAdmin: req.user!.isGlobalAdmin,
      activeTenantId: req.user!.activeTenantId,
      roleCodigo: req.user!.roleCodigo,
      permissoes,
    });
  },

  async listPermissions(_req: Request, res: Response) {
    const data = await listPermissions();
    return res.json(data);
  },

  async listRoles(req: Request, res: Response) {
    const data = await listRoles(req.user!.activeTenantId!);
    return res.json(data);
  },

  async createRole(req: Request, res: Response) {
    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const role = await createRole(req.user!.activeTenantId!, parsed.data);
      await auditFromRequest(req, {
        acao: 'permission_change',
        entidade: 'papel',
        entidadeId: role?.id,
        descricao: `Criou o papel "${parsed.data.nome}"`,
        depois: role,
      });
      return res.status(201).json(role);
    } catch (error) {
      return handleRoleError(error, res);
    }
  },

  async updateRole(req: Request, res: Response) {
    const parsed = roleUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const role = await updateRole(req.user!.activeTenantId!, Number(req.params.id), parsed.data);
      await auditFromRequest(req, {
        acao: 'permission_change',
        entidade: 'papel',
        entidadeId: req.params.id,
        descricao: `Atualizou o papel "${role?.nome}"`,
        depois: role,
      });
      return res.json(role);
    } catch (error) {
      return handleRoleError(error, res);
    }
  },

  async deleteRole(req: Request, res: Response) {
    try {
      await deleteRole(req.user!.activeTenantId!, Number(req.params.id));
      await auditFromRequest(req, {
        acao: 'permission_change',
        entidade: 'papel',
        entidadeId: req.params.id,
        descricao: 'Removeu um papel customizado',
      });
      return res.status(204).send();
    } catch (error) {
      return handleRoleError(error, res);
    }
  },

  async listUsers(req: Request, res: Response) {
    const data = await listTenantUsers(req.user!.activeTenantId!);
    return res.json(data);
  },

  async inviteUser(req: Request, res: Response) {
    const parsed = inviteUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const membership = await inviteUser(req.user!.activeTenantId!, parsed.data);
      await auditFromRequest(req, {
        acao: 'create',
        entidade: 'usuario',
        entidadeId: membership.userId,
        descricao: `Adicionou ${parsed.data.email} como ${membership.role.nome}`,
        depois: { userId: membership.userId, role: membership.role.codigo },
      });
      return res.status(201).json(membership);
    } catch (error) {
      return handleUserError(error, res);
    }
  },

  async updateUser(req: Request, res: Response) {
    const parsed = updateMembershipSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const membership = await updateMembership(req.user!.activeTenantId!, Number(req.params.userId), parsed.data);
      await auditFromRequest(req, {
        acao: 'permission_change',
        entidade: 'usuario',
        entidadeId: req.params.userId,
        descricao: 'Atualizou papel/vínculo do usuário',
        depois: membership ? { userId: membership.userId, role: membership.role.codigo, ativo: membership.user.ativo } : null,
      });
      return res.json(membership);
    } catch (error) {
      return handleUserError(error, res);
    }
  },
};
