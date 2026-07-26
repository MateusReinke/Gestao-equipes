import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/team.repository', () => ({
  teamRepository: { findAllIds: vi.fn(), findManagerTeamIds: vi.fn() },
}));
vi.mock('../permission.service', () => ({
  userHasPermission: vi.fn(),
}));

import { teamRepository } from '../../repositories/team.repository';
import { userHasPermission } from '../permission.service';
import { getVisibleTeamIds } from '../scope.service';

const mockedFindAllIds = vi.mocked(teamRepository.findAllIds);
const mockedFindManagerTeamIds = vi.mocked(teamRepository.findManagerTeamIds);
const mockedHasPermission = vi.mocked(userHasPermission);

const gestor = { sub: 'gestor@empresa.com', userId: 2, isGlobalAdmin: false, activeTenantId: 7, roleCodigo: 'gestor' };
const admin = { sub: 'admin@empresa.com', userId: 1, isGlobalAdmin: false, activeTenantId: 7, roleCodigo: 'admin_tenant' };
const globalAdmin = { sub: 'global@empresa.com', userId: 9, isGlobalAdmin: true, activeTenantId: 3, roleCodigo: 'admin_tenant' };

describe('scope.service getVisibleTeamIds', () => {
  beforeEach(() => {
    mockedFindAllIds.mockReset();
    mockedFindManagerTeamIds.mockReset();
    mockedHasPermission.mockReset();
    mockedHasPermission.mockResolvedValue(false);
  });

  it('retorna lista vazia sem usuário autenticado', async () => {
    expect(await getVisibleTeamIds(undefined)).toEqual([]);
  });

  it('retorna lista vazia sem tenant ativo (console do Admin Global)', async () => {
    const result = await getVisibleTeamIds({ ...globalAdmin, activeTenantId: null });
    expect(result).toEqual([]);
    expect(mockedFindAllIds).not.toHaveBeenCalled();
  });

  it('quem pode editar equipes enxerga todas as equipes do tenant ativo', async () => {
    mockedHasPermission.mockResolvedValue(true);
    mockedFindAllIds.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }] as never);

    const result = await getVisibleTeamIds(admin);

    expect(result).toEqual([1, 2, 3]);
    expect(mockedFindAllIds).toHaveBeenCalledWith(7);
    expect(mockedFindManagerTeamIds).not.toHaveBeenCalled();
  });

  it('Administrador Global enxerga todas as equipes do tenant em que está atuando', async () => {
    mockedFindAllIds.mockResolvedValue([{ id: 4 }] as never);

    const result = await getVisibleTeamIds(globalAdmin);

    expect(result).toEqual([4]);
    expect(mockedFindAllIds).toHaveBeenCalledWith(3);
  });

  it('sem permissão ampla, enxerga somente as equipes sob sua gestão', async () => {
    mockedFindManagerTeamIds.mockResolvedValue([{ equipeId: 5 }, { equipeId: 9 }] as never);

    const result = await getVisibleTeamIds(gestor);

    expect(result).toEqual([5, 9]);
    expect(mockedFindAllIds).not.toHaveBeenCalled();
    expect(mockedFindManagerTeamIds).toHaveBeenCalledWith(2, 7);
  });
});
