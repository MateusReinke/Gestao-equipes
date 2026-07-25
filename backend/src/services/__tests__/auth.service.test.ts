import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/user.repository', () => ({
  userRepository: { findByEmail: vi.fn() },
}));

import { userRepository } from '../../repositories/user.repository';
import { InvalidCredentialsError, login } from '../auth.service';

const mockedFindByEmail = vi.mocked(userRepository.findByEmail);

function fakeUser(overrides: Partial<Awaited<ReturnType<typeof userRepository.findByEmail>>> = {}) {
  return {
    id: 1,
    nome: 'Administrador',
    email: 'admin@empresa.com',
    senhaHash: '',
    role: 'admin' as const,
    ativo: true,
    colaboradorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('auth.service login', () => {
  beforeEach(() => {
    mockedFindByEmail.mockReset();
  });

  it('retorna token e dados do usuário com credenciais válidas', async () => {
    const senhaHash = await bcrypt.hash('Segredo@123', 4);
    mockedFindByEmail.mockResolvedValue(fakeUser({ senhaHash }) as never);

    const result = await login('admin@empresa.com', 'Segredo@123');

    expect(result.token).toEqual(expect.any(String));
    expect(result.user).toEqual({ id: 1, nome: 'Administrador', email: 'admin@empresa.com', role: 'admin' });
  });

  it('rejeita senha incorreta', async () => {
    const senhaHash = await bcrypt.hash('Segredo@123', 4);
    mockedFindByEmail.mockResolvedValue(fakeUser({ senhaHash }) as never);

    await expect(login('admin@empresa.com', 'senha-errada')).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('rejeita usuário inexistente', async () => {
    mockedFindByEmail.mockResolvedValue(null);

    await expect(login('naoexiste@empresa.com', 'qualquer')).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('rejeita usuário inativo mesmo com senha correta', async () => {
    const senhaHash = await bcrypt.hash('Segredo@123', 4);
    mockedFindByEmail.mockResolvedValue(fakeUser({ senhaHash, ativo: false }) as never);

    await expect(login('admin@empresa.com', 'Segredo@123')).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
