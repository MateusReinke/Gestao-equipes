import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { onCallService } from '../services/oncall.service';
import { scheduleService } from '../services/schedule.service';
import { dashboardService } from '../services/dashboard.service';

export const apiController = {
  async health(_: Request, res: Response) {
    return res.json({ status: 'ok' });
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
    const data = await onCallService.getNow();
    return res.json(data);
  },

  async escalaData(req: Request, res: Response) {
    const data = String(req.query.data || new Date().toISOString().slice(0, 10));
    const items = await scheduleService.getByDate(data);
    return res.json(items);
  },

  async createEscala(req: Request, res: Response) {
    try {
      const created = await scheduleService.createSchedule(req.body);
      return res.status(201).json(created);
    } catch (error) {
      return res.status(400).json({ error: (error as Error).message });
    }
  },

  async createPlantao(req: Request, res: Response) {
    const created = await onCallService.create(req.body);
    return res.status(201).json(created);
  },

  async createFerias(req: Request, res: Response) {
    const created = await prisma.vacation.create({ data: req.body });
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
