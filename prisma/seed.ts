import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@gestao.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
const MANAGER_EMAIL = process.env.SEED_MANAGER_EMAIL || 'gestor@gestao.local';
const MANAGER_PASSWORD = process.env.SEED_MANAGER_PASSWORD || 'Gestor@123';
const DEFAULT_TENANT_SLUG = 'default';

/**
 * Seed idempotente: só popula a base se o admin padrão ainda não existir.
 * Nunca apaga dados existentes - seguro para rodar em todo boot do backend.
 * Para resetar o dataset de demonstração em desenvolvimento, use `npm run seed:dev:reset`.
 */
async function main() {
  const existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existingAdmin) {
    console.log('[seed] Base já inicializada — nenhuma alteração feita.');
    return;
  }

  console.log('[seed] Base vazia — criando dados iniciais de demonstração.');

  const tenant = await prisma.tenant.upsert({
    where: { slug: DEFAULT_TENANT_SLUG },
    update: {},
    create: { nome: 'Empresa Padrão', slug: DEFAULT_TENANT_SLUG, ativo: true },
  });
  const tenantId = tenant.id;

  const [noc, field, service] = await Promise.all([
    prisma.team.create({ data: { tenantId, nome: 'NOC 24x7', ativo: true } }),
    prisma.team.create({ data: { tenantId, nome: 'Field Service', ativo: true } }),
    prisma.team.create({ data: { tenantId, nome: 'Service Desk', ativo: true } }),
  ]);

  const [ana, bruno, carla, diego, erika] = await Promise.all([
    prisma.collaborator.create({ data: { tenantId, nome: 'Ana Lima', email: 'ana.lima@gestao.local', telefone: '11988881111', cargo: 'Analista de NOC', equipeId: noc.id, tipoContrato: 'clt', modeloTrabalho: 'hibrido', fazPlantao: true, sobreAviso: false, ativo: true } }),
    prisma.collaborator.create({ data: { tenantId, nome: 'Bruno Costa', email: 'bruno.costa@gestao.local', telefone: '11988882222', cargo: 'Analista de NOC', equipeId: noc.id, tipoContrato: 'clt', modeloTrabalho: 'remoto', fazPlantao: true, sobreAviso: true, ativo: true } }),
    prisma.collaborator.create({ data: { tenantId, nome: 'Carla Souza', email: 'carla.souza@gestao.local', telefone: '11988883333', cargo: 'Técnica de Campo', equipeId: field.id, tipoContrato: 'pj', modeloTrabalho: 'presencial', fazPlantao: true, sobreAviso: false, ativo: true } }),
    prisma.collaborator.create({ data: { tenantId, nome: 'Diego Martins', email: 'diego.martins@gestao.local', telefone: '11988884444', cargo: 'Analista de Service Desk', equipeId: service.id, tipoContrato: 'clt', modeloTrabalho: 'hibrido', fazPlantao: false, sobreAviso: true, ativo: true } }),
    prisma.collaborator.create({ data: { tenantId, nome: 'Erika Rocha', email: 'erika.rocha@gestao.local', telefone: '11988885555', cargo: 'Analista de Service Desk', equipeId: service.id, tipoContrato: 'terceirizado', modeloTrabalho: 'remoto', fazPlantao: false, sobreAviso: false, ativo: true } }),
  ]);

  const [atlas, varejo] = await Promise.all([
    prisma.client.create({ data: { tenantId, nome: 'Banco Atlas', idWhatsapp: '5511999990001', escalation: 'war-room@atlas.com', responsavelInternoId: ana.id, ativo: true } }),
    prisma.client.create({ data: { tenantId, nome: 'Varejo Leste', idWhatsapp: '5511999990002', escalation: 'sev1@varejo.com', responsavelInternoId: carla.id, ativo: true } }),
  ]);

  await Promise.all([
    prisma.team.update({ where: { id: noc.id }, data: { clienteId: atlas.id } }),
    prisma.team.update({ where: { id: field.id }, data: { clienteId: varejo.id } }),
    prisma.team.update({ where: { id: service.id }, data: { clienteId: atlas.id } }),
  ]);

  const [escala12x36, escala52, escalaCustom] = await Promise.all([
    prisma.scale.create({
      data: {
        tenantId, nome: 'NOC 12x36', tipo: 'doze_por_trinta_seis', descricao: 'Cobertura contínua com alternância 12x36', clienteId: atlas.id,
        detalhes: { create: [
          { tenantId, diaSemana: 0, horaInicio: '07:00', horaFim: '19:00' },
          { tenantId, diaSemana: 1, horaInicio: '19:00', horaFim: '07:00' },
          { tenantId, diaSemana: 2, horaInicio: '07:00', horaFim: '19:00' },
          { tenantId, diaSemana: 3, horaInicio: '19:00', horaFim: '07:00' },
          { tenantId, diaSemana: 4, horaInicio: '07:00', horaFim: '19:00' },
          { tenantId, diaSemana: 5, horaInicio: '19:00', horaFim: '07:00' },
          { tenantId, diaSemana: 6, horaInicio: '07:00', horaFim: '19:00' },
        ] }
      }
    }),
    prisma.scale.create({
      data: {
        tenantId, nome: 'Field Service 5x2', tipo: 'cinco_por_dois', descricao: 'Atendimento comercial em dias úteis', clienteId: varejo.id,
        detalhes: { create: [
          { tenantId, diaSemana: 1, horaInicio: '08:00', horaFim: '17:00' },
          { tenantId, diaSemana: 2, horaInicio: '08:00', horaFim: '17:00' },
          { tenantId, diaSemana: 3, horaInicio: '08:00', horaFim: '17:00' },
          { tenantId, diaSemana: 4, horaInicio: '08:00', horaFim: '17:00' },
          { tenantId, diaSemana: 5, horaInicio: '08:00', horaFim: '17:00' },
        ] }
      }
    }),
    prisma.scale.create({
      data: {
        tenantId, nome: 'Service Desk Flex', tipo: 'personalizada', descricao: 'Escala flexível com sobreposição em horário crítico', clienteId: atlas.id,
        detalhes: { create: [
          { tenantId, diaSemana: 1, horaInicio: '06:00', horaFim: '14:00' },
          { tenantId, diaSemana: 1, horaInicio: '14:00', horaFim: '22:00' },
          { tenantId, diaSemana: 2, horaInicio: '06:00', horaFim: '14:00' },
          { tenantId, diaSemana: 2, horaInicio: '14:00', horaFim: '22:00' },
          { tenantId, diaSemana: 3, horaInicio: '06:00', horaFim: '14:00' },
        ] }
      }
    }),
  ]);

  await prisma.scaleAssignment.createMany({ data: [
    { tenantId, colaboradorId: ana.id, escalaId: escala12x36.id, dataInicio: new Date('2026-03-01') },
    { tenantId, colaboradorId: bruno.id, escalaId: escala12x36.id, dataInicio: new Date('2026-03-01') },
    { tenantId, colaboradorId: carla.id, escalaId: escala52.id, dataInicio: new Date('2026-03-01') },
    { tenantId, colaboradorId: diego.id, escalaId: escalaCustom.id, dataInicio: new Date('2026-03-01') },
    { tenantId, colaboradorId: erika.id, escalaId: escalaCustom.id, dataInicio: new Date('2026-03-01') },
  ]});

  await prisma.onCall.createMany({ data: [
    { tenantId, colaboradorId: ana.id, clienteId: atlas.id, data: new Date('2026-03-18'), horaInicio: '07:00', horaFim: '19:00', tipo: 'plantao' },
    { tenantId, colaboradorId: bruno.id, clienteId: atlas.id, data: new Date('2026-03-18'), horaInicio: '07:00', horaFim: '19:00', tipo: 'sobreaviso' },
    { tenantId, colaboradorId: carla.id, clienteId: varejo.id, data: new Date('2026-03-18'), horaInicio: '08:00', horaFim: '17:00', tipo: 'plantao' },
    { tenantId, colaboradorId: diego.id, clienteId: atlas.id, data: new Date('2026-03-19'), horaInicio: '06:00', horaFim: '14:00', tipo: 'plantao' },
  ]});

  await prisma.vacation.createMany({ data: [
    { tenantId, colaboradorId: erika.id, dataInicio: new Date('2026-03-18'), dataFim: new Date('2026-03-25'), status: 'aprovado' },
  ]});

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const gestorHash = await bcrypt.hash(MANAGER_PASSWORD, 10);

  const admin = await prisma.user.create({ data: { nome: 'Administrador', email: ADMIN_EMAIL, senhaHash: adminHash, ativo: true, isGlobalAdmin: true } });
  const gestor = await prisma.user.create({ data: { nome: 'Marina Gestora', email: MANAGER_EMAIL, senhaHash: gestorHash, ativo: true } });

  await prisma.tenantMembership.createMany({ data: [
    { userId: admin.id, tenantId, role: 'admin' },
    { userId: gestor.id, tenantId, role: 'gestor', colaboradorId: ana.id },
  ]});

  await prisma.managerTeam.createMany({ data: [
    { tenantId, gestorId: admin.id, equipeId: noc.id },
    { tenantId, gestorId: admin.id, equipeId: field.id },
    { tenantId, gestorId: admin.id, equipeId: service.id },
    { tenantId, gestorId: gestor.id, equipeId: noc.id },
    { tenantId, gestorId: gestor.id, equipeId: service.id },
  ]});

  console.log('[seed] Concluído.');
}

main()
  .catch((error) => {
    console.error('[seed] Falhou:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
