import { Request, Response } from 'express';
import {
  listShifts,
  generateShiftsForScale,
  createShift,
  updateShift,
  getCurrentShifts,
  getUpcomingShifts,
  listShiftsForCollaborator,
  generateShiftsSchema,
  shiftSchema,
  shiftUpdateSchema,
  NoActiveTenantError,
  ScaleNotFoundError,
  ShiftNotFoundError,
  CollaboratorNotFoundError,
  InvalidRangeError,
} from '../services/shift.service';
import { auditFromRequest } from '../services/audit.service';
import { addDays, formatDateOnly } from '../utils/date';

function handleError(error: unknown, res: Response) {
  if (error instanceof NoActiveTenantError) return res.status(409).json({ error: error.message });
  if (error instanceof ScaleNotFoundError || error instanceof ShiftNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof CollaboratorNotFoundError || error instanceof InvalidRangeError) {
    return res.status(400).json({ error: error.message });
  }
  throw error;
}

export const shiftController = {
  async list(req: Request, res: Response) {
    const hoje = new Date();
    const inicio = String(req.query.inicio || formatDateOnly(addDays(hoje, -7)));
    const fim = String(req.query.fim || formatDateOnly(addDays(hoje, 30)));
    const colaboradorId = req.query.colaboradorId ? Number(req.query.colaboradorId) : undefined;

    try {
      const data = await listShifts(req.user, { inicio, fim, colaboradorId });
      return res.json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async mine(req: Request, res: Response) {
    const colaboradorId = Number(req.params.colaboradorId);
    try {
      const data = await listShiftsForCollaborator(colaboradorId, req.user);
      return res.json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async generate(req: Request, res: Response) {
    const parsed = generateShiftsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }

    try {
      const resultado = await generateShiftsForScale(parsed.data, req.user);
      await auditFromRequest(req, {
        acao: 'create',
        entidade: 'turnos',
        entidadeId: parsed.data.escalaId,
        descricao: `Gerou ${resultado.criados} turno(s) de ${parsed.data.inicio} a ${parsed.data.fim}`,
        depois: resultado,
      });
      return res.status(201).json(resultado);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async create(req: Request, res: Response) {
    const parsed = shiftSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }

    try {
      const turno = await createShift(parsed.data, req.user);
      await auditFromRequest(req, {
        acao: 'create',
        entidade: 'turno',
        entidadeId: turno.id,
        descricao: `Criou turno de ${turno.colaborador.nome} em ${formatDateOnly(turno.data)}`,
        depois: turno,
      });
      return res.status(201).json(turno);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async update(req: Request, res: Response) {
    const shiftId = Number(req.params.id);
    const parsed = shiftUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }

    try {
      const { antes, depois } = await updateShift(shiftId, parsed.data, req.user);
      await auditFromRequest(req, {
        acao: 'update',
        entidade: 'turno',
        entidadeId: shiftId,
        descricao: 'Editou turno',
        antes,
        depois,
      });
      return res.json(depois);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async current(req: Request, res: Response) {
    const ativos = await getCurrentShifts(undefined, req.user);
    return res.json({
      generatedAt: new Date().toISOString(),
      total: ativos.length,
      plantonistas: ativos,
    });
  },

  async upcoming(req: Request, res: Response) {
    const data = await getUpcomingShifts(undefined, req.user, 20);
    return res.json(data);
  },
};
