import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const equipes = ['NOC', 'Infraestrutura', 'Service Desk'];
  for (const nome of equipes) {
    await prisma.team.upsert({
      where: { id: equipes.indexOf(nome) + 1 },
      update: {},
      create: { nome: `Equipe ${nome}` },
    });
  }

  const turnos = [
    { nome: 'T1', horaInicio: '08:00', horaFim: '17:00', descricao: 'Turno comercial' },
    { nome: 'T2', horaInicio: '17:00', horaFim: '01:00', descricao: 'Turno tarde/noite' },
    { nome: 'T3', horaInicio: '01:00', horaFim: '08:00', descricao: 'Turno madrugada' },
    { nome: 'Plantão', horaInicio: '00:00', horaFim: '23:59', descricao: 'Sobreaviso' },
  ];

  for (const turno of turnos) {
    await prisma.shift.upsert({
      where: { nome: turno.nome },
      update: turno,
      create: turno,
    });
  }

  const weekday = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  for (let i = 0; i < weekday.length; i++) {
    await prisma.weekdayConfig.upsert({
      where: { diaSemana: i },
      update: { descricao: weekday[i], ativo: i !== 0 && i !== 6 },
      create: { diaSemana: i, descricao: weekday[i], ativo: i !== 0 && i !== 6 },
    });
  }
}

main().finally(() => prisma.$disconnect());
