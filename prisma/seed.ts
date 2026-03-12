import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const equipes = ['NOC', 'Infraestrutura', 'Service Desk'];
  for (const nome of equipes) {
    await prisma.team.upsert({
      where: { id: equipes.indexOf(nome) + 1 },
      update: { nome },
      create: { nome, descricao: `Equipe ${nome}`, ativo: true },
    });
  }

  const turnos = [
    { nome: 'T1', horaInicio: '08:00', horaFim: '17:00', descricao: 'Turno comercial', tipo: 'normal' as const },
    { nome: 'T2', horaInicio: '17:00', horaFim: '01:00', descricao: 'Turno tarde/noite', tipo: 'normal' as const },
    { nome: 'T3', horaInicio: '01:00', horaFim: '08:00', descricao: 'Turno madrugada', tipo: 'normal' as const },
    { nome: 'Plantão', horaInicio: '00:00', horaFim: '23:59', descricao: 'Plantão diário', tipo: 'plantao' as const },
  ];

  for (const turno of turnos) {
    await prisma.shift.upsert({
      where: { nome: turno.nome },
      update: turno,
      create: turno,
    });
  }

  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@gestaoescala.local' },
    update: { nome: 'Administrador', role: 'admin', ativo: true, senhaHash: adminPasswordHash },
    create: {
      nome: 'Administrador',
      email: 'admin@gestaoescala.local',
      senhaHash: adminPasswordHash,
      role: 'admin',
      ativo: true,
    },
  });
}

main().finally(() => prisma.$disconnect());
