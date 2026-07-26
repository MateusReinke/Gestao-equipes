import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/share.repository', () => ({
  shareRepository: {
    findReachingUser: vi.fn(),
    findExistingTarget: vi.fn(),
    create: vi.fn(),
    updateAccess: vi.fn(),
    findById: vi.fn(),
    remove: vi.fn(),
    findByToken: vi.fn(),
  },
}));
vi.mock('../../repositories/team.repository', () => ({
  teamRepository: { findUserTeamIds: vi.fn(), findById: vi.fn() },
}));
vi.mock('../../repositories/user.repository', () => ({
  userRepository: { findMembership: vi.fn() },
}));
vi.mock('../../repositories/role.repository', () => ({
  roleRepository: { findAvailableById: vi.fn() },
}));

import { shareRepository } from '../../repositories/share.repository';
import { teamRepository } from '../../repositories/team.repository';
import { userRepository } from '../../repositories/user.repository';
import { roleRepository } from '../../repositories/role.repository';
import {
  getSharedAccessMap,
  getEffectiveAccess,
  shareResource,
  maiorAcesso,
  permiteEditar,
  permiteGerir,
  resolvePublicToken,
  shareSchema,
  ShareTargetInvalidError,
  ShareScopeNotAllowedError,
} from '../share.service';

const mockedFindReaching = vi.mocked(shareRepository.findReachingUser);
const mockedFindExisting = vi.mocked(shareRepository.findExistingTarget);
const mockedCreate = vi.mocked(shareRepository.create);
const mockedUpdateAccess = vi.mocked(shareRepository.updateAccess);
const mockedFindByToken = vi.mocked(shareRepository.findByToken);
const mockedUserTeams = vi.mocked(teamRepository.findUserTeamIds);
const mockedTeamById = vi.mocked(teamRepository.findById);
const mockedMembership = vi.mocked(userRepository.findMembership);
const mockedRoleById = vi.mocked(roleRepository.findAvailableById);

const analista = { sub: 'ana@acme.com', userId: 5, isGlobalAdmin: false, activeTenantId: 7, roleCodigo: 'analista' };
const globalAdmin = { sub: 'root@plataforma', userId: 1, isGlobalAdmin: true, activeTenantId: 7, roleCodigo: 'admin_tenant' };

beforeEach(() => {
  vi.resetAllMocks();
  mockedUserTeams.mockResolvedValue([]);
  mockedMembership.mockResolvedValue({ roleId: 40 } as never);
  mockedFindReaching.mockResolvedValue([]);
});

describe('força dos níveis de acesso', () => {
  it('gestão vence edição, que vence leitura', () => {
    expect(maiorAcesso('leitura', 'edicao')).toBe('edicao');
    expect(maiorAcesso('gestao', 'edicao')).toBe('gestao');
    expect(maiorAcesso('leitura', 'leitura')).toBe('leitura');
  });

  it('somente edição e gestão permitem editar; só gestão permite administrar', () => {
    expect(permiteEditar('leitura')).toBe(false);
    expect(permiteEditar('edicao')).toBe(true);
    expect(permiteEditar('gestao')).toBe(true);
    expect(permiteGerir('edicao')).toBe(false);
    expect(permiteGerir('gestao')).toBe(true);
    expect(permiteEditar(null)).toBe(false);
  });
});

