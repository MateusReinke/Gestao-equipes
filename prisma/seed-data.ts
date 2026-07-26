import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

/**
 * Dataset de demonstração compartilhado entre o seed idempotente (produção) e o
 * reset destrutivo (desenvolvimento). Mantido num só lugar para os dois nunca
 * divergirem.
 */

const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/// Segunda-feira da semana atual, em UTC — mantém o dataset sempre "atual"
/// independentemente de quando o seed rodar.
function segundaDestaSemana() {
  const hoje = new Date();
  const base = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));
  const diaSemana = base.getUTCDay();
  const offset = diaSemana === 0 ? -6 : 1 - diaSemana;
  base.setUTCDate(base.getUTCDate() + offset);
  return base;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export type SeedOptions = {
  adminEmail: string;
  adminPassword: string;
  managerEmail: string;
  managerPassword: string;
  /// Cria um segundo tenant de demonstração para exercitar o isolamento.
  criarSegundoTenant?: boolean;
};

export async function seedDemoData(prisma: PrismaClient, options: SeedOptions) {
  const papelAdmin = await prisma.role.findFirstOrThrow({ where: { tenantId: null, codigo: 'admin_tenant' } });
  const papelGestor = await prisma.role.findFirstOrThrow({ where: { tenantId: null, codigo: 'gestor' } });
  const papelAnalista = await prisma.role.findFirstOrThrow({ where: { tenantId: null, codigo: 'analista' } });

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: { nome: 'Empresa Padrão', slug: 'default', ativo: true },
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
    prisma.client.create({
      data: {
        tenantId, nome: 'Banco Atlas', razaoSocial: 'Banco Atlas S.A.', idWhatsapp: '5511999990001',
        escalation: 'war-room@atlas.com', telefone: '1130001000', slaMinutos: 30,
        cidade: 'São Paulo', uf: 'SP', responsavelInternoId: ana.id, ativo: true,
      },
    }),
    prisma.client.create({
      data: {
        tenantId, nome: 'Varejo Leste', razaoSocial: 'Varejo Leste Comércio Ltda.', idWhatsapp: '5511999990002',
        escalation: 'sev1@varejo.com', telefone: '1130002000', slaMinutos: 60,
        cidade: 'Guarulhos', uf: 'SP', responsavelInternoId: carla.id, ativo: true,
      },
    }),
  ]);

  await Promise.all([
    prisma.team.update({ where: { id: noc.id }, data: { clienteId: atlas.id } }),
    prisma.team.update({ where: { id: field.id }, data: { clienteId: varejo.id } }),
    prisma.team.update({ where: { id: service.id }, data: { clienteId: atlas.id } }),
  ]);

  const inicioEscala = toDate('2026-01-01');

  const escala12x36 = await prisma.scale.create({
    data: {
      tenantId, nome: 'NOC 12x36', tipo: 'doze_por_trinta_seis',
      descricao: 'Cobertura contínua: Ana e Bruno se revezam dia sim, dia não.',
      clienteId: atlas.id,
      detalhes: { create: [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => ({ tenantId, diaSemana, horaInicio: '07:00', horaFim: '19:00' })) },
      colaboradores: {
        create: [
          { tenantId, colaboradorId: ana.id, ordem: 0, dataInicio: inicioEscala },
          { tenantId, colaboradorId: bruno.id, ordem: 1, dataInicio: inicioEscala },
        ],
      },
    },
  });

  await prisma.scale.create({
    data: {
      tenantId, nome: 'Field Service 5x2', tipo: 'cinco_por_dois',
      descricao: 'Atendimento em campo de segunda a sexta, das 08h às 17h.',
      clienteId: varejo.id,
      detalhes: { create: [1, 2, 3, 4, 5].map((diaSemana) => ({ tenantId, diaSemana, horaInicio: '08:00', horaFim: '17:00' })) },
      colaboradores: { create: [{ tenantId, colaboradorId: carla.id, ordem: 0, dataInicio: inicioEscala }] },
    },
  });

  await prisma.scale.create({
    data: {
      tenantId, nome: 'Service Desk Flex', tipo: 'personalizada',
      descricao: 'Dois turnos por dia, revezados entre Diego e Erika.',
      clienteId: atlas.id,
      detalhes: {
        create: [1, 2, 3, 4, 5].flatMap((diaSemana) => [
          { tenantId, diaSemana, horaInicio: '06:00', horaFim: '14:00' },
          { tenantId, diaSemana, horaInicio: '14:00', horaFim: '22:00' },
        ]),
      },
      colaboradores: {
        create: [
          { tenantId, colaboradorId: diego.id, ordem: 0, dataInicio: inicioEscala },
          { tenantId, colaboradorId: erika.id, ordem: 1, dataInicio: inicioEscala },
        ],
      },
    },
  });

  // Turnos concretos da semana atual, para o painel já abrir com dados reais.
  const segunda = segundaDestaSemana();
  const turnosNoc = Array.from({ length: 14 }, (_, index) => ({
    tenantId,
    colaboradorId: index % 2 === 0 ? ana.id : bruno.id,
    escalaId: escala12x36.id,
    equipeId: noc.id,
    clienteId: atlas.id,
    data: addDays(segunda, index),
    horaInicio: '07:00',
    horaFim: '19:00',
    tipo: 'turno' as const,
    status: 'planejado' as const,
  }));
  await prisma.shift.createMany({ data: turnosNoc, skipDuplicates: true });

  const turnosField = [0, 1, 2, 3, 4].map((offset) => ({
    tenantId,
    colaboradorId: carla.id,
    equipeId: field.id,
    clienteId: varejo.id,
    data: addDays(segunda, offset),
    horaInicio: '08:00',
    horaFim: '17:00',
    tipo: 'turno' as const,
    status: 'planejado' as const,
  }));
  await prisma.shift.createMany({ data: turnosField, skipDuplicates: true });

  // Um pedido de troca pendente, para o fluxo de aprovação já ter o que mostrar.
  const turnoAna = await prisma.shift.findFirst({
    where: { tenantId, colaboradorId: ana.id, data: { gte: addDays(segunda, 2) } },
    orderBy: { data: 'asc' },
  });
  const turnoBruno = await prisma.shift.findFirst({
    where: { tenantId, colaboradorId: bruno.id, data: { gte: addDays(segunda, 3) } },
    orderBy: { data: 'asc' },
  });

  if (turnoAna && turnoBruno) {
    await prisma.shiftSwap.create({
      data: {
        tenantId,
        tipo: 'troca',
        solicitanteId: ana.id,
        destinatarioId: bruno.id,
        turnoOrigemId: turnoAna.id,
        turnoDestinoId: turnoBruno.id,
        motivo: 'Consulta médica marcada nesse dia; combinei a troca com o Bruno.',
        status: 'pendente',
      },
    });
  }

  await prisma.vacation.create({
    data: {
      tenantId, colaboradorId: erika.id,
      dataInicio: addDays(segunda, 21), dataFim: addDays(segunda, 35),
      status: 'pendente', observacao: 'Férias programadas.',
    },
  });

  await prisma.absence.create({
    data: {
      tenantId, colaboradorId: diego.id,
      tipo: 'atestado', dataInicio: addDays(segunda, -3), dataFim: addDays(segunda, -2),
      motivo: 'Atestado médico de 2 dias.', status: 'aprovado',
    },
  });

  const adminHash = await bcrypt.hash(options.adminPassword, 10);
  const gestorHash = await bcrypt.hash(options.managerPassword, 10);

  const admin = await prisma.user.create({
    data: { nome: 'Administrador', email: options.adminEmail, senhaHash: adminHash, ativo: true, isGlobalAdmin: true },
  });
  const gestor = await prisma.user.create({
    data: { nome: 'Marina Gestora', email: options.managerEmail, senhaHash: gestorHash, ativo: true },
  });

  await prisma.tenantMembership.createMany({
    data: [
      { userId: admin.id, tenantId, roleId: papelAdmin.id },
      { userId: gestor.id, tenantId, roleId: papelGestor.id, colaboradorId: ana.id },
    ],
  });

  await prisma.managerTeam.createMany({
    data: [
      { tenantId, gestorId: admin.id, equipeId: noc.id },
      { tenantId, gestorId: admin.id, equipeId: field.id },
      { tenantId, gestorId: admin.id, equipeId: service.id },
      { tenantId, gestorId: gestor.id, equipeId: noc.id },
      { tenantId, gestorId: gestor.id, equipeId: service.id },
    ],
  });

  // ---- Dashboard de demonstração, compartilhado com toda a empresa ----
  // Existe para a plataforma não abrir vazia: mostra de cara o que um painel
  // montado consegue fazer, e serve de ponto de partida para o usuário copiar.
  const painel = await prisma.dashboard.create({
    data: {
      tenantId,
      nome: 'Operação NOC — visão do dia',
      descricao: 'Cobertura atual, o que vem a seguir e o que precisa de decisão.',
      ownerUserId: gestor.id,
      visibilidade: 'compartilhado',
    },
  });

  const versaoInicial = await prisma.dashboardVersion.create({
    data: {
      dashboardId: painel.id,
      versao: 1,
      nota: 'Versão inicial',
      criadoPorId: gestor.id,
      layout: {
        widgets: [
          { id: 'w-agora', tipo: 'metrica', titulo: 'Em turno agora', largura: 1, opcoes: { metrica: 'em_turno_agora' } },
          { id: 'w-trocas', tipo: 'metrica', titulo: 'Trocas pendentes', largura: 1, opcoes: { metrica: 'trocas_pendentes' } },
          { id: 'w-7dias', tipo: 'metrica', titulo: 'Turnos em 7 dias', largura: 1, opcoes: { metrica: 'turnos_7_dias' } },
          { id: 'w-ferias', tipo: 'metrica', titulo: 'Em férias hoje', largura: 1, opcoes: { metrica: 'ferias_hoje' } },
          { id: 'w-cobertura', tipo: 'em_turno_agora', titulo: 'Quem está cobrindo', largura: 2, opcoes: { limite: 8 } },
          { id: 'w-proximos', tipo: 'proximos_turnos', titulo: 'Próximos turnos', largura: 2, opcoes: { limite: 8 } },
          { id: 'w-semana', tipo: 'cobertura_semana', titulo: 'Cobertura da semana', largura: 2, opcoes: { dias: 7 } },
          { id: 'w-carga', tipo: 'carga_por_colaborador', titulo: 'Carga por colaborador', largura: 2, opcoes: { dias: 30 } },
          {
            id: 'w-nota',
            tipo: 'nota',
            titulo: 'Procedimento de escalation',
            largura: 4,
            opcoes: {
              texto:
                'Sev1: acionar o plantonista da vez e abrir ponte em até 5 min.\nSev2: registrar no ticket e escalar ao líder no início do próximo turno.\nSem resposta do plantonista em 10 min: acionar o gestor de plantão.',
            },
          },
        ],
      },
    },
  });

  await prisma.dashboard.update({ where: { id: painel.id }, data: { versaoAtualId: versaoInicial.id } });

  // Compartilhado com a empresa em leitura: todo mundo abre, só o dono edita.
  await prisma.shareGrant.create({
    data: {
      tenantId,
      recursoTipo: 'dashboard',
      recursoId: painel.id,
      escopo: 'tenant',
      acesso: 'leitura',
      criadoPorId: gestor.id,
    },
  });

  await prisma.dashboardFavorite.create({ data: { dashboardId: painel.id, userId: gestor.id } });

  if (!options.criarSegundoTenant) return { tenantId };

  // ---- Segundo tenant, só para demonstrar isolamento em desenvolvimento ----
  const tenantB = await prisma.tenant.create({ data: { nome: 'Acme Corp', slug: 'acme', ativo: true } });
  const suporte = await prisma.team.create({ data: { tenantId: tenantB.id, nome: 'Suporte Acme', ativo: true } });
  const fernanda = await prisma.collaborator.create({
    data: {
      tenantId: tenantB.id, nome: 'Fernanda Alves', email: 'fernanda.alves@acme.local', telefone: '11977776666',
      cargo: 'Analista de Suporte', equipeId: suporte.id, tipoContrato: 'clt', modeloTrabalho: 'remoto',
      fazPlantao: true, sobreAviso: false, ativo: true,
    },
  });
  const clienteAcme = await prisma.client.create({
    data: {
      tenantId: tenantB.id, nome: 'Acme Retail', idWhatsapp: '5511999991234', escalation: 'sev1@acme.local',
      responsavelInternoId: fernanda.id, ativo: true,
    },
  });
  await prisma.team.update({ where: { id: suporte.id }, data: { clienteId: clienteAcme.id } });

  const acmeAdmin = await prisma.user.create({
    data: { nome: 'Admin Acme', email: 'admin@acme.local', senhaHash: await bcrypt.hash('Acme@123', 10), ativo: true },
  });
  await prisma.tenantMembership.create({
    data: { userId: acmeAdmin.id, tenantId: tenantB.id, roleId: papelAdmin.id, colaboradorId: fernanda.id },
  });
  await prisma.managerTeam.create({ data: { tenantId: tenantB.id, gestorId: acmeAdmin.id, equipeId: suporte.id } });

  const acmeAnalista = await prisma.user.create({
    data: { nome: 'Analista Acme', email: 'analista@acme.local', senhaHash: await bcrypt.hash('Acme@123', 10), ativo: true },
  });
  await prisma.tenantMembership.create({
    data: { userId: acmeAnalista.id, tenantId: tenantB.id, roleId: papelAnalista.id, colaboradorId: fernanda.id },
  });

  return { tenantId, tenantBId: tenantB.id };
}
