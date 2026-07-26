import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_USER_COOKIE, SESSION_TENANT_COOKIE } from '@/lib/session-cookie';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(SESSION_USER_COOKIE);
  response.cookies.delete(SESSION_TENANT_COOKIE);
  return response;
}
