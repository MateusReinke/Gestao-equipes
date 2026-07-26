-- AlterTable: adiciona campos necessários para montar a escala de plantão
ALTER TABLE "colaboradores" ADD COLUMN "cargo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "colaboradores" ADD COLUMN "faz_plantao" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "colaboradores" ADD COLUMN "sobre_aviso" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "colaboradores" ALTER COLUMN "cargo" DROP DEFAULT;
