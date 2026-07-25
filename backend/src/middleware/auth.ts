import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload } from '../types/auth';

type AuthOptions = {
  /** Papéis aceitos dentro do tenant ativo. Administrador Global sempre passa. */
  roles?: NonNullable<JwtPayload['role']>[];
  /** Exige um tenant ativo selecionado (padrão: true). Use false para rotas de plataforma. */
  requireTenant?: boolean;
  /** Exige que o usuário seja o Administrador Global. */
  requireGlobalAdmin?: boolean;
};

export function auth(options: AuthOptions = {}) {
  const { roles, requireTenant = true, requireGlobalAdmin = false } = options;

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

    if (roles && !decoded.isGlobalAdmin && (!decoded.role || !roles.includes(decoded.role))) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    req.user = decoded;
    return next();
  };
}
