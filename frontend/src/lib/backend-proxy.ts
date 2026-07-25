import { NextResponse } from 'next/server';

/**
 * Encaminha uma requisição para o backend e SEMPRE devolve um payload JSON
 * utilizável, mesmo que o backend esteja indisponível ou a conexão falhe.
 * Sem isso, um erro de rede no fetch() derruba a Route Handler com uma
 * exceção não tratada, o Next.js responde com uma página de erro em HTML,
 * e o cliente quebra tentando fazer `response.json()` nessa página -
 * aparecendo como "falha de comunicação" mesmo quando a operação em si
 * pode ter sido concluída no backend.
 */
export async function callBackend(
  url: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number; payload: Record<string, unknown> }> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    return {
      ok: false,
      status: 502,
      payload: { error: 'Não foi possível falar com o servidor. Tente novamente em instantes.' },
    };
  }

  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

/**
 * Converte o resultado de callBackend numa NextResponse, sem quebrar em
 * respostas 204 (No Content) - HTTP proíbe corpo nessas respostas, e
 * `NextResponse.json(payload, { status: 204 })` lança um erro interno.
 */
export function backendResultToResponse(result: { status: number; payload: Record<string, unknown> }) {
  if (result.status === 204) {
    return new NextResponse(null, { status: 204 });
  }
  return NextResponse.json(result.payload, { status: result.status });
}
