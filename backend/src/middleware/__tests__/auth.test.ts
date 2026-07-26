import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env';
import { auth } from '../auth';

function mockResponse() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function tokenFor(payload: Record<string, unknown>) {
  return jwt.sign(payload, env.jwtSecret);
}

describe('auth middleware', () => {
  it('rejeita requisição sem token', () => {
    const req = { headers: {} } as Request;
    const res = mockResponse();
    const next = vi.fn();

    auth()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejeita token inválido', () => {
    const req = { headers: { authorization: 'Bearer token-invalido' } } as Request;
    const res = mockResponse();
    const next = vi.fn();

    auth()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejeita quando não há tenant ativo selecionado', () => {
    const token = tokenFor({ sub: 'global@empresa.com', userId: 3, isGlobalAdmin: true, activeTenantId: null, roleCodigo: null });
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = mockResponse();
    const next = vi.fn();

    auth()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(next).not.toHaveBeenCalled();
  });

  it('permite rota de plataforma sem tenant ativo', () => {
    const token = tokenFor({ sub: 'global@empresa.com', userId: 3, isGlobalAdmin: true, activeTenantId: null, roleCodigo: null });
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = mockResponse();
    const next = vi.fn();

    auth({ requireTenant: false })(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejeita rota exclusiva do Administrador Global para usuário comum', () => {
    const token = tokenFor({ sub: 'admin@empresa.com', userId: 1, isGlobalAdmin: false, activeTenantId: 1, roleCodigo: 'admin_tenant' });
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = mockResponse();
    const next = vi.fn();

    auth({ requireGlobalAdmin: true, requireTenant: false })(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('libera acesso e popula req.user para token válido com tenant', () => {
    const token = tokenFor({ sub: 'admin@empresa.com', userId: 1, isGlobalAdmin: false, activeTenantId: 1, roleCodigo: 'admin_tenant' });
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = mockResponse();
    const next = vi.fn();

    auth()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ sub: 'admin@empresa.com', userId: 1, roleCodigo: 'admin_tenant', activeTenantId: 1 });
  });
});
