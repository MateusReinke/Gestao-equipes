import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../directory.repository', () => ({
  directoryRepository: {
    execucaoEmAndamento: vi.fn(),
    abrirExecucao: vi.fn(),
    fecharExecucao: vi.fn(),
    idsExistentes: vi.fn(),
    upsertPessoa: vi.fn(),
    marcarAusentes: vi.fn(),
    contarPorCampo: vi.fn(),
    sincronizarCatalogo: vi.fn(),
    registrarEventos: vi.fn(),
    atualizarCursor: vi.fn(),
  },
}));

import { directoryRepository } from '../directory.repository';
import { FakeProvider, pessoaFalsa } from '../providers/fake.provider';
import { SincronizacaoEmAndamentoError, sincronizarPessoas } from '../sync/sync.engine';

const mockEmAndamento = vi.mocked(directoryRepository.execucaoEmAndamento);
const mockAbrir = vi.mocked(directoryRepository.abrirExecucao);
const mockFechar = vi.mocked(directoryRepository.fecharExecucao);
const mockExistentes = vi.mocked(directoryRepository.idsExistentes);
const mockUpsert = vi.mocked(directoryRepository.upsertPessoa);
const mockAusentes = vi.mocked(directoryRepository.marcarAusentes);
const mockContar = vi.mocked(directoryRepository.contarPorCampo);
const mockCatalogo = vi.mocked(directoryRepository.sincronizarCatalogo);
const mockEventos = vi.mocked(directoryRepository.registrarEventos);
const mockCursor = vi.mocked(directoryRepository.atualizarCursor);

const BASE = { tenantId: 7, connectionId: 3, incluirDesabilitados: true, logOperacoes: true };

beforeEach(() => {
  vi.resetAllMocks();
  mockEmAndamento.mockResolvedValue(null);
  mockAbrir.mockResolvedValue({ id: 100 } as never);
  mockExistentes.mockResolvedValue(new Set<string>());
  mockUpsert.mockResolvedValue({} as never);
  mockAusentes.mockResolvedValue({ count: 0 } as never);
  mockContar.mockResolvedValue([]);
  mockCatalogo.mockResolvedValue({ count: 0 } as never);
  mockEventos.mockResolvedValue({ count: 0 } as never);
  mockCursor.mockResolvedValue({} as never);
  mockFechar.mockResolvedValue({} as never);
});

function provider(paginas: Parameters<typeof pessoaFalsa>[0][][], extra = {}) {
  return new FakeProvider({ paginas: paginas.map((p) => p.map(pessoaFalsa)), ...extra });
}

describe('primeira carga', () => {
  it('grava todo mundo e conta como criação', async () => {
    const resultado = await sincronizarPessoas({
      ...BASE,
      provider: provider([[{ externalId: 'a' }, { externalId: 'b' }], [{ externalId: 'c' }]]),
    });

    expect(resultado.status).toBe('sucesso');
    expect(resultado.lidos).toBe(3);
    expect(resultado.criados).toBe(3);
    expect(resultado.atualizados).toBe(0);
    expect(mockUpsert).toHaveBeenCalledTimes(3);
  });

  it('traduz a forma canônica para as colunas do espelho', async () => {
    await sincronizarPessoas({
      ...BASE,
      provider: provider([
        [{ externalId: 'a', nomeExibicao: 'Ana Lima', loginPrincipal: 'ana@contoso.com', cargo: 'Analista' }],
      ]),
    });

    const linha = mockUpsert.mock.calls[0][2];
    expect(linha).toMatchObject({
      externalId: 'a',
      nomeExibicao: 'Ana Lima',
      // `loginPrincipal` canônico vira `userPrincipalName` na coluna: o nome
      // da Microsoft só existe do banco para dentro.
      userPrincipalName: 'ana@contoso.com',
      cargo: 'Analista',
    });
  });

  it('não escreve o vínculo com colaborador nem as travas de campo', async () => {
    await sincronizarPessoas({ ...BASE, provider: provider([[{ externalId: 'a' }]]) });

    // A ponte com o mundo operacional é decisão de gente; a sincronização
    // atualiza o retrato do diretório e não encosta nela.
    const linha = mockUpsert.mock.calls[0][2] as Record<string, unknown>;
    expect(linha).not.toHaveProperty('colaboradorId');
    expect(linha).not.toHaveProperty('camposBloqueados');
  });
});

describe('reexecução', () => {
  it('quem já existia conta como atualização, não como nova', async () => {
    mockExistentes.mockResolvedValue(new Set(['a', 'b']));

    const resultado = await sincronizarPessoas({
      ...BASE,
      provider: provider([[{ externalId: 'a' }, { externalId: 'b' }, { externalId: 'c' }]]),
    });

    expect(resultado.criados).toBe(1);
    expect(resultado.atualizados).toBe(2);
  });

  it('marca como removido quem não veio na leitura', async () => {
    mockAusentes.mockResolvedValue({ count: 2 } as never);

    const resultado = await sincronizarPessoas({ ...BASE, provider: provider([[{ externalId: 'a' }]]) });

    expect(mockAusentes).toHaveBeenCalledWith(3, ['a'], expect.any(Date));
    expect(resultado.removidos).toBe(2);
  });
});

