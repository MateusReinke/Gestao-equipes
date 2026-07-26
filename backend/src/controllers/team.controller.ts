import { Request, Response } from 'express';
import {
  listTeamsForUser,
  createTeam,
  updateTeam,
  teamSchema,
  teamUpdateSchema,
  NoActiveTenantError,
  ClientNotFoundForTeamError,
  TeamNotFoundError,
} from '../services/team.service';
import { auditFromRequest } from '../services/audit.service';

function handleError(error: unknown, res: Response) {
  if (error instanceof NoActiveTenantError) return res.status(409).json({ error: error.message });
  if (error instanceof TeamNotFoundError) return res.status(404).json({ error: error.message });
  if (error instanceof ClientNotFoundForTeamError) return res.status(400).json({ error: error.message });
  throw error;
}

export const teamController = {
  async list(req: Request, res: Response) {
    const data = await listTeamsForUser(req.user);
    return res.json(data);
  },

  async create(req: Request, res: Response) {
    const parsed = teamSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const team = await createTeam(parsed.data, req.user);
      await auditFromRequest(req, {
        acao: 'create',
        entidade: 'equipe',
        entidadeId: team.id,
        descricao: `Criou a equipe "${team.nome}"`,
        depois: team,
      });
      return res.status(201).json(team);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async update(req: Request, res: Response) {
    const parsed = teamUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const { antes, depois } = await updateTeam(Number(req.params.id), parsed.data, req.user);
      await auditFromRequest(req, {
        acao: 'update',
        entidade: 'equipe',
        entidadeId: req.params.id,
        descricao: `Editou a equipe "${depois?.nome}"`,
        antes,
        depois,
      });
      return res.json(depois);
    } catch (error) {
      return handleError(error, res);
    }
  },
};
