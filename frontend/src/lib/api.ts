const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://backend:4000';
const DEFAULT_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@gestao.local';
const DEFAULT_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';

let tokenCache: string | null = null;

async function getToken() {
  if (tokenCache) return tokenCache;
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEFAULT_EMAIL, senha: DEFAULT_PASSWORD }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Falha ao autenticar no backend para renderizar o painel.');
  }

  const data = (await response.json()) as { token: string };
  tokenCache = data.token;
  return tokenCache;
}

export async function fetchApi<T>(path: string): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 30 },
  });

  if (!response.ok) {
    throw new Error(`Erro ao consultar ${path}`);
  }

  return (await response.json()) as T;
}