describe('getSharedAccessMap', () => {
  it('devolve mapa vazio quando não há tenant ativo', async () => {
    const mapa = await getSharedAccessMap({ ...analista, activeTenantId: null });
    expect(mapa.size).toBe(0);
    expect(mockedFindReaching).not.toHaveBeenCalled();
  });

  it('consulta as concessões com o papel e as equipes reais do usuário', async () => {
    mockedUserTeams.mockResolvedValue([3, 9]);
    mockedMembership.mockResolvedValue({ roleId: 40 } as never);

    await getSharedAccessMap(analista, 'dashboard');

    expect(mockedFindReaching).toHaveBeenCalledWith({
      tenantId: 7,
      userId: 5,
      roleId: 40,
      teamIds: [3, 9],
      recursoTipo: 'dashboard',
    });
  });

  it('quando duas concessões alcançam o mesmo recurso, vale a mais permissiva', async () => {
    mockedFindReaching.mockResolvedValue([
      { recursoTipo: 'dashboard', recursoId: 12, acesso: 'leitura', escopo: 'tenant', tenantId: 7 },
      { recursoTipo: 'dashboard', recursoId: 12, acesso: 'edicao', escopo: 'usuario', tenantId: 7 },
    ] as never);

    const mapa = await getSharedAccessMap(analista, 'dashboard');

    expect(mapa.get('dashboard:12')).toBe('edicao');
  });

  it('a ordem em que as concessões chegam não muda o resultado', async () => {
    mockedFindReaching.mockResolvedValue([
      { recursoTipo: 'dashboard', recursoId: 12, acesso: 'gestao', escopo: 'usuario', tenantId: 7 },
      { recursoTipo: 'dashboard', recursoId: 12, acesso: 'leitura', escopo: 'tenant', tenantId: 7 },
    ] as never);

    const mapa = await getSharedAccessMap(analista, 'dashboard');

    expect(mapa.get('dashboard:12')).toBe('gestao');
  });
});

describe('getEffectiveAccess', () => {
  const base = { recursoTipo: 'dashboard' as const, recursoId: 12, recursoTenantId: 7 };

  it('dono do recurso administra o próprio recurso sem precisar de concessão', async () => {
    const acesso = await getEffectiveAccess({ ...base, user: analista, ownerUserId: 5 });

    expect(acesso).toBe('gestao');
    expect(mockedFindReaching).not.toHaveBeenCalled();
  });

  it('Administrador Global administra qualquer recurso', async () => {
    const acesso = await getEffectiveAccess({ ...base, user: globalAdmin, ownerUserId: 99 });
    expect(acesso).toBe('gestao');
  });

  it('sem concessão que alcance o recurso, o acesso é nulo', async () => {
    const acesso = await getEffectiveAccess({ ...base, user: analista, ownerUserId: 99 });
    expect(acesso).toBeNull();
  });

  it('concessão que alcança o usuário devolve o nível concedido', async () => {
    mockedFindReaching.mockResolvedValue([
      { recursoTipo: 'dashboard', recursoId: 12, acesso: 'leitura', escopo: 'equipe', tenantId: 7 },
    ] as never);

    const acesso = await getEffectiveAccess({ ...base, user: analista, ownerUserId: 99 });
    expect(acesso).toBe('leitura');
  });

  it('concessão de outro recurso não vaza para o recurso consultado', async () => {
    mockedFindReaching.mockResolvedValue([
      { recursoTipo: 'dashboard', recursoId: 99, acesso: 'gestao', escopo: 'tenant', tenantId: 7 },
    ] as never);

    const acesso = await getEffectiveAccess({ ...base, user: analista, ownerUserId: 99 });
    expect(acesso).toBeNull();
  });
});

describe('validação do destinatário', () => {
  it('exige o usuário quando o escopo é "usuario"', () => {
    const parsed = shareSchema.safeParse({ escopo: 'usuario', acesso: 'leitura' });
    expect(parsed.success).toBe(false);
  });

  it('exige a equipe quando o escopo é "equipe"', () => {
    const parsed = shareSchema.safeParse({ escopo: 'equipe', acesso: 'leitura' });
    expect(parsed.success).toBe(false);
  });

  it('link público não pode conceder edição', () => {
    const parsed = shareSchema.safeParse({ escopo: 'link_publico', acesso: 'edicao' });
    expect(parsed.success).toBe(false);
  });

  it('escopo de tenant dispensa destinatário', () => {
    const parsed = shareSchema.safeParse({ escopo: 'tenant', acesso: 'leitura' });
    expect(parsed.success).toBe(true);
  });
});

