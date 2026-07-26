import { AuditAction } from '@prisma/client';
import { Request, Response } from 'express';
import { auditRepository } from '../services/audit.service';

export const auditController = {
  async list(req: Request, res: Response) {
    const take = Math.min(Number(req.query.take) || 50, 200);
    const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;
    const entidade = req.query.entidade ? String(req.query.entidade) : undefined;
    const acao = req.query.acao ? (String(req.query.acao) as AuditAction) : undefined;

    const registros = await auditRepository.list({
      tenantId: req.user!.activeTenantId!,
      entidade,
      acao,
      take,
      cursor,
    });

    return res.json({
      registros,
      proximoCursor: registros.length === take ? registros[registros.length - 1].id : null,
    });
  },
};
