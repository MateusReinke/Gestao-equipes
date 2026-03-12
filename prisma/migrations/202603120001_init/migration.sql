-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('nacional', 'estadual', 'municipal', 'empresa');

CREATE TABLE "equipes" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "equipes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clientes" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "colaboradores" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "cargo" TEXT,
    "equipe_id" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "colaboradores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "turnos" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fim" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "turnos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feriados" (
    "id" SERIAL NOT NULL,
    "data" DATE NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" "HolidayType" NOT NULL,
    CONSTRAINT "feriados_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "escala" (
    "id" SERIAL NOT NULL,
    "data" DATE NOT NULL,
    "colaborador_id" INTEGER NOT NULL,
    "turno_id" INTEGER NOT NULL,
    "cliente_id" INTEGER,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "escala_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "plantao" (
    "id" SERIAL NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3) NOT NULL,
    "colaborador_id" INTEGER NOT NULL,
    "cliente_id" INTEGER,
    "descricao" TEXT,
    CONSTRAINT "plantao_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ferias" (
    "id" SERIAL NOT NULL,
    "colaborador_id" INTEGER NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "aprovado" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    CONSTRAINT "ferias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dias_semana_config" (
    "id" SERIAL NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "dias_semana_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "entidade" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "detalhes" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "colaboradores_email_key" ON "colaboradores"("email");
CREATE UNIQUE INDEX "turnos_nome_key" ON "turnos"("nome");
CREATE UNIQUE INDEX "feriados_data_descricao_key" ON "feriados"("data", "descricao");
CREATE UNIQUE INDEX "escala_data_colaborador_id_key" ON "escala"("data", "colaborador_id");
CREATE UNIQUE INDEX "dias_semana_config_dia_semana_key" ON "dias_semana_config"("dia_semana");

ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escala" ADD CONSTRAINT "escala_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escala" ADD CONSTRAINT "escala_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turnos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escala" ADD CONSTRAINT "escala_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "plantao" ADD CONSTRAINT "plantao_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plantao" ADD CONSTRAINT "plantao_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ferias" ADD CONSTRAINT "ferias_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
