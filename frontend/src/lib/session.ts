import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, SESSION_USER_COOKIE } from './session-cookie';
import type { SessionUser } from './session-types';

export { SESSION_COOKIE, SESSION_USER_COOKIE };
export type { SessionUser };

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(SESSION_USER_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<{ token: string; user: SessionUser }> {
  const [token, user] = await Promise.all([getSessionToken(), getSessionUser()]);
  if (!token || !user) {
    redirect('/login');
  }
  return { token, user };
}
