-- Trava de concorrência da sincronização de diretório.
--
-- Até aqui, a única proteção contra execuções simultâneas era consultar se
-- havia uma execução com status 'executando' — o que tem uma janela de corrida
-- entre a consulta e a criação do registro. Com o agendador entrando em cena
-- (e podendo coincidir com o botão "Sincronizar agora", ou com uma segunda
-- instância do backend), a janela deixa de ser teórica.
--
-- A reivindicação passa a ser comparação-e-troca atômica: UPDATE ... WHERE
-- sincronizando_desde IS NULL. Quem afeta 1 linha ganhou; quem afeta 0 desiste.
--
-- Reivindicação antiga demais conta como abandonada, senão um processo morto
-- no meio de uma carga deixaria a conexão travada para sempre.

ALTER TABLE "diretorio_conexoes" ADD COLUMN "sincronizando_desde" TIMESTAMP(3);

-- Serve à varredura do agendador, que procura conexões ativas em todos os
-- tenants — é a única consulta do módulo que legitimamente cruza empresas,
-- porque o agendador é do deployment, não de uma delas.
CREATE INDEX "diretorio_conexoes_ativo_ultima_sincronizacao_em_idx"
  ON "diretorio_conexoes"("ativo", "ultima_sincronizacao_em");
