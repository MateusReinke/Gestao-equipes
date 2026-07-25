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

  it('admin enxerga todas as equipes cadastradas', async () => {
    mockedFindAllIds.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }] as never);

    const result = await getVisibleTeamIds({ sub: 'admin@empresa.com', userId: 1, role: 'admin' });

    expect(result).toEqual([1, 2, 3]);
    expect(mockedFindManagerTeamIds).not.toHaveBeenCalled();
  });

  it('gestor enxerga somente as equipes vinculadas a ele', async () => {
    mockedFindManagerTeamIds.mockResolvedValue([{ equipeId: 5 }, { equipeId: 9 }] as never);

    const result = await getVisibleTeamIds({ sub: 'gestor@empresa.com', userId: 2, role: 'gestor' });

    expect(result).toEqual([5, 9]);
    expect(mockedFindAllIds).not.toHaveBeenCalled();
    expect(mockedFindManagerTeamIds).toHaveBeenCalledWith(2);
  });
});
