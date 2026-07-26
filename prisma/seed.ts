import { PrismaClient } from '@prisma/client';
import { seedDemoData } from './seed-data';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@gestao.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
const MANAGER_EMAIL = process.env.SEED_MANAGER_EMAIL || 'gestor@gestao.local';
const MANAGER_PASSWORD = process.env.SEED_MANAGER_PASSWORD || 'Gestor@123';

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

  await seedDemoData(prisma, {
    adminEmail: ADMIN_EMAIL,
    adminPassword: ADMIN_PASSWORD,
    managerEmail: MANAGER_EMAIL,
    managerPassword: MANAGER_PASSWORD,
  });

  console.log('[seed] Concluído.');
}

main()
  .catch((error) => {
    console.error('[seed] Falhou:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
