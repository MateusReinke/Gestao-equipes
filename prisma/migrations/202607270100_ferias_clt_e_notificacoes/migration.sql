-- Módulo de férias segundo a CLT + notificações no app.
--
-- Os períodos aquisitivo e concessivo NÃO viram tabela: são derivados da
-- data de admissão e calculados na leitura. Armazená-los exigiria manter
-- sincronizado algo que já é determinístico. Só o que não é derivável
-- ganha tabela: o ajuste manual de direito (ferias_ajustes).

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('info', 'aviso', 'critico');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ferias_direito_adquirido', 'ferias_prazo_proximo', 'ferias_prazo_critico', 'ferias_vencida', 'ferias_pendente_aprovacao', 'ausencia_pendente_aprovacao', 'troca_pendente_aprovacao');

-- AlterTable
ALTER TABLE "colaboradores" ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "data_admissao" DATE,
ADD COLUMN     "data_desligamento" DATE,
ADD COLUMN     "data_nascimento" DATE,
ADD COLUMN     "matricula" TEXT;

-- AlterTable
ALTER TABLE "ferias" ADD COLUMN     "ciclo_numero" INTEGER,
ADD COLUMN     "dias_abono" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ferias_ajustes" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "colaborador_id" INTEGER NOT NULL,
    "ciclo_numero" INTEGER NOT NULL,
    "dias_delta" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "registrado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ferias_ajustes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "destinatario_id" INTEGER NOT NULL,
    "tipo" "NotificationType" NOT NULL,
    "severidade" "NotificationSeverity" NOT NULL DEFAULT 'info',
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "link" TEXT,
    "entidade" TEXT,
    "entidade_id" TEXT,
    "chave_idempotencia" TEXT NOT NULL,
    "lida_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ferias_ajustes_tenant_id_colaborador_id_idx" ON "ferias_ajustes"("tenant_id", "colaborador_id");

-- CreateIndex
CREATE INDEX "notificacoes_destinatario_id_lida_em_created_at_idx" ON "notificacoes"("destinatario_id", "lida_em", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notificacoes_tenant_id_idx" ON "notificacoes"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "notificacoes_destinatario_id_chave_idempotencia_key" ON "notificacoes"("destinatario_id", "chave_idempotencia");

-- AddForeignKey
ALTER TABLE "ferias_ajustes" ADD CONSTRAINT "ferias_ajustes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ferias_ajustes" ADD CONSTRAINT "ferias_ajustes_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ferias_ajustes" ADD CONSTRAINT "ferias_ajustes_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------- Novas permissões ----------
INSERT INTO "permissoes" ("codigo", "descricao", "categoria") VALUES
  ('hr.vacation.adjust', 'Ajustar manualmente o direito a férias de um ciclo', 'RH'),
  ('hr.employee.manage', 'Editar o cadastro funcional (admissão, matrícula, CPF)', 'RH')
ON CONFLICT ("codigo") DO NOTHING;

-- Administrador da Empresa e Gestor administram o cadastro funcional e o saldo.
INSERT INTO "papel_permissoes" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "papeis" r CROSS JOIN "permissoes" p
WHERE r."codigo" IN ('admin_tenant', 'gestor') AND r."tenant_id" IS NULL
  AND p."codigo" IN ('hr.vacation.adjust', 'hr.employee.manage')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- ---------- Classificação dos registros de férias antigos ----------
-- Associa cada gozo já existente ao ciclo cujo período concessivo o contém.
-- O ciclo N vai de (admissao + 12*N meses) até (admissao + 12*(N+1) meses - 1 dia).
-- Sem data de admissão não há como classificar: fica nulo, e a tela mostra
-- "ciclo não identificado" até alguém preencher a admissão.
UPDATE "ferias" f
SET "ciclo_numero" = sub."ciclo"
FROM (
  SELECT f2."id",
         FLOOR(
           EXTRACT(YEAR FROM AGE(f2."data_inicio", c."data_admissao")) * 12
           + EXTRACT(MONTH FROM AGE(f2."data_inicio", c."data_admissao"))
         )::int / 12 AS "ciclo"
  FROM "ferias" f2
  JOIN "colaboradores" c ON c."id" = f2."colaborador_id"
  WHERE c."data_admissao" IS NOT NULL
) sub
WHERE f."id" = sub."id" AND sub."ciclo" >= 1;
