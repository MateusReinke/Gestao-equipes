import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_USER_COOKIE, SESSION_TENANT_COOKIE } from '@/lib/session-cookie';
import { callBackend } from '@/lib/backend-proxy';

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://backend:4000';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.senha) {
    return NextResponse.json({ error: 'Informe e-mail e senha.' }, { status: 400 });
  }

  const result = await callBackend(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: body.email, senha: body.senha, tenantId: body.tenantId ?? undefined }),
    cache: 'no-store',
  });

  if (!result.ok) {
    if (result.payload.requiresTenantSelection) {
      return NextResponse.json({ requiresTenantSelection: true, tenants: result.payload.tenants }, { status: 200 });
    }
    return NextResponse.json({ error: result.payload.error || 'Credenciais inválidas.' }, { status: result.status });
  }

  const response = NextResponse.json({ ok: true, user: result.payload.user, activeTenant: result.payload.activeTenant });
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 12,
  };

  response.cookies.set(SESSION_COOKIE, result.payload.token as string, cookieOptions);
  response.cookies.set(SESSION_USER_COOKIE, JSON.stringify(result.payload.user), cookieOptions);
  if (result.payload.activeTenant) {
    response.cookies.set(SESSION_TENANT_COOKIE, JSON.stringify(result.payload.activeTenant), cookieOptions);
  } else {
    response.cookies.delete(SESSION_TENANT_COOKIE);
  }

  return response;
}
