import { Request, Response } from 'express';
import {
  listScalesForUser,
  getScale,
  createScale,
  updateScale,
  deleteScale,
  scaleSchema,
  scaleUpdateSchema,
  NoActiveTenantError,
  ScaleNotFoundError,
  InvalidAssignmentError,
} from '../services/scale.service';
import { auditFromRequest } from '../services/audit.service';

function handleError(error: unknown, res: Response) {
  if (error instanceof NoActiveTenantError) return res.status(409).json({ error: error.message });
  if (error instanceof ScaleNotFoundError) return res.status(404).json({ error: error.message });
  if (error instanceof InvalidAssignmentError) return res.status(400).json({ error: error.message });
  throw error;
}

export const scaleController = {
  async list(req: Request, res: Response) {
    const data = await listScalesForUser(req.user);
    return res.json(data);
  },

  async show(req: Request, res: Response) {
    try {
      const data = await getScale(Number(req.params.id), req.user);
      return res.json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async create(req: Request, res: Response) {
    const parsed = scaleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const escala = await createScale(parsed.data, req.user);
      await auditFromRequest(req, {
        acao: 'create',
        entidade: 'escala',
        entidadeId: escala?.id,
        descricao: `Criou a escala "${parsed.data.nome}"`,
        depois: escala,
      });
      return res.status(201).json(escala);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async update(req: Request, res: Response) {
    const parsed = scaleUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const { antes, depois } = await updateScale(Number(req.params.id), parsed.data, req.user);
      await auditFromRequest(req, {
        acao: 'update',
        entidade: 'escala',
        entidadeId: req.params.id,
        descricao: `Editou a escala "${depois?.nome}"`,
        antes,
        depois,
      });
      return res.json(depois);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const removida = await deleteScale(Number(req.params.id), req.user);
      await auditFromRequest(req, {
        acao: 'delete',
        entidade: 'escala',
        entidadeId: req.params.id,
        descricao: `Removeu a escala "${removida.nome}"`,
        antes: removida,
      });
      return res.status(204).send();
    } catch (error) {
      return handleError(error, res);
    }
  },
};