describe('shareResource', () => {
  const base = { recursoTipo: 'dashboard' as const, recursoId: 12 };

  it('recusa usuário que não pertence ao tenant', async () => {
    mockedMembership.mockResolvedValue(null as never);

    await expect(
      shareResource({
        ...base,
        data: { escopo: 'usuario', usuarioId: 42, acesso: 'leitura' } as never,
        user: analista,
      })
    ).rejects.toBeInstanceOf(ShareTargetInvalidError);

    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('recusa equipe de outra empresa', async () => {
    mockedTeamById.mockResolvedValue(null as never);

    await expect(
      shareResource({
        ...base,
        data: { escopo: 'equipe', equipeId: 77, acesso: 'leitura' } as never,
        user: analista,
      })
    ).rejects.toBeInstanceOf(ShareTargetInvalidError);
  });

  it('recusa papel que não está disponível para o tenant', async () => {
    mockedRoleById.mockResolvedValue(null as never);

    await expect(
      shareResource({
        ...base,
        data: { escopo: 'papel', papelId: 3, acesso: 'leitura' } as never,
        user: analista,
      })
    ).rejects.toBeInstanceOf(ShareTargetInvalidError);
  });

  it('só o Administrador Global compartilha com toda a plataforma', async () => {
    await expect(
      shareResource({ ...base, data: { escopo: 'plataforma', acesso: 'leitura' } as never, user: analista })
    ).rejects.toBeInstanceOf(ShareScopeNotAllowedError);

    mockedFindExisting.mockResolvedValue(null as never);
    mockedCreate.mockResolvedValue({ id: 1 } as never);

    await expect(
      shareResource({ ...base, data: { escopo: 'plataforma', acesso: 'leitura' } as never, user: globalAdmin })
    ).resolves.toEqual({ id: 1 });
  });

  it('compartilhar de novo com o mesmo destinatário promove o acesso em vez de duplicar', async () => {
    mockedMembership.mockResolvedValue({ roleId: 40 } as never);
    mockedFindExisting.mockResolvedValue({ id: 55 } as never);
    mockedUpdateAccess.mockResolvedValue({ id: 55, acesso: 'edicao' } as never);

    const resultado = await shareResource({
      ...base,
      data: { escopo: 'usuario', usuarioId: 8, acesso: 'edicao' } as never,
      user: analista,
    });

    expect(mockedUpdateAccess).toHaveBeenCalledWith(55, 'edicao', null);
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(resultado).toEqual({ id: 55, acesso: 'edicao' });
  });

  it('cada link público gera uma concessão nova, com token próprio', async () => {
    mockedCreate.mockResolvedValue({ id: 2 } as never);

    await shareResource({ ...base, data: { escopo: 'link_publico', acesso: 'leitura' } as never, user: analista });

    expect(mockedFindExisting).not.toHaveBeenCalled();
    const enviado = mockedCreate.mock.calls[0][0];
    expect(enviado.token).toBeTruthy();
    expect(enviado.token!.length).toBeGreaterThanOrEqual(24);
    expect(enviado.escopo).toBe('link_publico');
  });
});

describe('resolvePublicToken', () => {
  it('devolve null para token inexistente', async () => {
    mockedFindByToken.mockResolvedValue(null as never);
    expect(await resolvePublicToken('nada')).toBeNull();
  });

  it('devolve null para concessão que não é de link público', async () => {
    mockedFindByToken.mockResolvedValue({ escopo: 'usuario' } as never);
    expect(await resolvePublicToken('abc')).toBeNull();
  });

  it('devolve null para link expirado', async () => {
    mockedFindByToken.mockResolvedValue({
      escopo: 'link_publico',
      expiraEm: new Date(Date.now() - 60_000),
    } as never);

    expect(await resolvePublicToken('abc')).toBeNull();
  });

  it('devolve a concessão de link válido', async () => {
    const concessao = { escopo: 'link_publico', expiraEm: null, recursoId: 12 };
    mockedFindByToken.mockResolvedValue(concessao as never);

    expect(await resolvePublicToken('abc')).toEqual(concessao);
  });
});
