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

  it('rejeita usuário autenticado sem a role exigida', () => {
    const token = jwt.sign({ sub: 'gestor@empresa.com', userId: 2, role: 'gestor' }, env.jwtSecret);
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = mockResponse();
    const next = vi.fn();

    auth(['admin'])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('libera acesso e popula req.user para token e role válidos', () => {
    const token = jwt.sign({ sub: 'admin@empresa.com', userId: 1, role: 'admin' }, env.jwtSecret);
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = mockResponse();
    const next = vi.fn();

    auth()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ sub: 'admin@empresa.com', userId: 1, role: 'admin' });
  });
});
