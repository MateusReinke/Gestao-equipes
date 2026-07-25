import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Reset destrutivo do dataset de demonstração - uso exclusivo em desenvolvimento local.
 * Apaga e recria tenants, usuários, clientes, equipes, colaboradores, escalas, plantões e férias.
 * Cria DOIS tenants (para demonstrar isolamento) além do admin global.
 * NUNCA é chamado pelo entrypoint.sh nem deve ser usado em produção.
 */
async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[seed:dev:reset] Recusado: este script apaga todos os dados e não deve rodar em produção.');
  }

  console.warn('[seed:dev:reset] Apagando dados operacionais e recriando o dataset de demonstração...');

  await prisma.managerTeam.deleteMany();
  await prisma.onCall.deleteMany();
  await prisma.vacation.deleteMany();
  await prisma.scaleDetail.deleteMany();
  await prisma.scaleAssignment.deleteMany();
  await prisma.scale.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.client.deleteMany();
  await prisma.collaborator.deleteMany();
  await prisma.team.deleteMany();
  await prisma.tenant.deleteMany();

  const tenant = await prisma.tenant.create({ data: { nome: 'Empresa Padrão', slug: 'default', ativo: true } });
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

  const adminHash = await bcrypt.hash('Admin@123', 10);
  const gestorHash = await bcrypt.hash('Gestor@123', 10);

  const admin = await prisma.user.create({ data: { nome: 'Administrador', email: 'admin@gestao.local', senhaHash: adminHash, ativo: true, isGlobalAdmin: true } });
  const gestor = await prisma.user.create({ data: { nome: 'Marina Gestora', email: 'gestor@gestao.local', senhaHash: gestorHash, ativo: true } });

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

  // Segundo tenant, só para provar isolamento em desenvolvimento.
  const tenantB = await prisma.tenant.create({ data: { nome: 'Acme Corp', slug: 'acme', ativo: true } });
  const tenantBId = tenantB.id;

  const suporteAcme = await prisma.team.create({ data: { tenantId: tenantBId, nome: 'Suporte Acme', ativo: true } });
  const fernanda = await prisma.collaborator.create({ data: { tenantId: tenantBId, nome: 'Fernanda Alves', email: 'fernanda.alves@acme.local', telefone: '11977776666', cargo: 'Analista de Suporte', equipeId: suporteAcme.id, tipoContrato: 'clt', modeloTrabalho: 'remoto', fazPlantao: true, sobreAviso: false, ativo: true } });
  const acmeCliente = await prisma.client.create({ data: { tenantId: tenantBId, nome: 'Acme Retail', idWhatsapp: '5511999991234', escalation: 'sev1@acme.local', responsavelInternoId: fernanda.id, ativo: true } });
  await prisma.team.update({ where: { id: suporteAcme.id }, data: { clienteId: acmeCliente.id } });

  const acmeAdminHash = await bcrypt.hash('Acme@123', 10);
  const acmeAdmin = await prisma.user.create({ data: { nome: 'Admin Acme', email: 'admin@acme.local', senhaHash: acmeAdminHash, ativo: true } });
  await prisma.tenantMembership.create({ data: { userId: acmeAdmin.id, tenantId: tenantBId, role: 'admin', colaboradorId: fernanda.id } });
  await prisma.managerTeam.create({ data: { tenantId: tenantBId, gestorId: acmeAdmin.id, equipeId: suporteAcme.id } });

  console.log('[seed:dev:reset] Concluído. Tenants: "default" (admin@gestao.local) e "acme" (admin@acme.local / Acme@123).');
}

main()
  .catch((error) => {
    console.error('[seed:dev:reset] Falhou:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
