import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntraIdProvider } from '../providers/entra/entra.provider';
import { ProvedorNaoSuportadoError, criarProvider } from '../providers';

const CREDENCIAIS = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  clientId: '22222222-2222-2222-2222-222222222222',
  clientSecret: 'segredo',
};

function resposta(status: number, corpo: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(corpo),
    json: async () => corpo,
  } as unknown as Response;
}

const TOKEN = resposta(200, { access_token: 'token-abc', expires_in: 3600 });

const ORGANIZACAO = {
  value: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      displayName: 'Contoso Brasil',
      verifiedDomains: [{ name: 'contoso.com.br', isDefault: true }, { name: 'contoso.onmicrosoft.com' }],
    },
  ],
};

const NEGADO = resposta(403, {
  error: { code: 'Authorization_RequestDenied', message: 'Insufficient privileges to complete the operation.' },
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

/// As três verificações partem em paralelo, então a ordem de resolução do
/// mock não é garantida. Responder por URL é o que torna o teste estável.
function responderPorUrl(mapa: Record<'organization' | 'users' | 'groups', Response>) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes('/oauth2/v2.0/token')) return TOKEN;
    if (url.includes('/organization')) return mapa.organization;
    if (url.includes('/users')) return mapa.users;
    if (url.includes('/groups')) return mapa.groups;
    throw new Error(`URL não esperada: ${url}`);
  });
}

describe('teste de conexão com o Entra', () => {
  it('reporta organização e contagens quando tudo está concedido', async () => {
    responderPorUrl({
      organization: resposta(200, ORGANIZACAO),
      users: resposta(200, { '@odata.count': 1284, value: [{ id: 'x' }] }),
      groups: resposta(200, { '@odata.count': 37, value: [{ id: 'y' }] }),
    });

    const resultado = await new EntraIdProvider(CREDENCIAIS).testarConexao();

    expect(resultado.ok).toBe(true);
    expect(resultado.erro).toBeNull();
    expect(resultado.organizacao).toEqual({
      nome: 'Contoso Brasil',
      tenantId: '11111111-1111-1111-1111-111111111111',
      dominios: ['contoso.com.br', 'contoso.onmicrosoft.com'],
    });

    const usuarios = resultado.verificacoes.find((v) => v.permissao === 'User.Read.All');
    expect(usuarios?.ok).toBe(true);
    // Separador de milhar em pt-BR, não em inglês.
    expect(usuarios?.detalhe).toBe('1.284 contas');
    expect(resultado.verificacoes.find((v) => v.permissao === 'Group.Read.All')?.detalhe).toBe('37 grupos');
  });

  it('credencial recusada nem chega a testar permissão', async () => {
    fetchMock.mockResolvedValueOnce(
      resposta(401, { error_description: 'AADSTS7000215: Invalid client secret provided.' })
    );

    const resultado = await new EntraIdProvider(CREDENCIAIS).testarConexao();

    expect(resultado.ok).toBe(false);
    expect(resultado.erro).toMatch(/Secret ID/);
    expect(resultado.verificacoes).toEqual([]);
    // Uma chamada só: sem token não há o que verificar.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falta de permissão obrigatória reprova o teste', async () => {
    responderPorUrl({
      organization: resposta(200, ORGANIZACAO),
      users: NEGADO,
      groups: resposta(200, { '@odata.count': 1 }),
    });

    const resultado = await new EntraIdProvider(CREDENCIAIS).testarConexao();

    expect(resultado.ok).toBe(false);
    const usuarios = resultado.verificacoes.find((v) => v.permissao === 'User.Read.All');
    expect(usuarios?.ok).toBe(false);
    expect(usuarios?.obrigatoria).toBe(true);
    // A mensagem tem que dizer onde clicar, não só que falhou.
    expect(usuarios?.detalhe).toMatch(/Grant admin consent/);
  });

  it('falta de permissão opcional não reprova — só limita o que dá para sincronizar', async () => {
    responderPorUrl({
      organization: NEGADO,
      users: resposta(200, { '@odata.count': 10 }),
      groups: NEGADO,
    });

    const resultado = await new EntraIdProvider(CREDENCIAIS).testarConexao();

    expect(resultado.ok).toBe(true);
    expect(resultado.organizacao).toBeNull();
    expect(resultado.verificacoes.filter((v) => !v.ok).every((v) => !v.obrigatoria)).toBe(true);
  });

  it('cada recurso é verificado em separado', async () => {
    responderPorUrl({
      organization: resposta(200, ORGANIZACAO),
      users: resposta(200, {}),
      groups: resposta(200, {}),
    });

    const resultado = await new EntraIdProvider(CREDENCIAIS).testarConexao();

    expect(resultado.verificacoes.map((v) => v.permissao)).toEqual([
      'Organization.Read.All',
      'User.Read.All',
      'Group.Read.All',
    ]);
  });
});

describe('fábrica de provedores', () => {
  it('entrega o provedor do Entra', () => {
    expect(criarProvider('entra', CREDENCIAIS).tipo).toBe('entra');
  });

  it('recusa provedor ainda não implementado com mensagem clara', () => {
    expect(() => criarProvider('google', CREDENCIAIS)).toThrow(ProvedorNaoSuportadoError);
    expect(() => criarProvider('okta', CREDENCIAIS)).toThrow(/ainda não foi implementada/);
  });
});
