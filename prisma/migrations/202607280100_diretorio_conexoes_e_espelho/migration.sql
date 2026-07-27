-- Módulo de diretório: conexão com provedor de identidade e espelho dos dados.
--
-- Tudo que entra aqui é RÉPLICA do provedor (Entra ID hoje; Google, Okta e
-- LDAP depois). O motor de sincronização escreve exclusivamente nestas
-- tabelas e não tem alcance sobre colaboradores, equipes, escalas, turnos,
-- férias, plantões, aprovações, clientes, SLA ou indicadores.
--
-- A única passagem entre os dois mundos é diretorio_pessoas.colaborador_id, e
-- atravessá-la é ato explícito da reconciliação (Fase D), com lista fechada de
-- campos e trava por campo. Por isso um diretório de 5.000 contas não vira
-- 5.000 colaboradores.
--
-- Grupos ficaram de fora desta migration de propósito: são da Fase E e a
-- forma útil depende de decisões que ainda não foram tomadas (grupos
-- aninhados, dinâmicos, atribuídos).

-- CreateEnum
CREATE TYPE "DirectoryProviderType" AS ENUM ('entra', 'google', 'okta', 'ldap');

-- CreateEnum
CREATE TYPE "DirectorySyncMode" AS ENUM ('completa', 'incremental');

-- CreateEnum
CREATE TYPE "DirectorySyncStatus" AS ENUM ('executando', 'sucesso', 'parcial', 'erro');

-- CreateEnum
CREATE TYPE "DirectorySyncLevel" AS ENUM ('info', 'aviso', 'erro');

-- CreateTable
-- As credenciais moram no banco, e não no ambiente, porque cada empresa do
-- SaaS tem o próprio tenant Entra e a própria App Registration. O segredo vai
-- cifrado (AES-256-GCM) com chave que fica fora do banco.
CREATE TABLE "diretorio_conexoes" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "provider" "DirectoryProviderType" NOT NULL DEFAULT 'entra',
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "provedor_tenant_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret_cifrado" TEXT NOT NULL,
    "authority_url" TEXT,
    "opcoes" JSONB NOT NULL,
    "equipe_padrao_id" INTEGER,
    "cursor_pessoas" TEXT,
    "cursor_grupos" TEXT,
    "ultima_sincronizacao_em" TIMESTAMP(3),
    "ultimo_teste_em" TIMESTAMP(3),
    "ultimo_teste_ok" BOOLEAN,
    "ultimo_erro" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diretorio_conexoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diretorio_pessoas" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "connection_id" INTEGER NOT NULL,
    "external_id" TEXT NOT NULL,
    "nome_exibicao" TEXT NOT NULL,
    "primeiro_nome" TEXT,
    "sobrenome" TEXT,
    "email" TEXT,
    "user_principal_name" TEXT,
    "cargo" TEXT,
    "departamento" TEXT,
    "empresa" TEXT,
    "escritorio" TEXT,
    "telefone" TEXT,
    "celular" TEXT,
    "pais" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "idioma" TEXT,
    "fuso_horario" TEXT,
    "conta_habilitada" BOOLEAN NOT NULL DEFAULT true,
    "gestor_external_id" TEXT,
    "foto_etag" TEXT,
    "foto_atualizada_em" TIMESTAMP(3),
    "colaborador_id" INTEGER,
    "campos_bloqueados" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bruto" JSONB,
    "removido_em" TIMESTAMP(3),
    "primeira_vez_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_vez_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diretorio_pessoas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Departamento não é objeto no Microsoft Graph: é string livre no usuário, e
-- não existe endpoint /departments. O catálogo é derivado dos valores
-- distintos, e "deixou de existir" vira ativo=false, nunca DELETE.
CREATE TABLE "diretorio_departamentos" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "connection_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "pessoas" INTEGER NOT NULL DEFAULT 0,
    "mesclado_em_id" INTEGER,
    "primeira_vez_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_vez_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diretorio_departamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Cargo pela mesma razão do departamento. Informativo por definição: quem
-- controla permissão nesta aplicação é o papel do RBAC, nunca o cargo.
CREATE TABLE "diretorio_cargos" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "connection_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "pessoas" INTEGER NOT NULL DEFAULT 0,
    "primeira_vez_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_vez_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diretorio_cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diretorio_execucoes" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "connection_id" INTEGER NOT NULL,
    "modo" "DirectorySyncMode" NOT NULL,
    "status" "DirectorySyncStatus" NOT NULL DEFAULT 'executando',
    "disparado_por_id" INTEGER,
    "objetos_lidos" INTEGER NOT NULL DEFAULT 0,
    "objetos_criados" INTEGER NOT NULL DEFAULT 0,
    "objetos_atualizados" INTEGER NOT NULL DEFAULT 0,
    "objetos_inalterados" INTEGER NOT NULL DEFAULT 0,
    "objetos_removidos" INTEGER NOT NULL DEFAULT 0,
    "conflitos" INTEGER NOT NULL DEFAULT 0,
    "detalhes" JSONB,
    "erro" TEXT,
    "iniciado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizado_em" TIMESTAMP(3),

    CONSTRAINT "diretorio_execucoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Separado de "auditoria" de propósito: milhares de linhas de robô misturadas
