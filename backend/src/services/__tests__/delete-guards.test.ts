import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/team.repository', () => ({
  teamRepository: { findById: vi.fn(), contarVinculos: vi.fn(), remove: vi.fn() },
}));
vi.mock('../../repositories/collaborator.repository', () => ({
  collaboratorRepository: { findById: vi.fn(), contarVinculos: vi.fn(), remove: vi.fn() },
}));
vi.mock('../../repositories/client.repository', () => ({ clientRepository: { findById: vi.fn() } }));
vi.mock('../scope.service', () => ({ getVisibleTeamIds: vi.fn() }));

import { teamRepository } from '../../repositories/team.repository';
import { collaboratorRepository } from '../../repositories/collaborator.repository';
import { getVisibleTeamIds } from '../scope.service';
import { deleteTeam, TeamHasHistoryError, TeamNotFoundError, NoActiveTenantError } from '../team.service';
import {
  deleteCollaborator,
  CollaboratorHasHistoryError,
  CollaboratorNotFoundError,
  ForbiddenTeamError,
} from '../collaborator.service';

const mockedTeamById = vi.mocked(teamRepository.findById);
const mockedTeamVinculos = vi.mocked(teamRepository.contarVinculos);
const mockedTeamRemove = vi.mocked(teamRepository.remove);
const mockedColabById = vi.mocked(collaboratorRepository.findById);
const mockedColabVinculos = vi.mocked(collaboratorRepository.contarVinculos);
const mockedColabRemove = vi.mocked(collaboratorRepository.remove);
const mockedEquipes = vi.mocked(getVisibleTeamIds);

const gestor = { sub: 'gestor@empresa.com', userId: 2, isGlobalAdmin: false, activeTenantId: 7, roleCodigo: 'gestor' };

const semVinculo = [0, 0] as [number, number];
const colabSemVinculo = [0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number];

beforeEach(() => {
  vi.resetAllMocks();
  mockedEquipes.mockResolvedValue([1, 2]);
});

describe('exclusão de equipe', () => {
  it('exige tenant ativo', async () => {
    await expect(deleteTeam(1, { ...gestor, activeTenantId: null })).rejects.toBeInstanceOf(NoActiveTenantError);
  });

  it('404 para equipe de outra empresa (findById já filtra por tenant)', async () => {
    mockedTeamById.mockResolvedValue(null as never);
    await expect(deleteTeam(99, gestor)).rejects.toBeInstanceOf(TeamNotFoundError);
    expect(mockedTeamRemove).not.toHaveBeenCalled();
  });

  it('apaga a equipe vazia', async () => {
    mockedTeamById.mockResolvedValue({ id: 1, nome: 'NOC' } as never);
    mockedTeamVinculos.mockResolvedValue(semVinculo as never);

    const removida = await deleteTeam(1, gestor);

    expect(removida).toMatchObject({ nome: 'NOC' });
    expect(mockedTeamRemove).toHaveBeenCalledWith(7, 1);
  });

  it('recusa apagar equipe com colaborador e sugere mover ou desativar', async () => {
    mockedTeamById.mockResolvedValue({ id: 1, nome: 'NOC' } as never);
    mockedTeamVinculos.mockResolvedValue([3, 0] as never);

    await expect(deleteTeam(1, gestor)).rejects.toThrowError(/3 colaborador\(es\).*desative/s);
    expect(mockedTeamRemove).not.toHaveBeenCalled();
  });

  it('recusa apagar equipe sem colaborador mas com turnos no histórico', async () => {
    mockedTeamById.mockResolvedValue({ id: 1, nome: 'NOC' } as never);
    mockedTeamVinculos.mockResolvedValue([0, 42] as never);

    const erro = await deleteTeam(1, gestor).catch((e) => e);

    expect(erro).toBeInstanceOf(TeamHasHistoryError);
    expect(erro.detalhes).toEqual({ colaboradores: 0, turnos: 42 });
    expect(erro.message).toContain('42 turno(s) no histórico');
  });
});

describe('exclusão de colaborador', () => {
  const ana = { id: 10, nome: 'Ana Lima', equipeId: 1 };

  it('404 para colaborador inexistente', async () => {
    mockedColabById.mockResolvedValue(null as never);
    await expect(deleteCollaborator(10, gestor)).rejects.toBeInstanceOf(CollaboratorNotFoundError);
  });

  it('recusa remover colaborador de equipe que o usuário não enxerga', async () => {
    mockedColabById.mockResolvedValue({ ...ana, equipeId: 99 } as never);

    await expect(deleteCollaborator(10, gestor)).rejects.toBeInstanceOf(ForbiddenTeamError);
    expect(mockedColabVinculos).not.toHaveBeenCalled();
    expect(mockedColabRemove).not.toHaveBeenCalled();
  });

  it('apaga o colaborador recém-criado, sem histórico', async () => {
    mockedColabById.mockResolvedValue(ana as never);
    mockedColabVinculos.mockResolvedValue(colabSemVinculo as never);

    await deleteCollaborator(10, gestor);

    expect(mockedColabRemove).toHaveBeenCalledWith(7, 10);
  });

  it('um único turno já basta para bloquear e mandar desativar', async () => {
    mockedColabById.mockResolvedValue(ana as never);
    mockedColabVinculos.mockResolvedValue([1, 0, 0, 0, 0, 0] as never);

    await expect(deleteCollaborator(10, gestor)).rejects.toThrowError(/1 turno\(s\).*Desative o cadastro/s);
    expect(mockedColabRemove).not.toHaveBeenCalled();
  });

  it('lista tudo o que segura a exclusão, não só o primeiro item', async () => {
    mockedColabById.mockResolvedValue(ana as never);
    mockedColabVinculos.mockResolvedValue([5, 2, 1, 3, 1, 1] as never);

    const erro = await deleteCollaborator(10, gestor).catch((e) => e);

    expect(erro).toBeInstanceOf(CollaboratorHasHistoryError);
    expect(erro.detalhes).toEqual({ turnos: 5, escalas: 2, ferias: 1, ausencias: 3, clientes: 1, usuario: 1 });
    expect(erro.message).toContain('5 turno(s)');
    expect(erro.message).toContain('2 atribuição(ões) de escala');
    expect(erro.message).toContain('1 cliente(s) sob sua responsabilidade');
    expect(erro.message).toContain('um usuário vinculado');
  });

  it('cliente sob responsabilidade sozinho já bloqueia', async () => {
    mockedColabById.mockResolvedValue(ana as never);
    mockedColabVinculos.mockResolvedValue([0, 0, 0, 0, 1, 0] as never);

    await expect(deleteCollaborator(10, gestor)).rejects.toBeInstanceOf(CollaboratorHasHistoryError);
  });
});
