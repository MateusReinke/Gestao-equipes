import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/hr.repository', () => ({
  hrRepository: { carregarBaseDeFerias: vi.fn() },
  notificationRepository: {
    gestoresDasEquipes: vi.fn(),
    usuariosComPermissao: vi.fn(),
    emitirEmLote: vi.fn(),
  },
}));
vi.mock('../scope.service', () => ({ getVisibleTeamIds: vi.fn() }));

import { hrRepository, notificationRepository } from '../../repositories/hr.repository';
import { varrerAlertasDeFerias } from '../vacation-balance.service';

const mockBase = vi.mocked(hrRepository.carregarBaseDeFerias);
const mockGestores = vi.mocked(notificationRepository.gestoresDasEquipes);
const mockRh = vi.mocked(notificationRepository.usuariosComPermissao);
const mockEmitir = vi.mocked(notificationRepository.emitirEmLote);

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/// Admitido em 15/03/2024: em 20/03/2025 o ciclo 1 já venceu o aquisitivo e
/// tem direito adquirido, então gera exatamente um alerta.
function baseCom(colaboradores: Array<{ id: number; nome: string; equipeId: number }>) {
  return {
    colaboradores: colaboradores.map((item) => ({
      id: item.id,
      nome: item.nome,
      dataAdmissao: d('2024-03-15'),
      dataDesligamento: null,
      equipe: { id: item.equipeId, nome: `Equipe ${item.equipeId}` },
    })),
    faltas: [],
    ferias: [],
    ajustes: [],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockEmitir.mockImplementation(async (itens) => ({ count: itens.length }) as never);
  mockGestores.mockResolvedValue([] as never);
  mockRh.mockResolvedValue([]);
});

describe('destinatários da varredura de férias', () => {
  it('sem responsável e sem RH, o alerta existe mas não tem para quem ir', async () => {
    // É exatamente o estado em que qualquer empresa criada pela interface ficava
    // antes da tela de responsáveis: o motor rodava e notificava o vazio.
    mockBase.mockResolvedValue(baseCom([{ id: 1, nome: 'Ana', equipeId: 10 }]) as never);

    const resultado = await varrerAlertasDeFerias({ tenantId: 7, teamIds: [10], hoje: d('2025-03-20') });

    expect(resultado.alertas).toBe(1);
    expect(resultado.notificacoes).toBe(0);
  });

  it('responsável pela equipe recebe o alerta do time dele', async () => {
    mockBase.mockResolvedValue(baseCom([{ id: 1, nome: 'Ana', equipeId: 10 }]) as never);
    mockGestores.mockResolvedValue([{ gestorId: 50, equipeId: 10 }] as never);

    await varrerAlertasDeFerias({ tenantId: 7, teamIds: [10], hoje: d('2025-03-20') });

    expect(mockEmitir.mock.calls[0][0].map((item) => item.destinatarioId)).toEqual([50]);
  });

  it('responsável de uma equipe não recebe alerta da outra', async () => {
    mockBase.mockResolvedValue(
      baseCom([
        { id: 1, nome: 'Ana', equipeId: 10 },
        { id: 2, nome: 'Bruno', equipeId: 20 },
      ]) as never
    );
    mockGestores.mockResolvedValue([{ gestorId: 50, equipeId: 10 }] as never);

    await varrerAlertasDeFerias({ tenantId: 7, teamIds: [10, 20], hoje: d('2025-03-20') });

    const emitidos = mockEmitir.mock.calls[0][0];
    // Um alerta só: o de Ana. O de Bruno não tem destinatário.
    expect(emitidos).toHaveLength(1);
    expect(emitidos[0].entidadeId).toBe('1');
  });

  it('RH recebe de todo mundo, inclusive de equipe sem responsável', async () => {
    mockBase.mockResolvedValue(
      baseCom([
        { id: 1, nome: 'Ana', equipeId: 10 },
        { id: 2, nome: 'Bruno', equipeId: 20 },
      ]) as never
    );
    mockGestores.mockResolvedValue([{ gestorId: 50, equipeId: 10 }] as never);
    mockRh.mockResolvedValue([99]);

    await varrerAlertasDeFerias({ tenantId: 7, teamIds: [10, 20], hoje: d('2025-03-20') });

    const emitidos = mockEmitir.mock.calls[0][0];
    const porColaborador = new Map<string, number[]>();
    for (const item of emitidos) {
      porColaborador.set(item.entidadeId!, [...(porColaborador.get(item.entidadeId!) ?? []), item.destinatarioId]);
    }

    expect(porColaborador.get('1')?.sort()).toEqual([50, 99]);
    expect(porColaborador.get('2')).toEqual([99]);
  });

  it('quem é responsável E RH recebe uma notificação, não duas', async () => {
    mockBase.mockResolvedValue(baseCom([{ id: 1, nome: 'Ana', equipeId: 10 }]) as never);
    mockGestores.mockResolvedValue([{ gestorId: 50, equipeId: 10 }] as never);
    mockRh.mockResolvedValue([50]);

    await varrerAlertasDeFerias({ tenantId: 7, teamIds: [10], hoje: d('2025-03-20') });

    expect(mockEmitir.mock.calls[0][0]).toHaveLength(1);
  });

  it('consulta o RH pela permissão dedicada, não pela de aprovar férias', async () => {
    mockBase.mockResolvedValue(baseCom([{ id: 1, nome: 'Ana', equipeId: 10 }]) as never);

    await varrerAlertasDeFerias({ tenantId: 7, teamIds: [10], hoje: d('2025-03-20') });

    // `hr.vacation.approve` é de admin_tenant E gestor: usá-la faria todo
    // gestor receber alerta da empresa inteira.
    expect(mockRh).toHaveBeenCalledWith(7, 'hr.vacation.watch_all');
  });

  it('base vazia não consulta destinatário nem emite nada', async () => {
    mockBase.mockResolvedValue({ colaboradores: [], faltas: [], ferias: [], ajustes: [] } as never);

    const resultado = await varrerAlertasDeFerias({ tenantId: 7, teamIds: [10], hoje: d('2025-03-20') });

    expect(resultado).toEqual({ alertas: 0, notificacoes: 0 });
    expect(mockEmitir).not.toHaveBeenCalled();
  });
});
