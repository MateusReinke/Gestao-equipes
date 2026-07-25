import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/team.repository', () => ({
  teamRepository: { findAllIds: vi.fn(), findManagerTeamIds: vi.fn() },
}));

import { teamRepository } from '../../repositories/team.repository';
import { getVisibleTeamIds } from '../scope.service';

const mockedFindAllIds = vi.mocked(teamRepository.findAllIds);
const mockedFindManagerTeamIds = vi.mocked(teamRepository.findManagerTeamIds);

describe('scope.service getVisibleTeamIds', () => {
  beforeEach(() => {
    mockedFindAllIds.mockReset();
    mockedFindManagerTeamIds.mockReset();
  });

  it('retorna lista vazia sem usuário autenticado', async () => {
    expect(await getVisibleTeamIds(undefined)).toEqual([]);
  });

  it('retorna lista vazia sem tenant ativo (console do Admin Global)', async () => {
    const result = await getVisibleTeamIds({
      sub: 'global@empresa.com',
      userId: 1,
      isGlobalAdmin: true,
      activeTenantId: null,
      role: null,
    });
    expect(result).toEqual([]);
    expect(mockedFindAllIds).not.toHaveBeenCalled();
  });

  it('admin enxerga todas as equipes do tenant ativo', async () => {
    mockedFindAllIds.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }] as never);

    const result = await getVisibleTeamIds({
      sub: 'admin@empresa.com',
      userId: 1,
      isGlobalAdmin: false,
      activeTenantId: 7,
      role: 'admin',
    });

    expect(result).toEqual([1, 2, 3]);
    expect(mockedFindAllIds).toHaveBeenCalledWith(7);
    expect(mockedFindManagerTeamIds).not.toHaveBeenCalled();
  });

  it('Administrador Global enxerga todas as equipes do tenant em que está atuando', async () => {
    mockedFindAllIds.mockResolvedValue([{ id: 4 }] as never);

    const result = await getVisibleTeamIds({
      sub: 'global@empresa.com',
      userId: 9,
      isGlobalAdmin: true,
      activeTenantId: 3,
      role: 'admin',
    });

    expect(result).toEqual([4]);
    expect(mockedFindAllIds).toHaveBeenCalledWith(3);
  });

  it('gestor enxerga somente as equipes vinculadas a ele dentro do tenant ativo', async () => {
    mockedFindManagerTeamIds.mockResolvedValue([{ equipeId: 5 }, { equipeId: 9 }] as never);

    const result = await getVisibleTeamIds({
      sub: 'gestor@empresa.com',
      userId: 2,
      isGlobalAdmin: false,
      activeTenantId: 7,
      role: 'gestor',
    });

    expect(result).toEqual([5, 9]);
    expect(mockedFindAllIds).not.toHaveBeenCalled();
    expect(mockedFindManagerTeamIds).toHaveBeenCalledWith(2, 7);
  });
});
