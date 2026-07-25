import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_USER_COOKIE } from '@/lib/session-cookie';

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://backend:4000';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.senha) {
    return NextResponse.json({ error: 'Informe e-mail e senha.' }, { status: 400 });
  }

  const backendResponse = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: body.email, senha: body.senha }),
    cache: 'no-store',
  });

  const payload = await backendResponse.json().catch(() => ({}));

  if (!backendResponse.ok) {
    return NextResponse.json({ error: payload.error || 'Credenciais inválidas.' }, { status: backendResponse.status });
  }

  const response = NextResponse.json({ user: payload.user });
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 12,
  };

  response.cookies.set(SESSION_COOKIE, payload.token, cookieOptions);
  response.cookies.set(SESSION_USER_COOKIE, JSON.stringify(payload.user), cookieOptions);

  return response;
}
