import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../directory.repository', () => ({
  directoryRepository: {
    reivindicar: vi.fn(),
    liberar: vi.fn(),
    abrirExecucao: vi.fn(),
    fecharExecucao: vi.fn(),
    idsExistentes: vi.fn(),
    upsertPessoa: vi.fn(),
    marcarRemovida: vi.fn(),
    marcarAusentes: vi.fn(),
    contarPorCampo: vi.fn(),
    sincronizarCatalogo: vi.fn(),
    registrarEventos: vi.fn(),
    atualizarCursor: vi.fn(),
  },
}));

vi.mock('../sync/reconcile.service', () => ({
  reconciliarVinculados: vi.fn(),
  criarColaboradoresAutomaticamente: vi.fn(),
}));

import { directoryRepository } from '../directory.repository';
import { criarColaboradoresAutomaticamente, reconciliarVinculados } from '../sync/reconcile.service';
import { FakeProvider, pessoaFalsa } from '../providers/fake.provider';
import { SincronizacaoEmAndamentoError, sincronizarPessoas } from '../sync/sync.engine';

const mockReivindicar = vi.mocked(directoryRepository.reivindicar);
const mockLiberar = vi.mocked(directoryRepository.liberar);
const mockAbrir = vi.mocked(directoryRepository.abrirExecucao);
const mockFechar = vi.mocked(directoryRepository.fecharExecucao);
const mockExistentes = vi.mocked(directoryRepository.idsExistentes);
const mockUpsert = vi.mocked(directoryRepository.upsertPessoa);
const mockRemovida = vi.mocked(directoryRepository.marcarRemovida);
const mockAusentes = vi.mocked(directoryRepository.marcarAusentes);
const mockContar = vi.mocked(directoryRepository.contarPorCampo);
const mockCatalogo = vi.mocked(directoryRepository.sincronizarCatalogo);
const mockEventos = vi.mocked(directoryRepository.registrarEventos);
const mockCursor = vi.mocked(directoryRepository.atualizarCursor);
const mockReconciliar = vi.mocked(reconciliarVinculados);
const mockCriarAuto = vi.mocked(criarColaboradoresAutomaticamente);

const RECONCILIACAO_VAZIA = { atualizados: 0, criados: 0, desativados: 0, reativados: 0, conflitos: [], mudancas: [] };

const BASE = { tenantId: 7, connectionId: 3, incluirDesabilitados: true, logOperacoes: true };

beforeEach(() => {
  vi.resetAllMocks();
  mockReivindicar.mockResolvedValue(true);
  mockLiberar.mockResolvedValue({ count: 1 } as never);
  mockAbrir.mockResolvedValue({ id: 100 } as never);
  mockExistentes.mockResolvedValue(new Set<string>());
  mockUpsert.mockResolvedValue({} as never);
  mockRemovida.mockResolvedValue(1);
  mockAusentes.mockResolvedValue({ count: 0 } as never);
  mockContar.mockResolvedValue([]);
  mockCatalogo.mockResolvedValue({ count: 0 } as never);
  mockEventos.mockResolvedValue({ count: 0 } as never);
  mockCursor.mockResolvedValue({} as never);
  mockFechar.mockResolvedValue({} as never);
  mockReconciliar.mockResolvedValue({ ...RECONCILIACAO_VAZIA });
  mockCriarAuto.mockResolvedValue({ ...RECONCILIACAO_VAZIA });
});

type Parcial = Parameters<typeof pessoaFalsa>[0];

function provider(paginas: Parcial[][], extra: Record<string, unknown> = {}) {
  const mapear = (p: Parcial[][]) => p.map((pagina) => pagina.map(pessoaFalsa));
  return new FakeProvider({
    paginas: mapear(paginas),
    ...extra,
    ...(extra.paginasIncrementais ? { paginasIncrementais: mapear(extra.paginasIncrementais as Parcial[][]) } : {}),
  });
}

