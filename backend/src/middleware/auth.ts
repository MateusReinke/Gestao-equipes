import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload } from '../types/auth';

type AuthOptions = {
  /** Exige um tenant ativo selecionado (padrão: true). Use false para rotas de plataforma. */
  requireTenant?: boolean;
  /** Exige que o usuário seja o Administrador Global. */
  requireGlobalAdmin?: boolean;
};

/**
 * Autentica a requisição e garante que há um tenant ativo.
 * A autorização por permissão fica a cargo de `requirePermission(...)`.
 */
export function auth(options: AuthOptions = {}) {
  const { requireTenant = true, requireGlobalAdmin = false } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token ausente' });

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
    } catch {
      return res.status(401).json({ error: 'Token inválido' });
    }

    if (requireGlobalAdmin && !decoded.isGlobalAdmin) {
      return res.status(403).json({ error: 'Restrito ao Administrador Global' });
    }

    if (requireTenant && decoded.activeTenantId == null) {
      return res.status(409).json({ error: 'Selecione um tenant ativo para acessar este recurso' });
    }

    req.user = decoded;
    return next();
  };
}
