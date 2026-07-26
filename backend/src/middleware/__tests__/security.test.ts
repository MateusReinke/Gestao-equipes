import { describe, expect, it, vi } from 'vitest';

// O env exige JWT_SECRET para carregar; o app é importado por tabela.
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'segredo-de-teste-0123456789abcdef';

describe('cabeçalhos e limites do app', () => {
  it('não expõe a tecnologia do servidor nem permite sniffing de tipo', async () => {
    const { app } = await import('../../app');
    const headers = await capturaHeaders(app, '/health');

    expect(headers['x-powered-by']).toBeUndefined();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('no-referrer');
  });

  it('anuncia o teto de requisições no cabeçalho padrão', async () => {
    const { app } = await import('../../app');
    const headers = await capturaHeaders(app, '/health');

    // draft-7 do rate limit: um único cabeçalho RateLimit com o orçamento.
    expect(headers['ratelimit']).toBeDefined();
  });
});

/// Sobe o app numa porta efêmera, faz uma requisição e devolve os cabeçalhos.
async function capturaHeaders(app: import('express').Express, caminho: string) {
  const { createServer } = await import('http');
  const server = createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const endereco = server.address();
  const porta = typeof endereco === 'object' && endereco ? endereco.port : 0;

  try {
    const resposta = await fetch(`http://127.0.0.1:${porta}${caminho}`);
    const headers: Record<string, string> = {};
    resposta.headers.forEach((valor, chave) => {
      headers[chave] = valor;
    });
    await resposta.text();
    return headers;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
