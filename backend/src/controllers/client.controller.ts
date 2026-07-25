import { Request, Response } from 'express';
import { listClients, getClientResponsible, ClientNotFoundError } from '../services/client.service';
import { getCurrentOnCall, getUpcomingOnCall } from '../services/oncall.service';

export const clientController = {
  async list(req: Request, res: Response) {
    const data = await listClients(req.user!.activeTenantId!);
    return res.json(data);
  },

  async responsible(req: Request, res: Response) {
    const clientId = Number(req.params.id);
    try {
      const data = await getClientResponsible(req.user!.activeTenantId!, clientId);
      return res.json(data);
    } catch (error) {
      if (error instanceof ClientNotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      throw error;
    }
  },

  async onCall(req: Request, res: Response) {
    const clientId = Number(req.params.id);
    const [atuais, proximos] = await Promise.all([
      getCurrentOnCall(clientId, req.user),
      getUpcomingOnCall(clientId, req.user),
    ]);
    return res.json({ clientId, atuais, proximos });
  },
};
