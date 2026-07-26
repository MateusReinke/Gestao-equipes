import { SwapStatus } from '@prisma/client';
import { Request, Response } from 'express';
import {
  listSwaps,
  requestSwap,
  acceptSwap,
  approveSwap,
  rejectSwap,
  cancelSwap,
  swapRequestSchema,
  swapResponseSchema,
  NoActiveTenantError,
  SwapNotFoundError,
  ShiftNotFoundError,
  InvalidSwapError,
  SwapForbiddenError,
  SwapAlreadyResolvedError,
} from '../services/swap.service';
import { auditFromRequest } from '../services/audit.service';

function handleError(error: unknown, res: Response) {
  if (error instanceof NoActiveTenantError) return res.status(409).json({ error: error.message });
  if (error instanceof SwapNotFoundError || error instanceof ShiftNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof SwapForbiddenError) return res.status(403).json({ error: error.message });
  if (error instanceof InvalidSwapError) return res.status(400).json({ error: error.message });
  if (error instanceof SwapAlreadyResolvedError) return res.status(409).json({ error: error.message });
  throw error;
}

export const swapController = {
  async list(req: Request, res: Response) {
    const status = req.query.status ? (String(req.query.status) as SwapStatus) : undefined;
    try {
      const data = await listSwaps(req.user, status);
      return res.json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async request(req: Request, res: Response) {
    const parsed = swapRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }

    try {
      const swap = await requestSwap(parsed.data, req.user);
      await auditFromRequest(req, {
        acao: 'swap_request',
        entidade: 'troca_turno',
        entidadeId: swap.id,
        descricao: `${swap.solicitante.nome} solicitou ${swap.tipo} com ${swap.destinatario.nome}`,
        depois: swap,
      });
      return res.status(201).json(swap);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async accept(req: Request, res: Response) {
    try {
      const swap = await acceptSwap(Number(req.params.id), req.user);
      await auditFromRequest(req, {
        acao: 'swap_response',
        entidade: 'troca_turno',
        entidadeId: req.params.id,
        descricao: 'Colega aceitou a troca; aguardando aprovação',
        depois: swap,
      });
      return res.json(swap);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async approve(req: Request, res: Response) {
    const parsed = swapResponseSchema.safeParse(req.body ?? {});
    try {
      const swap = await approveSwap(Number(req.params.id), parsed.success ? parsed.data.observacao : undefined, req.user);
      await auditFromRequest(req, {
        acao: 'swap_response',
        entidade: 'troca_turno',
        entidadeId: req.params.id,
        descricao: 'Troca aprovada e aplicada aos turnos',
        depois: swap,
      });
      return res.json(swap);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async reject(req: Request, res: Response) {
    const parsed = swapResponseSchema.safeParse(req.body ?? {});
    try {
      const swap = await rejectSwap(Number(req.params.id), parsed.success ? parsed.data.observacao : undefined, req.user);
      await auditFromRequest(req, {
        acao: 'swap_response',
        entidade: 'troca_turno',
        entidadeId: req.params.id,
        descricao: 'Troca recusada',
        depois: swap,
      });
      return res.json(swap);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async cancel(req: Request, res: Response) {
    try {
      const swap = await cancelSwap(Number(req.params.id), req.user);
      await auditFromRequest(req, {
        acao: 'swap_response',
        entidade: 'troca_turno',
        entidadeId: req.params.id,
        descricao: 'Pedido de troca cancelado pelo solicitante',
        depois: swap,
      });
      return res.json(swap);
    } catch (error) {
      return handleError(error, res);
    }
  },
};
