import { Request, Response } from 'express';
import {
  listarSaldos,
  listarAlertas,
  registrarAjuste,
  varrerAlertasDeFerias,
  ajusteSchema,
  NoActiveTenantError,
  CollaboratorNotFoundError,
} from '../services/vacation-balance.service';
import { notificationRepository } from '../repositories/hr.repository';
import { getVisibleTeamIds } from '../services/scope.service';
import { auditFromRequest } from '../services/audit.service';

function handleError(error: unknown, res: Response) {
  if (error instanceof NoActiveTenantError) return res.status(409).json({ error: error.message });
  if (error instanceof CollaboratorNotFoundError) return res.status(404).json({ error: error.message });
  throw error;
}

export const hrVacationController = {
  async saldos(req: Request, res: Response) {
    try {
      return res.json(await listarSaldos(req.user));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async alertas(req: Request, res: Response) {
    try {
      return res.json(await listarAlertas(req.user));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async ajustar(req: Request, res: Response) {
    const parsed = ajusteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const ajuste = await registrarAjuste(parsed.data, req.user);
      // Ajuste de direito trabalhista tem que ser rastreável: quem, quando, por quê.
      await auditFromRequest(req, {
        acao: 'update',
        entidade: 'ferias_ajuste',
        entidadeId: ajuste.id,
        descricao: `Ajustou o ciclo ${ajuste.cicloNumero} em ${ajuste.diasDelta > 0 ? '+' : ''}${ajuste.diasDelta} dia(s): ${ajuste.motivo}`,
        depois: ajuste,
      });
      return res.status(201).json(ajuste);
    } catch (error) {
      return handleError(error, res);
    }
  },

  /// Dispara a varredura sob demanda. A rotina diária chama o mesmo serviço;
  /// como é idempotente, rodar aqui não duplica nada.
  async varrer(req: Request, res: Response) {
    try {
      const tenantId = req.user!.activeTenantId!;
      const teamIds = await getVisibleTeamIds(req.user);
      return res.json(await varrerAlertasDeFerias({ tenantId, teamIds }));
    } catch (error) {
      return handleError(error, res);
    }
  },
};

export const notificationController = {
  async list(req: Request, res: Response) {
    const apenasNaoLidas = req.query.naoLidas === 'true';
    const [notificacoes, naoLidas] = await Promise.all([
      notificationRepository.listarDoUsuario(req.user!.userId, { apenasNaoLidas }),
      notificationRepository.contarNaoLidas(req.user!.userId),
    ]);
    return res.json({ notificacoes, naoLidas });
  },

  async marcarLida(req: Request, res: Response) {
    await notificationRepository.marcarLida(req.user!.userId, Number(req.params.id));
    return res.status(204).send();
  },

  async marcarTodasLidas(req: Request, res: Response) {
    const resultado = await notificationRepository.marcarTodasLidas(req.user!.userId);
    return res.json({ marcadas: resultado.count });
  },
};
