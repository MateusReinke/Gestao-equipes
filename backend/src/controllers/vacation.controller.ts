import { Request, Response } from 'express';
import { listVacationsForUser } from '../services/vacation.service';

export const vacationController = {
  async list(req: Request, res: Response) {
    const data = await listVacationsForUser(req.user);
    return res.json(data);
  },
};
