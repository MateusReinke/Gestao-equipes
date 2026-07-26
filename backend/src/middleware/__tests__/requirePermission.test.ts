import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/permission.service', () => ({
  userHasPermission: vi.fn(),
}));

import { userHasPermission } from '../../services/permission.service';
import { requirePermission } from '../requirePermission';
import { PERMISSIONS } from '../../types/permissions';

const mockedHasPermission = vi.mocked(userHasPermission);

function mockResponse() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const userComum = {
  sub: 'analista@empresa.com',
  userId: 5,
  isGlobalAdmin: false,
  activeTenantId: 1,
  roleCodigo: 'analista',
};

describe('requirePermission', () => {
  beforeEach(() => mockedHasPermission.mockReset());

  it('rejeita requisição não autenticada', async () => {
    const req = {} as Request;
    const res = mockResponse();
    const next = vi.fn();

    await requirePermission(PERMISSIONS.CLIENT_CREATE)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('libera quando o usuário tem a permissão exigida', async () => {
    mockedHasPermission.mockResolvedValue(true);
    const req = { user: userComum } as Request;
    const res = mockResponse();
    const next = vi.fn();

    await requirePermission(PERMISSIONS.CLIENT_VIEW)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockedHasPermission).toHaveBeenCalledWith(userComum, 'client.view');
  });

  it('bloqueia com 403 quando falta a permissão', async () => {
    mockedHasPermission.mockResolvedValue(false);
    const req = { user: userComum } as Request;
    const res = mockResponse();
    const next = vi.fn();

    await requirePermission(PERMISSIONS.CLIENT_DELETE)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('aceita qualquer uma das permissões informadas (OR)', async () => {
    mockedHasPermission.mockImplementation(async (_user, permissao) => permissao === 'shift.approve_swap');
    const req = { user: userComum } as Request;
    const res = mockResponse();
    const next = vi.fn();

    await requirePermission(PERMISSIONS.SHIFT_REQUEST_SWAP, PERMISSIONS.SHIFT_APPROVE_SWAP)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
