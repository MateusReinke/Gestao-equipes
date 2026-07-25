#!/bin/sh
set -e

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
