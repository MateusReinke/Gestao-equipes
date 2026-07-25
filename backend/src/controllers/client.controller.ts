import { Request, Response } from 'express';
import {
  listClients,
  getClientResponsible,
  createClient,
  updateClient,
  clientSchema,
  updateClientSchema,
  ClientNotFoundError,
  NoActiveTenantError,
  ResponsibleNotFoundError,
} from '../services/client.service';
import { getCurrentOnCall, getUpcomingOnCall } from '../services/oncall.service';

export const clientController = {
  async list(req: Request, res: Response) {
    const data = await listClients(req.user!.activeTenantId!);
    return res.json(data);
  },

  async create(req: Request, res: Response) {
    const parsed = clientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }

    try {
      const client = await createClient(parsed.data, req.user);
      return res.status(201).json(client);
    } catch (error) {
      if (error instanceof NoActiveTenantError) return res.status(409).json({ error: error.message });
      if (error instanceof ResponsibleNotFoundError) return res.status(400).json({ error: error.message });
      throw error;
    }
  },

  async update(req: Request, res: Response) {
    const clientId = Number(req.params.id);
    const parsed = updateClientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }

    try {
      const client = await updateClient(clientId, parsed.data, req.user);
      return res.json(client);
    } catch (error) {
      if (error instanceof ClientNotFoundError) return res.status(404).json({ error: error.message });
      if (error instanceof NoActiveTenantError) return res.status(409).json({ error: error.message });
      if (error instanceof ResponsibleNotFoundError) return res.status(400).json({ error: error.message });
      throw error;
    }
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
