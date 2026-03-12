import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { onCallService } from '../services/oncall.service';
import { scheduleService } from '../services/schedule.service';
import { dashboardService } from '../services/dashboard.service';
import { env } from '../config/env';

export const apiController = {
  async health(_: Request, res: Response) {
    return res.json({ status: 'ok' });
  },

  async login(req: Request, res: Response) {
    const { email, senha } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.ativo) return res.status(401).json({ error: 'Credenciais inválidas' });

    const valid = await bcrypt.compare(String(senha || ''), user.senhaHash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

    const token = jwt.sign({ sub: user.email, role: user.role }, env.jwtSecret, { expiresIn: '12h' });
    return res.json({ token, user: { nome: user.nome, email: user.email, role: user.role } });
  },

  async dashboard(_: Request, res: Response) {
    const data = await dashboardService.summary();
    return res.json(data);
  },

  async plantonistaHoje(_: Request, res: Response) {
    const data = await onCallService.getToday();
    return res.json(data);
  },

  async plantonistaAgora(_: Request, res: Response) {
    const data = await onCallService.getNowSummary();
    return res.json(data);
  },

  async escalaData(req: Request, res: Response) {
    const data = String(req.query.data || new Date().toISOString().slice(0, 10));
    const items = await scheduleService.getByDate(data);
    return res.json(items);
  },

  async escalaColaborador(req: Request, res: Response) {
    const colaboradorId = Number(req.params.colaboradorId);
    const items = await scheduleService.getByCollaborator(colaboradorId);
    return res.json(items);
  },

  async createEscala(req: Request, res: Response) {
    try {
      const created = await scheduleService.createSchedule({
        ...req.body,
        usuario: (req as Request & { user?: { sub: string } }).user?.sub,
      });
      return res.status(201).json(created);
    } catch (error) {
      return res.status(400).json({ error: (error as Error).message });
    }
  },

  async createPlantao(req: Request, res: Response) {
    const created = await onCallService.create({
      ...req.body,
      usuario: (req as Request & { user?: { sub: string } }).user?.sub,
    });
    return res.status(201).json(created);
  },

  async createFerias(req: Request, res: Response) {
    const payload = {
      ...req.body,
      status: req.body.status || 'pendente',
      dataInicio: new Date(req.body.dataInicio),
      dataFim: new Date(req.body.dataFim),
    };
    const created = await prisma.vacation.create({ data: payload });
    return res.status(201).json(created);
  },

  async createFeriado(req: Request, res: Response) {
    const payload = { ...req.body, data: new Date(req.body.data) };
    const created = await prisma.holiday.create({ data: payload });
    return res.status(201).json(created);
  },

  async colaboradores(_: Request, res: Response) {
    const data = await prisma.collaborator.findMany({ include: { equipe: true } });
    return res.json(data);
  },

  async equipes(_: Request, res: Response) {
    const data = await prisma.team.findMany();
    return res.json(data);
  },

  async clientes(_: Request, res: Response) {
    const data = await prisma.client.findMany();
    return res.json(data);
  },

  async turnos(_: Request, res: Response) {
    const data = await prisma.shift.findMany();
    return res.json(data);
  },

  async ferias(_: Request, res: Response) {
    const data = await prisma.vacation.findMany({ include: { colaborador: true } });
    return res.json(data);
  },

  async feriados(_: Request, res: Response) {
    const data = await prisma.holiday.findMany({ orderBy: { data: 'asc' } });
    return res.json(data);
  },
};
