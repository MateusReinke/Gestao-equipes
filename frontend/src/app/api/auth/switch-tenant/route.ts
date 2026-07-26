import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';
import { SESSION_COOKIE, SESSION_TENANT_COOKIE } from '@/lib/session-cookie';

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://backend:4000';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 12,
};

export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: 'Sessão ausente.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${API_URL}/auth/switch-tenant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tenantId: body.tenantId ?? null }),
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
    return NextResponse.json({ error: payload.error || 'Não foi possível trocar de empresa.' }, { status: backendResponse.status });
  }

  const response = NextResponse.json({ ok: true, activeTenant: payload.activeTenant });

  response.cookies.set(SESSION_COOKIE, payload.token as string, COOKIE_OPTIONS);
  if (payload.activeTenant) {
    response.cookies.set(SESSION_TENANT_COOKIE, JSON.stringify(payload.activeTenant), COOKIE_OPTIONS);
  } else {
    response.cookies.delete(SESSION_TENANT_COOKIE);
  }

  return response;
}
