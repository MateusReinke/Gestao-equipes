import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';
import { SESSION_COOKIE, SESSION_TENANT_COOKIE } from '@/lib/session-cookie';
import { callBackend } from '@/lib/backend-proxy';

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://backend:4000';

export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: 'Sessão ausente.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  const result = await callBackend(`${API_URL}/auth/switch-tenant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tenantId: body.tenantId ?? null }),
    cache: 'no-store',
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.payload.error || 'Não foi possível trocar de empresa.' }, { status: result.status });
  }

  const response = NextResponse.json({ ok: true, activeTenant: result.payload.activeTenant });
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 12,
  };

  response.cookies.set(SESSION_COOKIE, result.payload.token as string, cookieOptions);
  if (result.payload.activeTenant) {
    response.cookies.set(SESSION_TENANT_COOKIE, JSON.stringify(result.payload.activeTenant), cookieOptions);
  } else {
    response.cookies.delete(SESSION_TENANT_COOKIE);
  }

  return response;
}
