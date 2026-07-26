-- ============================================================
-- Fases 3, 6, 7 e 8: RBAC granular, turnos com trocas, RH e auditoria.
-- Aditiva e segura sobre base em produção: nada é apagado, e os papéis
-- existentes (admin/gestor) são migrados para o novo modelo de papéis.
-- ============================================================

-- ---------- Enums novos ----------
CREATE TYPE "ShiftType" AS ENUM ('turno', 'plantao', 'sobreaviso');
CREATE TYPE "ShiftStatus" AS ENUM ('planejado', 'confirmado', 'trocado', 'cancelado');
CREATE TYPE "SwapType" AS ENUM ('troca', 'cobertura');
CREATE TYPE "SwapStatus" AS ENUM ('pendente', 'aceito_pelo_par', 'aprovado', 'rejeitado', 'cancelado');
CREATE TYPE "AbsenceType" AS ENUM ('falta', 'atestado', 'licenca', 'folga', 'banco_horas', 'outro');
CREATE TYPE "AbsenceStatus" AS ENUM ('pendente', 'aprovado', 'rejeitado');
CREATE TYPE "PermissionEffect" AS ENUM ('grant', 'deny');
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete', 'login', 'login_failed', 'permission_change', 'swap_request', 'swap_response');

-- VacationStatus ganha 'cancelado'
ALTER TYPE "VacationStatus" ADD VALUE IF NOT EXISTS 'cancelado';

-- ---------- RBAC: permissões ----------
CREATE TABLE "permissoes" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,

    CONSTRAINT "permissoes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "permissoes_codigo_key" ON "permissoes"("codigo");
CREATE INDEX "permissoes_categoria_idx" ON "permissoes"("categoria");

INSERT INTO "permissoes" ("codigo", "descricao", "categoria") VALUES
  ('dashboard.view', 'Visualizar o dashboard operacional', 'Dashboard'),
  ('client.view', 'Visualizar clientes', 'Clientes'),
  ('client.create', 'Cadastrar clientes', 'Clientes'),
  ('client.edit', 'Editar clientes', 'Clientes'),
  ('client.delete', 'Remover clientes', 'Clientes'),
  ('team.view', 'Visualizar equipes', 'Equipes'),
  ('team.create', 'Criar equipes', 'Equipes'),
  ('team.edit', 'Editar equipes', 'Equipes'),
  ('team.delete', 'Remover equipes', 'Equipes'),
  ('collaborator.view', 'Visualizar colaboradores', 'Colaboradores'),
  ('collaborator.create', 'Cadastrar colaboradores', 'Colaboradores'),
  ('collaborator.edit', 'Editar colaboradores', 'Colaboradores'),
  ('collaborator.delete', 'Remover colaboradores', 'Colaboradores'),
  ('schedule.view', 'Visualizar escalas', 'Escalas'),
  ('schedule.create', 'Criar escalas', 'Escalas'),
  ('schedule.edit', 'Editar escalas', 'Escalas'),
  ('schedule.delete', 'Remover escalas', 'Escalas'),
  ('schedule.generate', 'Gerar turnos a partir de uma escala', 'Escalas'),
  ('shift.view', 'Visualizar turnos e plantões', 'Turnos'),
  ('shift.edit', 'Editar turnos manualmente', 'Turnos'),
  ('shift.request_swap', 'Solicitar troca de turno', 'Turnos'),
  ('shift.approve_swap', 'Aprovar ou rejeitar trocas de turno', 'Turnos'),
  ('hr.vacation.view', 'Visualizar férias', 'RH'),
  ('hr.vacation.request', 'Solicitar férias', 'RH'),
  ('hr.vacation.approve', 'Aprovar ou rejeitar férias', 'RH'),
  ('hr.absence.view', 'Visualizar ausências', 'RH'),
  ('hr.absence.manage', 'Registrar e responder ausências', 'RH'),
  ('user.view', 'Visualizar usuários do tenant', 'Usuários'),
  ('user.invite', 'Convidar novos usuários', 'Usuários'),
  ('user.edit', 'Editar usuários', 'Usuários'),
  ('user.manage_roles', 'Atribuir papéis e permissões', 'Usuários'),
  ('report.view', 'Visualizar relatórios', 'Relatórios'),
  ('report.export', 'Exportar relatórios', 'Relatórios'),
  ('role.manage', 'Administrar papéis do tenant', 'Administração'),
  ('tenant.settings.manage', 'Administrar configurações da empresa', 'Administração'),
  ('audit.view', 'Consultar a trilha de auditoria', 'Administração');

