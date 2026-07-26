import { NextRequest } from 'next/server';

/**
 * Verificação de origem para as rotas que mudam estado.
 *
 * A credencial destas rotas é um cookie httpOnly, e o navegador o anexa sozinho
 * — inclusive numa requisição disparada por outro site. O cookie é SameSite=lax,
 * o que já barra o caso clássico de CSRF, mas conferir a origem é explícito e
 * não depende de o navegador ter implementado SameSite do jeito esperado.
 *
 * Só se aplica a POST/PUT/PATCH/DELETE: um GET não muda nada, e nem todo
 * navegador manda `Origin` em navegação simples.
 */
export function sameOrigin(request: NextRequest): boolean {
  const origem = request.headers.get('origin');
  // Ausência de Origin não é requisição cross-site de fetch ou formulário:
  // navegadores sempre mandam o cabeçalho nesses métodos.
  if (!origem) return true;

  const host = request.headers.get('host');
  try {
    return new URL(origem).host === host;
  } catch {
    return false;
  }
}

export const CSRF_ERRO = { error: 'Origem não permitida.' };
