import { Request, Response } from 'express';
import { listManagers } from '../services/manager.service';

export const managerController = {
  async list(req: Request, res: Response) {
    const data = await listManagers(req.user!.activeTenantId!);
    return res.json(data);
  },
};