-- ao rastro de ações humanas inutilizariam as duas consultas.
CREATE TABLE "diretorio_execucao_eventos" (
    "id" SERIAL NOT NULL,
    "run_id" INTEGER NOT NULL,
    "nivel" "DirectorySyncLevel" NOT NULL DEFAULT 'info',
    "entidade" TEXT NOT NULL,
    "external_id" TEXT,
    "acao" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "dados" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diretorio_execucao_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diretorio_conexoes_tenant_id_idx" ON "diretorio_conexoes"("tenant_id");

-- CreateIndex
-- Uma conexão por provedor por empresa: abre espaço para Entra e Google
-- convivendo no mesmo tenant sem mudar o modelo.
CREATE UNIQUE INDEX "diretorio_conexoes_tenant_id_provider_key" ON "diretorio_conexoes"("tenant_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "diretorio_pessoas_colaborador_id_key" ON "diretorio_pessoas"("colaborador_id");

-- CreateIndex
CREATE INDEX "diretorio_pessoas_tenant_id_idx" ON "diretorio_pessoas"("tenant_id");

-- CreateIndex
-- Serve o agrupamento por departamento na tela do espelho.
CREATE INDEX "diretorio_pessoas_connection_id_departamento_idx" ON "diretorio_pessoas"("connection_id", "departamento");

-- CreateIndex
-- Serve a montagem do organograma: "quem reporta a esta pessoa".
CREATE INDEX "diretorio_pessoas_connection_id_gestor_external_id_idx" ON "diretorio_pessoas"("connection_id", "gestor_external_id");

-- CreateIndex
-- O Object ID é a chave de vínculo, escopada à conexão. Nunca e-mail ou nome:
-- os dois mudam ao longo do tempo e reapontariam o vínculo para outra pessoa.
CREATE UNIQUE INDEX "diretorio_pessoas_connection_id_external_id_key" ON "diretorio_pessoas"("connection_id", "external_id");

-- CreateIndex
CREATE INDEX "diretorio_departamentos_tenant_id_idx" ON "diretorio_departamentos"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "diretorio_departamentos_connection_id_nome_key" ON "diretorio_departamentos"("connection_id", "nome");

-- CreateIndex
CREATE INDEX "diretorio_cargos_tenant_id_idx" ON "diretorio_cargos"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "diretorio_cargos_connection_id_nome_key" ON "diretorio_cargos"("connection_id", "nome");

-- CreateIndex
CREATE INDEX "diretorio_execucoes_tenant_id_iniciado_em_idx" ON "diretorio_execucoes"("tenant_id", "iniciado_em" DESC);

-- CreateIndex
CREATE INDEX "diretorio_execucoes_connection_id_iniciado_em_idx" ON "diretorio_execucoes"("connection_id", "iniciado_em" DESC);

-- CreateIndex
CREATE INDEX "diretorio_execucao_eventos_run_id_nivel_idx" ON "diretorio_execucao_eventos"("run_id", "nivel");

-- AddForeignKey
ALTER TABLE "diretorio_conexoes" ADD CONSTRAINT "diretorio_conexoes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diretorio_conexoes" ADD CONSTRAINT "diretorio_conexoes_equipe_padrao_id_fkey" FOREIGN KEY ("equipe_padrao_id") REFERENCES "equipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diretorio_pessoas" ADD CONSTRAINT "diretorio_pessoas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diretorio_pessoas" ADD CONSTRAINT "diretorio_pessoas_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "diretorio_conexoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- SET NULL, e não CASCADE: apagar um colaborador desfaz o vínculo, mas a
-- pessoa continua no espelho. O diretório não é nosso para apagar.
ALTER TABLE "diretorio_pessoas" ADD CONSTRAINT "diretorio_pessoas_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diretorio_departamentos" ADD CONSTRAINT "diretorio_departamentos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diretorio_departamentos" ADD CONSTRAINT "diretorio_departamentos_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "diretorio_conexoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diretorio_departamentos" ADD CONSTRAINT "diretorio_departamentos_mesclado_em_id_fkey" FOREIGN KEY ("mesclado_em_id") REFERENCES "diretorio_departamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diretorio_cargos" ADD CONSTRAINT "diretorio_cargos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diretorio_cargos" ADD CONSTRAINT "diretorio_cargos_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "diretorio_conexoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diretorio_execucoes" ADD CONSTRAINT "diretorio_execucoes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diretorio_execucoes" ADD CONSTRAINT "diretorio_execucoes_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "diretorio_conexoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diretorio_execucoes" ADD CONSTRAINT "diretorio_execucoes_disparado_por_id_fkey" FOREIGN KEY ("disparado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diretorio_execucao_eventos" ADD CONSTRAINT "diretorio_execucao_eventos_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "diretorio_execucoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------- Novas permissões ----------
-- Separadas de propósito: ver o espelho é inofensivo, configurar credencial
-- não é, e reconciliar é a única que alcança dado operacional.
INSERT INTO "permissoes" ("codigo", "descricao", "categoria") VALUES
  ('directory.view', 'Ver o diretório sincronizado e o histórico de execuções', 'Diretório'),
  ('directory.manage', 'Configurar a conexão com o provedor de identidade', 'Diretório'),
  ('directory.sync', 'Disparar a sincronização manualmente', 'Diretório'),
  ('directory.reconcile', 'Vincular pessoas do diretório a colaboradores', 'Diretório')
ON CONFLICT ("codigo") DO NOTHING;

-- Só o Administrador da Empresa configura credencial. O Gestor enxerga o
-- diretório, dispara sincronização e reconcilia, mas não vê nem troca segredo.
INSERT INTO "papel_permissoes" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "papeis" r CROSS JOIN "permissoes" p
WHERE r."codigo" = 'admin_tenant' AND r."tenant_id" IS NULL
  AND p."codigo" IN ('directory.view', 'directory.manage', 'directory.sync', 'directory.reconcile')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "papel_permissoes" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "papeis" r CROSS JOIN "permissoes" p
WHERE r."codigo" = 'gestor' AND r."tenant_id" IS NULL
  AND p."codigo" IN ('directory.view', 'directory.sync', 'directory.reconcile')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
