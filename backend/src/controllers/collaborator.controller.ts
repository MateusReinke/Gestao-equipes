import { Request, Response } from 'express';
import {
  collaboratorSchema,
  listCollaboratorsForUser,
  createCollaborator,
  ForbiddenTeamError,
  DuplicateEmailError,
  TeamNotFoundError,
} from '../services/collaborator.service';

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
      return res.status(201).json(collaborator);
    } catch (error) {
      if (error instanceof ForbiddenTeamError) return res.status(403).json({ error: error.message });
      if (error instanceof DuplicateEmailError) return res.status(409).json({ error: error.message });
      if (error instanceof TeamNotFoundError) return res.status(400).json({ error: error.message });
      throw error;
    }
  },
};
