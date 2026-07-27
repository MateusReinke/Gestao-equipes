import { getSessionToken } from './session';

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://backend:4000';

export class UnauthenticatedError extends Error {}

async function requireToken(): Promise<string> {
  const token = await getSessionToken();
  if (!token) throw new UnauthenticatedError('Sessão expirada ou ausente. Faça login novamente.');
  return token;
}

/// Carrega o status junto da mensagem: há telas que precisam distinguir
/// "recurso desligado neste ambiente" (503) de "deu erro" para dizer a coisa
/// certa em vez de um alerta vermelho genérico.
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function fetchApi<T>(path: string): Promise<T> {
  const token = await requireToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    // A mensagem do backend explica o motivo; o caminho é só o último recurso.
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(payload.error || `Erro ao consultar ${path}`, response.status);
  }

  return (await response.json()) as T;
}

/// Versão tolerante: uma seção que falha não derruba a página inteira.
export async function fetchApiSafe<T>(
  path: string,
  fallback: T
): Promise<{ data: T; error: string | null; status: number }> {
  try {
    const data = await fetchApi<T>(path);
    return { data, error: null, status: 200 };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha inesperada ao carregar dados.';
    return { data: fallback, error: message, status: error instanceof ApiError ? error.status : 0 };
  }
}

type MutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; issues?: Record<string, string[] | undefined> };

async function mutate<T>(path: string, method: string, body?: unknown): Promise<MutationResult<T>> {
  const token = await requireToken();

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, error: 'Não foi possível falar com o servidor. Tente novamente em instantes.' };
  }

  if (response.status === 204) return { ok: true, data: undefined as T };

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { ok: false, error: payload.error || `Erro ao processar ${path}`, issues: payload.issues };
  }

  return { ok: true, data: payload as T };
}

export const postApi = <T>(path: string, body: unknown) => mutate<T>(path, 'POST', body);
export const patchApi = <T>(path: string, body: unknown) => mutate<T>(path, 'PATCH', body);
export const deleteApi = <T>(path: string) => mutate<T>(path, 'DELETE');
