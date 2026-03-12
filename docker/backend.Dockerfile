FROM node:22-alpine AS build
ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}
WORKDIR /app

COPY backend/package*.json ./backend/
COPY prisma ./prisma
WORKDIR /app/backend
RUN npm ci --include=dev

COPY backend ./
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY backend/package*.json ./backend/
COPY prisma ./prisma
WORKDIR /app/backend
RUN npm ci --include=dev

COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 4000
CMD ["sh", "entrypoint.sh"]
