import { Request, Response } from 'express';
import {
  listClients,
  getClientResponsible,
  createClient,
  updateClient,
  deleteClient,
  clientSchema,
  updateClientSchema,
  ClientNotFoundError,
  NoActiveTenantError,
  ResponsibleNotFoundError,
} from '../services/client.service';
import { getCurrentShifts, getUpcomingShifts } from '../services/shift.service';
import { auditFromRequest } from '../services/audit.service';

function handleError(error: unknown, res: Response) {
  if (error instanceof ClientNotFoundError) return res.status(404).json({ error: error.message });
  if (error instanceof NoActiveTenantError) return res.status(409).json({ error: error.message });
  if (error instanceof ResponsibleNotFoundError) return res.status(400).json({ error: error.message });
  throw error;
}

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
      await auditFromRequest(req, {
        acao: 'create',
        entidade: 'cliente',
        entidadeId: client.id,
        descricao: `Cadastrou o cliente "${client.nome}"`,
        depois: client,
      });
      return res.status(201).json(client);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async update(req: Request, res: Response) {
    const parsed = updateClientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const { antes, depois } = await updateClient(Number(req.params.id), parsed.data, req.user);
      await auditFromRequest(req, {
        acao: 'update',
        entidade: 'cliente',
        entidadeId: req.params.id,
        descricao: `Editou o cliente "${depois?.nome}"`,
        antes,
        depois,
      });
      return res.json(depois);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const removido = await deleteClient(Number(req.params.id), req.user);
      await auditFromRequest(req, {
        acao: 'delete',
        entidade: 'cliente',
        entidadeId: req.params.id,
        descricao: `Removeu o cliente "${removido.nome}"`,
        antes: removido,
      });
      return res.status(204).send();
    } catch (error) {
      return handleError(error, res);
    }
  },

  async responsible(req: Request, res: Response) {
    try {
      const data = await getClientResponsible(req.user!.activeTenantId!, Number(req.params.id));
      return res.json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async onCall(req: Request, res: Response) {
    const clientId = Number(req.params.id);
    const [atuais, proximos] = await Promise.all([
      getCurrentShifts(clientId, req.user),
      getUpcomingShifts(clientId, req.user),
    ]);
    return res.json({ clientId, atuais, proximos });
  },
};
