import { NextRequest, NextResponse } from 'next/server';
import { CSRF_ERRO, sameOrigin } from '@/lib/csrf';
import { SESSION_COOKIE, SESSION_USER_COOKIE, SESSION_TENANT_COOKIE } from '@/lib/session-cookie';

export async function POST(request: NextRequest) {
  // Deslogar alguém à força é um incômodo, não um roubo — mas continua sendo
  // mudança de estado disparável de fora, então passa pela mesma barreira.
  if (!sameOrigin(request)) return NextResponse.json(CSRF_ERRO, { status: 403 });

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(SESSION_USER_COOKIE);
  response.cookies.delete(SESSION_TENANT_COOKIE);
  return response;
}
