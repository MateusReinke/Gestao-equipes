import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/shift.repository', () => ({
  shiftRepository: { findByRange: vi.fn() },
}));
vi.mock('../../repositories/swap.repository', () => ({ swapRepository: { list: vi.fn() } }));
vi.mock('../../repositories/vacation.repository', () => ({ vacationRepository: { findByTeamIds: vi.fn() } }));
vi.mock('../../repositories/absence.repository', () => ({ absenceRepository: { findByTeamIds: vi.fn() } }));
vi.mock('../scope.service', () => ({ getVisibleTeamIds: vi.fn() }));

import { shiftRepository } from '../../repositories/shift.repository';
import { swapRepository } from '../../repositories/swap.repository';
import { vacationRepository } from '../../repositories/vacation.repository';
import { absenceRepository } from '../../repositories/absence.repository';
import { getVisibleTeamIds } from '../scope.service';
import { gerarRelatorio, toCsv, nomeArquivo, periodoPadrao, UnknownReportError, NoActiveTenantError } from '../report.service';

const mockedTurnos = vi.mocked(shiftRepository.findByRange);
const mockedTrocas = vi.mocked(swapRepository.list);
const mockedFerias = vi.mocked(vacationRepository.findByTeamIds);
const mockedAusencias = vi.mocked(absenceRepository.findByTeamIds);
const mockedEquipes = vi.mocked(getVisibleTeamIds);

const gestor = { sub: 'gestor@empresa.com', userId: 2, isGlobalAdmin: false, activeTenantId: 7, roleCodigo: 'gestor' };
const periodo = { inicio: new Date('2026-07-01T00:00:00Z'), fim: new Date('2026-07-31T00:00:00Z') };

function turno(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    data: new Date('2026-07-06T00:00:00Z'), // segunda-feira
    horaInicio: '07:00',
    horaFim: '19:00',
    tipo: 'turno',
    status: 'planejado',
    colaboradorId: 10,
    colaborador: { id: 10, nome: 'Ana Lima', equipe: { nome: 'NOC' } },
    colaboradorOriginal: null,
    cliente: { nome: 'Banco Atlas' },
    ...over,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedEquipes.mockResolvedValue([1, 2]);
  mockedTurnos.mockResolvedValue([]);
  mockedTrocas.mockResolvedValue([]);
  mockedFerias.mockResolvedValue([]);
  mockedAusencias.mockResolvedValue([]);
});

describe('escopo dos relatórios', () => {
  it('exige tenant ativo', async () => {
    await expect(
      gerarRelatorio('horas-turno', periodo, { ...gestor, activeTenantId: null })
    ).rejects.toBeInstanceOf(NoActiveTenantError);
  });

  it('recusa um relatório que não existe', async () => {
    await expect(gerarRelatorio('inventado', periodo, gestor)).rejects.toBeInstanceOf(UnknownReportError);
  });

  it('filtro por equipe fora do escopo não amplia nada: sai vazio sem consultar', async () => {
    const relatorio = await gerarRelatorio('horas-turno', { ...periodo, equipeId: 99 }, gestor);

    expect(relatorio.linhas).toEqual([]);
    // As colunas continuam vindo, para a tela montar o cabeçalho.
    expect(relatorio.colunas.length).toBeGreaterThan(0);
    expect(mockedTurnos).not.toHaveBeenCalled();
  });

  it('filtro por equipe dentro do escopo estreita a consulta', async () => {
    await gerarRelatorio('horas-turno', { ...periodo, equipeId: 2 }, gestor);
    expect(mockedTurnos).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 7, teamIds: [2] }));
  });

  it('sem equipe visível, não consulta o banco', async () => {
    mockedEquipes.mockResolvedValue([]);
    const relatorio = await gerarRelatorio('escala-colaborador', periodo, gestor);

    expect(relatorio.linhas).toEqual([]);
    expect(mockedTurnos).not.toHaveBeenCalled();
  });
});

