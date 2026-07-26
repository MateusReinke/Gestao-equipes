import { NextFunction, Request, Response } from 'express';
import { userHasPermission } from '../services/permission.service';
import { PermissionCode } from '../types/permissions';

/**
 * Guarda de rota baseada em permissão nomeada, não em papel.
 * Deve ser usada depois de `auth()`, que é quem popula req.user.
 * Aceita várias permissões: basta ter UMA delas (OR).
 */
export function requirePermission(...permissoes: PermissionCode[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Não autenticado' });

    for (const permissao of permissoes) {
      if (await userHasPermission(user, permissao)) return next();
    }

    return res.status(403).json({
      error: 'Você não tem permissão para esta ação',
      permissoesNecessarias: permissoes,
    });
  };
}
