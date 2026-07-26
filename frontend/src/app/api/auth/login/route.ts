import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/api';

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://backend:4000';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { email, senha } = body as { email?: string; senha?: string };

  if (!email || !senha) {
    return NextResponse.json({ error: 'Informe e-mail e senha' }, { status: 400 });
  }

  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return NextResponse.json({ error: payload.error || 'Falha ao autenticar' }, { status: response.status });
  }

  const res = NextResponse.json({ user: payload.user });
  res.cookies.set(SESSION_COOKIE, payload.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return res;
}
