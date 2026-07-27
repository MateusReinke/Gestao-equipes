import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../directory.repository', () => ({
  directoryRepository: { conexoesAtivas: vi.fn() },
}));
vi.mock('../sync/sync.engine', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('../sync/sync.engine')>();
  return { ...original, sincronizarPessoas: vi.fn() };
});
vi.mock('../providers', () => ({ criarProvider: vi.fn(() => ({ tipo: 'entra' })) }));
vi.mock('../crypto', () => ({ decifrar: vi.fn(() => 'segredo'), contextoDaConexao: vi.fn(() => 'ctx') }));

import { directoryRepository } from '../directory.repository';
import { SincronizacaoEmAndamentoError, sincronizarPessoas } from '../sync/sync.engine';
import { baterUmaVez, estaVencida, proximaExecucao } from '../sync/sync.scheduler';

const mockConexoes = vi.mocked(directoryRepository.conexoesAtivas);
const mockSincronizar = vi.mocked(sincronizarPessoas);

const AGORA = new Date('2026-07-28T12:00:00Z');
const OPCOES = { intervaloMinutos: 60, sincronizarUsuarios: true, sincronizarUsuariosDesabilitados: true, logOperacoes: true };

function conexao(sobrescreve: Record<string, unknown> = {}) {
  return {
    id: 1,
    tenantId: 7,
    provider: 'entra',
    ativo: true,
    provedorTenantId: 'guid',
    clientId: 'guid',
    clientSecretCifrado: 'v1.a.b.c',
    authorityUrl: null,
    opcoes: OPCOES,
    cursorPessoas: null,
    ultimaSincronizacaoEm: new Date('2026-07-28T10:00:00Z'),
    sincronizandoDesde: null,
    ...sobrescreve,
  } as never;
}

beforeEach(() => {
  vi.resetAllMocks();
  mockSincronizar.mockResolvedValue({} as never);
});

describe('quando uma conexão vence', () => {
  it('nunca sincronizada vence imediatamente', () => {
    // Senão, ativar a conexão significaria esperar um intervalo inteiro para
    // ver o primeiro dado.
    expect(proximaExecucao({ ultimaSincronizacaoEm: null, opcoes: OPCOES }).getTime()).toBe(0);
  });

  it('soma o intervalo da própria empresa, não um global', () => {
    const proxima = proximaExecucao({
      ultimaSincronizacaoEm: new Date('2026-07-28T10:00:00Z'),
      opcoes: { intervaloMinutos: 30 },
    });
    expect(proxima.toISOString()).toBe('2026-07-28T10:30:00.000Z');
  });

  it('cai no padrão quando o intervalo está ausente ou é lixo', () => {
    const proxima = proximaExecucao({
      ultimaSincronizacaoEm: new Date('2026-07-28T10:00:00Z'),
      opcoes: { intervaloMinutos: 'não é número' },
    });
    expect(proxima.toISOString()).toBe('2026-07-28T11:00:00.000Z');
  });

  it('vencida há duas horas com intervalo de uma: é a vez dela', () => {
    expect(estaVencida(conexao(), AGORA)).toBe(true);
  });

  it('sincronizada há pouco: ainda não', () => {
    expect(estaVencida(conexao({ ultimaSincronizacaoEm: new Date('2026-07-28T11:30:00Z') }), AGORA)).toBe(false);
  });

  it('ocupada por outra execução: não é a vez', () => {
    const ocupada = conexao({ sincronizandoDesde: new Date('2026-07-28T11:59:00Z') });
    expect(estaVencida(ocupada, AGORA)).toBe(false);
  });

  it('reivindicação abandonada há mais de uma hora não segura a conexão', () => {
    // Um processo que morreu no meio de uma carga não pode travar a conexão
    // para sempre.
    const orfa = conexao({ sincronizandoDesde: new Date('2026-07-28T10:30:00Z') });
    expect(estaVencida(orfa, AGORA)).toBe(true);
  });

  it('conexão que não lê pessoas é ignorada', () => {
    const semPessoas = conexao({ opcoes: { ...OPCOES, sincronizarUsuarios: false } });
    expect(estaVencida(semPessoas, AGORA)).toBe(false);
  });
});

describe('batida do agendador', () => {
  it('sincroniza só as vencidas', async () => {
    mockConexoes.mockResolvedValue([
      conexao({ id: 1 }),
      conexao({ id: 2, ultimaSincronizacaoEm: new Date('2026-07-28T11:55:00Z') }),
      conexao({ id: 3 }),
    ]);

    const resultado = await baterUmaVez(AGORA);

    expect(resultado).toEqual({ verificadas: 3, sincronizadas: 2 });
    expect(mockSincronizar.mock.calls.map((chamada) => chamada[0].connectionId)).toEqual([1, 3]);
  });

  it('dispara em modo automático, com o cursor guardado', async () => {
    mockConexoes.mockResolvedValue([conexao({ cursorPessoas: 'delta-abc' })]);

    await baterUmaVez(AGORA);

    expect(mockSincronizar.mock.calls[0][0]).toMatchObject({ modo: 'auto', cursor: 'delta-abc', disparadoPorId: null });
  });

  it('perder a corrida pela trava é normal e não interrompe as demais', async () => {
    mockConexoes.mockResolvedValue([conexao({ id: 1 }), conexao({ id: 2 })]);
    mockSincronizar.mockRejectedValueOnce(new SincronizacaoEmAndamentoError('outra instância pegou'));

    const resultado = await baterUmaVez(AGORA);

    // Com duas instâncias do backend, as duas acordam e uma perde. É o desenho
    // funcionando, não um erro.
    expect(resultado.sincronizadas).toBe(1);
    expect(mockSincronizar).toHaveBeenCalledTimes(2);
  });

  it('uma empresa com problema não impede as seguintes', async () => {
    mockConexoes.mockResolvedValue([conexao({ id: 1 }), conexao({ id: 2 }), conexao({ id: 3 })]);
    mockSincronizar.mockRejectedValueOnce(new Error('credencial vencida'));

    const resultado = await baterUmaVez(AGORA);

    expect(resultado.sincronizadas).toBe(2);
    expect(mockSincronizar).toHaveBeenCalledTimes(3);
  });

  it('sincroniza em série, não em paralelo', async () => {
    mockConexoes.mockResolvedValue([conexao({ id: 1 }), conexao({ id: 2 })]);

    const ordem: string[] = [];
    mockSincronizar.mockImplementation(async (params) => {
      ordem.push(`inicio-${params.connectionId}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      ordem.push(`fim-${params.connectionId}`);
      return {} as never;
    });

    await baterUmaVez(AGORA);

    // Disparar todas as empresas de uma vez faria do backend uma fonte de
    // rajadas contra o limite de taxa da Microsoft, que é medido por aplicação.
    expect(ordem).toEqual(['inicio-1', 'fim-1', 'inicio-2', 'fim-2']);
  });

  it('sem conexão ativa, não faz nada', async () => {
    mockConexoes.mockResolvedValue([]);

    expect(await baterUmaVez(AGORA)).toEqual({ verificadas: 0, sincronizadas: 0 });
    expect(mockSincronizar).not.toHaveBeenCalled();
  });
});
