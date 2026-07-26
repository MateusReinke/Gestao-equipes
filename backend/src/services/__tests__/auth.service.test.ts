import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/user.repository', () => ({
  userRepository: { findByEmailWithMemberships: vi.fn() },
}));
vi.mock('../../repositories/tenant.repository', () => ({
  tenantRepository: { findById: vi.fn() },
}));
vi.mock('../../repositories/role.repository', () => ({
  roleRepository: { findSystemByCodigo: vi.fn() },
}));

import { userRepository } from '../../repositories/user.repository';
import { InvalidCredentialsError, NoTenantAccessError, TenantSelectionRequiredError, login } from '../auth.service';

const mockedFindByEmailWithMemberships = vi.mocked(userRepository.findByEmailWithMemberships);

function membership(tenantId: number, roleCodigo: 'admin_tenant' | 'gestor', tenantNome = `Tenant ${tenantId}`) {
  return {
    id: tenantId,
    userId: 1,
    tenantId,
    roleId: 1,
    colaboradorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    role: { id: 1, codigo: roleCodigo, nome: roleCodigo, descricao: '', isSystem: true, ordem: 10, tenantId: null },
    tenant: { id: tenantId, nome: tenantNome, slug: `tenant-${tenantId}`, ativo: true, createdAt: new Date(), updatedAt: new Date() },
  };
}

function fakeUser(overrides: Record<string, unknown>, senhaHash: string) {
  return {
    id: 1,
    nome: 'Usuário Teste',
    email: 'usuario@empresa.com',
    senhaHash,
    ativo: true,
    isGlobalAdmin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    memberships: [],
    ...overrides,
  };
}

describe('auth.service login', () => {
  beforeEach(() => mockedFindByEmailWithMemberships.mockReset());

  it('rejeita usuário inexistente', async () => {
    mockedFindByEmailWithMemberships.mockResolvedValue(null);
    await expect(login('naoexiste@empresa.com', 'qualquer')).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('rejeita usuário inativo', async () => {
    const senhaHash = await bcrypt.hash('Segredo@123', 4);
    mockedFindByEmailWithMemberships.mockResolvedValue(fakeUser({ ativo: false }, senhaHash) as never);
    await expect(login('usuario@empresa.com', 'Segredo@123')).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('rejeita senha incorreta', async () => {
    const senhaHash = await bcrypt.hash('Segredo@123', 4);
    mockedFindByEmailWithMemberships.mockResolvedValue(fakeUser({}, senhaHash) as never);
    await expect(login('usuario@empresa.com', 'senha-errada')).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('Administrador Global entra sem tenant ativo (console)', async () => {
    const senhaHash = await bcrypt.hash('Segredo@123', 4);
    mockedFindByEmailWithMemberships.mockResolvedValue(fakeUser({ isGlobalAdmin: true }, senhaHash) as never);

    const result = await login('usuario@empresa.com', 'Segredo@123');

    expect(result.token).toEqual(expect.any(String));
    expect(result.activeTenant).toBeNull();
    expect(result.user.isGlobalAdmin).toBe(true);
  });

  it('usuário sem nenhum vínculo é rejeitado', async () => {
    const senhaHash = await bcrypt.hash('Segredo@123', 4);
    mockedFindByEmailWithMemberships.mockResolvedValue(fakeUser({ memberships: [] }, senhaHash) as never);
    await expect(login('usuario@empresa.com', 'Segredo@123')).rejects.toBeInstanceOf(NoTenantAccessError);
  });

  it('usuário com um único vínculo entra direto nesse tenant', async () => {
    const senhaHash = await bcrypt.hash('Segredo@123', 4);
    mockedFindByEmailWithMemberships.mockResolvedValue(fakeUser({ memberships: [membership(1, 'gestor')] }, senhaHash) as never);

    const result = await login('usuario@empresa.com', 'Segredo@123');

    expect(result.activeTenant).toEqual({ id: 1, nome: 'Tenant 1', slug: 'tenant-1' });
  });

  it('usuário com múltiplos vínculos sem escolher tenant recebe a lista para seleção', async () => {
    const senhaHash = await bcrypt.hash('Segredo@123', 4);
    mockedFindByEmailWithMemberships.mockResolvedValue(
      fakeUser({ memberships: [membership(1, 'gestor'), membership(2, 'admin_tenant')] }, senhaHash) as never
    );

    await expect(login('usuario@empresa.com', 'Segredo@123')).rejects.toBeInstanceOf(TenantSelectionRequiredError);
  });

  it('usuário com múltiplos vínculos escolhendo um tenant válido recebe token para ele', async () => {
    const senhaHash = await bcrypt.hash('Segredo@123', 4);
    mockedFindByEmailWithMemberships.mockResolvedValue(
      fakeUser({ memberships: [membership(1, 'gestor'), membership(2, 'admin_tenant')] }, senhaHash) as never
    );

    const result = await login('usuario@empresa.com', 'Segredo@123', 2);

    expect(result.activeTenant).toEqual({ id: 2, nome: 'Tenant 2', slug: 'tenant-2' });
  });

  it('rejeita tenant escolhido que não pertence ao usuário', async () => {
    const senhaHash = await bcrypt.hash('Segredo@123', 4);
    mockedFindByEmailWithMemberships.mockResolvedValue(
      fakeUser({ memberships: [membership(1, 'gestor'), membership(2, 'admin_tenant')] }, senhaHash) as never
    );

    await expect(login('usuario@empresa.com', 'Segredo@123', 999)).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
