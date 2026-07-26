import { NextRequest, NextResponse } from 'next/server';
import { postApi } from '@/lib/api';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await postApi('/api/colaboradores', body);

  if (!result.ok) {
    return NextResponse.json({ error: result.error, issues: result.issues }, { status: 400 });
  }

  return NextResponse.json(result.data, { status: 201 });
}
