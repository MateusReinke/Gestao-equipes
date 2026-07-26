import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { userRepository } from '../repositories/user.repository';
import { tenantRepository } from '../repositories/tenant.repository';
import { roleRepository } from '../repositories/role.repository';
import { JwtPayload } from '../types/auth';

export class InvalidCredentialsError extends Error {}
export class NoTenantAccessError extends Error {}
export class TenantSelectionRequiredError extends Error {
  constructor(public tenants: Array<{ id: number; nome: string; slug: string }>) {
    super('Selecione a empresa para continuar');
  }
}

type TenantSummary = { id: number; nome: string; slug: string };

function signSession(payload: JwtPayload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '12h' });
}

export async function login(email: string, senha: string, tenantId?: number) {
  const user = await userRepository.findByEmailWithMemberships(email);
  if (!user || !user.ativo) throw new InvalidCredentialsError('Credenciais inválidas');

  const valid = await bcrypt.compare(String(senha || ''), user.senhaHash);
  if (!valid) throw new InvalidCredentialsError('Credenciais inválidas');

  const publicUser = { id: user.id, nome: user.nome, email: user.email, isGlobalAdmin: user.isGlobalAdmin };

  if (user.isGlobalAdmin) {
    const token = signSession({ sub: user.email, userId: user.id, isGlobalAdmin: true, activeTenantId: null, roleCodigo: null });
    return { token, user: publicUser, activeTenant: null as TenantSummary | null };
  }

  if (user.memberships.length === 0) {
    throw new NoTenantAccessError('Usuário sem vínculo com nenhuma empresa');
  }

  const membership =
    user.memberships.length === 1
      ? user.memberships[0]
      : (() => {
          if (tenantId == null) {
            throw new TenantSelectionRequiredError(user.memberships.map((m) => ({ id: m.tenant.id, nome: m.tenant.nome, slug: m.tenant.slug })));
          }
          const chosen = user.memberships.find((m) => m.tenantId === tenantId);
          if (!chosen) throw new InvalidCredentialsError('Empresa inválida para este usuário');
          return chosen;
        })();

  const token = signSession({
    sub: user.email,
    userId: user.id,
    isGlobalAdmin: false,
    activeTenantId: membership.tenantId,
    roleCodigo: membership.role.codigo,
  });

  return {
    token,
    user: publicUser,
    activeTenant: { id: membership.tenant.id, nome: membership.tenant.nome, slug: membership.tenant.slug },
  };
}

export async function switchTenant(user: JwtPayload, tenantId: number | null) {
  if (!user.isGlobalAdmin) throw new InvalidCredentialsError('Restrito ao Administrador Global');

  if (tenantId == null) {
    const token = signSession({ sub: user.sub, userId: user.userId, isGlobalAdmin: true, activeTenantId: null, roleCodigo: null });
    return { token, activeTenant: null as TenantSummary | null };
  }

  const tenant = await tenantRepository.findById(tenantId);
  if (!tenant) throw new InvalidCredentialsError('Tenant inválido');

  const adminRole = await roleRepository.findSystemByCodigo('admin_tenant');

  const token = signSession({
    sub: user.sub,
    userId: user.userId,
    isGlobalAdmin: true,
    activeTenantId: tenant.id,
    roleCodigo: adminRole?.codigo ?? 'admin_tenant',
  });
  return { token, activeTenant: { id: tenant.id, nome: tenant.nome, slug: tenant.slug } };
}
