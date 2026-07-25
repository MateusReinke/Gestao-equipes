import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';
import { callBackend, backendResultToResponse } from '@/lib/backend-proxy';

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://backend:4000';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: 'Sessão ausente.' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const result = await callBackend(`${API_URL}/api/clientes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  return backendResultToResponse(result);
}
