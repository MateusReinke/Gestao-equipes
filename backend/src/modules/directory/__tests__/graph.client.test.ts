import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GraphAuthError,
  GraphPermissionError,
  GraphRequestError,
  GraphThrottleError,
  criarGraphClient,
} from '../providers/entra/graph.client';

const CREDENCIAIS = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  clientId: '22222222-2222-2222-2222-222222222222',
  clientSecret: 'segredo',
};

function resposta(status: number, corpo: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (nome: string) => headers[nome] ?? null },
    text: async () => (typeof corpo === 'string' ? corpo : JSON.stringify(corpo)),
    json: async () => corpo,
  } as unknown as Response;
}

const tokenOk = () => resposta(200, { access_token: 'token-abc', expires_in: 3600 });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('obtenção de token', () => {
  it('pede o token com client_credentials e o escopo .default', async () => {
    fetchMock.mockResolvedValueOnce(tokenOk());

    const token = await criarGraphClient(CREDENCIAIS).obterToken();

    expect(token).toBe('token-abc');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(`/${CREDENCIAIS.tenantId}/oauth2/v2.0/token`);
    expect(init.body).toContain('grant_type=client_credentials');
    expect(init.body).toContain('scope=https%3A%2F%2Fgraph.microsoft.com%2F.default');
  });

  it('reaproveita o token entre chamadas', async () => {
    fetchMock.mockResolvedValueOnce(tokenOk());
    const client = criarGraphClient(CREDENCIAIS);

    await client.obterToken();
    await client.obterToken();

    // Um token de aplicação vale ~1h: repedir a cada chamada seria desperdício
    // e um convite ao rate limit do endpoint de autenticação.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('traduz segredo inválido para instrução acionável', async () => {
    fetchMock.mockResolvedValueOnce(
      resposta(401, { error: 'invalid_client', error_description: 'AADSTS7000215: Invalid client secret provided.' })
    );

    await expect(criarGraphClient(CREDENCIAIS).obterToken()).rejects.toThrow(/Secret ID/);
  });

  it('traduz segredo vencido', async () => {
    fetchMock.mockResolvedValueOnce(
      resposta(401, { error: 'invalid_client', error_description: 'AADSTS7000222: The provided client secret keys are expired.' })
    );

    await expect(criarGraphClient(CREDENCIAIS).obterToken()).rejects.toThrow(/venceu/);
  });

  it('traduz tenant inexistente', async () => {
    fetchMock.mockResolvedValueOnce(
      resposta(400, { error_description: 'AADSTS90002: Tenant not found.' })
    );

    await expect(criarGraphClient(CREDENCIAIS).obterToken()).rejects.toThrow(/Directory \(tenant\) ID/);
  });

  it('guarda o código AADSTS mesmo sem tradução conhecida', async () => {
    fetchMock.mockResolvedValueOnce(resposta(400, { error_description: 'AADSTS99999: Algo inesperado. Detalhes irrelevantes.' }));

    const erro = (await criarGraphClient(CREDENCIAIS).obterToken().catch((e) => e)) as GraphAuthError;
    expect(erro).toBeInstanceOf(GraphAuthError);
    expect(erro.codigo).toBe('AADSTS99999');
    // Só a primeira frase: o parágrafo da Microsoft traz trace id e timestamp.
    expect(erro.message).toBe('AADSTS99999: Algo inesperado');
  });

  it('trata resposta não-JSON do endpoint de token', async () => {
    fetchMock.mockResolvedValueOnce(resposta(502, '<html>proxy error</html>'));
    await expect(criarGraphClient(CREDENCIAIS).obterToken()).rejects.toBeInstanceOf(GraphAuthError);
  });

  it('avisa quando não consegue nem falar com o Entra', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(criarGraphClient(CREDENCIAIS).obterToken()).rejects.toThrow(/falha de rede/);
  });
});

