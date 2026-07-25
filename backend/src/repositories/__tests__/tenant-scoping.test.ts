import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/prisma', () => ({
  prisma: {
    client: { findMany: vi.fn(), findFirst: vi.fn() },
    team: { findMany: vi.fn(), findFirst: vi.fn() },
    collaborator: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    scale: { findMany: vi.fn() },
    vacation: { findMany: vi.fn() },
    onCall: { findMany: vi.fn() },
    tenantMembership: { findMany: vi.fn() },
    managerTeam: { findMany: vi.fn() },
  },
}));

import { prisma } from '../../config/prisma';
import { clientRepository } from '../client.repository';
import { teamRepository } from '../team.repository';
import { collaboratorRepository } from '../collaborator.repository';
import { scaleRepository } from '../scale.repository';
import { vacationRepository } from '../vacation.repository';
import { oncallRepository } from '../oncall.repository';
import { managerRepository } from '../manager.repository';

const TENANT_ID = 42;

describe('repositórios sempre filtram por tenant_id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clientRepository.findAll', async () => {
    await clientRepository.findAll(TENANT_ID);
    expect(prisma.client.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID }) }));
  });

  it('clientRepository.findById', async () => {
    await clientRepository.findById(TENANT_ID, 1);
    expect(prisma.client.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID, id: 1 }) }));
  });

  it('clientRepository.findByTeamIds', async () => {
    await clientRepository.findByTeamIds(TENANT_ID, [1, 2]);
    expect(prisma.client.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID }) }));
  });

  it('teamRepository.findAllIds', async () => {
    await teamRepository.findAllIds(TENANT_ID);
    expect(prisma.team.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: TENANT_ID } }));
  });

  it('teamRepository.findManagerTeamIds filtra por gestor E por tenant', async () => {
    await teamRepository.findManagerTeamIds(7, TENANT_ID);
    expect(prisma.managerTeam.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { gestorId: 7, tenantId: TENANT_ID } }));
  });

  it('teamRepository.findById', async () => {
    await teamRepository.findById(TENANT_ID, 9);
    expect(prisma.team.findFirst).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID, id: 9 } });
  });

  it('collaboratorRepository.findByEmail (unicidade agora é por tenant, não global)', async () => {
    await collaboratorRepository.findByEmail(TENANT_ID, 'pessoa@empresa.com');
    expect(prisma.collaborator.findFirst).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID, email: 'pessoa@empresa.com' } });
  });

  it('collaboratorRepository.create injeta tenantId mesmo que não venha explícito nos dados', async () => {
    await collaboratorRepository.create(TENANT_ID, { nome: 'X' } as never);
    expect(prisma.collaborator.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: TENANT_ID }) })
    );
  });

  it('scaleRepository.findByTeamIds', async () => {
    await scaleRepository.findByTeamIds(TENANT_ID, [1]);
    expect(prisma.scale.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID }) }));
  });

  it('vacationRepository.findByTeamIds', async () => {
    await vacationRepository.findByTeamIds(TENANT_ID, [1]);
    expect(prisma.vacation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID }) }));
  });

  it('oncallRepository.findByTeamIds', async () => {
    await oncallRepository.findByTeamIds(TENANT_ID, [1]);
    expect(prisma.onCall.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID }) }));
  });

  it('managerRepository.findAll', async () => {
    await managerRepository.findAll(TENANT_ID);
    expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID, role: 'gestor' }) })
    );
  });
});
