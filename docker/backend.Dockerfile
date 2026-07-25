FROM node:22-alpine AS build
ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}
WORKDIR /app

RUN apk add --no-cache openssl

COPY backend/package*.json ./backend/
COPY prisma ./prisma
WORKDIR /app/backend
RUN npm ci --include=dev
RUN npx prisma generate --schema ../prisma/schema.prisma

COPY backend ./
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN apk add --no-cache openssl

COPY backend/package*.json ./backend/
COPY prisma ./prisma
WORKDIR /app/backend
RUN npm ci --include=dev
RUN npx prisma generate --schema ../prisma/schema.prisma

# prisma/seed.ts vive em /app/prisma (irmão de /app/backend), fora da árvore de
# ancestrais de /app/backend/node_modules. O resolvedor de módulos do Node sobe
# a partir do arquivo requisitante (/app/prisma -> /app -> /), então este link
# em /app/node_modules é o que permite `tsx ../prisma/seed.ts` encontrar
# bcryptjs, @prisma/client etc. quando o entrypoint roda o seed.
RUN ln -sf /app/backend/node_modules /app/node_modules

COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 4000
CMD ["sh", "entrypoint.sh"]
