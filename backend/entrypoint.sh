#!/bin/sh
set -e

echo "[backend] Generating Prisma client"
npx prisma generate --schema ../prisma/schema.prisma

echo "[backend] Running migrations"
npx prisma migrate deploy --schema ../prisma/schema.prisma

echo "[backend] Running seed"
npm run seed

echo "[backend] Starting app"
node dist/server.js
