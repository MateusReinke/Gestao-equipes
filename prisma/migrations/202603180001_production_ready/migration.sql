-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'gestor');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('clt', 'pj', 'terceirizado', 'estagio');

-- CreateEnum
CREATE TYPE "WorkModel" AS ENUM ('presencial', 'hibrido', 'remoto');

-- CreateEnum
CREATE TYPE "ScaleType" AS ENUM ('doze_por_trinta_seis', 'cinco_por_dois', 'personalizada');

-- CreateEnum
CREATE TYPE "OnCallType" AS ENUM ('plantao', 'sobreaviso');

-- CreateEnum
CREATE TYPE "VacationStatus" AS ENUM ('pendente', 'aprovado', 'rejeitado');

-- CreateTable
CREATE TABLE "clientes" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "id_whatsapp" TEXT NOT NULL,
    "escalation" TEXT NOT NULL,
    "responsavel_interno_id" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipes" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cliente_id" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaboradores" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "equipe_id" INTEGER NOT NULL,
    "tipo_contrato" "ContractType" NOT NULL,
    "modelo_trabalho" "WorkModel" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colaboradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "colaborador_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestor_equipes" (
    "id" SERIAL NOT NULL,
    "gestor_id" INTEGER NOT NULL,
    "equipe_id" INTEGER NOT NULL,

    CONSTRAINT "gestor_equipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalas" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "ScaleType" NOT NULL,
    "descricao" TEXT NOT NULL,
    "cliente_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escalas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escala_colaboradores" (
    "id" SERIAL NOT NULL,
    "colaborador_id" INTEGER NOT NULL,
    "escala_id" INTEGER NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE,

    CONSTRAINT "escala_colaboradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escala_detalhe" (
    "id" SERIAL NOT NULL,
    "escala_id" INTEGER NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fim" TEXT NOT NULL,

    CONSTRAINT "escala_detalhe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantoes" (
    "id" SERIAL NOT NULL,
    "colaborador_id" INTEGER NOT NULL,
    "cliente_id" INTEGER,
    "data" DATE NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fim" TEXT NOT NULL,
    "tipo" "OnCallType" NOT NULL,

    CONSTRAINT "plantoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ferias" (
    "id" SERIAL NOT NULL,
    "colaborador_id" INTEGER NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "status" "VacationStatus" NOT NULL,

    CONSTRAINT "ferias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "colaboradores_email_key" ON "colaboradores"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "gestor_equipes_gestor_id_equipe_id_key" ON "gestor_equipes"("gestor_id", "equipe_id");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_responsavel_interno_id_fkey" FOREIGN KEY ("responsavel_interno_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestor_equipes" ADD CONSTRAINT "gestor_equipes_gestor_id_fkey" FOREIGN KEY ("gestor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestor_equipes" ADD CONSTRAINT "gestor_equipes_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalas" ADD CONSTRAINT "escalas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala_colaboradores" ADD CONSTRAINT "escala_colaboradores_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala_colaboradores" ADD CONSTRAINT "escala_colaboradores_escala_id_fkey" FOREIGN KEY ("escala_id") REFERENCES "escalas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala_detalhe" ADD CONSTRAINT "escala_detalhe_escala_id_fkey" FOREIGN KEY ("escala_id") REFERENCES "escalas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantoes" ADD CONSTRAINT "plantoes_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantoes" ADD CONSTRAINT "plantoes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ferias" ADD CONSTRAINT "ferias_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

