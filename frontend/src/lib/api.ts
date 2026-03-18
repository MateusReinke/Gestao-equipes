export type ApiResult<T> = {
  data: T;
  error: string | null;
};

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://backend:4000';
const DEFAULT_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@gestao.local';
const DEFAULT_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';

let tokenCache: string | null = null;

async function requestJson<T>(input: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(input, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
    });

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function getToken(forceRefresh = false) {
  if (!forceRefresh && tokenCache) return tokenCache;

  const response = await requestJson(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEFAULT_EMAIL, senha: DEFAULT_PASSWORD }),
  });

  if (!response.ok) {
    throw new Error('Não foi possível autenticar o frontend no backend.');
  }

  const data = (await response.json()) as { token: string };
  tokenCache = data.token;
  return tokenCache;
}

export async function fetchApiSafe<T>(path: string, fallback: T): Promise<ApiResult<T>> {
  try {
    let token = await getToken();
    let response = await requestJson(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 15 },
    });

    if (response.status === 401) {
      token = await getToken(true);
      response = await requestJson(`${API_URL}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 15 },
      });
    }

    if (!response.ok) {
      return {
        data: fallback,
        error: `Falha ao consultar ${path}. O painel exibirá dados assim que a API responder normalmente.`,
      };
    }

    return { data: (await response.json()) as T, error: null };
  } catch {
    return {
      data: fallback,
      error: 'Backend ainda indisponível ou em inicialização. Recarregue em instantes.',
    };
  }
}