describe('escala por colaborador', () => {
  it('calcula horas e nomeia o dia da semana', async () => {
    mockedTurnos.mockResolvedValue([turno()] as never);

    const relatorio = await gerarRelatorio('escala-colaborador', periodo, gestor);

    expect(relatorio.linhas[0]).toMatchObject({
      colaborador: 'Ana Lima',
      equipe: 'NOC',
      data: '2026-07-06',
      diaSemana: 'Segunda',
      horas: 12,
      cliente: 'Banco Atlas',
      tipo: 'Turno',
      status: 'Planejado',
    });
  });

  it('turno que atravessa a meia-noite conta 12h, não -12h', async () => {
    mockedTurnos.mockResolvedValue([turno({ horaInicio: '19:00', horaFim: '07:00' })] as never);

    const relatorio = await gerarRelatorio('escala-colaborador', periodo, gestor);

    expect(relatorio.linhas[0].horas).toBe(12);
  });

  it('mostra quem estava escalado antes da troca', async () => {
    mockedTurnos.mockResolvedValue([
      turno({ status: 'trocado', colaboradorOriginal: { nome: 'Bruno Costa' } }),
    ] as never);

    const relatorio = await gerarRelatorio('escala-colaborador', periodo, gestor);

    // O relatório é lido por gente: o enum do banco sai humanizado, aqui e no CSV.
    expect(relatorio.linhas[0]).toMatchObject({ status: 'Trocado', escaladoOriginalmente: 'Bruno Costa' });
  });
});

describe('escala por equipe', () => {
  it('agrega turnos, pessoas distintas e horas por equipe e dia', async () => {
    mockedTurnos.mockResolvedValue([
      turno({ id: 1, colaboradorId: 10 }),
      turno({ id: 2, colaboradorId: 20, colaborador: { id: 20, nome: 'Bruno Costa', equipe: { nome: 'NOC' } } }),
      // Mesma pessoa, mesmo dia, segundo turno: conta 2 turnos e 1 pessoa.
      turno({ id: 3, colaboradorId: 10, horaInicio: '19:00', horaFim: '23:00' }),
    ] as never);

    const relatorio = await gerarRelatorio('escala-equipe', periodo, gestor);

    expect(relatorio.linhas).toHaveLength(1);
    expect(relatorio.linhas[0]).toMatchObject({
      equipe: 'NOC',
      data: '2026-07-06',
      turnos: 3,
      pessoas: 2,
      horas: 28, // 12 + 12 + 4
      colaboradores: 'Ana Lima, Bruno Costa',
    });
  });
});

describe('horas por colaborador', () => {
  it('soma turnos, dias distintos e média, ordenando por horas', async () => {
    mockedTurnos.mockResolvedValue([
      turno({ id: 1, colaboradorId: 10 }),
      turno({ id: 2, colaboradorId: 10, data: new Date('2026-07-07T00:00:00Z') }),
      turno({
        id: 3,
        colaboradorId: 20,
        colaborador: { id: 20, nome: 'Bruno Costa', equipe: { nome: 'NOC' } },
        horaInicio: '08:00',
        horaFim: '12:00',
      }),
    ] as never);

    const relatorio = await gerarRelatorio('horas-turno', periodo, gestor);

    expect(relatorio.linhas[0]).toMatchObject({
      colaborador: 'Ana Lima',
      turnos: 2,
      diasTrabalhados: 2,
      horas: 24,
      mediaPorTurno: 12,
    });
    expect(relatorio.linhas[1]).toMatchObject({ colaborador: 'Bruno Costa', horas: 4 });
  });
});

describe('relatório de trocas', () => {
  it('filtra pelo dia do turno cedido, não pela data do pedido', async () => {
    mockedTrocas.mockResolvedValue([
      {
        id: 1,
        tipo: 'troca',
        status: 'aprovado',
        motivo: 'Consulta médica',
        createdAt: new Date('2026-06-20T00:00:00Z'),
        solicitante: { nome: 'Ana Lima' },
        destinatario: { nome: 'Bruno Costa' },
        turnoOrigem: { data: new Date('2026-07-06T00:00:00Z') },
        turnoDestino: { data: new Date('2026-07-07T00:00:00Z') },
        respondidoPor: { nome: 'Marina Gestora' },
        respondidoEm: new Date('2026-06-21T00:00:00Z'),
      },
      {
        id: 2,
        tipo: 'cobertura',
        status: 'pendente',
        motivo: 'Fora do período',
        createdAt: new Date('2026-07-01T00:00:00Z'),
        solicitante: { nome: 'Ana Lima' },
        destinatario: { nome: 'Bruno Costa' },
        turnoOrigem: { data: new Date('2026-08-15T00:00:00Z') },
        turnoDestino: null,
        respondidoPor: null,
        respondidoEm: null,
      },
    ] as never);

    const relatorio = await gerarRelatorio('trocas', periodo, gestor);

    expect(relatorio.linhas).toHaveLength(1);
    expect(relatorio.linhas[0]).toMatchObject({
      diaOrigem: '2026-07-06',
      diaDestino: '2026-07-07',
      tipo: 'Troca mútua',
      status: 'Aprovada',
      solicitadoEm: '2026-06-20',
    });
  });
});

