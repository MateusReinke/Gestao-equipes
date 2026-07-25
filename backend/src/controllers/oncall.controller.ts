import { Request, Response } from 'express';
import { getCurrentOnCall, listOnCallsForUser } from '../services/oncall.service';

export const oncallController = {
  async current(req: Request, res: Response) {
    const active = await getCurrentOnCall(undefined, req.user);
    return res.json({
      generatedAt: new Date().toISOString(),
      total: active.length,
      plantonistas: active,
    });
  },

  async list(req: Request, res: Response) {
    const data = await listOnCallsForUser(req.user);
    return res.json(data);
  },
};
