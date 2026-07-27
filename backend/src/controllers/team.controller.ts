import { Request, Response } from 'express';
import {
  listTeamsForUser,
  createTeam,
  updateTeam,
  teamSchema,
  teamUpdateSchema,
  NoActiveTenantError,
  ClientNotFoundForTeamError,
  TeamNotFoundError,
  deleteTeam,
  TeamHasHistoryError,
  InvalidManagerError,
  listTeamManagers,
  setTeamManagers,
  teamManagersSchema,
} from '../services/team.service';
import { auditFromRequest } from '../services/audit.service';

function handleError(error: unknown, res: Response) {
  if (error instanceof NoActiveTenantError) return res.status(409).json({ error: error.message });
  if (error instanceof TeamNotFoundError) return res.status(404).json({ error: error.message });
  if (error instanceof ClientNotFoundForTeamError) return res.status(400).json({ error: error.message });
  if (error instanceof InvalidManagerError) return res.status(400).json({ error: error.message, idsInvalidos: error.idsInvalidos });
  // 409: o pedido faz sentido, mas o estado atual impede — a mensagem diz o
  // que segura e qual é a saída (desativar).
  if (error instanceof TeamHasHistoryError) return res.status(409).json({ error: error.message, detalhes: error.detalhes });
  throw error;
}

export const teamController = {
  async list(req: Request, res: Response) {
    const data = await listTeamsForUser(req.user);
    return res.json(data);
  },

  async create(req: Request, res: Response) {
    const parsed = teamSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const team = await createTeam(parsed.data, req.user);
      await auditFromRequest(req, {
        acao: 'create',
        entidade: 'equipe',
        entidadeId: team.id,
        descricao: `Criou a equipe "${team.nome}"`,
        depois: team,
      });
      return res.status(201).json(team);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async update(req: Request, res: Response) {
    const parsed = teamUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const { antes, depois } = await updateTeam(Number(req.params.id), parsed.data, req.user);
      await auditFromRequest(req, {
        acao: 'update',
        entidade: 'equipe',
        entidadeId: req.params.id,
        descricao: `Editou a equipe "${depois?.nome}"`,
        antes,
        depois,
      });
      return res.json(depois);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async managers(req: Request, res: Response) {
    try {
      return res.json(await listTeamManagers(Number(req.params.id), req.user));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async setManagers(req: Request, res: Response) {
    const parsed = teamManagersSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const antes = await listTeamManagers(Number(req.params.id), req.user);
      const depois = await setTeamManagers(Number(req.params.id), parsed.data, req.user);

      // Vale auditoria como mudança de permissão, e não como edição de equipe:
      // o vínculo abre a visibilidade da equipe para quem não administra.
      await auditFromRequest(req, {
        acao: 'permission_change',
        entidade: 'equipe_responsaveis',
        entidadeId: req.params.id,
        descricao:
          depois.length === 0
            ? 'Removeu todos os responsáveis pela equipe'
            : `Definiu como responsáveis pela equipe: ${depois.map((item) => item.gestor.nome).join(', ')}`,
        antes: antes.map((item) => item.gestor),
        depois: depois.map((item) => item.gestor),
      });
      return res.json(depois);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const team = await deleteTeam(Number(req.params.id), req.user);
      await auditFromRequest(req, {
        acao: 'delete',
        entidade: 'equipe',
        entidadeId: req.params.id,
        descricao: `Removeu a equipe "${team.nome}"`,
        antes: team,
      });
      return res.status(204).send();
    } catch (error) {
      return handleError(error, res);
    }
  },
};