describe('requisições ao Graph', () => {
  it('envia o bearer e monta a URL com a versão configurada', async () => {
    fetchMock.mockResolvedValueOnce(tokenOk()).mockResolvedValueOnce(resposta(200, { value: [] }));

    await criarGraphClient(CREDENCIAIS).get('/users');

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('https://graph.microsoft.com/v1.0/users');
    expect(init.headers.Authorization).toBe('Bearer token-abc');
    expect(init.headers.ConsistencyLevel).toBeUndefined();
  });

  it('declara consistência eventual quando pedido', async () => {
    fetchMock.mockResolvedValueOnce(tokenOk()).mockResolvedValueOnce(resposta(200, {}));

    await criarGraphClient(CREDENCIAIS).get('/users?$count=true', { consistenciaEventual: true });

    // `$count` não funciona sem este cabeçalho.
    expect(fetchMock.mock.calls[1][1].headers.ConsistencyLevel).toBe('eventual');
  });

  it('aceita URL absoluta, que é o formato do nextLink', async () => {
    fetchMock.mockResolvedValueOnce(tokenOk()).mockResolvedValueOnce(resposta(200, {}));

    await criarGraphClient(CREDENCIAIS).get('https://graph.microsoft.com/v1.0/users?$skiptoken=abc');

    expect(fetchMock.mock.calls[1][0]).toBe('https://graph.microsoft.com/v1.0/users?$skiptoken=abc');
  });

  it('403 vira erro de permissão, com o código do Graph', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(resposta(403, { error: { code: 'Authorization_RequestDenied', message: 'Insufficient privileges.' } }));

    const erro = (await criarGraphClient(CREDENCIAIS).get('/users').catch((e) => e)) as GraphPermissionError;

    expect(erro).toBeInstanceOf(GraphPermissionError);
    expect(erro.permissao).toBe('Authorization_RequestDenied');
  });

  it('401 no meio do caminho descarta o token e tenta de novo', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(resposta(401, { error: { code: 'InvalidAuthenticationToken' } }))
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(resposta(200, { value: [1] }));

    const dados = await criarGraphClient(CREDENCIAIS).get<{ value: number[] }>('/users');

    expect(dados.value).toEqual([1]);
    // Quatro chamadas: token, 401, token de novo, sucesso.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('respeita o Retry-After do 429 em vez de inventar um backoff', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(resposta(429, { error: { code: 'TooManyRequests' } }, { 'Retry-After': '7' }))
      .mockResolvedValueOnce(resposta(200, { value: ['ok'] }));

    const promessa = criarGraphClient(CREDENCIAIS).get<{ value: string[] }>('/users');
    await vi.advanceTimersByTimeAsync(6_000);
    expect(fetchMock).toHaveBeenCalledTimes(2); // ainda esperando os 7s

    await vi.advanceTimersByTimeAsync(2_000);
    await expect(promessa).resolves.toEqual({ value: ['ok'] });
  });

  it('aceita Retry-After em formato de data', async () => {
    vi.useFakeTimers();
    const daquiA5s = new Date(Date.now() + 5_000).toUTCString();

    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(resposta(429, {}, { 'Retry-After': daquiA5s }))
      .mockResolvedValueOnce(resposta(200, { value: [] }));

    const promessa = criarGraphClient(CREDENCIAIS).get('/users');
    await vi.advanceTimersByTimeAsync(6_000);

    await expect(promessa).resolves.toEqual({ value: [] });
  });

  it('desiste do 429 depois das tentativas, dizendo quanto esperar', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(tokenOk());
    for (let i = 0; i < 4; i += 1) {
      fetchMock.mockResolvedValueOnce(resposta(429, {}, { 'Retry-After': '3' }));
    }

    const promessa = criarGraphClient(CREDENCIAIS).get('/users');
    const capturado = promessa.catch((e) => e);
    await vi.advanceTimersByTimeAsync(60_000);

    const erro = (await capturado) as GraphThrottleError;
    expect(erro).toBeInstanceOf(GraphThrottleError);
    expect(erro.esperarSegundos).toBe(3);
  });

  it('repete em erro do servidor e devolve o resultado da retentativa', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(resposta(503, { error: { code: 'ServiceNotAvailable' } }))
      .mockResolvedValueOnce(resposta(200, { value: ['recuperado'] }));

    const promessa = criarGraphClient(CREDENCIAIS).get<{ value: string[] }>('/users');
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(promessa).resolves.toEqual({ value: ['recuperado'] });
  });

  it('erro 400 não é repetido — repetir não mudaria a resposta', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(resposta(400, { error: { code: 'Request_BadRequest', message: 'Consulta inválida' } }));

    const erro = (await criarGraphClient(CREDENCIAIS).get('/users').catch((e) => e)) as GraphRequestError;

    expect(erro).toBeInstanceOf(GraphRequestError);
    expect(erro.status).toBe(400);
    expect(erro.message).toBe('Consulta inválida');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
