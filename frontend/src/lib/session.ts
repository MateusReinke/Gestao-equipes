import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, SESSION_USER_COOKIE, SESSION_TENANT_COOKIE } from './session-cookie';
import { can, type PermissionCode, type SessionInfo, type SessionTenant, type SessionUser } from './session-types';

export { SESSION_COOKIE, SESSION_USER_COOKIE, SESSION_TENANT_COOKIE };
export type { SessionInfo, SessionTenant, SessionUser };

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://backend:4000';

type DecodedToken = {
  userId: number;
  isGlobalAdmin: boolean;
  activeTenantId: number | null;
  roleCodigo: string | null;
};

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

async function readJsonCookie<T>(name: string): Promise<T | null> {
  const store = await cookies();
  const raw = store.get(name)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/// Permissões efetivas vêm do backend, nunca do cookie: o cliente não pode
/// se auto-conceder acesso editando o próprio cookie.
async function fetchPermissions(token: string): Promise<string[]> {
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { permissoes?: string[] };
    return data.permissoes ?? [];
  } catch {
    return [];
  }
}

export async function getSession(): Promise<SessionInfo | null> {
  const [token, user, tenant] = await Promise.all([
    getSessionToken(),
    readJsonCookie<SessionUser>(SESSION_USER_COOKIE),
    readJsonCookie<SessionTenant>(SESSION_TENANT_COOKIE),
  ]);
  if (!token || !user) return null;

  const decoded = decodeToken(token);
  if (!decoded) return null;

  const permissoes = await fetchPermissions(token);

  return {
    token,
    user,
    tenant,
    roleCodigo: decoded.roleCodigo,
    activeTenantId: decoded.activeTenantId,
    permissoes,
  };
}

/// Garante uma sessão válida (usuário logado); não exige tenant ativo.
export async function requireSession(): Promise<SessionInfo> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

/// Garante sessão válida E tenant ativo — o Administrador Global sem empresa
/// selecionada é mandado para o console da plataforma.
export async function requireTenantSession(): Promise<SessionInfo> {
  const session = await requireSession();
  if (session.activeTenantId == null) redirect('/console');
  return session;
}

/// Garante que o usuário tem ao menos uma das permissões informadas.
/// Sem isso, acessar a URL direto renderizaria uma página vazia em vez de barrar —
/// a API já bloqueia os dados, mas a rota também não deve abrir.
export async function requirePermissionSession(...permissoes: PermissionCode[]): Promise<SessionInfo> {
  const session = await requireTenantSession();
  if (!can(session.permissoes, ...permissoes)) redirect('/sem-permissao');
  return session;
}
