-- Create enums
CREATE TYPE "ShiftType" AS ENUM ('normal', 'plantao', 'sobreaviso');
CREATE TYPE "VacationStatus" AS ENUM ('pendente', 'aprovado', 'rejeitado');
CREATE TYPE "HolidayType" AS ENUM ('nacional', 'estadual', 'municipal', 'empresa');
CREATE TYPE "UserRole" AS ENUM ('admin', 'gestor', 'visualizador');

CREATE TABLE "equipes" (
  "id" SERIAL PRIMARY KEY,
  "nome" TEXT NOT NULL,
  "descricao" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "clientes" (
  "id" SERIAL PRIMARY KEY,
  "nome" TEXT NOT NULL,
  "descricao" TEXT,
  "contato" TEXT,
  "telefone" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "colaboradores" (
  "id" SERIAL PRIMARY KEY,
  "nome" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "telefone" TEXT,
  "cargo" TEXT,
  "equipe_id" INTEGER NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "turnos" (
  "id" SERIAL PRIMARY KEY,
  "nome" TEXT NOT NULL,
  "hora_inicio" TEXT NOT NULL,
  "hora_fim" TEXT NOT NULL,
  "descricao" TEXT,
  "tipo" "ShiftType" NOT NULL DEFAULT 'normal',
  "ativo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "escalas" (
  "id" SERIAL PRIMARY KEY,
  "data" DATE NOT NULL,
  "colaborador_id" INTEGER NOT NULL,
  "turno_id" INTEGER NOT NULL,
  "cliente_id" INTEGER,
  "observacao" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "plantao_periodos" (
  "id" SERIAL PRIMARY KEY,
  "data_inicio" TIMESTAMP(3) NOT NULL,
  "data_fim" TIMESTAMP(3) NOT NULL,
  "colaborador_id" INTEGER NOT NULL,
  "cliente_id" INTEGER,
  "descricao" TEXT
);

CREATE TABLE "ferias" (
  "id" SERIAL PRIMARY KEY,
  "colaborador_id" INTEGER NOT NULL,
  "data_inicio" DATE NOT NULL,
  "data_fim" DATE NOT NULL,
  "status" "VacationStatus" NOT NULL DEFAULT 'pendente',
  "observacao" TEXT
);

CREATE TABLE "feriados" (
  "id" SERIAL PRIMARY KEY,
  "data" DATE NOT NULL,
  "descricao" TEXT NOT NULL,
  "tipo" "HolidayType" NOT NULL
);

CREATE TABLE "usuarios" (
  "id" SERIAL PRIMARY KEY,
  "nome" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "senha_hash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'visualizador',
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "auditoria" (
  "id" SERIAL PRIMARY KEY,
  "usuario" TEXT NOT NULL,
  "acao" TEXT NOT NULL,
  "tabela" TEXT NOT NULL,
  "registro_id" TEXT,
  "dados_anteriores" JSONB,
  "dados_novos" JSONB,
  "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "colaboradores_email_key" ON "colaboradores"("email");
CREATE UNIQUE INDEX "turnos_nome_key" ON "turnos"("nome");
CREATE UNIQUE INDEX "escalas_data_colaborador_id_key" ON "escalas"("data", "colaborador_id");
CREATE UNIQUE INDEX "feriados_data_descricao_key" ON "feriados"("data", "descricao");
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escalas" ADD CONSTRAINT "escalas_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escalas" ADD CONSTRAINT "escalas_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turnos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escalas" ADD CONSTRAINT "escalas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "plantao_periodos" ADD CONSTRAINT "plantao_periodos_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plantao_periodos" ADD CONSTRAINT "plantao_periodos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ferias" ADD CONSTRAINT "ferias_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
