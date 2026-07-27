import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/team.repository', () => ({
  teamRepository: {
    findById: vi.fn(),
    findManagers: vi.fn(),
    replaceManagers: vi.fn(),
  },
}));
vi.mock('../../repositories/user.repository', () => ({
  userRepository: { findActiveMemberIds: vi.fn() },
}));
vi.mock('../../repositories/client.repository', () => ({ clientRepository: { findById: vi.fn() } }));
vi.mock('../scope.service', () => ({ getVisibleTeamIds: vi.fn() }));

import { teamRepository } from '../../repositories/team.repository';
import { userRepository } from '../../repositories/user.repository';
import {
  InvalidManagerError,
  NoActiveTenantError,
  TeamNotFoundError,
  setTeamManagers,
  teamManagersSchema,
} from '../team.service';

const admin = { sub: 'admin@empresa.com', userId: 1, isGlobalAdmin: false, activeTenantId: 7, roleCodigo: 'admin_tenant' };

const mockFindById = vi.mocked(teamRepository.findById);
const mockReplace = vi.mocked(teamRepository.replaceManagers);
const mockFindManagers = vi.mocked(teamRepository.findManagers);
const mockMembros = vi.mocked(userRepository.findActiveMemberIds);

beforeEach(() => {
  vi.resetAllMocks();
  mockFindById.mockResolvedValue({ id: 5, nome: 'NOC', tenantId: 7 } as never);
  mockFindManagers.mockResolvedValue([] as never);
  mockReplace.mockResolvedValue([] as never);
});

describe('validação do corpo', () => {
  it('aceita lista vazia — tirar todos os responsáveis é uma decisão válida', () => {
    expect(teamManagersSchema.safeParse({ gestorIds: [] }).success).toBe(true);
  });

  it('recusa id não numérico', () => {
    expect(teamManagersSchema.safeParse({ gestorIds: ['abc'] }).success).toBe(false);
  });

  it('recusa lista absurda', () => {
    expect(teamManagersSchema.safeParse({ gestorIds: Array.from({ length: 51 }, (_, i) => i + 1) }).success).toBe(false);
  });
});

describe('designação de responsáveis', () => {
  it('exige empresa ativa', async () => {
    await expect(setTeamManagers(5, { gestorIds: [2] }, { ...admin, activeTenantId: null })).rejects.toBeInstanceOf(
      NoActiveTenantError
    );
  });

  it('404 quando a equipe é de outra empresa', async () => {
    mockFindById.mockResolvedValue(null);
    await expect(setTeamManagers(5, { gestorIds: [2] }, admin)).rejects.toBeInstanceOf(TeamNotFoundError);
  });

  it('grava os responsáveis quando todos são membros ativos', async () => {
    mockMembros.mockResolvedValue([2, 3]);

    await setTeamManagers(5, { gestorIds: [2, 3] }, admin);

    expect(mockReplace).toHaveBeenCalledWith(7, 5, [2, 3]);
  });

  it('recusa usuário que não é membro desta empresa', async () => {
    // O ponto crítico: o vínculo abre a visibilidade da equipe. Aceitar um id
    // de outro tenant aqui seria entregar os dados desta empresa a ele.
    mockMembros.mockResolvedValue([2]);

    const erro = await setTeamManagers(5, { gestorIds: [2, 99] }, admin).catch((e) => e);

    expect(erro).toBeInstanceOf(InvalidManagerError);
    expect((erro as InvalidManagerError).idsInvalidos).toEqual([99]);
    // E nada é gravado: designação parcial silenciosa seria pior que o erro.
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('recusa usuário inativo', async () => {
    // `findActiveMemberIds` já filtra por ativo, então ele simplesmente não volta.
    mockMembros.mockResolvedValue([]);

    await expect(setTeamManagers(5, { gestorIds: [4] }, admin)).rejects.toBeInstanceOf(InvalidManagerError);
  });

  it('remove a duplicata em vez de estourar na unique do banco', async () => {
    mockMembros.mockResolvedValue([2]);

    await setTeamManagers(5, { gestorIds: [2, 2, 2] }, admin);

    expect(mockReplace).toHaveBeenCalledWith(7, 5, [2]);
  });

  it('lista vazia limpa os responsáveis sem consultar membros', async () => {
    mockMembros.mockResolvedValue([]);

    await setTeamManagers(5, { gestorIds: [] }, admin);

    expect(mockReplace).toHaveBeenCalledWith(7, 5, []);
  });

  it('devolve o estado depois da gravação, não o que foi enviado', async () => {
    mockMembros.mockResolvedValue([2]);
    mockFindManagers.mockResolvedValue([{ gestor: { id: 2, nome: 'Ana', email: 'ana@empresa.com' } }] as never);

    const resultado = await setTeamManagers(5, { gestorIds: [2] }, admin);

    expect(resultado).toEqual([{ gestor: { id: 2, nome: 'Ana', email: 'ana@empresa.com' } }]);
  });
});
