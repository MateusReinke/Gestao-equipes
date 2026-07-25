import { getSessionToken } from './session';

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://backend:4000';

export class UnauthenticatedError extends Error {}

async function requireToken(): Promise<string> {
  const token = await getSessionToken();
  if (!token) throw new UnauthenticatedError('Sessão expirada ou ausente. Faça login novamente.');
  return token;
}

export async function fetchApi<T>(path: string): Promise<T> {
  const token = await requireToken();
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
  const token = await requireToken();

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, error: 'Não foi possível falar com o servidor. Tente novamente em instantes.' };
  }

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
