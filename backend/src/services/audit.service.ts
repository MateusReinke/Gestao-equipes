import { prisma } from '../config/prisma';

export async function registerAudit(entidade: string, acao: string, detalhes?: unknown) {
  await prisma.auditLog.create({
    data: { entidade, acao, detalhes: detalhes as object | undefined },
  });
}
