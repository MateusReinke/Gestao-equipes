FROM node:22-alpine
WORKDIR /app

COPY backend/package*.json ./backend/
COPY prisma ./prisma
WORKDIR /app/backend
RUN npm install

COPY backend ./
RUN npm run build

EXPOSE 4000
CMD ["sh", "entrypoint.sh"]
