import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/prisma', () => ({
  prisma: {
    client: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    team: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    collaborator: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    scale: { findMany: vi.fn(), findFirst: vi.fn() },
    vacation: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    absence: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    shift: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), createMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    shiftSwap: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    tenantMembership: { findMany: vi.fn(), findUnique: vi.fn() },
    managerTeam: { findMany: vi.fn() },
    shareGrant: { findMany: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
    dashboard: { findMany: vi.fn() },
  },
}));

import { prisma } from '../../config/prisma';
import { clientRepository } from '../client.repository';
import { teamRepository } from '../team.repository';
import { collaboratorRepository } from '../collaborator.repository';
import { scaleRepository } from '../scale.repository';
import { vacationRepository } from '../vacation.repository';
import { absenceRepository } from '../absence.repository';
import { shiftRepository } from '../shift.repository';
import { swapRepository } from '../swap.repository';
import { shareRepository } from '../share.repository';
import { dashboardRepository } from '../dashboard.repository';

const TENANT_ID = 42;

/**
 * O isolamento entre empresas depende de TODA consulta carregar tenant_id.
 * Estes testes travam esse contrato: se alguém adicionar uma query sem o filtro,
 * o teste correspondente quebra.
 */
describe('repositórios sempre filtram por tenant_id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clientRepository.findAll', async () => {
    await clientRepository.findAll(TENANT_ID);
    expect(prisma.client.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID }) }));
  });

  it('clientRepository.findById combina tenantId + id', async () => {
    await clientRepository.findById(TENANT_ID, 1);
    expect(prisma.client.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID, id: 1 }) }));
  });

  it('clientRepository.update usa updateMany com tenantId no filtro', async () => {
    await clientRepository.update(TENANT_ID, 3, { nome: 'X' });
    expect(prisma.client.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 3, tenantId: TENANT_ID } }));
  });

  it('clientRepository.remove exige tenantId', async () => {
    await clientRepository.remove(TENANT_ID, 3);
    expect(prisma.client.deleteMany).toHaveBeenCalledWith({ where: { id: 3, tenantId: TENANT_ID } });
  });

  it('teamRepository.findAllIds', async () => {
    await teamRepository.findAllIds(TENANT_ID);
    expect(prisma.team.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: TENANT_ID } }));
  });

  it('teamRepository.findManagerTeamIds filtra por gestor E por tenant', async () => {
    await teamRepository.findManagerTeamIds(7, TENANT_ID);
    expect(prisma.managerTeam.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { gestorId: 7, tenantId: TENANT_ID } }));
  });

  it('collaboratorRepository.findByEmail (unicidade é por tenant, não global)', async () => {
    await collaboratorRepository.findByEmail(TENANT_ID, 'pessoa@empresa.com');
    expect(prisma.collaborator.findFirst).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID, email: 'pessoa@empresa.com' } });
  });

  it('collaboratorRepository.create injeta tenantId mesmo sem vir nos dados', async () => {
    await collaboratorRepository.create(TENANT_ID, { nome: 'X' } as never);
    expect(prisma.collaborator.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: TENANT_ID }) })
    );
  });

  it('scaleRepository.findById', async () => {
    await scaleRepository.findById(TENANT_ID, 5);
    expect(prisma.scale.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID, id: 5 }) }));
  });

  it('vacationRepository.findApprovedOverlapping', async () => {
    await vacationRepository.findApprovedOverlapping(TENANT_ID, new Date(), new Date());
    expect(prisma.vacation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID }) }));
  });

  it('absenceRepository.findApprovedOverlapping', async () => {
    await absenceRepository.findApprovedOverlapping(TENANT_ID, new Date(), new Date());
    expect(prisma.absence.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID }) }));
  });

  it('shiftRepository.findByRange', async () => {
    await shiftRepository.findByRange({ tenantId: TENANT_ID, inicio: new Date(), fim: new Date() });
    expect(prisma.shift.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID }) }));
  });

  it('shiftRepository.findById combina tenantId + id', async () => {
    await shiftRepository.findById(TENANT_ID, 8);
    expect(prisma.shift.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID, id: 8 }) }));
  });

  it('shiftRepository.createMany injeta tenantId em todos os turnos gerados', async () => {
    await shiftRepository.createMany(TENANT_ID, [{ colaboradorId: 1 } as never, { colaboradorId: 2 } as never]);
    expect(prisma.shift.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({ tenantId: TENANT_ID }),
          expect.objectContaining({ tenantId: TENANT_ID }),
        ],
      })
    );
  });

  it('swapRepository.findById', async () => {
    await swapRepository.findById(TENANT_ID, 2);
    expect(prisma.shiftSwap.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID, id: 2 }) }));
  });

  it('swapRepository.create injeta tenantId', async () => {
    await swapRepository.create(TENANT_ID, { motivo: 'teste' } as never);
    expect(prisma.shiftSwap.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: TENANT_ID }) })
    );
  });

  it('shareRepository.listForResource', async () => {
    await shareRepository.listForResource(TENANT_ID, 'dashboard', 5);
    expect(prisma.shareGrant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID }) })
    );
  });

  it('shareRepository.findById combina tenantId + id', async () => {
    await shareRepository.findById(TENANT_ID, 9);
    expect(prisma.shareGrant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID, id: 9 }) })
    );
  });

  it('shareRepository.remove exige tenantId', async () => {
    await shareRepository.remove(TENANT_ID, 9);
    expect(prisma.shareGrant.deleteMany).toHaveBeenCalledWith({ where: { id: 9, tenantId: TENANT_ID } });
  });

  it('shareRepository.findExistingTarget não confunde destinatários de tenants diferentes', async () => {
    await shareRepository.findExistingTarget(TENANT_ID, 'dashboard', 5, { escopo: 'usuario', usuarioId: 3 });
    expect(prisma.shareGrant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID, usuarioId: 3 }) })
    );
  });

  it('dashboardRepository.findOwnedBy filtra por tenant e por dono', async () => {
    await dashboardRepository.findOwnedBy(TENANT_ID, 4);
    expect(prisma.dashboard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID, ownerUserId: 4 }) })
    );
  });
});
