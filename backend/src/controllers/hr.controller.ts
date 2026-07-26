import { Request, Response } from 'express';
import {
  listVacationsForUser,
  requestVacation,
  respondVacation,
  vacationSchema,
  vacationResponseSchema,
  NoActiveTenantError as VacationTenantError,
  VacationNotFoundError,
  CollaboratorNotFoundError as VacationCollaboratorError,
} from '../services/vacation.service';
import {
  listAbsences,
  createAbsence,
  respondAbsence,
  absenceSchema,
  absenceResponseSchema,
  NoActiveTenantError as AbsenceTenantError,
  AbsenceNotFoundError,
  CollaboratorNotFoundError as AbsenceCollaboratorError,
} from '../services/absence.service';
import { auditFromRequest } from '../services/audit.service';

function handleError(error: unknown, res: Response) {
  if (error instanceof VacationTenantError || error instanceof AbsenceTenantError) {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof VacationNotFoundError || error instanceof AbsenceNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof VacationCollaboratorError || error instanceof AbsenceCollaboratorError) {
    return res.status(400).json({ error: error.message });
  }
  throw error;
}

export const hrController = {
  async listVacations(req: Request, res: Response) {
    const data = await listVacationsForUser(req.user);
    return res.json(data);
  },

  async requestVacation(req: Request, res: Response) {
    const parsed = vacationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const ferias = await requestVacation(parsed.data, req.user);
      await auditFromRequest(req, {
        acao: 'create',
        entidade: 'ferias',
        entidadeId: ferias.id,
        descricao: `Solicitou férias para ${ferias.colaborador.nome}`,
        depois: ferias,
      });
      return res.status(201).json(ferias);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async respondVacation(req: Request, res: Response) {
    const parsed = vacationResponseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const { antes, depois } = await respondVacation(
        Number(req.params.id),
        parsed.data.status,
        parsed.data.observacao,
        req.user
      );
      await auditFromRequest(req, {
        acao: 'update',
        entidade: 'ferias',
        entidadeId: req.params.id,
        descricao: `Férias marcadas como ${parsed.data.status}`,
        antes,
        depois,
      });
      return res.json(depois);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listAbsences(req: Request, res: Response) {
    const data = await listAbsences(req.user);
    return res.json(data);
  },

  async createAbsence(req: Request, res: Response) {
    const parsed = absenceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const ausencia = await createAbsence(parsed.data, req.user);
      await auditFromRequest(req, {
        acao: 'create',
        entidade: 'ausencia',
        entidadeId: ausencia.id,
        descricao: `Registrou ausência (${ausencia.tipo}) de ${ausencia.colaborador.nome}`,
        depois: ausencia,
      });
      return res.status(201).json(ausencia);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async respondAbsence(req: Request, res: Response) {
    const parsed = absenceResponseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const { antes, depois } = await respondAbsence(Number(req.params.id), parsed.data.status, req.user);
      await auditFromRequest(req, {
        acao: 'update',
        entidade: 'ausencia',
        entidadeId: req.params.id,
        descricao: `Ausência marcada como ${parsed.data.status}`,
        antes,
        depois,
      });
      return res.json(depois);
    } catch (error) {
      return handleError(error, res);
    }
  },
};