describe('trava de concorrência', () => {
  it('recusa quando outra execução já reivindicou a conexão', async () => {
    mockReivindicar.mockResolvedValue(false);

    await expect(sincronizarPessoas({ ...BASE, provider: provider([]) })).rejects.toBeInstanceOf(
      SincronizacaoEmAndamentoError
    );
    expect(mockAbrir).not.toHaveBeenCalled();
  });

  it('libera a trava mesmo quando a execução estoura', async () => {
    mockAbrir.mockRejectedValue(new Error('banco fora do ar'));

    await expect(sincronizarPessoas({ ...BASE, provider: provider([]) })).rejects.toThrow('banco fora do ar');
    // Sem isto, uma exceção inesperada inutilizaria a conexão até o prazo de
    // abandono.
    expect(mockLiberar).toHaveBeenCalledWith(3);
  });

  it('libera a trava no caminho feliz', async () => {
    await sincronizarPessoas({ ...BASE, provider: provider([[{ externalId: 'a' }]]) });
    expect(mockLiberar).toHaveBeenCalledWith(3);
  });
});

describe('leitura completa', () => {
  it('grava todo mundo e conta como criação', async () => {
    const resultado = await sincronizarPessoas({
      ...BASE,
      provider: provider([[{ externalId: 'a' }, { externalId: 'b' }], [{ externalId: 'c' }]]),
    });

    expect(resultado.modo).toBe('completa');
    expect(resultado.status).toBe('sucesso');
    expect(resultado.lidos).toBe(3);
    expect(resultado.criados).toBe(3);
  });

  it('traduz a forma canônica para as colunas do espelho', async () => {
    await sincronizarPessoas({
      ...BASE,
      provider: provider([
        [{ externalId: 'a', nomeExibicao: 'Ana Lima', loginPrincipal: 'ana@contoso.com', cargo: 'Analista' }],
      ]),
    });

    // `loginPrincipal` canônico vira `userPrincipalName` na coluna: o nome da
    // Microsoft só existe do banco para dentro.
    expect(mockUpsert.mock.calls[0][2]).toMatchObject({
      externalId: 'a',
      userPrincipalName: 'ana@contoso.com',
      cargo: 'Analista',
    });
  });

  it('não escreve o vínculo com colaborador nem as travas de campo', async () => {
    await sincronizarPessoas({ ...BASE, provider: provider([[{ externalId: 'a' }]]) });

    const linha = mockUpsert.mock.calls[0][2] as Record<string, unknown>;
    expect(linha).not.toHaveProperty('colaboradorId');
    expect(linha).not.toHaveProperty('camposBloqueados');
  });

  it('quem já existia conta como atualização', async () => {
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

describe('leitura incremental', () => {
  const comCursor = { ...BASE, cursor: 'delta-anterior' };

  it('usa o cursor guardado e se declara incremental', async () => {
    const resultado = await sincronizarPessoas({
      ...comCursor,
      provider: provider([[{ externalId: 'nunca-lida' }]], {
        paginasIncrementais: [[{ externalId: 'mudou' }]],
      }),
    });

    expect(resultado.modo).toBe('incremental');
    // Leu o roteiro incremental, não o completo.
    expect(resultado.lidos).toBe(1);
    expect(mockUpsert.mock.calls[0][2].externalId).toBe('mudou');
  });

  it('NÃO deduz saída por ausência', async () => {
    await sincronizarPessoas({
      ...comCursor,
      provider: provider([], { paginasIncrementais: [[{ externalId: 'mudou' }]] }),
    });

    // O delta só traz quem mudou. Marcar ausentes aqui removeria do espelho
    // todo mundo que apenas continuou igual — ou seja, quase a empresa inteira.
    expect(mockAusentes).not.toHaveBeenCalled();
  });

  it('respeita o marcador de saída explícita do provedor', async () => {
    const resultado = await sincronizarPessoas({
      ...comCursor,
      provider: provider([], {
        paginasIncrementais: [[{ externalId: 'saiu', removido: true }, { externalId: 'ficou' }]],
      }),
    });

    expect(mockRemovida).toHaveBeenCalledWith(3, 'saiu', expect.any(Date));
    expect(resultado.removidos).toBe(1);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('modo completa forçado ignora o cursor', async () => {
    const resultado = await sincronizarPessoas({
      ...comCursor,
      modo: 'completa',
      provider: provider([[{ externalId: 'a' }, { externalId: 'b' }]], {
        paginasIncrementais: [[{ externalId: 'mudou' }]],
      }),
    });

    expect(resultado.modo).toBe('completa');
    expect(resultado.lidos).toBe(2);
  });
});

describe('cursor expirado', () => {
  it('recomeça do zero sozinho, como leitura completa', async () => {
    const resultado = await sincronizarPessoas({
      ...BASE,
      cursor: 'delta-vencido',
      provider: provider([[{ externalId: 'a' }, { externalId: 'b' }]], { cursorExpirado: true }),
    });

    // É o que impede a sincronização de morrer em silêncio quando o Graph
    // descarta o estado delta.
    expect(resultado.recomecouDoZero).toBe(true);
    expect(resultado.modo).toBe('completa');
    expect(resultado.status).toBe('sucesso');
    expect(resultado.lidos).toBe(2);
  });

  it('registra o motivo, para não parecer que a carga completa foi espontânea', async () => {
    await sincronizarPessoas({
      ...BASE,
      cursor: 'delta-vencido',
      provider: provider([[{ externalId: 'a' }]], { cursorExpirado: true }),
    });

    const evento = mockEventos.mock.calls[0][0].find((item) => item.acao === 'cursor_expirado');
    expect(evento?.nivel).toBe('aviso');
  });

  it('a execução fica registrada como completa, não como a incremental que começou', async () => {
    await sincronizarPessoas({
      ...BASE,
      cursor: 'delta-vencido',
      provider: provider([[{ externalId: 'a' }]], { cursorExpirado: true }),
    });

    expect(mockFechar.mock.calls[0][1]).toMatchObject({ modo: 'completa' });
  });

  it('depois de recomeçar, volta a marcar ausentes', async () => {
    mockAusentes.mockResolvedValue({ count: 3 } as never);

    const resultado = await sincronizarPessoas({
      ...BASE,
      cursor: 'delta-vencido',
      provider: provider([[{ externalId: 'a' }]], { cursorExpirado: true }),
    });

    // Virou leitura completa de verdade — inclusive na dedução de saídas.
    expect(mockAusentes).toHaveBeenCalled();
    expect(resultado.removidos).toBe(3);
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
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });

  it('com a opção desligada, são LIDAS e então removidas do espelho', async () => {
    const resultado = await sincronizarPessoas({
      ...BASE,
      incluirDesabilitados: false,
      provider: provider([[{ externalId: 'a' }, { externalId: 'b', contaHabilitada: false }]]),
    });

    // O ponto: elas são processadas, não filtradas na origem. É por virem na
    // leitura incremental que descobrimos que acabaram de ser desabilitadas —
    // filtrar antes manteria o espelho afirmando que estão ativas para sempre.
    expect(resultado.lidos).toBe(2);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockRemovida).toHaveBeenCalledWith(3, 'b', expect.any(Date));
  });
});

describe('falhas', () => {
  it('leitura interrompida não marca ausentes nem grava cursor', async () => {
    const resultado = await sincronizarPessoas({
      ...BASE,
      provider: provider([[{ externalId: 'a' }], [{ externalId: 'b' }]], { falharNaPagina: 1 }),
    });

    expect(resultado.status).toBe('erro');
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
    expect(mockUpsert).toHaveBeenCalledTimes(3);

    const conflito = mockEventos.mock.calls[0][0].find((evento) => evento.acao === 'conflito');
    expect(conflito?.mensagem).toMatch(/violação de unicidade/);
  });

  it('quem falhou não entra na lista de vistos, para não sumir do espelho', async () => {
    mockUpsert.mockRejectedValueOnce(new Error('falhou'));

    await sincronizarPessoas({ ...BASE, provider: provider([[{ externalId: 'a' }, { externalId: 'b' }]]) });

    // 'a' falhou: sem confirmação de que está lá, o certo é deixá-lo fora da
    // lista de presentes e ser marcado como ausente.
    expect(mockAusentes).toHaveBeenCalledWith(3, ['b'], expect.any(Date));
  });
});

describe('catálogos e registro', () => {
  it('catálogos saem do espelho gravado, não da resposta', async () => {
    mockContar.mockImplementation(async (_conexao, campo) =>
      campo === 'departamento' ? [{ nome: 'TI', pessoas: 4 }] : [{ nome: 'Analista', pessoas: 3 }]
    );

    const resultado = await sincronizarPessoas({ ...BASE, provider: provider([[{ externalId: 'a' }]]) });

    expect(mockCatalogo).toHaveBeenCalledWith('departamento', 7, 3, [{ nome: 'TI', pessoas: 4 }]);
    expect(resultado.departamentos).toBe(1);
    expect(resultado.cargos).toBe(1);
  });

  it('grava o cursor devolvido pelo provedor', async () => {
    await sincronizarPessoas({
      ...BASE,
      provider: provider([[{ externalId: 'a' }]], { cursorFinal: 'delta-token-abc' }),
    });

    expect(mockCursor).toHaveBeenCalledWith(3, 'delta-token-abc');
  });

  it('com log desligado, o que deu errado ainda é registrado', async () => {
    mockUpsert.mockRejectedValueOnce(new Error('falhou'));

    await sincronizarPessoas({
      ...BASE,
      logOperacoes: false,
      provider: provider([[{ externalId: 'a' }, { externalId: 'b' }]]),
    });

    const eventos = mockEventos.mock.calls[0][0];
    expect(eventos.every((evento) => evento.nivel !== 'info')).toBe(true);
    expect(eventos.some((evento) => evento.acao === 'conflito')).toBe(true);
  });
});

describe('a ponte com o cadastro', () => {
  it('com as opções desligadas, nada operacional é criado nem desativado', async () => {
    const resultado = await sincronizarPessoas({ ...BASE, provider: provider([[{ externalId: 'a' }]]) });

    // Manter nome e cargo em dia de quem JÁ foi vinculado é o propósito de ter
    // vinculado — isso roda sempre. O que as opções controlam é criar cadastro
    // novo e mexer em `ativo`.
    expect(mockReconciliar).toHaveBeenCalledWith({ tenantId: 7, connectionId: 3, autoDesativar: false });
    expect(mockCriarAuto).not.toHaveBeenCalled();
    // Sem nada para relatar, a sincronização se declara sem efeito no cadastro.
    expect(resultado.reconciliacao).toBeNull();
  });

  it('a criação automática exige equipe de entrada e avisa quando falta', async () => {
    const resultado = await sincronizarPessoas({
      ...BASE,
      autoCriarColaboradores: true,
      equipePadraoId: null,
      provider: provider([[{ externalId: 'a' }]]),
    });

    // `colaboradores.equipe_id` é NOT NULL e o diretório não conhece equipes:
    // sem equipe de entrada não há o que criar, e ficar em silêncio faria
    // parecer que a opção não funciona.
    expect(mockCriarAuto).not.toHaveBeenCalled();
    expect(resultado.reconciliacao).not.toBeNull();
    const aviso = mockEventos.mock.calls[0][0].find((evento) => evento.acao === 'sem_equipe_padrao');
    expect(aviso?.nivel).toBe('erro');
  });

  it('com equipe de entrada, cria e soma ao resultado', async () => {
    mockCriarAuto.mockResolvedValue({ ...RECONCILIACAO_VAZIA, criados: 4 });

    const resultado = await sincronizarPessoas({
      ...BASE,
      autoCriarColaboradores: true,
      equipePadraoId: 5,
      provider: provider([[{ externalId: 'a' }]]),
    });

    expect(mockCriarAuto).toHaveBeenCalledWith({ tenantId: 7, connectionId: 3, equipePadraoId: 5 });
    expect(resultado.reconciliacao?.criados).toBe(4);
  });

  it('a auto-desativação chega até a ponte', async () => {
    await sincronizarPessoas({
      ...BASE,
      autoDesativarColaboradores: true,
      provider: provider([[{ externalId: 'a' }]]),
    });

    expect(mockReconciliar).toHaveBeenCalledWith({ tenantId: 7, connectionId: 3, autoDesativar: true });
  });

  it('leitura interrompida não reconcilia', async () => {
    await sincronizarPessoas({
      ...BASE,
      autoDesativarColaboradores: true,
      provider: provider([[{ externalId: 'a' }], [{ externalId: 'b' }]], { falharNaPagina: 1 }),
    });

    // Aplicar um espelho pela metade sobre gente de verdade desativaria quem
    // apenas não chegou a ser lido.
    expect(mockReconciliar).not.toHaveBeenCalled();
  });
});