-- ---------- RBAC: papéis ----------
CREATE TABLE "papeis" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "papeis_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "papeis_tenant_id_codigo_key" ON "papeis"("tenant_id", "codigo");
CREATE INDEX "papeis_tenant_id_idx" ON "papeis"("tenant_id");
ALTER TABLE "papeis" ADD CONSTRAINT "papeis_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "papeis" ("tenant_id", "codigo", "nome", "descricao", "is_system", "ordem", "created_at", "updated_at") VALUES
  (NULL, 'admin_tenant', 'Administrador da Empresa', 'Controle total dentro da própria empresa: usuários, papéis, configurações e toda a operação.', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (NULL, 'gestor', 'Gestor', 'Gerencia equipes, colaboradores, clientes e escalas; aprova trocas, férias e ausências.', true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (NULL, 'lider', 'Líder', 'Acompanha a própria equipe: escalas, turnos, férias e ausências dos membros; aprova trocas.', true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (NULL, 'analista', 'Analista', 'Consulta informações operacionais e solicita trocas de turno e férias.', true, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (NULL, 'operador', 'Operador', 'Acesso operacional do dia a dia: enxerga a própria escala e solicita trocas.', true, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (NULL, 'cliente', 'Cliente', 'Enxerga apenas os dados relacionados a ele.', true, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (NULL, 'visitante', 'Visitante', 'Acesso extremamente limitado, apenas leitura do painel.', true, 70, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

CREATE TABLE "papel_permissoes" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    CONSTRAINT "papel_permissoes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "papel_permissoes_role_id_permission_id_key" ON "papel_permissoes"("role_id", "permission_id");
ALTER TABLE "papel_permissoes" ADD CONSTRAINT "papel_permissoes_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "papeis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "papel_permissoes" ADD CONSTRAINT "papel_permissoes_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Administrador da Empresa: todas as permissões
INSERT INTO "papel_permissoes" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "papeis" r CROSS JOIN "permissoes" p
WHERE r."codigo" = 'admin_tenant' AND r."tenant_id" IS NULL;

-- Gestor: tudo menos administração da empresa/papéis/auditoria
INSERT INTO "papel_permissoes" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "papeis" r CROSS JOIN "permissoes" p
WHERE r."codigo" = 'gestor' AND r."tenant_id" IS NULL
  AND p."codigo" NOT IN ('role.manage', 'tenant.settings.manage', 'audit.view', 'user.invite', 'user.edit', 'user.manage_roles');

-- Líder: leitura ampla + aprovar trocas da equipe
INSERT INTO "papel_permissoes" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "papeis" r CROSS JOIN "permissoes" p
WHERE r."codigo" = 'lider' AND r."tenant_id" IS NULL
  AND p."codigo" IN ('dashboard.view', 'client.view', 'team.view', 'collaborator.view', 'schedule.view',
                     'shift.view', 'shift.approve_swap', 'shift.request_swap',
                     'hr.vacation.view', 'hr.vacation.request', 'hr.absence.view', 'report.view');

-- Analista: consulta + solicita
INSERT INTO "papel_permissoes" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "papeis" r CROSS JOIN "permissoes" p
WHERE r."codigo" = 'analista' AND r."tenant_id" IS NULL
  AND p."codigo" IN ('dashboard.view', 'client.view', 'team.view', 'collaborator.view', 'schedule.view',
                     'shift.view', 'shift.request_swap', 'hr.vacation.view', 'hr.vacation.request',
                     'hr.absence.view', 'report.view');

-- Operador: operação do dia a dia
INSERT INTO "papel_permissoes" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "papeis" r CROSS JOIN "permissoes" p
WHERE r."codigo" = 'operador' AND r."tenant_id" IS NULL
  AND p."codigo" IN ('dashboard.view', 'schedule.view', 'shift.view', 'shift.request_swap', 'hr.vacation.request');

-- Cliente: visão restrita
INSERT INTO "papel_permissoes" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "papeis" r CROSS JOIN "permissoes" p
WHERE r."codigo" = 'cliente' AND r."tenant_id" IS NULL
  AND p."codigo" IN ('dashboard.view', 'shift.view');

-- Visitante: só o painel
INSERT INTO "papel_permissoes" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "papeis" r CROSS JOIN "permissoes" p
WHERE r."codigo" = 'visitante' AND r."tenant_id" IS NULL
  AND p."codigo" IN ('dashboard.view');

-- ---------- RBAC: overrides individuais ----------
CREATE TABLE "usuario_permissoes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,
    "efeito" "PermissionEffect" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_permissoes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "usuario_permissoes_user_id_tenant_id_permission_id_key" ON "usuario_permissoes"("user_id", "tenant_id", "permission_id");
CREATE INDEX "usuario_permissoes_tenant_id_idx" ON "usuario_permissoes"("tenant_id");
ALTER TABLE "usuario_permissoes" ADD CONSTRAINT "usuario_permissoes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usuario_permissoes" ADD CONSTRAINT "usuario_permissoes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "usuario_permissoes" ADD CONSTRAINT "usuario_permissoes_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- TenantMembership: enum de papel vira FK ----------
ALTER TABLE "tenant_memberships" ADD COLUMN "role_id" INTEGER;

UPDATE "tenant_memberships" tm
SET "role_id" = (SELECT r."id" FROM "papeis" r WHERE r."tenant_id" IS NULL AND r."codigo" = 'admin_tenant')
WHERE tm."role" = 'admin';

UPDATE "tenant_memberships" tm
SET "role_id" = (SELECT r."id" FROM "papeis" r WHERE r."tenant_id" IS NULL AND r."codigo" = 'gestor')
WHERE tm."role" = 'gestor';

-- Rede de segurança: qualquer vínculo sem papel resolvido vira Gestor.
UPDATE "tenant_memberships"
SET "role_id" = (SELECT r."id" FROM "papeis" r WHERE r."tenant_id" IS NULL AND r."codigo" = 'gestor')
WHERE "role_id" IS NULL;

ALTER TABLE "tenant_memberships" ALTER COLUMN "role_id" SET NOT NULL;
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "papeis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_memberships" DROP COLUMN "role";
DROP TYPE "UserRole";

-- ---------- Clientes: dados cadastrais completos ----------
ALTER TABLE "clientes" ADD COLUMN "razao_social" TEXT;
ALTER TABLE "clientes" ADD COLUMN "cnpj" TEXT;
ALTER TABLE "clientes" ADD COLUMN "telefone" TEXT;
ALTER TABLE "clientes" ADD COLUMN "site" TEXT;
ALTER TABLE "clientes" ADD COLUMN "cep" TEXT;
ALTER TABLE "clientes" ADD COLUMN "logradouro" TEXT;
ALTER TABLE "clientes" ADD COLUMN "numero" TEXT;
ALTER TABLE "clientes" ADD COLUMN "complemento" TEXT;
ALTER TABLE "clientes" ADD COLUMN "bairro" TEXT;
ALTER TABLE "clientes" ADD COLUMN "cidade" TEXT;
ALTER TABLE "clientes" ADD COLUMN "uf" TEXT;
ALTER TABLE "clientes" ADD COLUMN "sla_minutos" INTEGER;
ALTER TABLE "clientes" ADD COLUMN "observacoes" TEXT;

-- ---------- Escalas: posição na rotação ----------
ALTER TABLE "escala_colaboradores" ADD COLUMN "ordem" INTEGER NOT NULL DEFAULT 0;

-- escalas passam a apagar em cascata seus detalhes/atribuições/turnos
ALTER TABLE "escala_colaboradores" DROP CONSTRAINT "escala_colaboradores_escala_id_fkey";
ALTER TABLE "escala_colaboradores" ADD CONSTRAINT "escala_colaboradores_escala_id_fkey" FOREIGN KEY ("escala_id") REFERENCES "escalas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "escala_detalhe" DROP CONSTRAINT "escala_detalhe_escala_id_fkey";
ALTER TABLE "escala_detalhe" ADD CONSTRAINT "escala_detalhe_escala_id_fkey" FOREIGN KEY ("escala_id") REFERENCES "escalas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- Turnos ----------
CREATE TABLE "turnos" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "colaborador_id" INTEGER NOT NULL,
    "escala_id" INTEGER,
    "equipe_id" INTEGER,
    "cliente_id" INTEGER,
    "data" DATE NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fim" TEXT NOT NULL,
    "tipo" "ShiftType" NOT NULL DEFAULT 'turno',
    "status" "ShiftStatus" NOT NULL DEFAULT 'planejado',
    "observacao" TEXT,
    "colaborador_original_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turnos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "turnos_colaborador_id_data_hora_inicio_key" ON "turnos"("colaborador_id", "data", "hora_inicio");
CREATE INDEX "turnos_tenant_id_data_idx" ON "turnos"("tenant_id", "data");
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_colaborador_original_id_fkey" FOREIGN KEY ("colaborador_original_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_escala_id_fkey" FOREIGN KEY ("escala_id") REFERENCES "escalas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Plantões legados viram turnos, para a operação não perder histórico ao migrar
-- para o novo modelo (que é o que suporta troca entre colaboradores).
INSERT INTO "turnos" ("tenant_id", "colaborador_id", "cliente_id", "equipe_id", "data", "hora_inicio", "hora_fim", "tipo", "status", "created_at", "updated_at")
SELECT p."tenant_id", p."colaborador_id", p."cliente_id", c."equipe_id", p."data", p."hora_inicio", p."hora_fim",
       (CASE WHEN p."tipo" = 'sobreaviso' THEN 'sobreaviso' ELSE 'plantao' END)::"ShiftType",
       'planejado'::"ShiftStatus", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "plantoes" p
JOIN "colaboradores" c ON c."id" = p."colaborador_id"
ON CONFLICT ("colaborador_id", "data", "hora_inicio") DO NOTHING;

-- ---------- Trocas de turno ----------
CREATE TABLE "turno_trocas" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "tipo" "SwapType" NOT NULL DEFAULT 'troca',
    "solicitante_id" INTEGER NOT NULL,
    "destinatario_id" INTEGER NOT NULL,
    "turno_origem_id" INTEGER NOT NULL,
    "turno_destino_id" INTEGER,
    "motivo" TEXT NOT NULL,
    "status" "SwapStatus" NOT NULL DEFAULT 'pendente',
    "respondido_por_id" INTEGER,
    "respondido_em" TIMESTAMP(3),
    "observacao_resposta" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turno_trocas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "turno_trocas_tenant_id_status_idx" ON "turno_trocas"("tenant_id", "status");
ALTER TABLE "turno_trocas" ADD CONSTRAINT "turno_trocas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "turno_trocas" ADD CONSTRAINT "turno_trocas_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "turno_trocas" ADD CONSTRAINT "turno_trocas_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "turno_trocas" ADD CONSTRAINT "turno_trocas_turno_origem_id_fkey" FOREIGN KEY ("turno_origem_id") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "turno_trocas" ADD CONSTRAINT "turno_trocas_turno_destino_id_fkey" FOREIGN KEY ("turno_destino_id") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "turno_trocas" ADD CONSTRAINT "turno_trocas_respondido_por_id_fkey" FOREIGN KEY ("respondido_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- Férias: fluxo de solicitação/aprovação ----------
ALTER TABLE "ferias" ADD COLUMN "observacao" TEXT;
ALTER TABLE "ferias" ADD COLUMN "solicitado_por_id" INTEGER;
ALTER TABLE "ferias" ADD COLUMN "respondido_por_id" INTEGER;
ALTER TABLE "ferias" ADD COLUMN "respondido_em" TIMESTAMP(3);
ALTER TABLE "ferias" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- updated_at entra com default só para preencher as linhas existentes; o default
-- é removido logo em seguida porque quem mantém a coluna é o @updatedAt do Prisma.
ALTER TABLE "ferias" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ferias" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "ferias" ALTER COLUMN "status" SET DEFAULT 'pendente';
ALTER TABLE "ferias" ADD CONSTRAINT "ferias_solicitado_por_id_fkey" FOREIGN KEY ("solicitado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ferias" ADD CONSTRAINT "ferias_respondido_por_id_fkey" FOREIGN KEY ("respondido_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- Ausências ----------
CREATE TABLE "ausencias" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "colaborador_id" INTEGER NOT NULL,
    "tipo" "AbsenceType" NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "motivo" TEXT,
    "status" "AbsenceStatus" NOT NULL DEFAULT 'pendente',
    "respondido_por_id" INTEGER,
    "respondido_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ausencias_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ausencias_tenant_id_data_inicio_idx" ON "ausencias"("tenant_id", "data_inicio");
ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_respondido_por_id_fkey" FOREIGN KEY ("respondido_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- Auditoria ----------
CREATE TABLE "auditoria" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER,
    "actor_user_id" INTEGER,
    "actor_nome" TEXT NOT NULL,
    "acao" "AuditAction" NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT,
    "descricao" TEXT,
    "antes" JSONB,
    "depois" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "auditoria_tenant_id_created_at_idx" ON "auditoria"("tenant_id", "created_at");
CREATE INDEX "auditoria_entidade_entidade_id_idx" ON "auditoria"("entidade", "entidade_id");
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
