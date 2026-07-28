-- Grupos do diretório.
--
-- Ficaram de fora da migration da Fase A de propósito: a forma útil dependia
-- de decisões que só agora estão tomadas — em especial, se membros de grupos
-- aninhados seriam resolvidos recursivamente. Não são: só membros diretos.
-- Resolver aninhamento exigiria decidir o que fazer com ciclos, e é problema
-- que não vale pagar antes de alguém precisar.
--
-- Um grupo do Entra NÃO é uma equipe operacional, e nada aqui escreve em
-- `equipes`. Grupo do diretório descreve como a TI organiza acesso; equipe
-- operacional descreve quem cobre qual plantão. As duas coisas costumam estar
-- desalinhadas numa empresa real, e forçar o alinhamento quebraria a escala.

-- CreateTable
CREATE TABLE "diretorio_grupos" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "connection_id" INTEGER NOT NULL,
    "external_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "email" TEXT,
    "tipo" TEXT,
    "bruto" JSONB,
    "removido_em" TIMESTAMP(3),
    "primeira_vez_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_vez_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diretorio_grupos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diretorio_grupo_membros" (
    "id" SERIAL NOT NULL,
    "grupo_id" INTEGER NOT NULL,
    "pessoa_id" INTEGER NOT NULL,
    "tenant_id" INTEGER NOT NULL,

    CONSTRAINT "diretorio_grupo_membros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diretorio_grupos_tenant_id_idx" ON "diretorio_grupos"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "diretorio_grupos_connection_id_external_id_key" ON "diretorio_grupos"("connection_id", "external_id");

-- CreateIndex
-- Serve a "de quais grupos esta pessoa participa", que é a consulta da tela.
CREATE INDEX "diretorio_grupo_membros_pessoa_id_idx" ON "diretorio_grupo_membros"("pessoa_id");

-- CreateIndex
CREATE INDEX "diretorio_grupo_membros_tenant_id_idx" ON "diretorio_grupo_membros"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "diretorio_grupo_membros_grupo_id_pessoa_id_key" ON "diretorio_grupo_membros"("grupo_id", "pessoa_id");

-- AddForeignKey
ALTER TABLE "diretorio_grupos" ADD CONSTRAINT "diretorio_grupos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diretorio_grupos" ADD CONSTRAINT "diretorio_grupos_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "diretorio_conexoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diretorio_grupo_membros" ADD CONSTRAINT "diretorio_grupo_membros_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "diretorio_grupos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diretorio_grupo_membros" ADD CONSTRAINT "diretorio_grupo_membros_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "diretorio_pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diretorio_grupo_membros" ADD CONSTRAINT "diretorio_grupo_membros_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
