import { permissionRepository } from '../repositories/permission.repository';
import { JwtPayload } from '../types/auth';

const CACHE_TTL_MS = 30_000;

type CacheEntry = { permissoes: Set<string>; expiraEm: number };
const cache = new Map<string, CacheEntry>();

function cacheKey(userId: number, tenantId: number) {
  return `${userId}:${tenantId}`;
}

/// Invalida o cache de permissões. Chamado sempre que papéis, permissões de papel
/// ou overrides mudam, para a alteração valer imediatamente em vez de esperar o TTL.
export function invalidatePermissionCache(userId?: number, tenantId?: number) {
  if (userId != null && tenantId != null) {
    cache.delete(cacheKey(userId, tenantId));
    return;
  }
  cache.clear();
}

/**
 * Permissões efetivas = (união das permissões dos papéis) + overrides "grant" - overrides "deny".
 * O Administrador Global tem acesso irrestrito por definição.
 */
export async function getEffectivePermissions(userId: number, tenantId: number): Promise<Set<string>> {
  const key = cacheKey(userId, tenantId);
  const cached = cache.get(key);
  if (cached && cached.expiraEm > Date.now()) return cached.permissoes;

  const [rolePermissions, overrides] = await Promise.all([
    permissionRepository.findRolePermissionsForMembership(userId, tenantId),
    permissionRepository.findOverrides(userId, tenantId),
  ]);

  const permissoes = new Set(rolePermissions.map((item) => item.codigo));
  for (const override of overrides) {
    if (override.efeito === 'grant') permissoes.add(override.permission.codigo);
    else permissoes.delete(override.permission.codigo);
  }

  cache.set(key, { permissoes, expiraEm: Date.now() + CACHE_TTL_MS });
  return permissoes;
}

export async function userHasPermission(user: JwtPayload, permissao: string): Promise<boolean> {
  if (user.isGlobalAdmin) return true;
  if (user.activeTenantId == null) return false;
  const permissoes = await getEffectivePermissions(user.userId, user.activeTenantId);
  return permissoes.has(permissao);
}

export async function listEffectivePermissions(user: JwtPayload): Promise<string[]> {
  if (user.activeTenantId == null) return [];
  if (user.isGlobalAdmin) {
    const todas = await permissionRepository.findAll();
    return todas.map((item) => item.codigo);
  }
  const permissoes = await getEffectivePermissions(user.userId, user.activeTenantId);
  return [...permissoes].sort();
}
