import { Request, Response } from 'express';
import {
  listTeamsForUser,
  createTeam,
  teamSchema,
  NoActiveTenantError,
  ClientNotFoundForTeamError,
} from '../services/team.service';

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
      return res.status(201).json(team);
    } catch (error) {
      if (error instanceof NoActiveTenantError) return res.status(409).json({ error: error.message });
      if (error instanceof ClientNotFoundForTeamError) return res.status(400).json({ error: error.message });
      throw error;
    }
  },
};
