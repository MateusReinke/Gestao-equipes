import { PrismaClient } from '@prisma/client';
import { seedDemoData } from './seed-data';

const prisma = new PrismaClient();

/**
 * Reset destrutivo do dataset de demonstração - uso exclusivo em desenvolvimento local.
 * Apaga e recria todos os dados operacionais, incluindo dois tenants (para testar isolamento).
 * NUNCA é chamado pelo entrypoint.sh nem deve ser usado em produção.
 */
async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[seed:dev:reset] Recusado: este script apaga todos os dados e não deve rodar em produção.');
  }

  console.warn('[seed:dev:reset] Apagando dados operacionais e recriando o dataset de demonstração...');

  // Ordem importa: filhos antes dos pais, por causa das foreign keys.
  await prisma.auditLog.deleteMany();
  await prisma.shiftSwap.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.onCall.deleteMany();
  await prisma.absence.deleteMany();
  await prisma.vacation.deleteMany();
  await prisma.scaleDetail.deleteMany();
  await prisma.scaleAssignment.deleteMany();
  await prisma.scale.deleteMany();
  await prisma.managerTeam.deleteMany();
  await prisma.userPermissionOverride.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.client.deleteMany();
  await prisma.collaborator.deleteMany();
  await prisma.team.deleteMany();
  // Papéis customizados de tenant saem junto; os de sistema (tenantId null) ficam.
  await prisma.role.deleteMany({ where: { tenantId: { not: null } } });
  await prisma.tenant.deleteMany();

  await seedDemoData(prisma, {
    adminEmail: 'admin@gestao.local',
    adminPassword: 'Admin@123',
    managerEmail: 'gestor@gestao.local',
    managerPassword: 'Gestor@123',
    criarSegundoTenant: true,
  });

  console.log('[seed:dev:reset] Concluído.');
  console.log('  Empresa Padrão  -> admin@gestao.local / Admin@123 (Administrador Global)');
  console.log('                  -> gestor@gestao.local / Gestor@123 (Gestor)');
  console.log('  Acme Corp       -> admin@acme.local / Acme@123 (Administrador da Empresa)');
  console.log('                  -> analista@acme.local / Acme@123 (Analista)');
}

main()
  .catch((error) => {
    console.error('[seed:dev:reset] Falhou:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
