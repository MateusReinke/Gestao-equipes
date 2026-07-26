-- Índices escolhidos por EXPLAIN ANALYZE sobre uma base com volume sintético
-- (500 mil linhas de auditoria, 220 mil turnos, 30 mil registros de férias
-- distribuídos entre duas empresas de tamanhos bem diferentes).

-- ---------- Auditoria: paginação por cursor ----------
-- A consulta é `WHERE tenant_id = ? [AND id < cursor] ORDER BY id DESC LIMIT n`.
-- Sem este índice o Postgres varre a PK de trás para frente e joga fora as
-- linhas dos outros tenants: numa empresa que responde por 1/40 dos registros,
-- eram ~1.900 linhas lidas para devolver 50. Com ele, o tenant entra no
-- Index Cond e a leitura é exatamente das 50 linhas pedidas.
CREATE INDEX "auditoria_tenant_id_id_idx" ON "auditoria"("tenant_id", "id" DESC);

-- ---------- Férias e ausências: períodos que cruzam a data de interesse ----------
-- A consulta é `tenant_id = ? AND status = 'aprovado' AND data_inicio <= fim
-- AND data_fim >= inicio`, e roda a cada carregamento de painel e a cada
-- geração de turnos.
--
-- A coluna que fecha o índice é `data_fim`, não `data_inicio`: é `data_fim >=`
-- que descarta todo o histórico já encerrado, que é a maior parte da tabela.
-- Com `data_inicio` o ganho era nulo (quase todo registro passado satisfaz
-- `data_inicio <=`); com `data_fim`, as linhas antigas nem são lidas.
CREATE INDEX "ferias_tenant_id_status_data_fim_idx" ON "ferias"("tenant_id", "status", "data_fim");
CREATE INDEX "ausencias_tenant_id_status_data_fim_idx" ON "ausencias"("tenant_id", "status", "data_fim");
