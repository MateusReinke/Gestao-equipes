import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://backend:4000';

export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: 'Sessão ausente.' }, { status: 401 });

  const backendResponse = await fetch(`${API_URL}/platform/tenants`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  const payload = await backendResponse.json().catch(() => ([]));
  return NextResponse.json(payload, { status: backendResponse.status });
}

export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: 'Sessão ausente.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  const backendResponse = await fetch(`${API_URL}/platform/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const payload = await backendResponse.json().catch(() => ({}));
  return NextResponse.json(payload, { status: backendResponse.status });
}