describe('relatório de férias e ausências', () => {
  it('junta os dois, conta os dias inclusive e mantém quem está fora do período de fora', async () => {
    mockedFerias.mockResolvedValue([
      {
        id: 1,
        dataInicio: new Date('2026-07-10T00:00:00Z'),
        dataFim: new Date('2026-07-19T00:00:00Z'),
        status: 'aprovado',
        observacao: 'Férias programadas',
        colaborador: { nome: 'Ana Lima', equipe: { nome: 'NOC' } },
        respondidoPor: { nome: 'Marina Gestora' },
      },
    ] as never);
    mockedAusencias.mockResolvedValue([
      {
        id: 2,
        tipo: 'atestado',
        dataInicio: new Date('2026-07-02T00:00:00Z'),
        dataFim: new Date('2026-07-02T00:00:00Z'),
        status: 'aprovado',
        motivo: 'Atestado de 1 dia',
        colaborador: { nome: 'Bruno Costa', equipe: { nome: 'NOC' } },
        respondidoPor: null,
      },
      {
        id: 3,
        tipo: 'folga',
        dataInicio: new Date('2026-09-01T00:00:00Z'),
        dataFim: new Date('2026-09-01T00:00:00Z'),
        status: 'aprovado',
        motivo: 'Fora do período',
        colaborador: { nome: 'Bruno Costa', equipe: { nome: 'NOC' } },
        respondidoPor: null,
      },
    ] as never);

    const relatorio = await gerarRelatorio('ausencias', periodo, gestor);

    expect(relatorio.linhas).toHaveLength(2);
    // Ordenado por data de início: o atestado do dia 02 vem antes das férias do dia 10.
    expect(relatorio.linhas[0]).toMatchObject({ tipo: 'Atestado', dias: 1, colaborador: 'Bruno Costa', status: 'Aprovado' });
    expect(relatorio.linhas[1]).toMatchObject({ tipo: 'Férias', dias: 10, colaborador: 'Ana Lima', status: 'Aprovado' });
  });
});

describe('serialização CSV', () => {
  const relatorio = {
    id: 'teste',
    nome: 'Teste',
    colunas: [
      { chave: 'nome', titulo: 'Nome' },
      { chave: 'horas', titulo: 'Horas', numerico: true },
    ],
    linhas: [
      { nome: 'Ana Lima', horas: 12.5 },
      { nome: 'Costa; Bruno', horas: 4 },
      { nome: 'Diz "olá"', horas: 0 },
      { nome: 'Duas\nlinhas', horas: null },
    ],
  };

  it('começa com BOM UTF-8 — sem ele o Excel abre a acentuação quebrada', () => {
    expect(toCsv(relatorio).startsWith('﻿')).toBe(true);
  });

  it('usa ponto e vírgula como separador e vírgula como decimal (Excel pt-BR)', () => {
    const linhas = toCsv(relatorio).split('\r\n');
    expect(linhas[0]).toBe('﻿Nome;Horas');
    expect(linhas[1]).toBe('Ana Lima;12,5');
  });

  it('põe entre aspas o campo que contém o separador', () => {
    expect(toCsv(relatorio).split('\r\n')[2]).toBe('"Costa; Bruno";4');
  });

  it('dobra as aspas internas', () => {
    expect(toCsv(relatorio).split('\r\n')[3]).toBe('"Diz ""olá""";0');
  });

  it('protege a quebra de linha e escreve célula vazia para nulo', () => {
    const csv = toCsv(relatorio);
    expect(csv).toContain('"Duas\nlinhas";');
  });

  it('relatório sem linhas ainda sai com o cabeçalho', () => {
    const csv = toCsv({ ...relatorio, linhas: [] });
    expect(csv).toBe('﻿Nome;Horas\r\n');
  });
});

describe('nome do arquivo e período padrão', () => {
  it('nomeia com o id do relatório e o período, em ordem cronológica', () => {
    expect(nomeArquivo({ id: 'horas-turno', nome: 'x', colunas: [], linhas: [] }, periodo)).toBe(
      'horas-turno_2026-07-01_a_2026-07-31.csv'
    );
  });

  it('sugere o mês corrente, do dia 1 ao último dia', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-17T12:00:00Z'));

    // 2026 não é bissexto: fevereiro termina no dia 28.
    expect(periodoPadrao()).toEqual({ inicio: '2026-02-01', fim: '2026-02-28' });

    vi.useRealTimers();
  });
});
