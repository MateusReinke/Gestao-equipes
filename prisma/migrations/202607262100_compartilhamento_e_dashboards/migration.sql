-- Fase 4 (compartilhamento de recursos) e Fase 5 (dashboards configuráveis).
-- Cria o modelo genérico de concessão de acesso (compartilhamentos), os dashboards
-- montáveis com histórico de versões e as permissões que governam os dois.

-- CreateEnum
CREATE TYPE "ShareResourceType" AS ENUM ('dashboard', 'escala', 'relatorio');

-- CreateEnum
CREATE TYPE "ShareScope" AS ENUM ('usuario', 'equipe', 'papel', 'tenant', 'link_publico', 'plataforma');

-- CreateEnum
CREATE TYPE "ShareAccess" AS ENUM ('leitura', 'edicao', 'gestao');

-- CreateEnum
CREATE TYPE "DashboardVisibility" AS ENUM ('privado', 'compartilhado');

-- CreateTable
CREATE TABLE "compartilhamentos" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "recurso_tipo" "ShareResourceType" NOT NULL,
    "recurso_id" INTEGER NOT NULL,
    "escopo" "ShareScope" NOT NULL,
    "usuario_id" INTEGER,
    "equipe_id" INTEGER,
    "papel_id" INTEGER,
    "token" TEXT,
    "acesso" "ShareAccess" NOT NULL DEFAULT 'leitura',
    "expira_em" TIMESTAMP(3),
    "criado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compartilhamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboards" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "owner_user_id" INTEGER NOT NULL,
    "visibilidade" "DashboardVisibility" NOT NULL DEFAULT 'privado',
    "versao_atual_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_versoes" (
    "id" SERIAL NOT NULL,
    "dashboard_id" INTEGER NOT NULL,
    "versao" INTEGER NOT NULL,
    "layout" JSONB NOT NULL,
    "nota" TEXT,
    "criado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_versoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_favoritos" (
    "id" SERIAL NOT NULL,
    "dashboard_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_favoritos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "compartilhamentos_token_key" ON "compartilhamentos"("token");

-- CreateIndex
CREATE INDEX "compartilhamentos_tenant_id_recurso_tipo_recurso_id_idx" ON "compartilhamentos"("tenant_id", "recurso_tipo", "recurso_id");

-- CreateIndex
CREATE INDEX "compartilhamentos_usuario_id_idx" ON "compartilhamentos"("usuario_id");

-- CreateIndex
CREATE INDEX "compartilhamentos_equipe_id_idx" ON "compartilhamentos"("equipe_id");

-- CreateIndex
CREATE INDEX "compartilhamentos_papel_id_idx" ON "compartilhamentos"("papel_id");

-- CreateIndex
CREATE UNIQUE INDEX "dashboards_versao_atual_id_key" ON "dashboards"("versao_atual_id");

-- CreateIndex
CREATE INDEX "dashboards_tenant_id_idx" ON "dashboards"("tenant_id");

-- CreateIndex
CREATE INDEX "dashboards_tenant_id_owner_user_id_idx" ON "dashboards"("tenant_id", "owner_user_id");

-- CreateIndex
CREATE INDEX "dashboard_versoes_dashboard_id_idx" ON "dashboard_versoes"("dashboard_id");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_versoes_dashboard_id_versao_key" ON "dashboard_versoes"("dashboard_id", "versao");

-- CreateIndex
CREATE INDEX "dashboard_favoritos_user_id_idx" ON "dashboard_favoritos"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_favoritos_dashboard_id_user_id_key" ON "dashboard_favoritos"("dashboard_id", "user_id");

-- AddForeignKey
ALTER TABLE "compartilhamentos" ADD CONSTRAINT "compartilhamentos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compartilhamentos" ADD CONSTRAINT "compartilhamentos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compartilhamentos" ADD CONSTRAINT "compartilhamentos_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compartilhamentos" ADD CONSTRAINT "compartilhamentos_papel_id_fkey" FOREIGN KEY ("papel_id") REFERENCES "papeis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compartilhamentos" ADD CONSTRAINT "compartilhamentos_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_versao_atual_id_fkey" FOREIGN KEY ("versao_atual_id") REFERENCES "dashboard_versoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_versoes" ADD CONSTRAINT "dashboard_versoes_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_versoes" ADD CONSTRAINT "dashboard_versoes_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_favoritos" ADD CONSTRAINT "dashboard_favoritos_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_favoritos" ADD CONSTRAINT "dashboard_favoritos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------- Novas permissões ----------
INSERT INTO "permissoes" ("codigo", "descricao", "categoria") VALUES
  ('dashboard.create', 'Criar dashboards personalizados', 'Dashboard'),
  ('dashboard.edit', 'Editar dashboards e publicar novas versões', 'Dashboard'),
  ('dashboard.delete', 'Remover dashboards', 'Dashboard'),
  ('dashboard.share', 'Compartilhar dashboards com outras pessoas', 'Dashboard'),
  ('share.manage', 'Administrar compartilhamentos de recursos da empresa', 'Compartilhamento')
ON CONFLICT ("codigo") DO NOTHING;

-- Administrador da Empresa: todas as novas permissões
INSERT INTO "papel_permissoes" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "papeis" r CROSS JOIN "permissoes" p
WHERE r."codigo" = 'admin_tenant' AND r."tenant_id" IS NULL
  AND p."codigo" IN ('dashboard.create', 'dashboard.edit', 'dashboard.delete', 'dashboard.share', 'share.manage')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- Gestor: monta e compartilha dashboards, e administra o que foi compartilhado na empresa
INSERT INTO "papel_permissoes" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "papeis" r CROSS JOIN "permissoes" p
WHERE r."codigo" = 'gestor' AND r."tenant_id" IS NULL
  AND p."codigo" IN ('dashboard.create', 'dashboard.edit', 'dashboard.delete', 'dashboard.share', 'share.manage')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- Líder: monta e compartilha os próprios dashboards
INSERT INTO "papel_permissoes" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "papeis" r CROSS JOIN "permissoes" p
WHERE r."codigo" = 'lider' AND r."tenant_id" IS NULL
  AND p."codigo" IN ('dashboard.create', 'dashboard.edit', 'dashboard.delete', 'dashboard.share')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- Analista: monta dashboards para si (a autoria é checada no serviço)
INSERT INTO "papel_permissoes" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "papeis" r CROSS JOIN "permissoes" p
WHERE r."codigo" = 'analista' AND r."tenant_id" IS NULL
  AND p."codigo" IN ('dashboard.create', 'dashboard.edit', 'dashboard.delete')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- Papéis customizados já existentes que espelham um papel de sistema não são tocados:
-- cada empresa decide se quer conceder as novas permissões.
