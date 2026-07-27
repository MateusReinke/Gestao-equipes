-- Alertas de férias para o RH, além dos gestores de equipe.
--
-- Até aqui a varredura só notificava os responsáveis pelas equipes envolvidas,
-- o que deixava de fora quem acompanha férias no nível da empresa. Notificar
-- por `hr.vacation.approve` não resolveria: essa permissão é de admin_tenant E
-- de gestor, então todo gestor passaria a receber alerta da empresa inteira —
-- exatamente o ruído que a varredura evita ao mirar por equipe.
--
-- Por isso a permissão é nova e separada: "pode aprovar férias" e "quer
-- acompanhar as férias de todo mundo" são coisas diferentes. Quem tem um papel
-- de RH customizado recebe pela tela de papéis; quem é exceção, por override
-- individual.

INSERT INTO "permissoes" ("codigo", "descricao", "categoria") VALUES
  ('hr.vacation.watch_all', 'Receber alertas de férias de toda a empresa (RH)', 'RH')
ON CONFLICT ("codigo") DO NOTHING;

-- Só o Administrador da Empresa por padrão. Gestor continua recebendo pelas
-- equipes sob sua responsabilidade, que é o alcance que lhe cabe.
INSERT INTO "papel_permissoes" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "papeis" r CROSS JOIN "permissoes" p
WHERE r."codigo" = 'admin_tenant' AND r."tenant_id" IS NULL
  AND p."codigo" = 'hr.vacation.watch_all'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
