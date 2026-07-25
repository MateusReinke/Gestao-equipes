#!/bin/sh
set -e

# prisma/seed.ts e seed.dev.ts vivem em /app/prisma (irmão de /app/backend, o
# cwd deste script). A resolução de módulos do Node sobe a árvore de
# diretórios a partir do arquivo requisitante, então nunca alcança
# /app/backend/node_modules por conta própria. NODE_PATH resolve isso sem
# depender de nenhuma camada de build/cache do Docker - é aplicado toda vez
# que este script roda.
export NODE_PATH="$(pwd)/node_modules"

echo "[backend] Generating Prisma client"
npx prisma generate --schema ../prisma/schema.prisma

echo "[backend] Running migrations"
npx prisma migrate deploy --schema ../prisma/schema.prisma

if [ "$SEED_ON_BOOT" = "true" ]; then
  echo "[backend] SEED_ON_BOOT=true - running seed (idempotent: only creates data if the admin user does not exist yet)"
  npm run seed
else
  echo "[backend] Skipping seed (set SEED_ON_BOOT=true to bootstrap an empty database automatically, or run 'npm run seed' manually)"
fi

echo "[backend] Starting app"
node dist/server.js
