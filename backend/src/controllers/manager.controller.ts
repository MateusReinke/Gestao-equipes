import { Request, Response } from 'express';
import { listManagers } from '../services/manager.service';

export const managerController = {
  async list(_req: Request, res: Response) {
    const data = await listManagers();
    return res.json(data);
  },
};
