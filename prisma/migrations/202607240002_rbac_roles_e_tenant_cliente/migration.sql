-- AlterEnum: novos papéis para RBAC (RH, monitoramento, cliente)
ALTER TYPE "UserRole" ADD VALUE 'rh';
ALTER TYPE "UserRole" ADD VALUE 'monitoramento';
ALTER TYPE "UserRole" ADD VALUE 'cliente';

-- AlterTable: usuário com papel "cliente" fica vinculado a um tenant (Client)
ALTER TABLE "usuarios" ADD COLUMN "cliente_id" INTEGER;

ALTER TABLE "usuarios"
  ADD CONSTRAINT "usuarios_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
