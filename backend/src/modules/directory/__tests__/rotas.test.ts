import { describe, expect, it } from 'vitest';

/**
 * As rotas do diretório no nível HTTP.
 *
 * O que se verifica aqui é o que os testes de serviço não alcançam: o código de
 * status que chega a quem chama. O caminho do módulo desligado é o único que não
 * toca o banco — nem chega ao repositório —, então roda sem mock de Prisma, e é
 * justamente a regressão mais provável: alguém "simplificar" a guarda de
 * habilitação e o módulo passar a responder 200 num ambiente onde não deveria
 * nem existir.
 *
 * `ENABLE_ENTRA_SYNC` precisa ser apagada ANTES de importar o app, porque
 * `config/env` monta o objeto na importação.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'segredo-de-teste-0123456789abcdef';
delete process.env.ENABLE_ENTRA_SYNC;

/// Administrador Global passa por `requirePermission` sem consultar o banco
/// (`userHasPermission` responde true de saída), o que deixa o teste focado no
/// status da rota em vez de na montagem de papéis.
async function tokenDeAdmin() {
  const jwt = (await import('jsonwebtoken')).default;
  return jwt.sign(
    { sub: 'admin@teste.local', userId: 1, isGlobalAdmin: true, activeTenantId: 1, roleCodigo: 'admin_tenant' },
    process.env.JWT_SECRET as string,
    { expiresIn: '1h' }
  );
}

async function chamar(caminho: string, metodo = 'GET') {
  const { app } = await import('../../../app');
  const { createServer } = await import('http');
  const server = createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const endereco = server.address();
  const porta = typeof endereco === 'object' && endereco ? endereco.port : 0;

  try {
    const resposta = await fetch(`http://127.0.0.1:${porta}${caminho}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${await tokenDeAdmin()}`,
        ...(metodo === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(metodo === 'POST' ? { body: '{}' } : {}),
    });
    return { status: resposta.status, corpo: await resposta.json().catch(() => ({})) };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('rotas do diretório com o módulo desligado', () => {
  it('listar responde 503, não 200 vazio', async () => {
    const { status, corpo } = await chamar('/api/diretorio/conexoes');

    // 200 com lista vazia seria pior que o erro: sugeriria "está ligado, só
    // não tem nada configurado" para quem nunca habilitou o módulo.
    expect(status).toBe(503);
    expect(corpo.error).toMatch(/ENABLE_ENTRA_SYNC/);
  });

  it('criar responde 503 antes de validar qualquer coisa', async () => {
    const { status } = await chamar('/api/diretorio/conexoes', 'POST');
    expect(status).toBe(503);
  });

  it('testar conexão responde 503 sem sair para o provedor', async () => {
    const { status } = await chamar('/api/diretorio/conexoes/testar', 'POST');
    expect(status).toBe(503);
  });

  it('a mensagem diz o que fazer, não só que falhou', async () => {
    const { corpo } = await chamar('/api/diretorio/conexoes');

    expect(corpo.error).toContain('=true');
    expect(corpo.error).toContain('backend');
  });
});

describe('proteção das rotas do diretório', () => {
  it('sem token, 401 — a guarda de sessão vem antes da de habilitação', async () => {
    const { app } = await import('../../../app');
    const { createServer } = await import('http');
    const server = createServer(app);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const endereco = server.address();
    const porta = typeof endereco === 'object' && endereco ? endereco.port : 0;

    try {
      const resposta = await fetch(`http://127.0.0.1:${porta}/api/diretorio/conexoes`);
      // Sem isto, um 503 informativo viraria vazamento: qualquer um na rede
      // descobriria se a empresa usa diretório sem sequer se autenticar.
      expect(resposta.status).toBe(401);
      await resposta.text();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
