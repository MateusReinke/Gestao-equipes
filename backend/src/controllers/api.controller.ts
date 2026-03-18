import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { JwtPayload } from '../types/auth';

function dayBounds(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function isTimeBetween(nowMinutes: number, start: string, end: string) {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (endMinutes >= startMinutes) return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

async function getVisibleTeamIds(user?: JwtPayload) {
  if (!user) return [];
  if (user.role === 'admin') {
    const teams = await prisma.team.findMany({ select: { id: true } });
    return teams.map((team: { id: number }) => team.id);
  }

  const managerTeams = await prisma.managerTeam.findMany({ where: { gestorId: user.userId }, select: { equipeId: true } });
  return managerTeams.map((item: { equipeId: number }) => item.equipeId);
}

async function getCurrentOnCall(clientId?: number, user?: JwtPayload) {
  const { start, end } = dayBounds();
  const visibleTeamIds = await getVisibleTeamIds(user);
  const nowMinutes = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();

  const vacations = await prisma.vacation.findMany({
    where: { status: 'aprovado', dataInicio: { lt: end }, dataFim: { gte: start } },
    select: { colaboradorId: true },
  });

  return prisma.onCall.findMany({
    where: {
      data: { gte: start, lt: end },
      clienteId: clientId,
      colaborador: {
        equipeId: { in: visibleTeamIds },
        ativo: true,
        id: { notIn: vacations.map((item: { colaboradorId: number }) => item.colaboradorId) },
      },
    },
    include: {
      cliente: true,
      colaborador: { include: { equipe: true } },
    },
  }).then((items: Array<{ horaInicio: string; horaFim: string }>) => items.filter((item) => isTimeBetween(nowMinutes, item.horaInicio, item.horaFim)));
}

async function getUpcomingOnCall(clientId?: number, user?: JwtPayload) {
  const visibleTeamIds = await getVisibleTeamIds(user);
  const { start } = dayBounds();

  return prisma.onCall.findMany({
    where: {
      data: { gte: start },
      clienteId: clientId,
      colaborador: { equipeId: { in: visibleTeamIds }, ativo: true },
    },
    include: { cliente: true, colaborador: { include: { equipe: true } } },
    orderBy: [{ data: 'asc' }, { horaInicio: 'asc' }],
    take: 10,
  });
}

async function getDashboard(user?: JwtPayload) {
  const visibleTeamIds = await getVisibleTeamIds(user);
  const { start, end } = dayBounds();
  const currentOnCall = await getCurrentOnCall(undefined, user);

  const [teams, collaborators, clients, vacations, scales] = await Promise.all([
    prisma.team.findMany({ where: { id: { in: visibleTeamIds } }, include: { cliente: true, _count: { select: { colaboradores: true } } } }),
    prisma.collaborator.findMany({ where: { equipeId: { in: visibleTeamIds }, ativo: true }, include: { equipe: true } }),
    prisma.client.findMany({ where: { equipes: { some: { id: { in: visibleTeamIds } } } }, include: { responsavelInterno: true } }),
    prisma.vacation.findMany({
      where: { status: 'aprovado', dataInicio: { lt: end }, dataFim: { gte: start }, colaborador: { equipeId: { in: visibleTeamIds } } },
      include: { colaborador: true },
    }),
    prisma.scale.findMany({
      where: { colaboradores: { some: { colaborador: { equipeId: { in: visibleTeamIds } } } } },
      include: { cliente: true, detalhes: true, colaboradores: { include: { colaborador: true } } },
    }),
  ]);

  return {
    metrics: {
      clients: clients.length,
      teams: teams.length,
      collaborators: collaborators.length,
      currentOnCall: currentOnCall.length,
      activeVacations: vacations.length,
      activeScales: scales.length,
    },
    currentOnCall,
    upcomingOnCall: await getUpcomingOnCall(undefined, user),
    teams,
    collaborators,
    clients,
    vacations,
    scales,
  };
}

export const apiController = {
  async health(_: Request, res: Response) {
    return res.json({ status: 'ok', timestamp: new Date().toISOString() });
  },

  async login(req: Request, res: Response) {
    const { email, senha } = req.body;
    const user = await prisma.user.findUnique({ where: { email }, include: { gestorEquipes: true } });
    if (!user || !user.ativo) return res.status(401).json({ error: 'Credenciais inválidas' });

    const valid = await bcrypt.compare(String(senha || ''), user.senhaHash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

    const token = jwt.sign({ sub: user.email, userId: user.id, role: user.role }, env.jwtSecret, { expiresIn: '12h' });
    return res.json({ token, user: { id: user.id, nome: user.nome, email: user.email, role: user.role } });
  },

  async dashboard(req: Request, res: Response) {
    const data = await getDashboard((req as Request & { user?: JwtPayload }).user);
    return res.json(data);
  },

  async currentOnCall(req: Request, res: Response) {
    const active = await getCurrentOnCall(undefined, (req as Request & { user?: JwtPayload }).user);
    const now = new Date();
    return res.json({
      generatedAt: now.toISOString(),
      total: active.length,
      plantonistas: active,
    });
  },

  async clientResponsible(req: Request, res: Response) {
    const clientId = Number(req.params.id);
    const client = await prisma.client.findUnique({ where: { id: clientId }, include: { responsavelInterno: { include: { equipe: true } } } });
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
    return res.json({
      cliente: { id: client.id, nome: client.nome },
      responsavel: client.responsavelInterno,
    });
  },

  async clientOnCall(req: Request, res: Response) {
    const clientId = Number(req.params.id);
    const atuais = await getCurrentOnCall(clientId, (req as Request & { user?: JwtPayload }).user);
    const proximos = await getUpcomingOnCall(clientId, (req as Request & { user?: JwtPayload }).user);
    return res.json({ clientId, atuais, proximos });
  },

  async clients(_: Request, res: Response) {
    const data = await prisma.client.findMany({ include: { responsavelInterno: { include: { equipe: true } }, equipes: true } });
    return res.json(data);
  },

  async teams(req: Request, res: Response) {
    const teamIds = await getVisibleTeamIds((req as Request & { user?: JwtPayload }).user);
    const data = await prisma.team.findMany({ where: { id: { in: teamIds } }, include: { cliente: true, colaboradores: true, gestores: { include: { gestor: true } } } });
    return res.json(data);
  },

  async collaborators(req: Request, res: Response) {
    const teamIds = await getVisibleTeamIds((req as Request & { user?: JwtPayload }).user);
    const data = await prisma.collaborator.findMany({ where: { equipeId: { in: teamIds } }, include: { equipe: true, ferias: true } });
    return res.json(data);
  },

  async managers(_: Request, res: Response) {
    const data = await prisma.user.findMany({ where: { role: 'gestor' }, include: { gestorEquipes: { include: { equipe: true } }, colaborador: true } });
    return res.json(data);
  },

  async scales(req: Request, res: Response) {
    const teamIds = await getVisibleTeamIds((req as Request & { user?: JwtPayload }).user);
    const data = await prisma.scale.findMany({
      where: { colaboradores: { some: { colaborador: { equipeId: { in: teamIds } } } } },
      include: { cliente: true, detalhes: true, colaboradores: { include: { colaborador: { include: { equipe: true } } } } },
    });
    return res.json(data);
  },

  async vacations(req: Request, res: Response) {
    const teamIds = await getVisibleTeamIds((req as Request & { user?: JwtPayload }).user);
    const data = await prisma.vacation.findMany({ where: { colaborador: { equipeId: { in: teamIds } } }, include: { colaborador: { include: { equipe: true } } } });
    return res.json(data);
  },

  async onCalls(req: Request, res: Response) {
    const teamIds = await getVisibleTeamIds((req as Request & { user?: JwtPayload }).user);
    const data = await prisma.onCall.findMany({
      where: { colaborador: { equipeId: { in: teamIds } } },
      include: { cliente: true, colaborador: { include: { equipe: true } } },
      orderBy: [{ data: 'asc' }, { horaInicio: 'asc' }],
    });
    return res.json(data);
  },
};
