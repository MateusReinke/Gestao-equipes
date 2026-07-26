import { cookies } from 'next/headers';

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://backend:4000';
export const SESSION_COOKIE = 'session';

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function fetchApi<T>(path: string): Promise<T> {
  const token = await getSessionToken();
  if (!token) throw new Error('Sessão não encontrada. Faça login novamente.');

  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 30 },
  });

  if (!response.ok) {
    throw new Error(`Erro ao consultar ${path}`);
  }

  return (await response.json()) as T;
}

export async function postApi<T>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string; issues?: Record<string, string[] | undefined> }> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: 'Sessão não encontrada. Faça login novamente.' };

  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { ok: false, error: payload.error || `Erro ao enviar dados para ${path}`, issues: payload.issues };
  }

  return { ok: true, data: payload as T };
}

export async function fetchApiSafe<T>(path: string, fallback: T): Promise<{ data: T; error: string | null }> {
  try {
    const data = await fetchApi<T>(path);
    return { data, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha inesperada ao carregar dados do painel.';
    return { data: fallback, error: message };
  }
}

export type SessionUser = { id: number; nome: string; email: string; role: 'admin' | 'gestor' | 'rh' | 'monitoramento' | 'cliente'; clienteId: number | null; colaboradorId: number | null };

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    return await fetchApi<SessionUser>('/auth/me');
  } catch {
    return null;
  }
}
