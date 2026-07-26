import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';
import { CSRF_ERRO, sameOrigin } from '@/lib/csrf';

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://backend:4000';

/**
 * Proxy autenticado entre o navegador e a API.
 *
 * O token de sessão vive num cookie httpOnly, então o navegador não consegue (nem
 * deve) montar o header Authorization sozinho. Este handler acrescenta o token no
 * servidor e devolve a resposta do backend como está.
 *
 * As rotas de /api/auth/* que mexem em cookies (login, logout, switch-tenant) têm
 * arquivos próprios e, por serem mais específicas, têm precedência sobre este.
 */

/// Caminhos que o backend expõe fora do prefixo /api.
/// `plantao` e `clientes/:id/...` são endpoints de operação; `platform` é o
/// console do Administrador Global.
const PREFIXOS_SEM_API = ['plantao', 'platform'];

function backendPath(segmentos: string[], search: string) {
  const caminho = segmentos.join('/');
  const base = PREFIXOS_SEM_API.includes(segmentos[0]) ? `/${caminho}` : `/api/${caminho}`;
  return `${API_URL}${base}${search}`;
}

async function proxy(request: NextRequest, segmentos: string[], method: string) {
  if (method !== 'GET' && !sameOrigin(request)) return NextResponse.json(CSRF_ERRO, { status: 403 });

  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: 'Sessão ausente. Faça login novamente.' }, { status: 401 });

  const url = backendPath(segmentos, request.nextUrl.search);
  const temCorpo = method !== 'GET' && method !== 'DELETE';

  let corpo: string | undefined;
  if (temCorpo) {
    corpo = await request.text();
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(temCorpo ? { 'Content-Type': 'application/json' } : {}),
      },
      body: corpo,
      cache: 'no-store',
    });
  } catch {
    // Sem isso, um erro de rede viraria uma página de erro HTML e o cliente
    // quebraria tentando fazer response.json() nela.
    return NextResponse.json(
      { error: 'Não foi possível falar com o servidor. Tente novamente em instantes.' },
      { status: 502 }
    );
  }

  // 204 não pode ter corpo — NextResponse.json com 204 lança erro.
  if (response.status === 204) return new NextResponse(null, { status: 204 });

  // Nem toda rota devolve JSON: a exportação de relatório manda CSV como anexo.
  // Nesses casos o corpo passa direto, junto com os cabeçalhos que dizem ao
  // navegador que é para baixar.
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const headers = new Headers();
    headers.set('Content-Type', contentType || 'application/octet-stream');
    const disposition = response.headers.get('content-disposition');
    if (disposition) headers.set('Content-Disposition', disposition);
    return new NextResponse(await response.arrayBuffer(), { status: response.status, headers });
  }

  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, { params }: Context) {
  const { path } = await params;
  return proxy(request, path, 'GET');
}

export async function POST(request: NextRequest, { params }: Context) {
  const { path } = await params;
  return proxy(request, path, 'POST');
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const { path } = await params;
  return proxy(request, path, 'PATCH');
}

export async function PUT(request: NextRequest, { params }: Context) {
  const { path } = await params;
  return proxy(request, path, 'PUT');
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const { path } = await params;
  return proxy(request, path, 'DELETE');
}
