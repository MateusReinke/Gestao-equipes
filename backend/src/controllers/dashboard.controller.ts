import { Request, Response } from 'express';
import { getDashboard } from '../services/dashboard.service';

export const dashboardController = {
  async show(req: Request, res: Response) {
    const data = await getDashboard(req.user);
    return res.json(data);
  },
};
