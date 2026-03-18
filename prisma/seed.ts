import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.managerTeam.deleteMany();
  await prisma.onCall.deleteMany();
  await prisma.vacation.deleteMany();
  await prisma.scaleDetail.deleteMany();
  await prisma.scaleAssignment.deleteMany();
  await prisma.scale.deleteMany();
  await prisma.user.deleteMany();
  await prisma.client.deleteMany();
  await prisma.collaborator.deleteMany();
  await prisma.team.deleteMany();

  const [noc, field, service] = await Promise.all([
    prisma.team.create({ data: { nome: 'NOC 24x7', ativo: true } }),
    prisma.team.create({ data: { nome: 'Field Service', ativo: true } }),
    prisma.team.create({ data: { nome: 'Service Desk', ativo: true } }),
  ]);

  const [ana, bruno, carla, diego, erika] = await Promise.all([
    prisma.collaborator.create({ data: { nome: 'Ana Lima', email: 'ana.lima@gestao.local', telefone: '11988881111', equipeId: noc.id, tipoContrato: 'clt', modeloTrabalho: 'hibrido', ativo: true } }),
    prisma.collaborator.create({ data: { nome: 'Bruno Costa', email: 'bruno.costa@gestao.local', telefone: '11988882222', equipeId: noc.id, tipoContrato: 'clt', modeloTrabalho: 'remoto', ativo: true } }),
    prisma.collaborator.create({ data: { nome: 'Carla Souza', email: 'carla.souza@gestao.local', telefone: '11988883333', equipeId: field.id, tipoContrato: 'pj', modeloTrabalho: 'presencial', ativo: true } }),
    prisma.collaborator.create({ data: { nome: 'Diego Martins', email: 'diego.martins@gestao.local', telefone: '11988884444', equipeId: service.id, tipoContrato: 'clt', modeloTrabalho: 'hibrido', ativo: true } }),
    prisma.collaborator.create({ data: { nome: 'Erika Rocha', email: 'erika.rocha@gestao.local', telefone: '11988885555', equipeId: service.id, tipoContrato: 'terceirizado', modeloTrabalho: 'remoto', ativo: true } }),
  ]);

  const [atlas, varejo] = await Promise.all([
    prisma.client.create({ data: { nome: 'Banco Atlas', idWhatsapp: '5511999990001', escalation: 'war-room@atlas.com', responsavelInternoId: ana.id, ativo: true } }),
    prisma.client.create({ data: { nome: 'Varejo Leste', idWhatsapp: '5511999990002', escalation: 'sev1@varejo.com', responsavelInternoId: carla.id, ativo: true } }),
  ]);

  await Promise.all([
    prisma.team.update({ where: { id: noc.id }, data: { clienteId: atlas.id } }),
    prisma.team.update({ where: { id: field.id }, data: { clienteId: varejo.id } }),
    prisma.team.update({ where: { id: service.id }, data: { clienteId: atlas.id } }),
  ]);

  const [escala12x36, escala52, escalaCustom] = await Promise.all([
    prisma.scale.create({
      data: {
        nome: 'NOC 12x36', tipo: 'doze_por_trinta_seis', descricao: 'Cobertura contínua com alternância 12x36', clienteId: atlas.id,
        detalhes: { create: [
          { diaSemana: 0, horaInicio: '07:00', horaFim: '19:00' },
          { diaSemana: 1, horaInicio: '19:00', horaFim: '07:00' },
          { diaSemana: 2, horaInicio: '07:00', horaFim: '19:00' },
          { diaSemana: 3, horaInicio: '19:00', horaFim: '07:00' },
          { diaSemana: 4, horaInicio: '07:00', horaFim: '19:00' },
          { diaSemana: 5, horaInicio: '19:00', horaFim: '07:00' },
          { diaSemana: 6, horaInicio: '07:00', horaFim: '19:00' },
        ] }
      }
    }),
    prisma.scale.create({
      data: {
        nome: 'Field Service 5x2', tipo: 'cinco_por_dois', descricao: 'Atendimento comercial em dias úteis', clienteId: varejo.id,
        detalhes: { create: [
          { diaSemana: 1, horaInicio: '08:00', horaFim: '17:00' },
          { diaSemana: 2, horaInicio: '08:00', horaFim: '17:00' },
          { diaSemana: 3, horaInicio: '08:00', horaFim: '17:00' },
          { diaSemana: 4, horaInicio: '08:00', horaFim: '17:00' },
          { diaSemana: 5, horaInicio: '08:00', horaFim: '17:00' },
        ] }
      }
    }),
    prisma.scale.create({
      data: {
        nome: 'Service Desk Flex', tipo: 'personalizada', descricao: 'Escala flexível com sobreposição em horário crítico', clienteId: atlas.id,
        detalhes: { create: [
          { diaSemana: 1, horaInicio: '06:00', horaFim: '14:00' },
          { diaSemana: 1, horaInicio: '14:00', horaFim: '22:00' },
          { diaSemana: 2, horaInicio: '06:00', horaFim: '14:00' },
          { diaSemana: 2, horaInicio: '14:00', horaFim: '22:00' },
          { diaSemana: 3, horaInicio: '06:00', horaFim: '14:00' },
        ] }
      }
    }),
  ]);

  await prisma.scaleAssignment.createMany({ data: [
    { colaboradorId: ana.id, escalaId: escala12x36.id, dataInicio: new Date('2026-03-01') },
    { colaboradorId: bruno.id, escalaId: escala12x36.id, dataInicio: new Date('2026-03-01') },
    { colaboradorId: carla.id, escalaId: escala52.id, dataInicio: new Date('2026-03-01') },
    { colaboradorId: diego.id, escalaId: escalaCustom.id, dataInicio: new Date('2026-03-01') },
    { colaboradorId: erika.id, escalaId: escalaCustom.id, dataInicio: new Date('2026-03-01') },
  ]});

  await prisma.onCall.createMany({ data: [
    { colaboradorId: ana.id, clienteId: atlas.id, data: new Date('2026-03-18'), horaInicio: '07:00', horaFim: '19:00', tipo: 'plantao' },
    { colaboradorId: bruno.id, clienteId: atlas.id, data: new Date('2026-03-18'), horaInicio: '07:00', horaFim: '19:00', tipo: 'sobreaviso' },
    { colaboradorId: carla.id, clienteId: varejo.id, data: new Date('2026-03-18'), horaInicio: '08:00', horaFim: '17:00', tipo: 'plantao' },
    { colaboradorId: diego.id, clienteId: atlas.id, data: new Date('2026-03-19'), horaInicio: '06:00', horaFim: '14:00', tipo: 'plantao' },
  ]});

  await prisma.vacation.createMany({ data: [
    { colaboradorId: erika.id, dataInicio: new Date('2026-03-18'), dataFim: new Date('2026-03-25'), status: 'aprovado' },
  ]});

  const adminHash = await bcrypt.hash('Admin@123', 10);
  const gestorHash = await bcrypt.hash('Gestor@123', 10);

  const admin = await prisma.user.create({ data: { nome: 'Administrador', email: 'admin@gestao.local', senhaHash: adminHash, role: 'admin', ativo: true } });
  const gestor = await prisma.user.create({ data: { nome: 'Marina Gestora', email: 'gestor@gestao.local', senhaHash: gestorHash, role: 'gestor', ativo: true, colaboradorId: ana.id } });

  await prisma.managerTeam.createMany({ data: [
    { gestorId: admin.id, equipeId: noc.id },
    { gestorId: admin.id, equipeId: field.id },
    { gestorId: admin.id, equipeId: service.id },
    { gestorId: gestor.id, equipeId: noc.id },
    { gestorId: gestor.id, equipeId: service.id },
  ]});
}

main().finally(() => prisma.$disconnect());
