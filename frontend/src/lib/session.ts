import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, SESSION_USER_COOKIE, SESSION_TENANT_COOKIE } from './session-cookie';
import type { SessionInfo, SessionTenant, SessionUser } from './session-types';

export { SESSION_COOKIE, SESSION_USER_COOKIE, SESSION_TENANT_COOKIE };
export type { SessionInfo, SessionTenant, SessionUser };

type DecodedToken = { userId: number; isGlobalAdmin: boolean; activeTenantId: number | null; role: 'admin' | 'gestor' | null };

function decodeToken(token: string): DecodedToken | null {
  try {
    const payload = token.split('.')[1];
    const json = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(json) as DecodedToken;
  } catch {
    return null;
  }
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(SESSION_USER_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

async function getSessionTenantCookie(): Promise<SessionTenant | null> {
  const store = await cookies();
  const raw = store.get(SESSION_TENANT_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionTenant;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionInfo | null> {
  const [token, user, tenant] = await Promise.all([getSessionToken(), getSessionUser(), getSessionTenantCookie()]);
  if (!token || !user) return null;

  const decoded = decodeToken(token);
  if (!decoded) return null;

  return { token, user, tenant, role: decoded.role, activeTenantId: decoded.activeTenantId };
}

/** Garante uma sessão válida (usuário logado); não exige tenant ativo. */
export async function requireSession(): Promise<SessionInfo> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

/** Garante sessão válida E tenant ativo selecionado - redireciona o Admin Global sem tenant para o console. */
export async function requireTenantSession(): Promise<SessionInfo> {
  const session = await requireSession();
  if (session.activeTenantId == null) redirect('/console');
  return session;
}
