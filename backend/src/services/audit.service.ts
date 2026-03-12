import { prisma } from '../config/prisma';

type AuditInput = {
  usuario: string;
  acao: string;
  tabela: string;
  registroId?: string;
  dadosAnteriores?: unknown;
  dadosNovos?: unknown;
};

export async function registerAudit(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      usuario: input.usuario,
      acao: input.acao,
      tabela: input.tabela,
      registroId: input.registroId,
      dadosAnteriores: input.dadosAnteriores as object | undefined,
      dadosNovos: input.dadosNovos as object | undefined,
    },
  });
}
