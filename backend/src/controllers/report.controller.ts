import { Request, Response } from 'express';
import {
  REPORTS,
  gerarRelatorio,
  nomeArquivo,
  periodoPadrao,
  reportQuerySchema,
  toCsv,
  NoActiveTenantError,
  UnknownReportError,
} from '../services/report.service';
import { auditFromRequest } from '../services/audit.service';

function handleError(error: unknown, res: Response) {
  if (error instanceof NoActiveTenantError) return res.status(409).json({ error: error.message });
  if (error instanceof UnknownReportError) return res.status(404).json({ error: error.message });
  throw error;
}

export const reportController = {
  /// Catálogo + período sugerido, para a tela montar os filtros.
  catalog(_req: Request, res: Response) {
    return res.json({ relatorios: REPORTS, periodoPadrao: periodoPadrao() });
  },

  async show(req: Request, res: Response) {
    const parsed = reportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Filtros inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      return res.json(await gerarRelatorio(String(req.params.id), parsed.data, req.user));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async export(req: Request, res: Response) {
    const parsed = reportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Filtros inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const relatorio = await gerarRelatorio(String(req.params.id), parsed.data, req.user);

      // Exportação leva dado operacional para fora do sistema — fica na trilha.
      await auditFromRequest(req, {
        acao: 'update',
        entidade: 'relatorio_exportacao',
        entidadeId: relatorio.id,
        descricao: `Exportou "${relatorio.nome}" (${relatorio.linhas.length} linha(s))`,
        depois: { relatorio: relatorio.id, ...req.query, linhas: relatorio.linhas.length },
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo(relatorio, parsed.data)}"`);
      return res.send(toCsv(relatorio));
    } catch (error) {
      return handleError(error, res);
    }
  },
};
