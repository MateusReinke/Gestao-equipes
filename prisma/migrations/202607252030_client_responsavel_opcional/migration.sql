-- Cliente pode ser criado sem responsável interno definido; o responsável
-- pode ser atribuído depois. Se o colaborador responsável for removido,
-- o cliente só perde a referência (SET NULL) em vez de bloquear a remoção.
ALTER TABLE "clientes" ALTER COLUMN "responsavel_interno_id" DROP NOT NULL;

ALTER TABLE "clientes" DROP CONSTRAINT "clientes_responsavel_interno_id_fkey";
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_responsavel_interno_id_fkey" FOREIGN KEY ("responsavel_interno_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
