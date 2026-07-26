-- ============================================================
-- Fase 2: fundação multi-tenant.
-- Cria o tenant "default" e migra TODO o dado já existente para ele,
-- sem apagar nada. Segura para rodar contra uma base já em produção.
-- ============================================================

-- CreateTable: tenants
CREATE TABLE "tenants" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- Seed do tenant default: todo dado pré-existente pertence a ele.
INSERT INTO "tenants" ("nome", "slug", "ativo", "created_at", "updated_at")
VALUES ('Empresa Padrão', 'default', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- usuarios: identidade global de agora em diante.
ALTER TABLE "usuarios" ADD COLUMN "is_global_admin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: tenant_memberships (vínculo usuário<->tenant + papel dentro do tenant)
CREATE TABLE "tenant_memberships" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "role" "UserRole" NOT NULL,
    "colaborador_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_memberships_user_id_tenant_id_key" ON "tenant_memberships"("user_id", "tenant_id");
CREATE INDEX "tenant_memberships_tenant_id_idx" ON "tenant_memberships"("tenant_id");

-- Migra todo usuário existente para um vínculo no tenant default,
-- preservando o papel e o colaborador vinculado que já tinham.
INSERT INTO "tenant_memberships" ("user_id", "tenant_id", "role", "colaborador_id", "created_at", "updated_at")
SELECT "id", (SELECT "id" FROM "tenants" WHERE "slug" = 'default'), "role", "colaborador_id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "usuarios";

-- Quem já era 'admin' vira Administrador Global (mantém também o vínculo
-- de tenant criado acima, então nada muda operacionalmente para eles).
UPDATE "usuarios" SET "is_global_admin" = true WHERE "id" IN (
    SELECT "user_id" FROM "tenant_memberships" WHERE "role" = 'admin'
);

-- role e colaborador_id agora vivem em tenant_memberships.
ALTER TABLE "usuarios" DROP COLUMN "role";
ALTER TABLE "usuarios" DROP COLUMN "colaborador_id";

-- AddForeignKey: tenant_memberships
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- tenant_id em toda tabela de domínio: adiciona nullable, faz backfill
-- para o tenant default, só então torna NOT NULL. Nenhuma linha é apagada.
-- ============================================================

-- clientes
ALTER TABLE "clientes" ADD COLUMN "tenant_id" INTEGER;
UPDATE "clientes" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default');
ALTER TABLE "clientes" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "clientes_tenant_id_idx" ON "clientes"("tenant_id");

-- equipes
ALTER TABLE "equipes" ADD COLUMN "tenant_id" INTEGER;
UPDATE "equipes" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default');
ALTER TABLE "equipes" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "equipes_tenant_id_idx" ON "equipes"("tenant_id");

-- colaboradores
ALTER TABLE "colaboradores" ADD COLUMN "tenant_id" INTEGER;
UPDATE "colaboradores" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default');
ALTER TABLE "colaboradores" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "colaboradores_tenant_id_idx" ON "colaboradores"("tenant_id");

-- colaboradores.email deixa de ser único globalmente e passa a ser único por tenant
DROP INDEX "colaboradores_email_key";
CREATE UNIQUE INDEX "colaboradores_tenant_id_email_key" ON "colaboradores"("tenant_id", "email");

-- gestor_equipes
ALTER TABLE "gestor_equipes" ADD COLUMN "tenant_id" INTEGER;
UPDATE "gestor_equipes" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default');
ALTER TABLE "gestor_equipes" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "gestor_equipes" ADD CONSTRAINT "gestor_equipes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "gestor_equipes_tenant_id_idx" ON "gestor_equipes"("tenant_id");

-- escalas
ALTER TABLE "escalas" ADD COLUMN "tenant_id" INTEGER;
UPDATE "escalas" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default');
ALTER TABLE "escalas" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "escalas" ADD CONSTRAINT "escalas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "escalas_tenant_id_idx" ON "escalas"("tenant_id");

-- escala_colaboradores
ALTER TABLE "escala_colaboradores" ADD COLUMN "tenant_id" INTEGER;
UPDATE "escala_colaboradores" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default');
ALTER TABLE "escala_colaboradores" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "escala_colaboradores" ADD CONSTRAINT "escala_colaboradores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "escala_colaboradores_tenant_id_idx" ON "escala_colaboradores"("tenant_id");

-- escala_detalhe
ALTER TABLE "escala_detalhe" ADD COLUMN "tenant_id" INTEGER;
UPDATE "escala_detalhe" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default');
ALTER TABLE "escala_detalhe" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "escala_detalhe" ADD CONSTRAINT "escala_detalhe_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "escala_detalhe_tenant_id_idx" ON "escala_detalhe"("tenant_id");

-- plantoes
ALTER TABLE "plantoes" ADD COLUMN "tenant_id" INTEGER;
UPDATE "plantoes" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default');
ALTER TABLE "plantoes" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "plantoes" ADD CONSTRAINT "plantoes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "plantoes_tenant_id_data_idx" ON "plantoes"("tenant_id", "data");

-- ferias
ALTER TABLE "ferias" ADD COLUMN "tenant_id" INTEGER;
UPDATE "ferias" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default');
ALTER TABLE "ferias" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "ferias" ADD CONSTRAINT "ferias_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ferias_tenant_id_idx" ON "ferias"("tenant_id");
