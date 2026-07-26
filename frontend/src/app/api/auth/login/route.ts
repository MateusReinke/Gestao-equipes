import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_USER_COOKIE, SESSION_TENANT_COOKIE } from '@/lib/session-cookie';

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://backend:4000';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 12,
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.senha) {
    return NextResponse.json({ error: 'Informe e-mail e senha.' }, { status: 400 });
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body.email, senha: body.senha, tenantId: body.tenantId ?? undefined }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível falar com o servidor. Tente novamente em instantes.' },
      { status: 502 }
    );
  }

  const payload = await backendResponse.json().catch(() => ({}));

  if (!backendResponse.ok) {
    // Conta com acesso a mais de uma empresa: o cliente precisa escolher qual,
    // então isso não é um erro de credencial.
    if (payload.requiresTenantSelection) {
      return NextResponse.json({ requiresTenantSelection: true, tenants: payload.tenants }, { status: 200 });
    }
    return NextResponse.json({ error: payload.error || 'Credenciais inválidas.' }, { status: backendResponse.status });
  }

  const response = NextResponse.json({ ok: true, user: payload.user, activeTenant: payload.activeTenant });

  response.cookies.set(SESSION_COOKIE, payload.token as string, COOKIE_OPTIONS);
  response.cookies.set(SESSION_USER_COOKIE, JSON.stringify(payload.user), COOKIE_OPTIONS);
  if (payload.activeTenant) {
    response.cookies.set(SESSION_TENANT_COOKIE, JSON.stringify(payload.activeTenant), COOKIE_OPTIONS);
  } else {
    response.cookies.delete(SESSION_TENANT_COOKIE);
  }

  return response;
}
