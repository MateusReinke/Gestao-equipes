import { Request, Response } from 'express';
import { listScalesForUser } from '../services/scale.service';

export const scaleController = {
  async list(req: Request, res: Response) {
    const data = await listScalesForUser(req.user);
    return res.json(data);
  },
};
