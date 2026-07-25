import { Request, Response } from 'express';
import { listTeamsForUser } from '../services/team.service';

export const teamController = {
  async list(req: Request, res: Response) {
    const data = await listTeamsForUser(req.user);
    return res.json(data);
  },
};
