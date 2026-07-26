import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/shift.repository', () => ({
  shiftRepository: { findByRange: vi.fn(), findForDay: vi.fn(), findUpcoming: vi.fn() },
}));
vi.mock('../../repositories/swap.repository', () => ({ swapRepository: { list: vi.fn() } }));
vi.mock('../../repositories/vacation.repository', () => ({
  vacationRepository: { findApprovedOverlapping: vi.fn(), findApprovedInRangeForTeams: vi.fn() },
}));
vi.mock('../../repositories/absence.repository', () => ({
  absenceRepository: { findApprovedOverlapping: vi.fn(), findByTeamIds: vi.fn() },
}));
vi.mock('../../repositories/client.repository', () => ({ clientRepository: { findByTeamIds: vi.fn() } }));
vi.mock('../../repositories/team.repository', () => ({ teamRepository: { countByIds: vi.fn() } }));
vi.mock('../../repositories/collaborator.repository', () => ({
  collaboratorRepository: { findActiveByTeamIds: vi.fn() },
}));
vi.mock('../../repositories/scale.repository', () => ({ scaleRepository: { findByTeamIds: vi.fn() } }));

import { shiftRepository } from '../../repositories/shift.repository';
import { clientRepository } from '../../repositories/client.repository';
import { vacationRepository } from '../../repositories/vacation.repository';
import { absenceRepository } from '../../repositories/absence.repository';
import { resolveWidgets } from '../widget-data.service';
import { Widget } from '../../types/widgets';
import { addDays, dayBounds } from '../../utils/date';

const mockedFindByRange = vi.mocked(shiftRepository.findByRange);
const mockedFindForDay = vi.mocked(shiftRepository.findForDay);
const mockedClientes = vi.mocked(clientRepository.findByTeamIds);
const mockedFerias = vi.mocked(vacationRepository.findApprovedOverlapping);
const mockedAusencias = vi.mocked(absenceRepository.findApprovedOverlapping);

const scope = { tenantId: 7, teamIds: [1, 2] };

function widget(over: Partial<Widget>): Widget {
  return { id: 'w1', tipo: 'metrica', titulo: 'Widget', largura: 2, opcoes: {}, ...over } as Widget;
}

function turno(over: Record<string, unknown>) {
  const { start } = dayBounds();
  return {
    id: 1,
    data: start,
    horaInicio: '08:00',
    horaFim: '20:00',
    colaboradorId: 10,
    colaborador: { id: 10, nome: 'Ana Lima', equipe: { nome: 'NOC' } },
    colaboradorOriginal: null,
    cliente: null,
    status: 'planejado',
    ...over,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedFerias.mockResolvedValue([]);
  mockedAusencias.mockResolvedValue([]);
});

describe('resolveWidgets', () => {
  it('nota não consulta o banco e devolve o texto configurado', async () => {
    const [resultado] = await resolveWidgets(
      [widget({ tipo: 'nota', opcoes: { texto: 'Runbook em /wiki/noc' } })],
      scope
    );

    expect(resultado.dados).toEqual({ texto: 'Runbook em /wiki/noc' });
    expect(mockedFindByRange).not.toHaveBeenCalled();
  });

  it('sem equipes no escopo, um widget de lista devolve vazio sem consultar', async () => {
    const [resultado] = await resolveWidgets([widget({ tipo: 'clientes_sla' })], {
      tenantId: 7,
      teamIds: [],
    });

    expect(resultado.dados).toEqual([]);
    expect(mockedClientes).not.toHaveBeenCalled();
  });

  it('filtro de equipe do widget não amplia o escopo do observador', async () => {
    mockedClientes.mockResolvedValue([] as never);

    // equipe 99 está fora do escopo: o resultado é vazio, e nada é consultado
    await resolveWidgets([widget({ tipo: 'clientes_sla', opcoes: { equipeId: 99 } })], scope);
    expect(mockedClientes).not.toHaveBeenCalled();

    // equipe 2 está no escopo: consulta restrita a ela
    await resolveWidgets([widget({ tipo: 'clientes_sla', opcoes: { equipeId: 2 } })], scope);
    expect(mockedClientes).toHaveBeenCalledWith(7, [2]);
  });

  it('cobertura por dia devolve uma linha por dia da janela, inclusive dias sem turno', async () => {
    const { start } = dayBounds();
    mockedFindByRange.mockResolvedValue([turno({ data: start }), turno({ id: 2, data: start })] as never);

    const [resultado] = await resolveWidgets(
      [widget({ tipo: 'cobertura_semana', opcoes: { dias: 3 } })],
      scope
    );

    const dados = resultado.dados as Array<{ data: string; total: number }>;
    expect(dados).toHaveLength(3);
    expect(dados[0].total).toBe(2);
    expect(dados[1].total).toBe(0);
    expect(dados[2].total).toBe(0);
  });

  it('carga por colaborador soma turnos e horas, tratando turno que vira a meia-noite', async () => {
    const { start } = dayBounds();
    mockedFindByRange.mockResolvedValue([
      // 12h de dia
      turno({ id: 1, colaboradorId: 10, horaInicio: '07:00', horaFim: '19:00' }),
      // 12h atravessando a meia-noite
      turno({ id: 2, colaboradorId: 10, data: addDays(start, 1), horaInicio: '19:00', horaFim: '07:00' }),
      turno({
        id: 3,
        colaboradorId: 20,
        colaborador: { id: 20, nome: 'Bruno Costa', equipe: { nome: 'NOC' } },
        horaInicio: '08:00',
        horaFim: '12:00',
      }),
    ] as never);

    const [resultado] = await resolveWidgets([widget({ tipo: 'carga_por_colaborador' })], scope);
    const dados = resultado.dados as Array<{ colaborador: string; turnos: number; horas: number }>;

    // Ordenado por quantidade de turnos, do maior para o menor
    expect(dados[0]).toEqual({ colaborador: 'Ana Lima', turnos: 2, horas: 24 });
    expect(dados[1]).toEqual({ colaborador: 'Bruno Costa', turnos: 1, horas: 4 });
  });

  it('em turno agora exclui quem está de férias ou ausente', async () => {
    mockedFerias.mockResolvedValue([{ id: 1, colaboradorId: 10 }] as never);
    mockedAusencias.mockResolvedValue([{ id: 2, colaboradorId: 20 }] as never);
    mockedFindForDay.mockResolvedValue([] as never);

    await resolveWidgets([widget({ tipo: 'em_turno_agora' })], scope);

    expect(mockedFindForDay).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 7, teamIds: [1, 2], excludeCollaboratorIds: [10, 20] })
    );
  });

  it('widget que falha não derruba os vizinhos', async () => {
    mockedFindByRange.mockRejectedValue(new Error('banco fora do ar'));

    const resultados = await resolveWidgets(
      [
        widget({ id: 'a', tipo: 'cobertura_semana' }),
        widget({ id: 'b', tipo: 'nota', opcoes: { texto: 'ok' } }),
      ],
      scope
    );

    expect(resultados[0].dados).toEqual({ erro: 'Não foi possível carregar este widget' });
    expect(resultados[1].dados).toEqual({ texto: 'ok' });
  });

  it('preserva id, título e largura declarados no layout', async () => {
    const [resultado] = await resolveWidgets(
      [widget({ id: 'meu-widget', tipo: 'nota', titulo: 'Aviso da operação', largura: 4 })],
      scope
    );

    expect(resultado.id).toBe('meu-widget');
    expect(resultado.titulo).toBe('Aviso da operação');
    expect(resultado.largura).toBe(4);
  });
});
