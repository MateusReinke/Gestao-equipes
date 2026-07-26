import { Request, Response } from 'express';
import {
  listCollaboratorsForUser,
  createCollaborator,
  updateCollaborator,
  collaboratorSchema,
  collaboratorUpdateSchema,
  ForbiddenTeamError,
  DuplicateEmailError,
  TeamNotFoundError,
  NoActiveTenantError,
  CollaboratorNotFoundError,
} from '../services/collaborator.service';
import { auditFromRequest } from '../services/audit.service';

function handleError(error: unknown, res: Response) {
  if (error instanceof ForbiddenTeamError) return res.status(403).json({ error: error.message });
  if (error instanceof DuplicateEmailError) return res.status(409).json({ error: error.message });
  if (error instanceof TeamNotFoundError) return res.status(400).json({ error: error.message });
  if (error instanceof NoActiveTenantError) return res.status(409).json({ error: error.message });
  if (error instanceof CollaboratorNotFoundError) return res.status(404).json({ error: error.message });
  throw error;
}

export const collaboratorController = {
  async list(req: Request, res: Response) {
    const data = await listCollaboratorsForUser(req.user);
    return res.json(data);
  },

  async create(req: Request, res: Response) {
    const parsed = collaboratorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const collaborator = await createCollaborator(parsed.data, req.user);
      await auditFromRequest(req, {
        acao: 'create',
        entidade: 'colaborador',
        entidadeId: collaborator.id,
        descricao: `Cadastrou o colaborador "${collaborator.nome}"`,
        depois: collaborator,
      });
      return res.status(201).json(collaborator);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async update(req: Request, res: Response) {
    const parsed = collaboratorUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const { antes, depois } = await updateCollaborator(Number(req.params.id), parsed.data, req.user);
      await auditFromRequest(req, {
        acao: 'update',
        entidade: 'colaborador',
        entidadeId: req.params.id,
        descricao: `Editou o colaborador "${depois?.nome}"`,
        antes,
        depois,
      });
      return res.json(depois);
    } catch (error) {
      return handleError(error, res);
    }
  },
};
