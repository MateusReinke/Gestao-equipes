import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/client.repository', () => ({
  clientRepository: { findAll: vi.fn(), findById: vi.fn(), findByTeamIds: vi.fn() },
}));

import { clientRepository } from '../../repositories/client.repository';
import { ClientNotFoundError, getClientResponsible, listClients } from '../client.service';

const mockedFindById = vi.mocked(clientRepository.findById);
const mockedFindAll = vi.mocked(clientRepository.findAll);

describe('client.service isolamento entre tenants', () => {
  beforeEach(() => {
    mockedFindById.mockReset();
    mockedFindAll.mockReset();
  });

  it('listClients consulta o repositório apenas com o tenant informado', async () => {
    mockedFindAll.mockResolvedValue([]);
    await listClients(7);
    expect(mockedFindAll).toHaveBeenCalledWith(7);
  });

  it('getClientResponsible não vaza cliente de outro tenant: repositório já filtra por tenantId + id juntos', async () => {
    // Um cliente com esse id existe, mas em outro tenant - o repositório (tenantId, id) não encontra nada.
    mockedFindById.mockResolvedValue(null);

    await expect(getClientResponsible(7, 999)).rejects.toBeInstanceOf(ClientNotFoundError);
    expect(mockedFindById).toHaveBeenCalledWith(7, 999);
  });

  it('getClientResponsible retorna o cliente quando ele pertence ao tenant informado', async () => {
    mockedFindById.mockResolvedValue({
      id: 1,
      tenantId: 7,
      nome: 'Cliente A',
      responsavelInterno: { nome: 'Fulano' },
    } as never);

    const result = await getClientResponsible(7, 1);
    expect(result.cliente).toEqual({ id: 1, nome: 'Cliente A' });
  });
});