describe('catálogos derivados', () => {
  it('saem do espelho gravado, não do que veio na resposta', async () => {
    mockContar.mockImplementation(async (_conexao, campo) =>
      campo === 'departamento' ? [{ nome: 'TI', pessoas: 4 }] : [{ nome: 'Analista', pessoas: 3 }]
    );

    const resultado = await sincronizarPessoas({ ...BASE, provider: provider([[{ externalId: 'a' }]]) });

    // Contar a partir do banco faz o número da tela bater mesmo quando alguma
    // pessoa falhou ao gravar.
    expect(mockCatalogo).toHaveBeenCalledWith('departamento', 7, 3, [{ nome: 'TI', pessoas: 4 }]);
    expect(mockCatalogo).toHaveBeenCalledWith('cargo', 7, 3, [{ nome: 'Analista', pessoas: 3 }]);
    expect(resultado.departamentos).toBe(1);
    expect(resultado.cargos).toBe(1);
  });
});

describe('contas desabilitadas', () => {
  it('entram no espelho quando a opção está ligada', async () => {
    const resultado = await sincronizarPessoas({
      ...BASE,
      incluirDesabilitados: true,
      provider: provider([[{ externalId: 'a' }, { externalId: 'b', contaHabilitada: false }]]),
    });

    // Sumir com elas apagaria o nome de quem aparece no histórico de escalas.
    expect(resultado.lidos).toBe(2);
  });

  it('ficam de fora quando a opção está desligada', async () => {
    const resultado = await sincronizarPessoas({
      ...BASE,
      incluirDesabilitados: false,
      provider: provider([[{ externalId: 'a' }, { externalId: 'b', contaHabilitada: false }]]),
    });

    expect(resultado.lidos).toBe(1);
  });
});

describe('falhas', () => {
  it('leitura interrompida não marca ausentes nem grava cursor', async () => {
    const resultado = await sincronizarPessoas({
      ...BASE,
      provider: provider([[{ externalId: 'a' }], [{ externalId: 'b' }]], { falharNaPagina: 1 }),
    });

    expect(resultado.status).toBe('erro');
    expect(resultado.erro).toMatch(/Falha simulada/);
    // O que já entrou continua valendo...
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    // ...mas marcar ausentes a partir de uma leitura pela metade apagaria do
    // espelho quem apenas não chegou a ser lido.
    expect(mockAusentes).not.toHaveBeenCalled();
    expect(mockCursor).not.toHaveBeenCalled();
  });

  it('uma pessoa que falha ao gravar não derruba a carga', async () => {
    mockUpsert.mockRejectedValueOnce(new Error('violação de unicidade de e-mail'));

    const resultado = await sincronizarPessoas({
      ...BASE,
      provider: provider([[{ externalId: 'a' }, { externalId: 'b' }, { externalId: 'c' }]]),
    });

    expect(resultado.status).toBe('parcial');
    expect(resultado.lidos).toBe(3);
    expect(mockUpsert).toHaveBeenCalledTimes(3);

    const conflito = mockEventos.mock.calls[0][0].find((evento) => evento.acao === 'conflito');
    expect(conflito?.nivel).toBe('erro');
    expect(conflito?.mensagem).toMatch(/violação de unicidade/);
  });

  it('quem falhou não entra na lista de vistos, para não sumir do espelho', async () => {
    mockUpsert.mockRejectedValueOnce(new Error('falhou'));

    await sincronizarPessoas({ ...BASE, provider: provider([[{ externalId: 'a' }, { externalId: 'b' }]]) });

    // 'a' falhou: se entrasse em `vistos`, seria contado como presente; se for
    // omitido, `marcarAusentes` o marca como removido. O segundo é o certo —
    // não temos como afirmar que ele está lá.
    expect(mockAusentes).toHaveBeenCalledWith(3, ['b'], expect.any(Date));
  });

  it('recusa começar com outra execução em andamento', async () => {
    mockEmAndamento.mockResolvedValue({ id: 99, iniciadoEm: new Date('2026-07-27T10:00:00Z') } as never);

    await expect(sincronizarPessoas({ ...BASE, provider: provider([]) })).rejects.toBeInstanceOf(
      SincronizacaoEmAndamentoError
    );
    expect(mockAbrir).not.toHaveBeenCalled();
  });
});

describe('registro da execução', () => {
  it('fecha com os contadores e o resumo dos catálogos', async () => {
    mockExistentes.mockResolvedValue(new Set(['a']));
    mockAusentes.mockResolvedValue({ count: 1 } as never);
    mockContar.mockResolvedValue([{ nome: 'TI', pessoas: 2 }]);

    await sincronizarPessoas({ ...BASE, provider: provider([[{ externalId: 'a' }, { externalId: 'b' }]]) });

    expect(mockFechar).toHaveBeenCalledWith(100, {
      status: 'sucesso',
      objetosLidos: 2,
      objetosCriados: 1,
      objetosAtualizados: 1,
      objetosInalterados: 0,
      objetosRemovidos: 1,
      conflitos: 0,
      erro: null,
      detalhes: { departamentos: 1, cargos: 1 },
    });
  });

  it('com log desligado, o que deu errado ainda é registrado', async () => {
    mockUpsert.mockRejectedValueOnce(new Error('falhou'));

    await sincronizarPessoas({
      ...BASE,
      logOperacoes: false,
      provider: provider([[{ externalId: 'a' }, { externalId: 'b' }]]),
    });

    const eventos = mockEventos.mock.calls[0][0];
    // O que se corta é o "criei fulano"; o erro é justamente o que alguém vai
    // procurar depois.
    expect(eventos.every((evento) => evento.nivel !== 'info')).toBe(true);
    expect(eventos.some((evento) => evento.acao === 'conflito')).toBe(true);
  });

  it('grava o cursor devolvido pelo provedor para a próxima execução', async () => {
    await sincronizarPessoas({
      ...BASE,
      provider: provider([[{ externalId: 'a' }]], { cursorFinal: 'delta-token-abc' }),
    });

    expect(mockCursor).toHaveBeenCalledWith(3, 'delta-token-abc');
  });
});
