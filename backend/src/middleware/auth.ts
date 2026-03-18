import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload } from '../types/auth';

export function auth(requiredRoles: JwtPayload['role'][] = ['admin', 'gestor']) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token ausente' });

    try {
      const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
      if (!requiredRoles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Sem permissão' });
      }
      (req as Request & { user?: JwtPayload }).user = decoded;
      return next();
    } catch {
      return res.status(401).json({ error: 'Token inválido' });
    }
  };
}
